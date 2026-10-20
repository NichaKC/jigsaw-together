import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { ASPECTS, aspectParts } from '../lib/constants.js';

const OUT_LONG_SIDE = 1200;

// Crop an image to the chosen aspect ratio: drag to pan, slider or mouse wheel to zoom.
export default function Cropper({ file, initialAspect, onCancel, onConfirm }) {
  const { t } = useI18n();
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState(null); // { el, w, h }
  const [aspect, setAspect] = useState(initialAspect || null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, y: 0 }); // center of the frame (in the source image's pixels)
  const [box, setBox] = useState({ w: 320, h: 420 });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    const el = new Image();
    el.onload = () => {
      setImg({ el, w: el.naturalWidth, h: el.naturalHeight });
      setCenter({ x: el.naturalWidth / 2, y: el.naturalHeight / 2 });
      setAspect((prev) => prev ?? (el.naturalWidth >= el.naturalHeight ? '4:3' : '3:4'));
    };
    el.onerror = () => setError('openError');
    el.src = url;
  }, [url]);

  useEffect(() => {
    const measure = () => {
      const w = stageRef.current?.clientWidth || 320;
      setBox({ w: Math.min(w, 420), h: Math.max(200, Math.min(window.innerHeight * 0.48, 460)) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const frame = useMemo(() => {
    if (!aspect) return null;
    const [aw, ah] = aspectParts(aspect);
    const r = aw / ah;
    let w = box.w;
    let h = w / r;
    if (h > box.h) { h = box.h; w = h * r; }
    return { w: Math.round(w), h: Math.round(h) };
  }, [aspect, box]);

  if (!img || !frame) {
    return (
      <div className="modal-backdrop">
        <div className="modal" role="dialog" aria-modal="true" aria-label={t('crop.dialog')}>
          {error ? (
            <>
              <p role="alert" className="form-error">{t(`crop.${error}`)}</p>
              <button type="button" className="btn btn-quiet" onClick={onCancel}>{t('crop.close')}</button>
            </>
          ) : (
            <p className="muted">{t('crop.opening')}</p>
          )}
        </div>
      </div>
    );
  }

  const minScale = Math.max(frame.w / img.w, frame.h / img.h); // scale at which the image exactly covers the frame
  const scale = minScale * zoom;
  const clampCenter = (c) => {
    const hw = frame.w / 2 / scale;
    const hh = frame.h / 2 / scale;
    return {
      x: Math.min(Math.max(c.x, hw), img.w - hw),
      y: Math.min(Math.max(c.y, hh), img.h - hh),
    };
  };
  const cc = clampCenter(center);
  const cropW = frame.w / scale;
  const cropH = frame.h / scale;

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, c: cc };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    setCenter(clampCenter({ x: d.c.x - (e.clientX - d.x) / scale, y: d.c.y - (e.clientY - d.y) / scale }));
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onWheel = (e) => setZoom((z) => Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 0.93))));

  const confirm = () => {
    setWorking(true);
    const [aw, ah] = aspectParts(aspect);
    const k = Math.min(1, OUT_LONG_SIDE / Math.max(cropW, cropH)); // never upscale beyond the real resolution
    const outW = Math.max(2, Math.round(cropW * k));
    const outH = Math.max(2, Math.round((outW * ah) / aw));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img.el, cc.x - cropW / 2, cc.y - cropH / 2, cropW, cropH, 0, 0, outW, outH);
    canvas.toBlob(
      (blob) => {
        setWorking(false);
        if (!blob) return setError('exportError');
        onConfirm(blob, aspect);
      },
      'image/jpeg',
      0.88,
    );
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={t('crop.dialog')}>
        <h2 className="modal-title">{t('crop.title')}</h2>

        <div className="ratio-row" role="group" aria-label={t('crop.ratioGroup')}>
          {ASPECTS.map((a) => {
            const [aw, ah] = aspectParts(a);
            const k = 22 / Math.max(aw, ah);
            return (
              <button key={a} type="button" className="ratio" aria-pressed={a === aspect} onClick={() => setAspect(a)}>
                <span className="ratio-shape" style={{ width: aw * k, height: ah * k }} />
                {a}
              </button>
            );
          })}
        </div>

        <div className="crop-stage" ref={stageRef}>
          <div
            className="crop-frame"
            style={{ width: frame.w, height: frame.h }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            <img
              src={url}
              alt={t('crop.alt')}
              draggable="false"
              style={{
                width: img.w * scale,
                height: img.h * scale,
                left: frame.w / 2 - cc.x * scale,
                top: frame.h / 2 - cc.y * scale,
              }}
            />
          </div>
        </div>

        <label className="zoom">
          <span>{t('crop.zoom')}</span>
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        {cropW < 400 && <p className="muted small">{t('crop.lowRes')}</p>}
        {error && <p role="alert" className="form-error">{t(`crop.${error}`)}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onCancel}>{t('crop.cancel')}</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={working}>
            {working ? t('crop.working') : t('crop.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
