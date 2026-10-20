// End-to-end test: create room -> join -> kick/leave -> add image -> start game -> solve it
// Run: npm run test:smoke   (starts a temporary server on port 4999 by itself)
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
  ok(created.ok && /^\d{6}$/.test(created.room.pin), 'creates a room with a 6-digit PIN');
  const pin = created.room.pin;
  const aliceId = created.me;

  ok((await req(b, 'room:join', { pin: '000000', name: 'Bob', clientId: 'client-bob-00001' })).code === 'NOT_FOUND', 'wrong PIN -> NOT_FOUND');

  const stateForA = once(a, 'room:state');
  const joined = await req(b, 'room:join', { pin, name: 'Bob', clientId: 'client-bob-00001' });
  ok(joined.ok && joined.room.players.length === 2, 'Bob can join');
  ok((await stateForA).players.length === 2, 'Alice sees Bob arrive');

  ok((await req(c, 'room:join', { pin, name: 'Cara', clientId: 'client-cara-0001' })).code === 'FULL', 'a 2-player room is full -> FULL');
  ok((await req(b, 'room:settings', { maxPlayers: 3 })).code === 'NOT_HOST', 'non-host cannot change settings');
  ok((await req(a, 'room:settings', { maxPlayers: 3, difficulty: 'easy' })).ok, 'host raises max players to 3');
  ok((await req(a, 'room:settings', { maxPlayers: 2 })).ok === true, 'host can lower it back to 2 (exactly 2 players)');
  ok((await req(a, 'room:settings', { maxPlayers: 3 })).ok, 'set to 3 again');

  const cara = await req(c, 'room:join', { pin, name: 'Cara', clientId: 'client-cara-0001' });
  ok(cara.ok, 'Cara joins as the 3rd player');
  const caraId = cara.me;

  const kicked = once(c, 'room:kicked');
  ok((await req(b, 'room:kick', { playerId: caraId })).code === 'NOT_HOST', 'non-host cannot kick');
  ok((await req(a, 'room:kick', { playerId: caraId })).ok, 'host can kick Cara');
  await kicked;
  ok(true, 'Cara receives room:kicked');

  const c2 = await connect();
  const again = await req(c2, 'room:join', { pin, name: 'Cara', clientId: 'client-cara-0002' });
  ok(again.ok, 'Cara can join again');
  const left = once(a, 'room:state');
  ok((await req(c2, 'room:leave')).ok, 'Cara can leave on her own');
  ok((await left).players.length === 2, 'room is back to 2 players');

  console.log('image & start');
  ok((await req(b, 'game:start')).code === 'NOT_HOST', 'non-host cannot start the game');
  ok((await req(a, 'game:start')).code === 'NO_IMAGE', 'cannot start without an image');
  ok((await req(b, 'room:image', { aspect: '3:4', data: Buffer.from('not a jpeg at all') })).code === 'BAD_IMAGE', 'non-JPEG files are rejected');
  await wait(900);
  const fakeJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(1000, 1)]);
  const imgState = once(a, 'room:state');
  ok((await req(b, 'room:image', { aspect: '3:4', data: fakeJpeg })).ok, 'a non-host player can add an image');
  const st = await imgState;
  ok(st.image.by === 'Bob' && st.grid.rows * st.grid.cols > 0, 'everyone sees the image and the piece grid');
  const res = await fetch(`${url}/api/rooms/${pin}/image`);
  ok(res.ok && res.headers.get('content-type') === 'image/jpeg', 'the image can be fetched over HTTP');

  const startedA = once(a, 'game:started');
  const startedB = once(b, 'game:started');
  ok((await req(a, 'game:start')).ok, 'host can start the game');
  const { game } = await startedA;
  await startedB;
  ok((await req(c2, 'room:join', { pin, name: 'Late', clientId: 'client-late-0001' })).code === 'STARTED', 'cannot join a room that already started');

  console.log('gameplay');
  const { rows, cols, a: ratio, margin } = game;
  const pw = 1 / cols;
  const ph = ratio / rows;
  ok(game.pieces.length === rows * cols, `creates ${rows}x${cols} pieces`);

  // Alice grabs piece 0 -> Bob can't grab it too
  const grabbed = once(b, 'piece:grabbed');
  a.emit('piece:grab', { id: 0 });
  ok((await grabbed).by === aliceId, 'Bob sees Alice grab piece 0');
  const denied = once(b, 'piece:denied');
  b.emit('piece:grab', { id: 0 });
  ok((await denied).id === 0, 'Bob cannot grab a piece Alice is holding');

  const moved = once(b, 'piece:moved');
  a.emit('piece:move', { id: 0, x: 0.5, y: 0.5 });
  ok((await moved).x === 0.5, 'Bob sees the piece move');

  // dropped far from its slot -> not locked
  const miss = once(b, 'piece:dropped');
  a.emit('piece:drop', { id: 0, x: 0.9, y: 0.9 });
  ok((await miss).locked === false, 'a wrong drop does not lock');

  // Solve every piece (alternating players), dropping slightly off-target to test snapping
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
  ok(complete && complete.room.phase === 'finished', 'server announces completion once all pieces are placed');
  const total = Object.values(complete.result.stats).reduce((n, s) => n + s.count, 0);
  ok(total === rows * cols, 'stats add up to every piece');

  console.log('reconnect');
  const a2 = await connect();
  const back = await req(a2, 'room:rejoin', { pin, clientId: 'client-alice-0001' });
  ok(back.ok && back.me === aliceId && back.result, 'Alice reconnects and gets her old state plus the result');
  ok((await req(a2, 'room:rejoin', { pin, clientId: 'wrong-client-id' })).code === 'NOT_FOUND', 'a wrong clientId is rejected');

  console.log(`\nAll ${passed} checks passed`);
} catch (e) {
  console.error('\nFailed:', e.message);
  process.exitCode = 1;
} finally {
  child.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 100);
}
