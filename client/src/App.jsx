import { useEffect } from 'react';
import Game from './screens/Game.jsx';
import Home from './screens/Home.jsx';
import Lobby from './screens/Lobby.jsx';
import { useRoom } from './useRoom.js';

export default function App() {
  const r = useRoom();

  useEffect(() => {
    if (!r.notice) return undefined;
    const t = setTimeout(r.dismissNotice, 6000);
    return () => clearTimeout(t);
  }, [r.notice, r.dismissNotice]);

  let screen;
  if (r.restoring) {
    screen = (
      <main className="splash" role="status">
        <p>กำลังกลับเข้าห้อง…</p>
        <button type="button" className="btn btn-quiet" onClick={r.cancelRestore}>ยกเลิก</button>
      </main>
    );
  } else if (!r.room) {
    screen = <Home actions={r.actions} busy={r.busy} error={r.error} clearError={r.clearError} />;
  } else if (r.room.phase === 'lobby') {
    screen = <Lobby room={r.room} me={r.me} actions={r.actions} busy={r.busy} error={r.error} />;
  } else {
    screen = <Game key={r.room.pin} room={r.room} me={r.me} result={r.result} onLeave={r.actions.leave} />;
  }

  return (
    <>
      {!r.connected && <div className="banner" role="status">กำลังเชื่อมต่อเซิร์ฟเวอร์…</div>}
      {r.notice && (
        <div className="toast" role="status">
          <span>{r.notice}</span>
          <button type="button" className="btn btn-quiet btn-sm" onClick={r.dismissNotice}>ปิด</button>
        </div>
      )}
      {screen}
    </>
  );
}
