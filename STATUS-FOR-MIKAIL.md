# Night-shift handoff — The Probability Battlefield, now on real TxLINE data (2026-07-18)

## TL;DR

The war diorama is no longer a puppet. The synthetic `driver.js` has been replaced by a **real data
bridge** that folds live TxLINE market state into the exact `BattleFrame`/`BattleEvent` contract the
renderer already speaks — so **all 116 corpus matches are now playable battles**, driven by the real
de-margined 1X2 probabilities, real scores, real event timeline, with true match-clock semantics
(halftime frozen, stoppage/ET honoured, score always in sync). **The renderer (`engine.js`) and the
data contract were not touched** — exactly the seam the architecture was designed around.

On top of that, the whole **consumer layer** now exists: a fixture picker over the corpus, a replay
scrubber with cinematic 1×/2×/4×/8× fast-forward, **every tick is inspectable with a real Merkle
proof walk** (leaf → sub-tree → root → the Solana account that anchored it), a **predict-along**
war-drum scored against the market's implied probability, **share links + poster export**, and
**devnet wallet sign-in**. Verified end-to-end in a phone-portrait Playwright journey with zero
console errors.

**One thing to know:** the run path is **`npm run dev`** (port 4400). The DC "Claude Design" runtime
+ `<x-import>` .jsx components are runtime-fetched, so `vite build` does not produce a runnable
bundle, and the engine is local-only — a "deployed link" needs the engine tunnelled (see `BLOCKED.md`,
a platform-wide issue). The dev server on this Mac is the demo, and it's solid.

Your six corrections from last run were all honoured: **real data**, **match-clock not wall-clock**,
**simulated-live progression** (replay is the whole product), **mobile-first + segmented fixtures**,
**cinematic continuous fast-forward** (no chart mush — the virtual clock sweeps smoothly at any
speed), and **score stays in sync** with the clock in both modes. DevNet/replay-vs-live are badged in
the UI everywhere.

## What works — verified in the browser (Playwright, phone-portrait 402×874)

Full journey, watched live, zero page/console errors (`docs/screenshots/`):

