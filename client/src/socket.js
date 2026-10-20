import { io } from 'socket.io-client';

// Normally the web app and server share an origin (dev via proxy, prod served by the server).
// If they're hosted separately, set VITE_SERVER_URL at build time.
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
