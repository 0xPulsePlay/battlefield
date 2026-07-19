// app/data.js — the ONE place @txline/client-sdk is imported. The HUD (index.html)
// runs under the DC "Claude Design" runtime where bare npm imports don't resolve,
// so it can't import the SDK directly; instead it dynamically imports THIS Vite
// module (where npm imports resolve) and routes all /v1 access through the client
// this factory builds. The bridge modules take the same client. Result: every REST
// + resumable-SSE call in the app goes through the SDK, not a raw fetch/EventSource.

import { TxlinePlatformClient, TxlinePlatformError } from '@txline/client-sdk';

export { TxlinePlatformClient, TxlinePlatformError };

// baseUrl '' → same-origin (Vite proxies /v1 → the engine; see vite.config.js).
// A ?api= override passes a raw origin straight through to the SDK.
export function makeClient(baseUrl = '') {
  return new TxlinePlatformClient({ baseUrl: baseUrl || '' });
}
