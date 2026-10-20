import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, proxy WebSocket and /api to the server (port 3001) so no CORS setup is needed.
const target = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // lets phones on the same Wi-Fi connect for testing
    port: 5173,
    proxy: {
      '/socket.io': { target, ws: true },
      '/api': target,
    },
  },
});
