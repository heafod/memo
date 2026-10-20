import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 开发代理保持同源：浏览器只访问 Vite（:5173），/api 由 Vite 转发到 backend，
// 会话 Cookie（SameSite=Lax）按同源下发；不依赖、也不修改后端 CORS。
const BACKEND = process.env.VITE_BACKEND_URL ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: { proxy: { '/api': { target: BACKEND, changeOrigin: false } } },
});
