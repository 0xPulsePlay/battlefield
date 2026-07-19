import { defineConfig } from 'vite';

// The battlefield runs on :4400 and talks to the TxLINE engine on :3001. We proxy
// /v1 (REST + SSE) through Vite so the browser makes same-origin requests — no CORS,
// and deep-links / the live stream just work. Override the engine with ENGINE_URL.
const ENGINE = process.env.ENGINE_URL || 'http://localhost:3001';

export default defineConfig({
  // Pre-bundle the SDKs at startup so the first dynamic import of app/data.js or
  // app/verify.js doesn't trigger a mid-demo re-optimize + full reload. @txline/verify
  // pulls @solana/web3.js + buffer (the browser Merkle walk); pre-bundling avoids a
  // reload the first time a judge taps "verify this tick".
  optimizeDeps: { include: ['@txline/client-sdk', '@txline/verify', '@solana/web3.js', 'buffer'] },
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
      // Same-origin Solana mainnet RPC for the browser-side @txline/verify check.
      // The public endpoint 403s any request carrying a browser Origin/Referer, so
      // we proxy server-side (like /v1) AND strip those headers so mainnet sees a
      // clean server request. READ-ONLY reads only — no signing, no SOL.
      '/rpc': {
        target: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
});
