import { useEffect, useMemo, useRef, useState } from 'react';
import { ASPECTS, aspectParts } from '../lib/constants.js';

const OUT_LONG_SIDE = 1200;

// ครอปรูปตามสัดส่วนที่เลือก: ลากเพื่อเลื่อน, สไลเดอร์/ล้อเมาส์เพื่อซูม
export default function Cropper({ file, initialAspect, onCancel, onConfirm }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState(null); // { el, w, h }
  const [aspect, setAspect] = useState(initialAspect || null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0, y: 0 }); // จุดกึ่งกลางกรอบ (พิกเซลของรูปจริง)
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
    el.onerror = () => setError('เปิดไฟล์รูปนี้ไม่ได้ ลองใช้ไฟล์ JPG หรือ PNG');
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
        <div className="modal" role="dialog" aria-modal="true" aria-label="ครอปรูป">
          {error ? (
            <>
              <p role="alert" className="form-error">{error}</p>
              <button type="button" className="btn btn-quiet" onClick={onCancel}>ปิด</button>
            </>
          ) : (
            <p className="muted">กำลังเปิดรูป…</p>
          )}
        </div>
      </div>
    );
  }

  const minScale = Math.max(frame.w / img.w, frame.h / img.h); // ขนาดที่รูปเต็มกรอบพอดี
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
    const k = Math.min(1, OUT_LONG_SIDE / Math.max(cropW, cropH)); // ไม่ขยายเกินความละเอียดจริง
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
        if (!blob) return setError('แปลงรูปไม่สำเร็จ ลองใหม่อีกครั้ง');
        onConfirm(blob, aspect);
      },
      'image/jpeg',
      0.88,
    );
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="ครอปรูปสำหรับจิ๊กซอ">
        <h2 className="modal-title">เลือกสัดส่วนของจิ๊กซอ</h2>

        <div className="ratio-row" role="group" aria-label="สัดส่วนภาพ">
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
              alt="รูปที่กำลังครอป"
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
          <span>ซูม</span>
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        {cropW < 400 && <p className="muted small">รูปนี้ความละเอียดค่อนข้างต่ำ จิ๊กซอจะไม่คมนัก</p>}
        {error && <p role="alert" className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-quiet" onClick={onCancel}>ยกเลิก</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={working}>
            {working ? 'กำลังเตรียมรูป…' : 'ใช้รูปนี้'}
          </button>
        </div>
      </div>
    </div>
  );
}
