// สถานะเกมที่เปลี่ยนถี่ (ตำแหน่งชิ้นส่วน) เก็บนอก React เพื่อไม่ให้ re-render ทุกครั้งที่ลาก
// socket event เขียนที่นี่ตั้งแต่เริ่มเกม ส่วน canvas อ่านทุกเฟรม จึงไม่พลาด event ช่วงที่คอมโพเนนต์ยังไม่ mount
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
      dx: p.x, // ตำแหน่งที่วาดจริง (ค่อยๆ เลื่อนเข้าหา x,y เพื่อให้ชิ้นของอีกคนขยับลื่น)
      dy: p.y,
    })),
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    offset: s.serverNow - Date.now(), // ชดเชยนาฬิกาเครื่องกับเซิร์ฟเวอร์
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
  if (g.localDragId === id) return; // กำลังลากชิ้นนี้อยู่เอง ไม่ให้เหตุการณ์จากเซิร์ฟเวอร์มาแย่งตำแหน่ง
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
