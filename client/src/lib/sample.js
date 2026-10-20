import { aspectParts } from './constants.js';

// สร้างรูปตัวอย่างสำหรับทดสอบ (วาดด้วย canvas ไม่ต้องมีไฟล์รูป)
// ใช้ seed คงที่ ทุกชิ้นมีลวดลายต่างกันพอให้แยกออก
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSampleBlob(aspect = '4:3') {
  const [aw, ah] = aspectParts(aspect);
  const W = 1000;
  const H = Math.round((W * ah) / aw);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const rand = rng(Math.floor(Math.random() * 1e9));

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#5B4BFF');
  sky.addColorStop(0.55, '#FF6FA5');
  sky.addColorStop(1, '#FFC46B');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // ดาว/จุดสว่างกระจาย
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H * 0.6, 1 + rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ดวงอาทิตย์
  ctx.fillStyle = '#FFF3B0';
  ctx.beginPath();
  ctx.arc(W * 0.7, H * 0.38, Math.min(W, H) * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // ภูเขาหลายชั้น
  const layers = ['#3A2D9C', '#2B2278', '#1D1856', '#120F3B'];
  layers.forEach((color, i) => {
    const base = H * (0.5 + i * 0.12);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, base);
    const steps = 6 + i * 2;
    for (let s = 1; s <= steps; s++) {
      const x = (W / steps) * s;
      const peak = base - (60 + rand() * 140) * (1 - i * 0.18);
      ctx.lineTo(x - W / steps / 2, peak);
      ctx.lineTo(x, base + rand() * 30);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  });

  // ลูกบอลสีสดกระจายทั่วภาพ ช่วยให้ชิ้นส่วนแต่ละชิ้นต่างกัน
  const palette = ['#FF3B7F', '#00B7D4', '#FFB300', '#8A5CFF', '#2ED573', '#FF6A2B'];
  for (let i = 0; i < 38; i++) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 14 + rand() * 38, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
}
