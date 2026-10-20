import { useRef, useState } from 'react';
import Cropper from '../components/Cropper.jsx';
import Segmented from '../components/Segmented.jsx';
import { DIFFICULTIES, aspectParts, errorText } from '../lib/constants.js';
import { makeSampleBlob } from '../lib/sample.js';
import { copyText } from '../lib/session.js';
import { serverUrl } from '../socket.js';

export default function Lobby({ room, me, actions, busy, error }) {
  const isHost = room.hostId === me;
  const host = room.players.find((p) => p.id === room.hostId);
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState('');
  const fileRef = useRef(null);

  const onlineCount = room.players.filter((p) => p.connected).length;
  const level = DIFFICULTIES.find((d) => d.key === room.difficulty);
  const pieceCount = room.grid ? room.grid.rows * room.grid.cols : null;

  let startBlock = null;
  if (isHost) {
    const reason = !room.image
      ? 'แนบรูปก่อนถึงจะเริ่มได้'
      : onlineCount < room.minPlayers
        ? `ต้องมีผู้เล่นอย่างน้อย ${room.minPlayers} คน`
        : '';
    startBlock = (
      <>
        <button type="button" className="btn btn-primary btn-xl" disabled={!!reason || busy} onClick={actions.start}>
          เริ่มเล่น
        </button>
        {reason && <p className="muted small center">{reason}</p>}
      </>
    );
  } else {
    startBlock = <p className="waiting center" role="status">รอ {host?.name ?? 'หัวหน้าห้อง'} กดเริ่มเกม</p>;
  }

  const copy = async (kind, text) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(''), 1800);
    }
  };

  const useSample = async () => {
    const aspect = room.aspect || '4:3';
    actions.uploadImage(await makeSampleBlob(aspect), aspect);
  };

  const imageUrl = room.image ? serverUrl(`/api/rooms/${room.pin}/image?v=${room.image.version}`) : null;
  const [aw, ah] = room.aspect ? aspectParts(room.aspect) : [4, 3];

  return (
    <main className="lobby">
      <header className="lobby-head">
        <div>
          <p className="muted small">รหัสห้อง ส่งให้เพื่อนกรอกที่หน้าแรก</p>
          <p className="pin" aria-label={`PIN ห้อง ${room.pin.split('').join(' ')}`}>{room.pin}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-quiet" onClick={() => copy('pin', room.pin)}>
            {copied === 'pin' ? 'คัดลอกแล้ว' : 'คัดลอก PIN'}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => copy('link', `${location.origin}/?pin=${room.pin}`)}
          >
            {copied === 'link' ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
          </button>
        </div>
      </header>

      <div className="lobby-grid">
        <section className="panel" aria-labelledby="players-h">
          <h2 id="players-h">ผู้เล่น {room.players.length}/{room.maxPlayers}</h2>

          <ul className="slots">
            {Array.from({ length: room.maxPlayers }, (_, i) => {
              const p = room.players[i];
              if (!p) {
                return (
                  <li key={`empty-${i}`} className="slot slot-empty">
                    <span className="slot-badge" aria-hidden="true" />
                    <span>รอผู้เล่น…</span>
                  </li>
                );
              }
              return (
                <li key={p.id} className="slot" style={{ '--c': p.color }}>
                  <span className="slot-badge" aria-hidden="true">{Array.from(p.name)[0]}</span>
                  <span className="slot-name">{p.name}</span>
                  {p.id === room.hostId && <span className="tag">หัวหน้าห้อง</span>}
                  {p.id === me && <span className="tag tag-me">คุณ</span>}
                  {!p.connected && <span className="tag tag-warn">หลุดการเชื่อมต่อ</span>}
                  {isHost && p.id !== me && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      aria-label={`เตะ ${p.name} ออกจากห้อง`}
                      onClick={() => actions.kick(p.id)}
                    >
                      เตะ
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="setting">
            <span className="field-label">จำนวนผู้เล่นสูงสุด</span>
            {isHost ? (
              <Segmented
                label="จำนวนผู้เล่นสูงสุด"
                value={room.maxPlayers}
                onChange={(v) => actions.settings({ maxPlayers: v })}
                options={[2, 3, 4].map((n) => ({ value: n, label: `${n} คน`, disabled: n < room.players.length }))}
              />
            ) : (
              <p>{room.maxPlayers} คน</p>
            )}
          </div>

          <div className="setting">
            <span className="field-label">ระดับความยาก</span>
            {isHost ? (
              <Segmented
                label="ระดับความยาก"
                value={room.difficulty}
                onChange={(v) => actions.settings({ difficulty: v })}
                options={DIFFICULTIES.map((d) => ({ value: d.key, label: d.label }))}
              />
            ) : (
              <p>{level?.label}</p>
            )}
            <p className="muted small">
              {room.grid
                ? `${room.grid.cols} × ${room.grid.rows} = ${pieceCount} ชิ้น`
                : `ประมาณ ${level?.pieces} ชิ้น (ขึ้นกับสัดส่วนรูป)`}
            </p>
          </div>
        </section>

        <section className="panel" aria-labelledby="image-h">
          <h2 id="image-h">รูปจิ๊กซอ</h2>

          <div className="preview-wrap">
            {imageUrl ? (
              <div className="preview" style={{ aspectRatio: `${aw} / ${ah}` }}>
                <img src={imageUrl} alt="รูปที่จะใช้ต่อจิ๊กซอ" />
                {room.grid && (
                  <span
                    className="preview-grid"
                    style={{ '--cols': room.grid.cols, '--rows': room.grid.rows }}
                    aria-hidden="true"
                  />
                )}
              </div>
            ) : (
              <div className="preview preview-empty" style={{ aspectRatio: '4 / 3' }}>
                <p>ยังไม่มีรูป<br />ใครในห้องก็แนบได้</p>
              </div>
            )}
          </div>
          {room.image && <p className="muted small">แนบโดย {room.image.by} · {room.aspect}</p>}

          <div className="row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {room.image ? 'เปลี่ยนรูป' : 'เลือกรูปจากเครื่อง'}
            </button>
            <button type="button" className="btn btn-quiet" onClick={useSample} disabled={busy}>
              ใช้รูปตัวอย่าง
            </button>
          </div>
        </section>
      </div>

      <footer className="lobby-foot">
        {error && <p role="alert" className="form-error center">{errorText(error, room)}</p>}
        {startBlock}
        <button type="button" className="btn btn-quiet" onClick={actions.leave}>ออกจากห้อง</button>
      </footer>

      {file && (
        <Cropper
          file={file}
          initialAspect={room.aspect}
          onCancel={() => setFile(null)}
          onConfirm={async (blob, aspect) => {
            setFile(null);
            await actions.uploadImage(blob, aspect);
          }}
        />
      )}
    </main>
  );
}
