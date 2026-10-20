// Fast-changing game state (piece positions) lives outside React so dragging doesn't re-render the UI.
// Socket events write here from the moment the game starts and the canvas reads it every frame,
// so no event is lost while the Game component is still mounting.
export const store = { g: null };

export const clearGame = () => {
  store.g = null;
};

export function initGame(s) {
  const pw = 1 / s.cols;
  const ph = s.a / s.rows;
  store.g = {
    rows: s.rows, cols: s.cols, a: s.a, margin: s.margin, pw, ph,
    W: 1 + 2 * s.margin, H: s.a + 2 * s.margin,
    pieces: s.pieces.map((p) => ({
      ...p,
      row: Math.floor(p.id / s.cols),
      col: p.id % s.cols,
      dx: p.x, // drawn position (eases toward x,y so other players' pieces move smoothly)
      dy: p.y,
    })),
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    offset: s.serverNow - Date.now(), // offset between this device's clock and the server's
    stats: { ...s.stats },
    lockedCount: s.pieces.filter((p) => p.locked).length,
    flashes: [],
    localDragId: null,
    deniedId: null,
  };
}

export const targetOf = (g, p) => ({ x: g.margin + p.col * g.pw, y: g.margin + p.row * g.ph });

export function applyGrab({ id, by, z }) {
  const p = store.g?.pieces[id];
  if (!p) return;
  p.heldBy = by;
  p.z = z;
}

export function applyMove({ id, x, y }) {
  const g = store.g;
  const p = g?.pieces[id];
  if (!p || g.localDragId === id) return;
  p.x = x;
  p.y = y;
}

export function applyDrop({ id, x, y, locked, by, stat }) {
  const g = store.g;
  const p = g?.pieces[id];
  if (!p) return;
  p.heldBy = null;
  if (g.localDragId === id) return; // we're dragging this piece ourselves; don't let server events fight our position
  p.x = x;
  p.y = y;
  if (locked && !p.locked) markLocked(g, p, by, stat);
}

function markLocked(g, p, by, stat) {
  p.locked = true;
  g.lockedCount++;
  g.flashes.push({ id: p.id, by, t0: performance.now() });
  if (stat && by) g.stats[by] = { ...stat };
}

export function applyDenied({ id }) {
  if (store.g) store.g.deniedId = id;
}

export function applyFinish(finishedAt) {
  if (store.g) store.g.finishedAt = finishedAt;
}
