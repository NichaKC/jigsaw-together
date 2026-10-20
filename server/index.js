import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import { ASPECTS, CONFIG, DIFFICULTIES } from './config.js';
import { createGame, drop, grab, move, publicGame, roundPos } from './game.js';
import { addPlayer, cleanName, createRoom, publicRoom, rooms } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------------------------------- HTTP ---------------------------------- */

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  next();
});

app.get('/healthz', (_req, res) => res.send('ok'));

// รูปจิ๊กซอของห้อง (ต้องรู้ PIN ถึงจะดึงได้) version เปลี่ยนทุกครั้งที่อัปโหลดใหม่
app.get('/api/rooms/:pin/image', (req, res) => {
  const room = rooms.get(req.params.pin);
  if (!room?.image) return res.sendStatus(404);
  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  res.send(room.image.buffer);
});

// โปรดักชัน: เสิร์ฟหน้าเว็บที่ build แล้ว (client/dist) จากเซิร์ฟเวอร์เดียวกัน
const dist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.use((req, res, next) =>
    req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next(),
  );
}

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: CONFIG.MAX_IMAGE_BYTES + 64 * 1024,
  cors: process.env.CLIENT_ORIGIN
    ? { origin: process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) }
    : undefined,
});

/* --------------------------- กันเดา PIN (rate limit) -------------------------- */

const failures = new Map(); // ip -> { count, resetAt }

function clientIp(socket) {
  // หลัง proxy (Render/Railway) ใช้ x-forwarded-for; ถ้าไม่ได้อยู่หลัง proxy ค่านี้ปลอมได้
  const xf = socket.handshake.headers['x-forwarded-for'];
  return (typeof xf === 'string' ? xf.split(',')[0].trim() : socket.handshake.address) || 'unknown';
}
const isBlocked = (ip) => {
  const e = failures.get(ip);
  return !!e && e.resetAt > Date.now() && e.count >= 8;
};
function noteFailure(ip) {
  const now = Date.now();
  let e = failures.get(ip);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + 60_000 };
    failures.set(ip, e);
  }
  e.count++;
}

/* --------------------------------- helpers -------------------------------- */

const err = (code) => ({ ok: false, code });
const isJpeg = (buf) => buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

function ctxOf(socket) {
  const room = rooms.get(socket.data.pin);
  const player = room?.players.find((p) => p.id === socket.data.playerId);
  return room && player ? { room, player } : null;
}

const broadcastRoom = (room) => io.to(room.pin).emit('room:state', publicRoom(room));

function resultOf(room) {
  const g = room.game;
  return {
    startedAt: g.startedAt,
    finishedAt: g.finishedAt,
    durationMs: g.finishedAt - g.startedAt,
    stats: g.stats,
  };
}

function snapshot(room, player) {
  return {
    ok: true,
    me: player.id,
    room: publicRoom(room),
    game: room.game ? publicGame(room.game) : null,
    result: room.game?.finishedAt ? resultOf(room) : null,
  };
}

function attach(socket, room, player) {
  clearTimeout(player.timer);
  player.timer = null;
  player.socketId = socket.id;
  player.connected = true;
  socket.data.pin = room.pin;
  socket.data.playerId = player.id;
  socket.join(room.pin);
  room.lastActivity = Date.now();
}

function emitDropped(room, piece, by = null) {
  io.to(room.pin).emit('piece:dropped', {
    id: piece.id, x: piece.x, y: piece.y, locked: piece.locked, by,
  });
}

function releaseHeld(room, player) {
  if (!room.game) return;
  for (const p of room.game.pieces) {
    if (p.heldBy === player.id) {
      p.heldBy = null;
      emitDropped(room, p);
    }
  }
}

// เอาผู้เล่นออกจากห้องจริงๆ (กดออกเอง / ถูกเตะ / หมดเวลารอรีคอนเนกต์)
function dropPlayer(room, player) {
  clearTimeout(player.timer);
  releaseHeld(room, player);
  room.players = room.players.filter((p) => p.id !== player.id);

  const sock = io.sockets.sockets.get(player.socketId);
  if (sock && sock.data.playerId === player.id) {
    sock.leave(room.pin);
    sock.data = {};
  }

  if (room.players.length === 0) {
    rooms.delete(room.pin);
    return;
  }
  if (room.hostId === player.id) {
    // โอนหัวหน้าห้องให้คนที่เข้าก่อนถัดไป (เลือกคนที่ยังออนไลน์ก่อน)
    room.hostId = (room.players.find((p) => p.connected) ?? room.players[0]).id;
  }
  room.lastActivity = Date.now();
  broadcastRoom(room);
}

// ลงทะเบียน handler: รับ payload เป็น object เสมอ และมี ack ให้เรียกได้เสมอ
function on(socket, event, fn) {
  socket.on(event, (...args) => {
    const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    const payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
    const ack = (res) => cb?.(res);
    try {
      fn(payload, ack);
    } catch (e) {
      console.error(`[${event}]`, e);
      ack(err('SERVER_ERROR'));
    }
  });
}

