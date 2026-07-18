# Battlefield — Build Status (nightshift/product)

Overnight productization: synthetic prototype → real TxLINE data + consumer layer.
Engine: http://localhost:3001 (base txline-explorer). Dev server: **port 4400** (`--strictPort`).
Prime directive: **renderer (engine.js) + BattleFrame/BattleEvent contract DO NOT CHANGE.**
We swap the driver and add UI around the existing HUD.

## Acceptance criteria (authored up front — do not weaken)

### P0 — Real data bridge (has a written spec; cut-line #1)
- [x] `bridge/mapping.js`: pure, hermetic mappers (statusId→phase, 1X2 Pct→prob, possession level→zone, action→BattleEvent, front/momentum derivation). Unit-tested against recorded fixtures. **(13/13 green)**
- [x] `bridge/replay-source.js`: fetch fixture detail + 1X2 odds series; build a **ts-native, match-clock-derived** model (clock anchored on real event minutes + phase transitions, HT frozen, stoppage honoured); prob path with **suspension gaps at goals** (never interpolated). **(9/9 green)**
- [x] `bridge/real-driver.js`: `RealMatchDriver` — same `{onFrame,onEvent}` + method surface as synthetic (inject/forceThreat/setFogForced/setMomentumOverride/jumpToFinale/setPaused/setSpeed/destroy) + seek/seekProgress. REPLAY (virtual match clock) + LIVE (SSE) paths. **(8/8 green + verified in browser)**
- [x] Score always in sync with the clock; halftime is not a minute tick; stoppage/ET handled. **(browser-verified: ENG-ARG plays 1-0 → 1-1 → 1-2, clock frozen at HT, suspension at the equalizer)**
- [x] HUD team identity **dynamic** (home/away abbr+name+palette+SVG flag from fixture via bridge/teams.js), not ENG/ARG literals.
- [x] Synthetic driver still selectable (`?mode=synthetic`) as offline/demo fallback (+ auto-fallback if engine unreachable).

### P1 — Consumer layer (new scope; design as we go)
- [x] Fixture picker over all corpus fixtures, segmented live/upcoming/finished, SVG country flags, search, sorted by market depth. **(browser-verified: 109 finished + 8 upcoming; fixture switch re-skins the diorama, e.g. BRA vs HAI)**
- [x] Replay scrubber: seek within a match; cinematic continuous fast-forward (1×/2×/4×/8×); pause-on-drag, resume-on-release. **(verified)**
- [x] Every-pixel-inspectable: VERIFY opens the tick payload (real state) → "verify this tick" → **real Merkle proof walk** (leaf → sub-tree → root → on-chain account) via `/v1/validation/scores`. **(verified: computed root === on-chain root, PROVEN AUTHENTIC)**
- [x] Predict-along: danger-spell war-drum prompt (real pre-goal threat windows); answers log-scored vs market implied prob; per-match leaderboard (localStorage). **(verified: RAID INCOMING fires + scores)**
- [x] Share: replay link (fixture + ts params) restores state; poster-frame PNG export (canvas snapshot). **(verified)**
- [x] Wallet sign-in (devnet, clearly labelled DEVNET · NO REAL FUNDS; localStorage session). **(verified)**

### Guardrails (owner "Do not" list)
- [x] Sparkline honest across suspensions (never interpolate) — model holds prob + gaps at goals.
- [x] No 100vh (100dvh used); no separate mobile-landscape layout; no real crests/FIFA marks (abstract SVG flags + army palettes).
- [x] Audio off by default; cinematics never block the frame loop; renderer untouched.
- [x] Label reality: DevNet badge on wallet, REPLAY/LIVE badge in the top bar, "no wallet, no gas" on the proof.

## Phase log
| Phase | Status | Notes |
|---|---|---|
| Recon + engine probes | PASS | Engine live, 116 fixtures, all shapes confirmed, hermetic fixtures captured |
| P0 mapping.js + tests | PASS | 13/13 hermetic tests green |
| P0 replay-source.js + tests | PASS | 9/9; match-clock model verified against real ENG-ARG |
| P0 real-driver.js | PASS | 8/8; REPLAY virtual clock + LIVE SSE; same method surface |
| P0 HUD dynamic identity + factory | PASS | app/session.js swaps driver+engine+palette per fixture; browser-verified |
| P0 teams.js palettes + SVG flags | PASS | 6/6; 32 hand-tuned palettes + 25 real flags + generated fallback |
| P1 fixture picker | PASS | app/console.jsx; segmented + flags + search; verified |
| P1 scrubber | PASS | seek + 1/2/4/8× fast-forward; verified |
| P1 inspect + Merkle proof | PASS | real /v1/validation/scores proof walk; PROVEN AUTHENTIC verified |
| P1 predict-along | PASS | pre-goal threat windows + log-score + local leaderboard; verified |
| P1 share + poster | PASS | deep-link + canvas PNG export; verified |
| P1 wallet sign-in | PASS | devnet-labelled localStorage session; verified |
| Playwright verification | PASS | full phone-portrait journey (pick→replay→inspect→verify→predict→poster) + desktop console smoke; zero console errors; screenshots in docs/screenshots/ |
| Corpus breadth | PASS | 23/23 sampled fixtures (highest/middle/lowest odds-depth) replay cleanly end-to-end: frames flow, fulltime fires, prob always sums to ~100, no throws — validates "all 116 replayable" |
| Round-2 polish | PASS | composed poster frame · tappable War Feed → per-event Merkle proof · persistent predict record in wallet |
| Live SSE mode | SMOKE | mode=live opens composite SSE, LIVE badge, frames flow, no crash (intended for Sun final) |
| Production build (`vite build`) | KNOWN-LIMIT | DC runtime (support.js) + x-import .jsx are runtime-fetched, not bundled → run via `npm run dev`. See BLOCKED.md |

_Run: `npm run dev` (→ :4400). Tests: `node --test bridge/`._
