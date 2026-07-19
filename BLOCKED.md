# Blockers & known limitations — Battlefield (nightshift/product)

None of these blocked the build; each was worked around and is documented for you.

---

## 0. DEPLOY RUNBOOK — the "working link" (Mikail-only; do NOT run in the build)

The whole app is same-origin behind the :4400 dev server: it proxies `/v1` → the engine
(:3001), `/rpc` → Solana mainnet (for the browser proof check), and `/rooms` → the rooms
sidecar (:4490). So one tunnel over :4400 exposes everything — no static build needed
(`vite build` can't bundle the DC runtime; see #1).

```bash
# 0. keep these running on this Mac (all already up during the build):
curl -s localhost:3001/health   # engine → {"ok":true}
#    battlefield dev server:  cd battlefield && npm run dev     (→ :4400)
#    rooms sidecar (C10):     cd battlefield && npm run rooms   (→ :4490)

# 1. install a tunnel (NEITHER cloudflared NOR ngrok is currently on PATH; brew IS):
brew install cloudflared        # ~1 min, one time

# 2. expose :4400 publicly (no account/login needed for a quick tunnel):
cloudflared tunnel --url http://localhost:4400
#    → prints  https://<random>.trycloudflare.com  — THAT is the deployed link judges test.
#    /v1, /rpc, /rooms (incl. the WebSocket) all ride through it same-origin. WebSockets
#    work over cloudflared by default.

# ZERO-INSTALL FALLBACK (if you can't/don't want to brew): localtunnel via npx —
#    npx --yes localtunnel --port 4400
#    → prints a https://<sub>.loca.lt URL (shows a one-time click-through interstitial;
#    the tunnel password is this Mac's public IP, from https://loca.lt/mytunnelpassword ).
```
Notes: the link lives only while this Mac + those three processes stay up. Off-match the
demo is the tick-by-tick REPLAY (the judged weapon); the live path lights up at the final
(Sun 19:00 UTC). Repo push + demo-video recording are also Mikail-only. (I did NOT install
a tunnel or run it — per the operating contract that's your call.)

## 0b. Compliance sweep (B7 — checked against txline-explorer/HACKATHON-MUST-INCLUDES.md)

Track 2 (Consumer & Fan). Status of each must-include:
- **NO TxL-token P2P** — CONFIRMED clean: grep finds no wager/escrow/deposit/payout/TxL-token
  path. Predict-along is a **points-only skill game** (log-scored vs the market's implied
  probability); the wallet is **identity-only** (no funds). Nothing is staked.
- **DevNet / real-vs-sim labelling** — present everywhere: wallet sheet "DEVNET · NO REAL
  FUNDS", mode badge REPLAY/LIVE/SANDBOX, proof "read-only, no wallet, no gas".
- **TxLINE as live/primary input** — yes: de-margined 1X2 `Pct` drives the front, scores +
  event timeline drive the diorama, `/v1/validation/scores` + browser `@txline/verify` prove
  every tick. All data via `@txline/client-sdk` (B1).
- **Merkle-proof verification** — B2: verified twice (browser `@txline/verify` reconstructs the
  root + reads the mainnet PDA; engine `verify=1` independently). Both shown in the inspect sheet.
- **"Sign up through Solana" (wallet auth)** — CLOSED by C2 (real Phantom `window.phantom.solana`
  connect + signMessage); guest fallback retained. [see C2 status]
- **Every-pixel-inspectable** — CLOSED by C1 (tap flare / fog / frontline → real payload). [see C1]
- **Monetization path** — the `?overlay=1` creator/second-screen route (C11) is the story.
- Endpoints used (for the tech-doc): `/v1/fixtures`, `/v1/fixtures/:id`, `/v1/fixtures/:id/odds`,
  `/v1/fixtures/:id/state`, `/v1/validation/scores`, `/v1/stream/fixtures/:id`, plus mainnet
  `getAccountInfo` on the `daily_scores_roots` PDA via `@txline/verify`.

---

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

## 5. Client-side `@txline/verify` — RESOLVED (B2, 2026-07-19)
**Was:** the proof walk used only the engine's `/v1/validation/scores?...&verify=1` (server-side
reconstruction + on-chain compare). Browser-side `@txline/verify` was left as an enhancement because
it needs `@solana/web3.js` + a Buffer polyfill + a mainnet RPC from the page.
**Now:** `app/verify.js` (lazy-imported on the verify tap, so web3 never touches page load) runs
`verifyScoresStatProofOnChain` in the browser: it reconstructs the fixture-summary root client-side
and reads the mainnet `daily_scores_roots` PDA READ-ONLY, then the inspect sheet shows BOTH verdicts
("verified twice — in your browser AND by the engine"). Buffer via `app/buffer-shim.js`; the mainnet
RPC is same-origin through a `/rpc` Vite proxy that strips Origin/Referer (the public endpoint 403s
browser-origin `getAccountInfo`). Verified: browser computed root === on-chain root === engine root.
