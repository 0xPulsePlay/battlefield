# Blockers & known limitations — Battlefield (nightshift/product)

None of these blocked the build; each was worked around and is documented for you.

## 1. Production `vite build` does not produce a runnable bundle (run via dev server)
**What:** `npm run build` emits a partial `dist/` (index.html + engine/teams chunks) but **omits**
`support.js` (the "Claude Design" runtime, a non-module `<script>`) and the `.jsx` components loaded
at runtime via `<x-import ... from="./app/console.jsx">` — those are *runtime fetches*, invisible to
Vite's module graph, so they aren't bundled or copied.
**Why it's fine:** this app is designed to run as **static files + CDN React/Babel + runtime JSX
transform**; it doesn't need a bundler. The run path is **`npm run dev`** (Vite dev server on :4400
with the `/v1` proxy), which works fully and is what the demo uses.
**Tried:** confirmed the dynamic `import()`s that Vite *can* see (engine.js, teams.js, session.js
graph) do bundle; the gap is only the DC-runtime + x-import files.
**To make a static deploy later:** serve the repo directory as-is behind any static server and point
`?api=` at a reachable engine origin (CORS-open), or add a Vite `publicDir`/copy step for
`support.js`, `driver.js`, `engine.js`, and `app/*.jsx`. Not attempted tonight (see #2).

## 2. "Working deployed link" needs the engine deployed (platform is local-only)
**What:** the TxLINE engine (`:3001`) is **local-only** (per the engine manual — every consumer must
run on this Mac). There is no public engine URL to point a deployed frontend at.
**Impact:** the hackathon "working deployed link" requirement can't be satisfied without either
tunnelling `:3001` (e.g. cloudflared/ngrok) or standing the engine up somewhere. This is a
**platform-wide blocker shared by all five apps**, tracked in `txline-explorer/docs/PLATFORM-PLAN.md`.
**Demo path tonight:** `npm run dev` on this Mac (engine already running on :3001).

## 3. Offline / venue-Wi-Fi risk: React + Babel + Google Fonts load from CDN
**What:** `support.js` pulls React (unpkg) and Babel-standalone at load, and the HUD uses Google
Fonts. With **no network, the page white-screens** (the "no network calls" rule was only ever about
the *data feed*).
**Not changed:** vendoring React/Babel locally risks breaking the DC runtime's expectations; deferred
as too risky to do blind overnight. **Before demo day:** confirm venue Wi-Fi, or vendor React/Babel +
fonts. The *data* path is already same-origin (Vite `/v1` proxy) so only the CDN libs are at risk.

## 4. Live SSE mode is smoke-tested, not match-tested (no live match tonight)
**What:** `?mode=live` opens the composite per-fixture SSE (`/v1/stream/fixtures/:id?since=0`),
shows the LIVE badge, and drives the same frame emitter from real ticks. Verified it connects,
streams, and renders without error. It has **not** been exercised against a genuinely live match
(none is running — the final is Sun 19:00 UTC). Off-match, `since=0` replays the whole log unpaced;
during a live match it tails in real time (the intended behavior). Replay mode is the demo weapon.

## 5. Client-side `@txline/verify` not wired (engine endpoint used instead)
**What:** the Merkle proof walk fetches `/v1/validation/scores?...&verify=1`, which runs the proof
reconstruction **and the on-chain root comparison server-side** and returns the verdict + proof
nodes. This is real cryptographic verification (computed root === the root Solana anchored), just
performed by the engine rather than by `@txline/verify` in the browser.
**Why:** browser-side `@txline/verify` needs `@solana/web3.js` + a Buffer polyfill + a mainnet RPC
from the page — more fragile for a live demo. The tarball is installed (`node_modules/@txline/verify`)
and could be wired as an independent second check; left as a documented enhancement.
