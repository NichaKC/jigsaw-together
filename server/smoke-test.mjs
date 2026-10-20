// ทดสอบแบบ end-to-end: สร้างห้อง → เข้าห้อง → เตะ/ออก → แนบรูป → เริ่มเกม → ต่อจนจบ
// รัน: npm run test:smoke   (จะเปิดเซิร์ฟเวอร์ชั่วคราวที่พอร์ต 4999 ให้เอง)
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const PORT = 4999;
const url = `http://localhost:${PORT}`;
const child = spawn(process.execPath, ['index.js'], {
  cwd: new URL('.', import.meta.url),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve) => child.stdout.on('data', (d) => String(d).includes('listening') && resolve()));

const connect = () =>
  new Promise((resolve) => {
    const s = io(url, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
const req = (s, ev, payload = {}) => new Promise((r) => s.emit(ev, payload, r));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const ok = (cond, label) => {
  assert.ok(cond, label);
  passed++;
  console.log('  ✓', label);
};

try {
  const a = await connect();
  const b = await connect();
  const c = await connect();

  console.log('lobby');
  const created = await req(a, 'room:create', { name: 'Alice', clientId: 'client-alice-0001' });
  ok(created.ok && /^\d{6}$/.test(created.room.pin), 'สร้างห้องได้ PIN 6 หลัก');
  const pin = created.room.pin;
  const aliceId = created.me;

  ok((await req(b, 'room:join', { pin: '000000', name: 'Bob', clientId: 'client-bob-00001' })).code === 'NOT_FOUND', 'PIN ผิด → NOT_FOUND');

  const stateForA = once(a, 'room:state');
  const joined = await req(b, 'room:join', { pin, name: 'Bob', clientId: 'client-bob-00001' });
  ok(joined.ok && joined.room.players.length === 2, 'Bob เข้าห้องได้');
  ok((await stateForA).players.length === 2, 'Alice เห็น Bob เข้ามา');

  ok((await req(c, 'room:join', { pin, name: 'Cara', clientId: 'client-cara-0001' })).code === 'FULL', 'ห้อง 2 คนเต็ม → FULL');
  ok((await req(b, 'room:settings', { maxPlayers: 3 })).code === 'NOT_HOST', 'คนที่ไม่ใช่ host ตั้งค่าไม่ได้');
  ok((await req(a, 'room:settings', { maxPlayers: 3, difficulty: 'easy' })).ok, 'host เพิ่มจำนวนผู้เล่นเป็น 3');
  ok((await req(a, 'room:settings', { maxPlayers: 2 })).ok === true, 'host ลดกลับเป็น 2 ได้ (มี 2 คนพอดี)');
  ok((await req(a, 'room:settings', { maxPlayers: 3 })).ok, 'ตั้งเป็น 3 อีกครั้ง');

  const cara = await req(c, 'room:join', { pin, name: 'Cara', clientId: 'client-cara-0001' });
  ok(cara.ok, 'Cara เข้าห้อง (ที่ 3)');
  const caraId = cara.me;

  const kicked = once(c, 'room:kicked');
  ok((await req(b, 'room:kick', { playerId: caraId })).code === 'NOT_HOST', 'คนอื่นเตะไม่ได้');
  ok((await req(a, 'room:kick', { playerId: caraId })).ok, 'host เตะ Cara ได้');
  await kicked;
  ok(true, 'Cara ได้รับ room:kicked');

  const c2 = await connect();
  const again = await req(c2, 'room:join', { pin, name: 'Cara', clientId: 'client-cara-0002' });
  ok(again.ok, 'Cara กลับเข้ามาใหม่ได้');
  const left = once(a, 'room:state');
  ok((await req(c2, 'room:leave')).ok, 'Cara กดออกเองได้');
  ok((await left).players.length === 2, 'ห้องเหลือ 2 คน');

  console.log('image & start');
  ok((await req(b, 'game:start')).code === 'NOT_HOST', 'คนอื่นเริ่มเกมไม่ได้');
  ok((await req(a, 'game:start')).code === 'NO_IMAGE', 'ยังไม่มีรูป เริ่มไม่ได้');
  ok((await req(b, 'room:image', { aspect: '3:4', data: Buffer.from('not a jpeg at all') })).code === 'BAD_IMAGE', 'ไฟล์ที่ไม่ใช่ JPEG ถูกปฏิเสธ');
  await wait(900);
  const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1000, 1)]);
  const imgState = once(a, 'room:state');
  ok((await req(b, 'room:image', { aspect: '3:4', data: fakeJpeg })).ok, 'ผู้เล่นที่ไม่ใช่ host แนบรูปได้');
  const st = await imgState;
  ok(st.image.by === 'Bob' && st.grid.rows * st.grid.cols > 0, 'ทุกคนเห็นรูป + ตารางชิ้นส่วน');
  const res = await fetch(`${url}/api/rooms/${pin}/image`);
  ok(res.ok && res.headers.get('content-type') === 'image/jpeg', 'ดึงรูปผ่าน HTTP ได้');

  const startedA = once(a, 'game:started');
  const startedB = once(b, 'game:started');
  ok((await req(a, 'game:start')).ok, 'host เริ่มเกมได้');
  const { game } = await startedA;
  await startedB;
  ok((await req(c2, 'room:join', { pin, name: 'Late', clientId: 'client-late-0001' })).code === 'STARTED', 'เข้าห้องที่เริ่มแล้วไม่ได้');

  console.log('gameplay');
  const { rows, cols, a: ratio, margin } = game;
  const pw = 1 / cols;
  const ph = ratio / rows;
  ok(game.pieces.length === rows * cols, `สร้างชิ้นส่วน ${rows}x${cols}`);

  // Alice จับชิ้น 0 → Bob จับซ้ำไม่ได้
  const grabbed = once(b, 'piece:grabbed');
  a.emit('piece:grab', { id: 0 });
  ok((await grabbed).by === aliceId, 'Bob เห็นว่า Alice จับชิ้น 0');
  const denied = once(b, 'piece:denied');
  b.emit('piece:grab', { id: 0 });
  ok((await denied).id === 0, 'Bob จับชิ้นที่ Alice ถือไม่ได้');

  const moved = once(b, 'piece:moved');
  a.emit('piece:move', { id: 0, x: 0.5, y: 0.5 });
  ok((await moved).x === 0.5, 'Bob เห็นชิ้นขยับ');

  // วางห่างจากช่อง → ไม่ล็อก
  const miss = once(b, 'piece:dropped');
  a.emit('piece:drop', { id: 0, x: 0.9, y: 0.9 });
  ok((await miss).locked === false, 'วางผิดที่ ไม่ล็อก');

  // ต่อทุกชิ้น (สลับผู้เล่น) โดยวางใกล้ช่องจริงนิดหน่อยเพื่อทดสอบ snap
  let complete = null;
  const done = once(a, 'game:complete').then((r) => (complete = r));
  for (const p of game.pieces) {
    const s = p.id % 2 === 0 ? a : b;
    const tx = margin + (p.id % cols) * pw;
    const ty = margin + Math.floor(p.id / cols) * ph;
    s.emit('piece:grab', { id: p.id });
    await wait(5);
    s.emit('piece:drop', { id: p.id, x: tx + pw * 0.2, y: ty - ph * 0.2 });
    await wait(5);
  }
  await Promise.race([done, wait(2000)]);
  ok(complete && complete.room.phase === 'finished', 'ต่อครบแล้ว server ประกาศจบเกม');
  const total = Object.values(complete.result.stats).reduce((n, s) => n + s.count, 0);
  ok(total === rows * cols, 'สถิติรวมครบทุกชิ้น');

  console.log('reconnect');
  const a2 = await connect();
  const back = await req(a2, 'room:rejoin', { pin, clientId: 'client-alice-0001' });
  ok(back.ok && back.me === aliceId && back.result, 'Alice รีคอนเนกต์แล้วได้สถานะเดิม + ผลลัพธ์');
  ok((await req(a2, 'room:rejoin', { pin, clientId: 'wrong-client-id' })).code === 'NOT_FOUND', 'clientId ผิดเข้าไม่ได้');

  console.log(`\nผ่านทั้งหมด ${passed} รายการ`);
} catch (e) {
  console.error('\nไม่ผ่าน:', e.message);
  process.exitCode = 1;
} finally {
  child.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 100);
}
