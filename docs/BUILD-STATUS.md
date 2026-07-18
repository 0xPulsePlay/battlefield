# Battlefield — Build Status (nightshift/product)

Overnight productization: synthetic prototype → real TxLINE data + consumer layer.
Engine: http://localhost:3001 (base txline-explorer). Dev server: **port 4400** (`--strictPort`).
Prime directive: **renderer (engine.js) + BattleFrame/BattleEvent contract DO NOT CHANGE.**
We swap the driver and add UI around the existing HUD.

## Acceptance criteria (authored up front — do not weaken)

### P0 — Real data bridge (has a written spec; cut-line #1)
- [x] `bridge/mapping.js`: pure, hermetic mappers (statusId→phase, 1X2 Pct→prob, possession level→zone, action→BattleEvent, front/momentum derivation). Unit-tested against recorded fixtures. **(13/13 green)**
- [ ] `bridge/replay-source.js`: fetch fixture detail + 1X2 odds series; build a **match-clock-indexed** model (clock anchored on real event minutes + phase transitions, HT frozen, stoppage honoured); prob path with **suspension gaps at goals** (never interpolated). Hermetic tests.
- [ ] `bridge/real-driver.js`: `RealMatchDriver` with the **same `{onFrame,onEvent}` constructor + method surface** as the synthetic `MatchDriver` (inject/forceThreat/setFogForced/setMomentumOverride/jumpToFinale/setPaused/setSpeed/destroy) + seek/loadFixture. REPLAY (virtual match clock) + LIVE (SSE).
- [ ] Score always in sync with the clock; halftime is not a minute tick; stoppage/ET handled.
- [ ] HUD team identity **dynamic** (home/away abbr+name+palette from fixture), not ENG/ARG literals.
- [ ] Synthetic driver still selectable (`?mode=synthetic`) as offline/demo fallback.

### P1 — Consumer layer (new scope; design as we go)
- [ ] Fixture picker over all 116 corpus fixtures, segmented live/upcoming/finished, country flags (SVG).
- [ ] Replay scrubber: seek within a match; cinematic continuous fast-forward (1x/2x/4x/8x); no chart mush.
- [ ] Every-pixel-inspectable: tap feed row/flare → real PossibleEvent/tick payload; long-press frontline → 1X2 Pct + "verify this tick" → **real Merkle proof walk** (leaf → root → on-chain account) via the validation endpoint.
- [ ] Predict-along: danger-spell war-drum prompt; answers log-scored vs market probability; per-match leaderboard (local).
- [ ] Share: replay link (fixture + match-second params) restores state; poster-frame export (canvas snapshot at full time).
- [ ] Wallet sign-in (devnet, clearly labelled).

### Guardrails (owner "Do not" list)
- [ ] Sparkline honest across suspensions (never interpolate).
- [ ] No 100vh (use 100dvh); no separate mobile-landscape layout; no real crests/FIFA marks.
- [ ] Audio off by default; cinematics never block the frame loop; hold ~50fps.
- [ ] Label reality: DevNet / replay-vs-live badges explicit in the UI.

## Phase log
| Phase | Status | Notes |
|---|---|---|
| Recon + engine probes | PASS | Engine live, 116 fixtures, all shapes confirmed, hermetic fixtures captured |
| P0 mapping.js + tests | PASS | 13/13 hermetic tests green |
| P0 replay-source.js + tests | PENDING | |
| P0 real-driver.js | PENDING | |
| P0 HUD dynamic identity + factory | PENDING | |
| P1 fixture picker | PENDING | |
| P1 scrubber | PENDING | |
| P1 inspect + Merkle proof | PENDING | |
| P1 predict-along | PENDING | |
| P1 share + poster | PENDING | |
| P1 wallet sign-in | PENDING | |
| Playwright verification | PENDING | |

_Run: `npm run dev` (→ :4400). Tests: `node --test bridge/`._
