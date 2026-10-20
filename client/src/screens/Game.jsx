import { useEffect, useMemo, useRef, useState } from 'react';
import Confetti from '../components/Confetti.jsx';
import { serverUrl, socket } from '../socket.js';
import { store, targetOf } from '../gameStore.js';

const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export default function Game({ room, me, result, onLeave }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const live = useRef({}); // ค่าล่าสุดที่ลูป canvas ต้องใช้ (ไม่ต้องสร้างลูปใหม่ทุกครั้งที่ props เปลี่ยน)
  const [, setTick] = useState(0);
  const [showFull, setShowFull] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const finished = room.phase === 'finished';
  const players = useMemo(() => Object.fromEntries(room.players.map((p) => [p.id, p])), [room.players]);
  live.current = { me, players, finished, showFull };

  // โหลดรูปจิ๊กซอจากเซิร์ฟเวอร์
  useEffect(() => {
    if (!room.image) return undefined;
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = serverUrl(`/api/rooms/${room.pin}/image?v=${room.image.version}`);
    return () => { img.onload = null; };
  }, [room.pin, room.image?.version]);

  // ตัวเลขใน HUD อัปเดตทุกครึ่งวินาที
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  // ปิดการเลื่อน/ดึงรีเฟรชของหน้าเว็บระหว่างเล่น
  useEffect(() => {
    document.body.classList.add('in-game');
    return () => document.body.classList.remove('in-game');
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
    let drag = null;
    let raf = 0;

    const layout = () => {
      const r = wrap.getBoundingClientRect();
      view.dpr = Math.min(window.devicePixelRatio || 1, 2);
      view.w = r.width;
      view.h = r.height;
      canvas.width = Math.round(r.width * view.dpr);
      canvas.height = Math.round(r.height * view.dpr);
      const g = store.g;
      if (g) {
        const pad = 10;
        view.scale = Math.min((r.width - pad * 2) / g.W, (r.height - pad * 2) / g.H);
        view.ox = (r.width - g.W * view.scale) / 2;
        view.oy = (r.height - g.H * view.scale) / 2;
      }
    };
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    layout();

    const toWorld = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left - view.ox) / view.scale, y: (clientY - r.top - view.oy) / view.scale };
    };

    // ชิ้นบนสุดที่จับได้ ณ ตำแหน่งนั้น (ล็อกแล้ว หรือมีคนอื่นถืออยู่ = จับไม่ได้)
    const hitTest = (x, y) => {
      const g = store.g;
      if (!g) return null;
      let best = null;
      for (const p of g.pieces) {
        if (p.locked || (p.heldBy && p.heldBy !== live.current.me)) continue;
        if (x >= p.dx && x <= p.dx + g.pw && y >= p.dy && y <= p.dy + g.ph && (!best || p.z > best.z)) best = p;
      }
      return best;
    };

    const onDown = (e) => {
      const g = store.g;
      if (!g || drag || live.current.finished || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const w = toWorld(e.clientX, e.clientY);
      const p = hitTest(w.x, w.y);
      if (!p) return;
      canvas.setPointerCapture(e.pointerId);
      drag = { id: p.id, offX: w.x - p.dx, offY: w.y - p.dy, pointerId: e.pointerId, lastSent: 0 };
      g.localDragId = p.id;
      g.deniedId = null;
      p.heldBy = live.current.me; // แสดงผลทันที ถ้าเซิร์ฟเวอร์ปฏิเสธค่อยยกเลิก
      p.z = Math.max(...g.pieces.map((q) => q.z)) + 1;
      canvas.style.cursor = 'grabbing';
      socket.emit('piece:grab', { id: p.id });
      e.preventDefault();
    };

    const onMove = (e) => {
      const g = store.g;
      if (!g) return;
      const w = toWorld(e.clientX, e.clientY);
      if (!drag) {
        if (e.pointerType === 'mouse' && !live.current.finished) {
          canvas.style.cursor = hitTest(w.x, w.y) ? 'grab' : 'default';
        }
        return;
      }
      if (e.pointerId !== drag.pointerId) return;
      const p = g.pieces[drag.id];
      p.x = p.dx = clamp(w.x - drag.offX, 0, g.W - g.pw);
      p.y = p.dy = clamp(w.y - drag.offY, 0, g.H - g.ph);
      const now = performance.now();
      if (now - drag.lastSent >= 33) { // ส่งไม่เกินประมาณ 30 ครั้ง/วินาที
        drag.lastSent = now;
        socket.volatile.emit('piece:move', { id: p.id, x: p.x, y: p.y });
      }
    };

    const endDrag = (e) => {
      const g = store.g;
      if (!drag || !g || e.pointerId !== drag.pointerId) return;
      const p = g.pieces[drag.id];
      g.localDragId = null;
      canvas.style.cursor = 'default';
      if (p.heldBy === live.current.me) {
        p.heldBy = null;
        socket.emit('piece:drop', { id: p.id, x: p.x, y: p.y });
      }
      drag = null;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    /* ------------------------------ วาดภาพทุกเฟรม ------------------------------ */

    const draw = (now) => {
      const g = store.g;
      const { me: myId, players: byId, finished: done, showFull: full } = live.current;
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.clearRect(0, 0, view.w, view.h);
      if (!g) return;
      if (!view.scale || view.scale < 0) layout();

      // ชิ้นที่ถูกปฏิเสธ (มีคนจับตัดหน้า) → ยกเลิกการลากของเรา
      if (drag && g.deniedId === drag.id) {
        const p = g.pieces[drag.id];
        if (p.heldBy === myId) p.heldBy = null;
        g.localDragId = null;
        g.deniedId = null;
        drag = null;
      }

      ctx.save();
      ctx.translate(view.ox, view.oy);
      ctx.scale(view.scale, view.scale);
      const px = 1 / view.scale; // 1 พิกเซลหน้าจอ เป็นหน่วยโลก
      const img = imgRef.current;
      const M = g.margin;

      // โต๊ะ + กระดานจิ๊กซอ
      ctx.fillStyle = '#F6F7FD';
      roundedRectPath(ctx, 0, 0, g.W, g.H, 14 * px);
      ctx.fill();
      ctx.fillStyle = '#E2E7F7';
      ctx.fillRect(M, M, 1, g.a);
      if (img) {
        ctx.globalAlpha = full ? 0.6 : 0.1;
        ctx.drawImage(img, M, M, 1, g.a);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(29,33,80,0.12)';
      ctx.lineWidth = px;
      for (let c = 0; c <= g.cols; c++) { ctx.beginPath(); ctx.moveTo(M + c * g.pw, M); ctx.lineTo(M + c * g.pw, M + g.a); ctx.stroke(); }
      for (let r = 0; r <= g.rows; r++) { ctx.beginPath(); ctx.moveTo(M, M + r * g.ph); ctx.lineTo(M + 1, M + r * g.ph); ctx.stroke(); }

      // เลื่อนตำแหน่งที่วาดเข้าหาตำแหน่งจริง (ชิ้นของอีกคนจึงขยับลื่น)
      for (const p of g.pieces) {
        if (g.localDragId === p.id) { p.dx = p.x; p.dy = p.y; continue; }
        p.dx += (p.x - p.dx) * 0.35;
        p.dy += (p.y - p.dy) * 0.35;
        if (Math.abs(p.x - p.dx) < 0.0004) p.dx = p.x;
        if (Math.abs(p.y - p.dy) < 0.0004) p.dy = p.y;
      }

      const sw = img ? img.naturalWidth / g.cols : 0;
      const sh = img ? img.naturalHeight / g.rows : 0;
      const paint = (p, bleed = 0) => {
        if (img) ctx.drawImage(img, p.col * sw, p.row * sh, sw, sh, p.dx - bleed, p.dy - bleed, g.pw + bleed * 2, g.ph + bleed * 2);
        else { ctx.fillStyle = '#C9D0EE'; ctx.fillRect(p.dx, p.dy, g.pw, g.ph); }
      };

      if (done && img) {
        ctx.drawImage(img, M, M, 1, g.a); // จบแล้ว: โชว์ภาพเต็มไม่มีรอยต่อ
      } else {
        for (const p of g.pieces) if (p.locked) paint(p, 0.5 * px);
      }

      const loose = g.pieces.filter((p) => !p.locked).sort((a, b) => a.z - b.z);
      for (const p of loose) {
        const holder = p.heldBy ? byId[p.heldBy] : null;
        ctx.save();
        if (holder) {
          ctx.shadowColor = holder.color;
          ctx.shadowBlur = 16 * view.dpr;
        } else {
          ctx.shadowColor = 'rgba(29,33,80,0.35)';
          ctx.shadowBlur = 4 * view.dpr;
          ctx.shadowOffsetY = 1.5 * view.dpr;
        }
        paint(p);
        ctx.restore();

        // ขอบสีของคนที่จับอยู่ (ทุกคนเห็นตรงกัน)
        ctx.lineJoin = 'round';
        if (holder) {
          ctx.strokeStyle = holder.color;
          ctx.lineWidth = 4 * px;
          ctx.strokeRect(p.dx, p.dy, g.pw, g.ph);
        } else {
          ctx.strokeStyle = 'rgba(29,33,80,0.4)';
          ctx.lineWidth = 1.2 * px;
          ctx.strokeRect(p.dx, p.dy, g.pw, g.ph);
        }

        // ป้ายชื่อบนชิ้นที่เพื่อนกำลังถือ
        if (holder && holder.id !== myId) {
          const fs = 12 * px;
          ctx.font = `600 ${fs}px "IBM Plex Sans Thai", system-ui, sans-serif`;
          const tw = ctx.measureText(holder.name).width;
          const bw = tw + 12 * px;
          const bh = 19 * px;
          const bx = clamp(p.dx + g.pw / 2 - bw / 2, 0, g.W - bw);
          const by = Math.max(0, p.dy - bh - 4 * px);
          ctx.fillStyle = holder.color;
          roundedRectPath(ctx, bx, by, bw, bh, 6 * px);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.textBaseline = 'middle';
          ctx.fillText(holder.name, bx + 6 * px, by + bh / 2 + px * 0.5);
        }
      }

      // วาบสีเมื่อชิ้นเข้าที่
      g.flashes = g.flashes.filter((f) => now - f.t0 < 600);
      for (const f of g.flashes) {
        const p = g.pieces[f.id];
        const t = (now - f.t0) / 600;
        const t0 = targetOf(g, p);
        ctx.strokeStyle = byId[f.by]?.color || '#fff';
        ctx.globalAlpha = 1 - t;
        ctx.lineWidth = (3 + 8 * t) * px;
        ctx.strokeRect(t0.x - 4 * t * px, t0.y - 4 * t * px, g.pw + 8 * t * px, g.ph + 8 * t * px);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const frame = (now) => {
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      if (drag && store.g) {
        store.g.localDragId = null;
        const p = store.g.pieces[drag.id];
        if (p?.heldBy === live.current.me) {
          p.heldBy = null;
          socket.emit('piece:drop', { id: p.id, x: p.x, y: p.y });
        }
      }
    };
  }, []);

  const g = store.g;
  const total = g ? g.pieces.length : 0;
  const locked = g ? g.lockedCount : 0;
  const elapsed = result
    ? result.durationMs
    : g ? (g.finishedAt ?? Date.now() + g.offset) - g.startedAt : 0;
  const ranking = result
    ? Object.values(result.stats).sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="game">
      <header className="hud">
        <div className="hud-stat" aria-live="off">
          <strong>{fmtTime(elapsed)}</strong>
          <span>{locked}/{total} ชิ้น</span>
        </div>

        <ul className="hud-players" aria-label="ผู้เล่น">
          {room.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'is-off'} style={{ '--c': p.color }}>
              <span className="dot" aria-hidden="true" />
              <span className="hud-name">{p.name}{p.id === me ? ' (คุณ)' : ''}</span>
              <span className="hud-count">{g?.stats[p.id]?.count ?? 0}</span>
            </li>
          ))}
        </ul>

        <div className="hud-actions">
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            aria-pressed={showFull}
            onClick={() => setShowFull((v) => !v)}
          >
            ดูภาพเต็ม
          </button>
          {!finished && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(true)}>
              ออก
            </button>
          )}
        </div>
        <div className="progress" aria-hidden="true"><i style={{ width: `${total ? (locked / total) * 100 : 0}%` }} /></div>
      </header>

      <div className="stage" ref={wrapRef}>
        <canvas ref={canvasRef} aria-label="กระดานจิ๊กซอ ลากชิ้นส่วนไปวางให้ตรงกับภาพ" />
      </div>

      {confirming && (
        <div className="modal-backdrop">
          <div className="modal modal-sm" role="alertdialog" aria-modal="true" aria-label="ออกจากเกม">
            <h2 className="modal-title">ออกจากเกมนี้?</h2>
            <p className="muted">เพื่อนจะเล่นต่อได้ แต่คุณกลับเข้ามาที่เดิมไม่ได้ถ้ากดออกแล้ว</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>เล่นต่อ</button>
              <button type="button" className="btn btn-danger" onClick={onLeave}>ออกจากเกม</button>
            </div>
          </div>
        </div>
      )}

      {finished && (
        <>
          <Confetti />
          <section className="finish" role="dialog" aria-label="ต่อภาพสำเร็จ">
            <h2>ต่อภาพสำเร็จแล้ว!</h2>
            <p className="finish-time">ใช้เวลา {fmtTime(elapsed)}</p>
            {ranking.length > 0 && (
              <ul className="finish-list">
                {ranking.map((s) => (
                  <li key={s.name} style={{ '--c': s.color }}>
                    <span className="dot" aria-hidden="true" />
                    <span>{s.name}</span>
                    <strong>{s.count} ชิ้น</strong>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn btn-primary btn-block" onClick={onLeave}>
              กลับหน้าหลัก
            </button>
          </section>
        </>
      )}
    </div>
  );
}
