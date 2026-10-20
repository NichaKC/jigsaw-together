import { useEffect, useRef } from 'react';

const COLORS = ['#FF3B7F', '#00B7D4', '#FFB300', '#8A5CFF', '#2ED573', '#FF6A2B', '#1E90FF'];

// Celebration confetti: bursts from both bottom corners, then rains down for about 5 seconds.
export default function Confetti() {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, raf = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const parts = [];
    const spawn = (x, y, vx, vy) =>
      parts.push({
        x, y, vx, vy,
        w: 6 + Math.random() * 7,
        h: 10 + Math.random() * 9,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.35,
        tilt: Math.random() * Math.PI * 2,
        ts: 0.06 + Math.random() * 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });

    for (let i = 0; i < 70; i++) {
      const a = (-Math.PI / 2) + (Math.random() - 0.5) * 0.9;
      const sp = (0.9 + Math.random() * 0.8) * Math.min(h, 900) * 0.028;
      spawn(0, h, Math.abs(Math.cos(a)) * sp + 2, Math.sin(a) * sp);
      spawn(w, h, -Math.abs(Math.cos(a)) * sp - 2, Math.sin(a) * sp);
    }

    const start = performance.now();
    const frame = (now) => {
      const elapsed = now - start;
      if (elapsed < 5000) {
        for (let i = 0; i < 2; i++) spawn(Math.random() * w, -20, (Math.random() - 0.5) * 2, 1 + Math.random() * 2);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += 0.16;
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.tilt += p.ts;
        if (p.y > h + 30) { parts.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.tilt)); // flip the paper so it looks like it's fluttering
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < 5000 || parts.length) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