1. **Real replay of the England–Argentina final** (`?fixture=18241006`). The battle plays the true
   arc: England lead 1–0 (win-prob leaps **28% → 68%** at their 54' goal, the real de-margined jump),
   Argentina equalise 1–1 (market suspends, fog rolls in), Argentina win 1–2 (England's line
   collapses to ~0.4%). Clock freezes at **48:00 · HT**, resumes for H2, full-time verdict correct.
   `docs/screenshots/core-portrait.png`, `goal-suspension.png`.
2. **Fixture picker** — `MATCHES` opens "CHOOSE YOUR BATTLE": segmented **LIVE / UPCOMING (8) /
   FINISHED (109)**, SVG country flags, search, sorted by market depth. Picking **Brazil–Haiti** or
   **France–Iraq** re-skins the entire diorama (army palettes + flags + abbreviations) from fixture
   data. `docs/screenshots/picker.png`.
3. **Replay scrubber** — seek anywhere in the match; play/pause; **1×/2×/4×/8×** continuous
   fast-forward that never thins the sparkline into mush (the clock, score and events stay coherent).
4. **Every tick inspectable → real Merkle proof** — `VERIFY` (or **tapping any War Feed event**)
   shows the raw TxLINE state, then "**VERIFY THIS TICK ON-CHAIN**" fetches its proof and walks it in
   plain language: **① the leaf** (the exact stat numbers) → **② the branch** (sub-tree sibling
   hashes) → **③ the root** (computed) → **④ on-chain** (the anchored root on Solana account
   `6d9bJ2Et…`, epoch day). Verdict **PROVEN AUTHENTIC** when `computedRoot === onChainRoot`. Tapping
   a goal proves `key 1 = 1` — the exact number on the scoreboard. `docs/screenshots/proof.png`,
   `tap-feed-proof.png`.
5. **Predict-along** — during a danger spell a **⚔ RAID INCOMING** war-drum asks goal / corner /
   nothing, showing the market's implied goal chance; the pick is **log-scored against that
   probability** (beating an unlikely-rated call pays more) and accrues a campaign total.
   `docs/screenshots/predict.png`.
6. **Share the war** — copy a **replay deep-link** (`?fixture=&mode=&t=` restores the exact fixture +
   moment) and **export a poster PNG** of the terrain (verified: a 1.4 MB canvas snapshot downloads).
7. **Wallet sign-in** — devnet identity (clearly badged **DEVNET · NO REAL FUNDS**), persisted for
   the leaderboard.
8. **Desktop command console** (`≥1024px`) — MATCH STATS, the ENG-WIN **probability path sparkline
   with honest suspension gaps**, a WAR FEED of real anchored events, all coexisting with the console
   chrome. `docs/screenshots/desktop-console.png`.

Bridge logic is covered by **36 hermetic unit/integration tests** (`node --test bridge/`, all green)
run against recorded fixtures — mapping, the match-clock model, suspension gaps, the driver's event
stream, and the flag/palette module.

## Architecture (what's new tonight)

```
battlefield/
  driver.js            UNCHANGED synthetic driver — kept as offline/demo fallback (?mode=synthetic)
  engine.js            UNCHANGED renderer (the prime directive)
  index.html           HUD shell — now: async fixture load, DYNAMIC team identity (no ENG/ARG
                       literals), window.BATTLE control+data API, frame/event subscribe, deep-links
  bridge/
    mapping.js         pure StatusId→phase / 1X2-Pct→prob / possession→zone / action→BattleEvent (+tests)
    replay-source.js   ts-native replay model: match-clock model (HT frozen, H2@45:00, stoppage/ET),
                       real prob path with honest suspension gaps at goals, event + threat timelines
    real-driver.js     RealMatchDriver — SAME {onFrame,onEvent} + method surface as MatchDriver;
                       virtual-clock cinematic replay + seek + a LIVE composite-SSE path
    teams.js           64 nation army palettes + self-contained SVG flags (+ generated fallbacks)
    __fixtures__/      recorded engine responses the tests run against (hermetic, no network)
  app/
    session.js         openSession() — unifies synthetic/replay/live; builds engine THEN driver
    console.jsx        the consumer overlay (x-import): picker, scrubber, inspect+proof, predict,
                       share, wallet — talks to the HUD only through window.BATTLE
  vite.config.js       :4400 strictPort + /v1 proxy to the engine (same-origin, no CORS, SSE-friendly)
```

**The one seam that changed:** `index.html` used to `new MatchDriver(...)`. It now
`openSession({mode, fixtureId})` → loads the replay model → builds the engine with the fixture's
palette → starts a `RealMatchDriver` bound to that model. Everything downstream (HUD, War Room,
`window.BF`) is unchanged because the new driver keeps the identical callback + method surface.

**Data sources used** (all via the same-origin `/v1` proxy):
`GET /v1/fixtures?status=all` (picker) · `GET /v1/fixtures/:id` (teams, phases, event timeline) ·
`GET /v1/fixtures/:id/odds?market=1X2_PARTICIPANT_RESULT` (the de-margined prob path) ·
`GET /v1/fixtures/:id/state?ts=` (inspect payload) ·
`GET /v1/validation/scores?fixtureId=&seq=&statKeys=&verify=1` (the Merkle proof + on-chain verdict) ·
`GET /v1/stream/fixtures/:id` (live mode).

## Honest rough edges

- **`vite build` is not the deploy path** — the DC runtime + x-import .jsx are runtime-fetched, not
  bundled. Run with **`npm run dev`**. Static-deploying needs a copy step + a reachable engine origin
  (see `BLOCKED.md` #1/#2). The engine is local-only, so a public link needs it tunnelled.
- **CDN dependency** — React/Babel/fonts load from unpkg + Google Fonts; **no network ⇒ white screen**.
  The data feed is same-origin; only the libs are at risk. Vendor them before an unreliable-Wi-Fi demo.
- **Live mode is smoke-tested, not match-tested** — verified it connects/streams/renders; not yet run
  against a genuinely live match (none tonight). Replay is the judged weapon regardless.
- **Merkle proof uses the engine's `verify=1` endpoint** (server-side reconstruction + on-chain
  compare), not browser-side `@txline/verify`. Same cryptographic guarantee; the SDK path is a
  documented enhancement.
- **Live stats** (possession %, shots, danger time) are still computed client-side from frames, as in
  the prototype — the engine's per-player/period-bucketed stats aren't surfaced yet.
- **Momentum / ambient possession are derived**, not read from the feed (the bridge spec always
  intended this); they're biased toward the side the data favours so they never contradict the market.
- Desktop is functional "smoke" quality — the portrait phone layout is the polished primary target.

## Run commands

```bash
# 0. the engine must be up (it already is): curl -s localhost:3001/health  → {"ok":true}
cd /Users/mikail/Desktop/PulsePlay/battlefield
npm install            # already done; installs Vite + the two SDK tarballs
npm run dev            # → http://localhost:4400  (LAN URL printed for phone testing)
npm test               # node --test bridge/  → 36 passing

# deep-links
#   http://localhost:4400/?fixture=18241006&mode=replay      the ENG–ARG final (default, richest arc)
#   pick any of the other 115 from the MATCHES picker (e.g. Canada 6–0 Qatar, Brazil 3–0 Haiti)
#   http://localhost:4400/?mode=synthetic                    offline fallback (no engine needed)
#   ...&dur=120                                              faster full-match playback (default 210s)
```

Open the printed **Network** URL on a phone in **portrait** (primary), or a desktop ≥1024px for the
command console.

## 3-beat demo script (~90s)

1. **"The match, as the market lives it."** Land on the England–Argentina final. Hit **4×** and let
   the battle play: England's line surges as their win-probability leaps 28→68% at the 54' goal, the
   market suspends (fog), then Argentina claw it back and overrun England at full time — every troop,
   every metre of trench is the real de-margined probability moving.
2. **"Every pixel is provable."** Pause, tap **VERIFY** → the raw tick → **VERIFY THIS TICK ON-CHAIN**
   → the leaf → root → **the Solana account that anchored it**, computed root === on-chain root,
   **PROVEN AUTHENTIC**. No other fan app can do this, because no other feed is provable.
3. **"Play along, then share it."** Scrub back into a danger spell → **RAID INCOMING** → call the
   goal, beat the market, bank the points. Open **MATCHES** to show all 116 battles (Brazil–Haiti,
   France–Iraq, Canada–Qatar) one tap away, then **share** a replay link + poster of the terrain at
   full time.
