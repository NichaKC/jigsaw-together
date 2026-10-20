import { CONFIG, DIFFICULTIES } from './config.js';

const r4 = (n) => Math.round(n * 10000) / 10000;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function aspectRatio(key) {
  const [w, h] = key.split(':').map(Number);
  return h / w; // สูง/กว้าง
}

// เลือกจำนวนแถว/คอลัมน์ให้ชิ้นส่วนเป็นสี่เหลี่ยมใกล้เคียงจัตุรัสที่สุด
export function computeGrid(aspectKey, targetPieces) {
  const a = aspectRatio(aspectKey);
  const cols = Math.max(2, Math.round(Math.sqrt(targetPieces / a)));
  const rows = Math.max(2, Math.round(cols * a));
  return { rows, cols };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createGame(room) {
  const M = CONFIG.MARGIN;
  const a = aspectRatio(room.aspect);
  const { rows, cols } = computeGrid(room.aspect, DIFFICULTIES[room.difficulty].pieces);
  const pw = 1 / cols;
  const ph = a / rows;
  const W = 1 + 2 * M;
  const H = a + 2 * M;
  const snap = Math.min(pw, ph) * CONFIG.SNAP_RATIO;

  const pieces = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = M + col * pw;
      const ty = M + row * ph;
      let x, y, tries = 0;
      do {
        x = Math.random() * (W - pw);
        y = Math.random() * (H - ph);
        tries++;
      } while (Math.hypot(x - tx, y - ty) < snap * 2 && tries < 30);
      pieces.push({
        id: row * cols + col, row, col,
        x: r4(x), y: r4(y), z: 0,
        locked: false, heldBy: null, lockedBy: null,
      });
    }
  }
  shuffle(pieces.map((_, i) => i)).forEach((idx, order) => { pieces[idx].z = order + 1; });

  return {
    rows, cols, a, pw, ph, W, H, snap, pieces,
    zCounter: pieces.length,
    lockedCount: 0,
    startedAt: Date.now(),
    finishedAt: null,
    stats: {}, // playerId -> { name, color, count }
  };
}

export function publicGame(game) {
  return {
    rows: game.rows, cols: game.cols, a: game.a, margin: CONFIG.MARGIN,
    startedAt: game.startedAt, finishedAt: game.finishedAt,
    serverNow: Date.now(),
    stats: game.stats,
    pieces: game.pieces.map(({ id, x, y, z, locked, heldBy }) => ({ id, x, y, z, locked, heldBy })),
  };
}

export function grab(game, playerId, id) {
  const p = Number.isInteger(id) ? game.pieces[id] : null;
  if (!p || p.locked) return null;
  if (p.heldBy && p.heldBy !== playerId) return null;
  const released = [];
  for (const q of game.pieces) {
    if (q.heldBy === playerId && q.id !== id) { q.heldBy = null; released.push(q); }
  }
  p.heldBy = playerId;
  p.z = ++game.zCounter;
  return { piece: p, released };
}

export function move(game, playerId, id, x, y) {
  const p = Number.isInteger(id) ? game.pieces[id] : null;
  if (!p || p.heldBy !== playerId || !isNum(x) || !isNum(y)) return null;
  p.x = clamp(x, 0, game.W - game.pw);
  p.y = clamp(y, 0, game.H - game.ph);
  return p;
}

export function drop(game, player, id, x, y) {
  const p = Number.isInteger(id) ? game.pieces[id] : null;
  if (!p || p.heldBy !== player.id) return null;
  if (isNum(x) && isNum(y)) {
    p.x = clamp(x, 0, game.W - game.pw);
    p.y = clamp(y, 0, game.H - game.ph);
  }
  p.heldBy = null;

  const tx = CONFIG.MARGIN + p.col * game.pw;
  const ty = CONFIG.MARGIN + p.row * game.ph;
  let stat = null;
  if (Math.hypot(p.x - tx, p.y - ty) <= game.snap) {
    p.x = tx; p.y = ty;
    p.locked = true; p.lockedBy = player.id;
    game.lockedCount++;
    const s = (game.stats[player.id] ||= { name: player.name, color: player.color, count: 0 });
    s.count++;
    stat = s;
  }
  return { piece: p, stat, complete: game.lockedCount === game.pieces.length };
}

export const roundPos = r4;
