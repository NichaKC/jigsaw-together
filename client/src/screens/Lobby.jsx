import { useRef, useState } from 'react';
import Cropper from '../components/Cropper.jsx';
import LangToggle from '../components/LangToggle.jsx';
import Segmented from '../components/Segmented.jsx';
import { useI18n } from '../i18n.jsx';
import { DIFFICULTIES, aspectParts } from '../lib/constants.js';
import { makeSampleBlob } from '../lib/sample.js';
import { copyText } from '../lib/session.js';
import { serverUrl } from '../socket.js';

export default function Lobby({ room, me, actions, busy, error }) {
  const { t, te } = useI18n();
  const isHost = room.hostId === me;
  const host = room.players.find((p) => p.id === room.hostId);
  const [file, setFile] = useState(null);
  const [copied, setCopied] = useState('');
  const fileRef = useRef(null);

  const onlineCount = room.players.filter((p) => p.connected).length;
  const level = DIFFICULTIES.find((d) => d.key === room.difficulty);
  const pieceCount = room.grid ? room.grid.rows * room.grid.cols : null;

  let startBlock;
  if (isHost) {
    const reason = !room.image
      ? t('lobby.needImage')
      : onlineCount < room.minPlayers
        ? t('lobby.needPlayers', { n: room.minPlayers })
        : '';
    startBlock = (
      <>
        <button type="button" className="btn btn-primary btn-xl" disabled={!!reason || busy} onClick={actions.start}>
          {t('lobby.start')}
        </button>
        {reason && <p className="muted small center">{reason}</p>}
      </>
    );
  } else {
    startBlock = (
      <p className="waiting center" role="status">
        {t('lobby.waiting', { name: host?.name ?? t('lobby.hostFallback') })}
      </p>
    );
  }

  const copy = async (kind, text) => {
    if (await copyText(text)) {
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
      <div className="lobby-top"><LangToggle /></div>

      <header className="lobby-head">
        <div>
          <p className="muted small">{t('lobby.pinCaption')}</p>
          <p className="pin" aria-label={t('lobby.pinAria', { pin: room.pin })}>{room.pin}</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-quiet" onClick={() => copy('pin', room.pin)}>
            {copied === 'pin' ? t('lobby.copied') : t('lobby.copyPin')}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => copy('link', `${location.origin}/?pin=${room.pin}`)}
          >
            {copied === 'link' ? t('lobby.copied') : t('lobby.copyLink')}
          </button>
        </div>
      </header>

      <div className="lobby-grid">
        <section className="panel" aria-labelledby="players-h">
          <h2 id="players-h">{t('lobby.players', { n: room.players.length, max: room.maxPlayers })}</h2>

          <ul className="slots">
            {Array.from({ length: room.maxPlayers }, (_, i) => {
              const p = room.players[i];
              if (!p) {
                return (
                  <li key={`empty-${i}`} className="slot slot-empty">
                    <span className="slot-badge" aria-hidden="true" />
                    <span>{t('lobby.empty')}</span>
                  </li>
                );
              }
              return (
                <li key={p.id} className="slot" style={{ '--c': p.color }}>
                  <span className="slot-badge" aria-hidden="true">{Array.from(p.name)[0]}</span>
                  <span className="slot-name">{p.name}</span>
                  {p.id === room.hostId && <span className="tag">{t('lobby.host')}</span>}
                  {p.id === me && <span className="tag tag-me">{t('lobby.you')}</span>}
                  {!p.connected && <span className="tag tag-warn">{t('lobby.offline')}</span>}
                  {isHost && p.id !== me && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      aria-label={t('lobby.kickAria', { name: p.name })}
                      onClick={() => actions.kick(p.id)}
                    >
                      {t('lobby.kick')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="setting">
            <span className="field-label">{t('lobby.maxPlayers')}</span>
            {isHost ? (
              <Segmented
                label={t('lobby.maxPlayers')}
                value={room.maxPlayers}
                onChange={(v) => actions.settings({ maxPlayers: v })}
                options={[2, 3, 4].map((n) => ({ value: n, label: t('lobby.nPlayers', { n }), disabled: n < room.players.length }))}
              />
            ) : (
              <p>{t('lobby.nPlayers', { n: room.maxPlayers })}</p>
            )}
          </div>

          <div className="setting">
            <span className="field-label">{t('lobby.difficulty')}</span>
            {isHost ? (
              <Segmented
                label={t('lobby.difficulty')}
                value={room.difficulty}
                onChange={(v) => actions.settings({ difficulty: v })}
                options={DIFFICULTIES.map((d) => ({ value: d.key, label: t(`diff.${d.key}`) }))}
              />
            ) : (
              <p>{t(`diff.${room.difficulty}`)}</p>
            )}
            <p className="muted small">
              {room.grid
                ? t('lobby.gridInfo', { cols: room.grid.cols, rows: room.grid.rows, n: pieceCount })
                : t('lobby.gridEstimate', { n: level?.pieces })}
            </p>
          </div>
        </section>

        <section className="panel" aria-labelledby="image-h">
          <h2 id="image-h">{t('lobby.image')}</h2>

          <div className="preview-wrap">
            {imageUrl ? (
              <div className="preview" style={{ aspectRatio: `${aw} / ${ah}` }}>
                <img src={imageUrl} alt={t('lobby.imageAlt')} />
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
                <p>{t('lobby.noImage1')}<br />{t('lobby.noImage2')}</p>
              </div>
            )}
          </div>
          {room.image && <p className="muted small">{t('lobby.addedBy', { name: room.image.by, aspect: room.aspect })}</p>}

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
              {room.image ? t('lobby.changeImage') : t('lobby.chooseImage')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={useSample} disabled={busy}>
              {t('lobby.sample')}
            </button>
          </div>
        </section>
      </div>

      <footer className="lobby-foot">
        {error && <p role="alert" className="form-error center">{te(error, { n: room.minPlayers })}</p>}
        {startBlock}
        <button type="button" className="btn btn-quiet" onClick={actions.leave}>{t('lobby.leave')}</button>
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
