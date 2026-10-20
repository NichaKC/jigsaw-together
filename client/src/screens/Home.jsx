import { useState } from 'react';
import Logo from '../components/Logo.jsx';
import { NAME_MAX, PIN_LENGTH, errorText } from '../lib/constants.js';
import { loadName, saveName } from '../lib/session.js';

export default function Home({ actions, busy, error, clearError }) {
  const [name, setName] = useState(loadName);
  const [pin, setPin] = useState(() => new URLSearchParams(location.search).get('pin')?.replace(/\D/g, '').slice(0, PIN_LENGTH) || '');
  const [localError, setLocalError] = useState('');

  const trimmed = name.trim();
  const needName = () => {
    if (trimmed) return false;
    setLocalError('กรุณาใส่ชื่อผู้เล่นก่อน');
    return true;
  };

  const create = () => {
    clearError();
    if (needName()) return;
    saveName(trimmed);
    actions.create(trimmed);
  };
  const join = (e) => {
    e.preventDefault();
    clearError();
    if (needName()) return;
    if (pin.length !== PIN_LENGTH) return setLocalError(`PIN ต้องเป็นตัวเลข ${PIN_LENGTH} หลัก`);
    saveName(trimmed);
    actions.join(pin, trimmed);
  };

  const message = localError || (error ? errorText(error) : '');

  return (
    <main className="home">
      <header className="home-head">
        <Logo />
        <h1>จิ๊กซอด้วยกัน</h1>
        <p>ต่อภาพกับเพื่อนแบบเรียลไทม์ 2–4 คน</p>
      </header>

      <section className="panel home-panel" aria-label="เริ่มเล่น">
        <label className="field">
          <span className="field-label">ชื่อของคุณ</span>
          <input
            type="text"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="nickname"
            placeholder="เช่น Clash"
            onChange={(e) => { setName(e.target.value); setLocalError(''); }}
          />
          <span className="field-hint">เปลี่ยนชื่อได้เฉพาะหน้านี้ พอเข้าห้องแล้วจะเปลี่ยนไม่ได้</span>
        </label>

        <button type="button" className="btn btn-primary btn-block" onClick={create} disabled={busy}>
          สร้างห้องใหม่
        </button>

        <div className="or" aria-hidden="true"><span>หรือเข้าห้องของเพื่อน</span></div>

        <form className="join-row" onSubmit={join}>
          <label className="field grow">
            <span className="field-label">PIN ห้อง</span>
            <input
              className="pin-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              placeholder="000000"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)); setLocalError(''); }}
            />
          </label>
          <button type="submit" className="btn btn-secondary" disabled={busy}>เข้าร่วม</button>
        </form>

        {message && <p role="alert" className="form-error">{message}</p>}
      </section>
    </main>
  );
}
