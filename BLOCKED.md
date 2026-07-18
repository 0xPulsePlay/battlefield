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

## 3. Offline / venue-Wi-Fi risk: React + Babel + Google Fonts load from CDN — **DAY-SHIFT ITEM**
**What:** `support.js` pulls React (unpkg) and Babel-standalone at load, and the HUD uses Google
Fonts. With **no network, the page white-screens** (the "no network calls" rule was only ever about
the *data feed*).
**Decision (night-shift):** do **not** vendor tonight — redirecting the generated `support.js` off its
CDN URLs risks the DC runtime, and the run path must not change under the freeze protocol. This is a
**day-shift task for the venue/deployed demo**, not a functional gap in the app.
**Day-shift plan:** download React 18 UMD (dev+prod) + Babel-standalone + the two Google fonts into
`public/vendor/`, then either (a) add a tiny pre-`support.js` shim that sets `window.React`/`ReactDOM`
from the local copies so `support.js` finds them already-present, or (b) add a Vite dev-proxy for
`unpkg.com`/`fonts.*` so they're served same-origin. Confirm venue Wi-Fi as the fallback. The *data*
path is already same-origin (Vite `/v1` proxy), so only the CDN libs are at risk.

## 3b. Real Solana wallet-adapter connect is labelled "planned", not wired — **DAY-SHIFT ITEM**
**What:** wallet sign-in creates a **local guest identity** (a devnet-labelled pubkey stand-in in
localStorage) to persist the predict-along record. It is honestly labelled in the UI — "GUEST IDENTITY
· DEVNET LABEL · NO REAL FUNDS · WALLET CONNECT PLANNED" — and never claims a real signature.
**Why not tonight:** a real `@solana/wallet-adapter` (Phantom/Backpack) integration means bundling npm
React components, which the DC "Claude Design" runtime + CDN-React + no-`vite build` architecture makes
risky, and the run path must not change under the freeze. The **real Solana substance is the Merkle
proof walk** — every tick verified against the on-chain oracle, no wallet required — so wallet-connect
is a login convenience, not the on-chain story.
**Day-shift plan:** in a normal bundled app shell (or once React is vendored per #3), mount
`@solana/wallet-adapter-react` with the Phantom/Backpack wallets, use `signMessage` for a
sign-in-with-Solana challenge, and swap the guest pubkey for the connected one. Predict records key off
the pubkey already, so the storage layer needs no change.

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
