import { io } from 'socket.io-client';

// ปกติเว็บกับเซิร์ฟเวอร์อยู่ origin เดียวกัน (dev ผ่าน proxy, prod เสิร์ฟจาก server)
// ถ้าแยกโฮสต์ ให้ตั้ง VITE_SERVER_URL ตอน build
const BASE = import.meta.env.VITE_SERVER_URL || '';

export const socket = io(BASE || undefined);
export const serverUrl = (path) => BASE + path;

export function request(event, payload = {}) {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload, (timedOut, res) => {
      resolve(timedOut ? { ok: false, code: 'TIMEOUT' } : res);
    });
  });
}
