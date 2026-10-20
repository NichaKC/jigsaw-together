import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ตอนพัฒนา: ส่งต่อ WebSocket และ /api ไปที่เซิร์ฟเวอร์ (พอร์ต 3001) เพื่อไม่ต้องตั้ง CORS
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // เปิดให้มือถือในวง Wi-Fi เดียวกันเข้าทดสอบได้
    port: 5173,
    proxy: {
      '/socket.io': { target, ws: true },
      '/api': target,
    },
  },
});
