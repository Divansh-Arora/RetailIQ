import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api is proxied to the Express server so the browser never talks to MySQL
// (or even to a different origin). Override the target with VITE_PROXY_TARGET if needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:5000' },
  },
});
