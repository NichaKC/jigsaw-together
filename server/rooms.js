import crypto from 'node:crypto';
import { CONFIG, DIFFICULTIES, PLAYER_COLORS } from './config.js';
import { computeGrid } from './game.js';

export const rooms = new Map(); // pin -> room (kept in memory)

export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(s).slice(0, CONFIG.NAME_MAX).join('');
}

function newPin() {
  for (;;) {
    const pin = String(crypto.randomInt(0, 10 ** CONFIG.PIN_LENGTH)).padStart(CONFIG.PIN_LENGTH, '0');
    if (!rooms.has(pin)) return pin;
  }
}

export function createRoom() {
  const room = {
    pin: newPin(),
    phase: 'lobby', // lobby | playing | finished
    hostId: null,
    maxPlayers: CONFIG.DEFAULT_MAX_PLAYERS,
    difficulty: 'normal',
    aspect: null,
    image: null, // { buffer, version, by }
    players: [],
    game: null,
    lastActivity: Date.now(),
  };
  rooms.set(room.pin, room);
  return room;
}

function uniqueName(room, name) {
  const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function addPlayer(room, { clientId, socketId, name }) {
  const used = new Set(room.players.map((p) => p.color));
  const free = PLAYER_COLORS.filter((c) => !used.has(c));
  const player = {
    id: crypto.randomBytes(6).toString('hex'), // public id (safe to share with other players)
    clientId, // secret: proves identity on reconnect, never sent to clients
    socketId,
    name: uniqueName(room, name),
    color: free[crypto.randomInt(free.length)],
    connected: true,
    timer: null,
  };
  room.players.push(player);
  if (!room.hostId) room.hostId = player.id;
  return player;
}

export function publicRoom(room) {
  return {
    pin: room.pin,
    phase: room.phase,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    minPlayers: CONFIG.MIN_PLAYERS_TO_START,
    difficulty: room.difficulty,
    aspect: room.aspect,
    grid: room.aspect ? computeGrid(room.aspect, DIFFICULTIES[room.difficulty].pieces) : null,
    image: room.image ? { version: room.image.version, by: room.image.by } : null,
    players: room.players.map(({ id, name, color, connected }) => ({ id, name, color, connected })),
  };
}