/* --------------------------------- sockets -------------------------------- */

io.on('connection', (socket) => {
  socket.data = {};
  const imageUploadAt = { t: 0 };

  /* ---- สร้าง / เข้า / ออก ---- */

  on(socket, 'room:create', ({ name, clientId }, ack) => {
    const ip = clientIp(socket);
    const cleaned = cleanName(name);
    if (!cleaned) return ack(err('BAD_NAME'));
    if (typeof clientId !== 'string' || clientId.length < 8 || clientId.length > 64) return ack(err('BAD_INPUT'));
    if (socket.data.pin) return ack(err('ALREADY_IN_ROOM'));
    if (isBlocked(ip)) return ack(err('RATE_LIMIT'));

    const room = createRoom();
    const player = addPlayer(room, { clientId, socketId: socket.id, name: cleaned });
    attach(socket, room, player);
    ack(snapshot(room, player));
  });

  on(socket, 'room:join', ({ pin, name, clientId }, ack) => {
    const ip = clientIp(socket);
    const cleaned = cleanName(name);
    if (!cleaned) return ack(err('BAD_NAME'));
    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) return ack(err('BAD_PIN'));
    if (typeof clientId !== 'string' || clientId.length < 8 || clientId.length > 64) return ack(err('BAD_INPUT'));
    if (socket.data.pin) return ack(err('ALREADY_IN_ROOM'));
    if (isBlocked(ip)) return ack(err('RATE_LIMIT'));

    const room = rooms.get(pin);
    if (!room) {
      noteFailure(ip);
      return ack(err('NOT_FOUND'));
    }
    if (room.phase !== 'lobby') return ack(err('STARTED'));
    if (room.players.length >= room.maxPlayers) return ack(err('FULL'));

    const player = addPlayer(room, { clientId, socketId: socket.id, name: cleaned });
    attach(socket, room, player);
    socket.to(room.pin).emit('room:state', publicRoom(room));
    ack(snapshot(room, player));
  });

  // เชื่อมต่อใหม่หลังหลุด/รีเฟรช: พิสูจน์ตัวตนด้วย clientId (ความลับของแต่ละแท็บ)
  on(socket, 'room:rejoin', ({ pin, clientId }, ack) => {
    const ip = clientIp(socket);
    if (isBlocked(ip)) return ack(err('RATE_LIMIT'));
    const room = typeof pin === 'string' ? rooms.get(pin) : null;
    const player = room?.players.find((p) => p.clientId === clientId);
    if (!room || !player) {
      noteFailure(ip);
      return ack(err('NOT_FOUND'));
    }
    const previous = io.sockets.sockets.get(player.socketId);
    attach(socket, room, player);
    if (previous && previous.id !== socket.id) {
      previous.leave(room.pin);
      previous.data = {};
    }
    broadcastRoom(room);
    ack(snapshot(room, player));
  });

  on(socket, 'room:leave', (_p, ack) => {
    const c = ctxOf(socket);
    if (c) dropPlayer(c.room, c.player);
    socket.data = {};
    ack({ ok: true });
  });

  on(socket, 'room:kick', ({ playerId }, ack) => {
    const c = ctxOf(socket);
    if (!c) return ack(err('NO_ROOM'));
    const { room, player } = c;
    if (room.hostId !== player.id) return ack(err('NOT_HOST'));
    if (room.phase !== 'lobby') return ack(err('BAD_PHASE'));
    const target = room.players.find((p) => p.id === playerId);
    if (!target || target.id === player.id) return ack(err('BAD_INPUT'));

    io.to(target.socketId).emit('room:kicked');
    dropPlayer(room, target);
    ack({ ok: true });
  });

  /* ---- ตั้งค่าห้อง / รูป ---- */

  on(socket, 'room:settings', (p, ack) => {
    const c = ctxOf(socket);
    if (!c) return ack(err('NO_ROOM'));
    const { room, player } = c;
    if (room.hostId !== player.id) return ack(err('NOT_HOST'));
    if (room.phase !== 'lobby') return ack(err('BAD_PHASE'));

    if (p.maxPlayers !== undefined) {
      const n = p.maxPlayers;
      if (!Number.isInteger(n) || n < 2 || n > CONFIG.MAX_PLAYERS_LIMIT) return ack(err('BAD_INPUT'));
      if (n < room.players.length) return ack(err('BELOW_CURRENT'));
      room.maxPlayers = n;
    }
    if (p.difficulty !== undefined) {
      if (typeof p.difficulty !== 'string' || !Object.hasOwn(DIFFICULTIES, p.difficulty)) return ack(err('BAD_INPUT'));
      room.difficulty = p.difficulty;
    }
    room.lastActivity = Date.now();
    broadcastRoom(room);
    ack({ ok: true });
  });

  // ใครใน lobby ก็แนบรูปได้ (รูปล่าสุดแทนรูปเดิม) — client ครอปเป็น JPEG ตามสัดส่วนมาให้แล้ว
  on(socket, 'room:image', ({ aspect, data }, ack) => {
    const c = ctxOf(socket);
    if (!c) return ack(err('NO_ROOM'));
    const { room, player } = c;
    if (room.phase !== 'lobby') return ack(err('BAD_PHASE'));
    if (!ASPECTS.includes(aspect)) return ack(err('BAD_INPUT'));

    const now = Date.now();
    if (now - imageUploadAt.t < 800) return ack(err('RATE_LIMIT'));
    imageUploadAt.t = now;

    const buffer = Buffer.isBuffer(data) ? data : data instanceof ArrayBuffer ? Buffer.from(data) : null;
    if (!buffer || buffer.length === 0 || buffer.length > CONFIG.MAX_IMAGE_BYTES || !isJpeg(buffer)) {
      return ack(err('BAD_IMAGE'));
    }
    room.aspect = aspect;
    room.image = { buffer, version: crypto.randomBytes(4).toString('hex'), by: player.name };
    room.lastActivity = now;
    broadcastRoom(room);
    ack({ ok: true });
  });

  /* ---- เริ่มเกม ---- */

  on(socket, 'game:start', (_p, ack) => {
    const c = ctxOf(socket);
    if (!c) return ack(err('NO_ROOM'));
    const { room, player } = c;
    if (room.hostId !== player.id) return ack(err('NOT_HOST'));
    if (room.phase !== 'lobby') return ack(err('BAD_PHASE'));
    if (!room.image || !room.aspect) return ack(err('NO_IMAGE'));
    if (room.players.filter((p) => p.connected).length < CONFIG.MIN_PLAYERS_TO_START) {
      return ack(err('NOT_ENOUGH_PLAYERS'));
    }
    room.game = createGame(room);
    room.phase = 'playing';
    room.lastActivity = Date.now();
    io.to(room.pin).emit('game:started', { room: publicRoom(room), game: publicGame(room.game) });
    ack({ ok: true });
  });

  /* ---- ในเกม: เซิร์ฟเวอร์เป็นผู้ตัดสินตำแหน่งและการล็อกชิ้นส่วน ---- */

  const inGame = () => {
    const c = ctxOf(socket);
    return c && c.room.phase === 'playing' && c.room.game ? c : null;
  };

  on(socket, 'piece:grab', ({ id }) => {
    const c = inGame();
    if (!c) return;
    const { room, player } = c;
    const res = grab(room.game, player.id, id);
    if (!res) return socket.emit('piece:denied', { id });
    for (const q of res.released) emitDropped(room, q);
    io.to(room.pin).emit('piece:grabbed', { id: res.piece.id, by: player.id, z: res.piece.z });
    room.lastActivity = Date.now();
  });

  on(socket, 'piece:move', ({ id, x, y }) => {
    const c = inGame();
    if (!c) return;
    const p = move(c.room.game, c.player.id, id, x, y);
    if (p) socket.to(c.room.pin).volatile.emit('piece:moved', { id: p.id, x: roundPos(p.x), y: roundPos(p.y) });
  });

  on(socket, 'piece:drop', ({ id, x, y }) => {
    const c = inGame();
    if (!c) return;
    const { room, player } = c;
    const res = drop(room.game, player, id, x, y);
    if (!res) return;
    const p = res.piece;
    io.to(room.pin).emit('piece:dropped', {
      id: p.id, x: roundPos(p.x), y: roundPos(p.y),
      locked: p.locked, by: player.id, stat: res.stat,
    });
    room.lastActivity = Date.now();

    if (res.complete) {
      room.game.finishedAt = Date.now();
      room.phase = 'finished';
      io.to(room.pin).emit('game:complete', { room: publicRoom(room), result: resultOf(room) });
    }
  });

  /* ---- หลุดการเชื่อมต่อ: เก็บที่นั่งไว้ชั่วคราว ---- */

  socket.on('disconnect', () => {
    const c = ctxOf(socket);
    if (!c || c.player.socketId !== socket.id) return; // socket เก่าที่ถูกแทนที่แล้ว
    const { room, player } = c;
    player.connected = false;
    releaseHeld(room, player);
    broadcastRoom(room);
    const grace = room.phase === 'lobby' ? CONFIG.GRACE_LOBBY_MS : CONFIG.GRACE_PLAYING_MS;
    player.timer = setTimeout(() => dropPlayer(room, player), grace);
  });
});

/* ------------------------------- งานเก็บกวาด ------------------------------- */

setInterval(() => {
  const now = Date.now();
  for (const [pin, room] of rooms) {
    if (now - room.lastActivity > CONFIG.ROOM_IDLE_TTL_MS && !room.players.some((p) => p.connected)) {
      room.players.forEach((p) => clearTimeout(p.timer));
      rooms.delete(pin);
    }
  }
  for (const [ip, e] of failures) if (e.resetAt <= now) failures.delete(ip);
}, 60_000).unref();

server.listen(CONFIG.PORT, () => {
  console.log(`Jigsaw server listening on http://localhost:${CONFIG.PORT}`);
});
