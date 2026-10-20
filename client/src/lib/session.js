// clientId เก็บใน sessionStorage = แยกกันต่อแท็บ (เปิด 2 แท็บทดสอบเป็นคนละคนได้)
// ชื่อผู้เล่นเก็บใน localStorage เพื่อให้จำชื่อล่าสุดไว้
const mem = {};
const safe = (store, key, value) => {
  try {
    if (value === undefined) return store.getItem(key);
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    if (value === undefined) return mem[key] ?? null;
    mem[key] = value;
  }
  return value === undefined ? null : value;
};

const randomHex = (bytes) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

export function getClientId() {
  let id = safe(sessionStorage, 'jigsaw.clientId');
  if (!id) {
    id = randomHex(16); // ไม่ใช้ randomUUID เพราะใช้ไม่ได้บน http://192.168.x.x
    safe(sessionStorage, 'jigsaw.clientId', id);
  }
  return id;
}
export const loadPin = () => safe(sessionStorage, 'jigsaw.pin');
export const savePin = (pin) => safe(sessionStorage, 'jigsaw.pin', pin);
export const clearPin = () => safe(sessionStorage, 'jigsaw.pin', null);
export const loadName = () => safe(localStorage, 'jigsaw.name') || '';
export const saveName = (name) => safe(localStorage, 'jigsaw.name', name);

// คัดลอกข้อความ (clipboard API ใช้ไม่ได้บน http ที่ไม่ใช่ localhost จึงมีทางสำรอง)
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}
