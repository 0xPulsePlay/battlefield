import { defineConfig } from 'vite';

// The battlefield runs on :4400 and talks to the TxLINE engine on :3001. We proxy
// /v1 (REST + SSE) through Vite so the browser makes same-origin requests — no CORS,
// and deep-links / the live stream just work. Override the engine with ENGINE_URL.
const ENGINE = process.env.ENGINE_URL || 'http://localhost:3001';

export default defineConfig({
  // Pre-bundle the data SDK at startup so the first dynamic import of app/data.js
  // doesn't trigger a mid-demo re-optimize + full reload.
  optimizeDeps: { include: ['@txline/client-sdk'] },
  server: {
    host: true,
    port: 4400,
    strictPort: true,
    proxy: {
      '/v1': {
        target: ENGINE,
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          // SSE needs buffering off; keep the connection streaming
          proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('accept-encoding', 'identity'));
        },
      },
    },
  },
});
