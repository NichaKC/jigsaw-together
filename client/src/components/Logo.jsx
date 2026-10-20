// โลโก้: จิ๊กซอ 4 ชิ้นสี่สีของผู้เล่น เลื่อนมาประกอบกันครั้งเดียวตอนโหลดหน้า
const TILES = [
  { x: 8, y: 8, color: 'var(--p1)', dx: '-26px', dy: '-26px', rot: '-14deg' },
  { x: 62, y: 8, color: 'var(--p2)', dx: '26px', dy: '-26px', rot: '12deg' },
  { x: 8, y: 62, color: 'var(--p3)', dx: '-26px', dy: '26px', rot: '10deg' },
  { x: 62, y: 62, color: 'var(--p4)', dx: '26px', dy: '26px', rot: '-12deg' },
];
const KNOBS = [
  { cx: 58, cy: 33, color: 'var(--p1)' },
  { cx: 87, cy: 58, color: 'var(--p2)' },
  { cx: 58, cy: 87, color: 'var(--p4)' },
  { cx: 33, cy: 58, color: 'var(--p3)' },
];

export default function Logo({ size = 112 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="จิ๊กซอด้วยกัน">
      {TILES.map((t, i) => (
        <rect
          key={i}
          className="logo-tile"
          x={t.x} y={t.y} width="50" height="50" rx="9"
          fill={t.color}
          style={{ '--dx': t.dx, '--dy': t.dy, '--rot': t.rot, animationDelay: `${i * 70}ms` }}
        />
      ))}
      {KNOBS.map((k, i) => (
        <circle key={i} className="logo-knob" cx={k.cx} cy={k.cy} r="8.5" fill={k.color} />
      ))}
    </svg>
  );
}
