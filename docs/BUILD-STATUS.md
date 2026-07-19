# Battlefield — Build Status

Engine: http://localhost:3001 (base txline-explorer). Dev server: **port 4400** (`--strictPort`).
Rooms sidecar (C10): **port 4490**. Prime directive: **renderer (engine.js) + BattleFrame/BattleEvent
contract DO NOT CHANGE.** We swap the driver and add UI around the existing HUD.

Run: `npm run dev` (→ :4400) · rooms: `npm run rooms` (→ :4490) · tests: `npm test` (`node --test bridge/`).

---

# FINAL ROUND — spec 05b-battlefield-final-round (2026-07-19)

Confirmed phase order (Mikail chose SDK-first):
**B1→B2 (SDK) · B3–B6 (bugs) · B7 (compliance) · C1–C3 (inspect+wallet) · C4–C6 (game loop) ·
C10 (rooms) · C7–C9 (layout/camera/picker) · C11 (overlay) · D1 (vendor).**
Deadline TONIGHT 23:59 UTC; final kicks off 19:00 UTC. Commit at every green milestone; never leave
main broken. Playwright-verify each phase phone-portrait (402×874) first.

## Acceptance criteria (from the spec AC lines — do not weaken)

### P0 — Correctness & compliance
| ID | Acceptance criterion | Status |
|---|---|---|
| B1 | `grep -rn "fetch(.*/v1"` (app code, excl node_modules/fixtures) → **zero** hits; all bridge tests green; full replay journey plays in Playwright | **PASS** — grep=0; 36/36 tests; Playwright: data.js loaded, /v1 fixture+odds+fixtures(117)+proof all via SDK, computed root===chain (b23f6841), playback advances, 0 console errors |
| B2 | Browser-side `@txline/verify` walks the Merkle proof; browser-computed root matches on-chain; engine `verify=1` shown as independent 2nd check; zero console errors | **PASS** — app/verify.js (lazy, buffer-shim) + `/rpc` proxy (strips Origin, which mainnet 403s). Playwright: browser_verified=true, browser computed===chain===engine (b23f6841), 531ms, sheet shows "VERIFIED TWICE" + both checks ✓, 0 console errors |
| B3 | Extra/stoppage time no longer always 0 — replay of a fixture with known stoppage shows non-zero added minutes at the right times; ET periods labeled correctly | **PASS** — added minutes derived from clock segment (data lacks the amount): H1 +3, H2 +11 fire at right times; clock now 45+N/90+N/105+N/120+N per phase (Playwright: "45+3:00 · H1" shown; ET fixture ET1 "97:00", ET2 "107:20"). +1 bridge test (37/37). |
| B4a | Playback sync: at the ENG–ARG 54' goal, banner side/minute match the fixture event payload; prob boxes match the odds series at that ts; fog onset aligns with recorded suspension (±1 tick) | **PASS** — goal event side=home/min=54/jump 37.2→64.1; banner "GOAL — ENGLAND" (real side, engine.js already data-driven); fog engages in H2 at the goal; reopen prob reflects the lead. |
| B4b | Seek sync: Playwright seeks to 3 timestamps (pre-goal, HT, late); engine frame state (front, score, clock, fog flag) matches the feed at each ts; no stale/replayed cinematics | **PASS** — FIXED stale front on seek-into-fog (_reset now re-anchors _lastFront): all 4 ts (preGoal/HT/late/inFog) match feed exactly (inFog front 0.084→0.623); seek-forward re-fires 0 past goals; index.html debounced engine.resetBoard() clears stale craters/feed. |
| B5 | Real fixture → no War Room button anywhere; SANDBOX battle (fictional teams, badged) → all War Room triggers visibly work | **PASS** — WarRoom gated to sandbox/synthetic mode; SANDBOX battle = Astoria vs Verdania (fictional teams+palettes) on synthetic driver, reachable via picker card, badged SANDBOX (no VERIFY/scrubber). Playwright: real fixture WAR ROOM=absent; sandbox "Goal — ASTORIA" → 0-0→1-0 + banner. |
| B6 | Poster PNG downloads with correct caption band on phone + desktop; copied deep-link restores fixture + timestamp | **PASS** — canvas is 2D + procedural (no taint). Hardened: poster via toBlob+objectURL (reliable vs multi-MB dataURL), copy has execCommand fallback for LAN http:// (Clipboard API is secure-context only) + honest COPIED/FAILED feedback, robust largest-canvas pick. Playwright phone+desktop: poster 1200×1420 w/ caption band, copy ok, deep-link restores fixture+ts. |
| B7 | Compliance sweep vs HACKATHON-MUST-INCLUDES: C1 + C2 close Track-2 boxes; DevNet badging kept; NO TxL-token P2P; deploy runbook in BLOCKED.md (Mikail-only push/tunnel) | **PASS** — swept: no TxL P2P (predict = points-only, wallet = identity-only), DevNet badging present, TxLINE primary via SDK, Merkle proof twice (B2). Deploy runbook in BLOCKED.md §0 (honest: cloudflared via brew — NOT preinstalled — or npx localtunnel; I did not tunnel). Wallet-auth box → C2, inspectable box → C1. |

### P1 — Product gaps
| ID | Acceptance criterion | Status |
|---|---|---|
| C1 | Tap threat flare / fog / frontline each opens the inspect sheet with real payload data (Playwright taps all three during ENG–ARG replay) | **PASS** — InspectHotspots overlay: small FRONT chip (de-margined 1X2 triplet) + long-press canvas, fog chip "MARKET DARK · TAP" (suspension gap+duration), flare chip (PossibleEvent, real side). InspectSheet takes a subject w/ headline, reuses proof walk. Playwright: all 3 open w/ real payload tied to fixture 18241006; 0 console errors. |
| C2 | Real Phantom (`window.phantom.solana`) connect + signMessage; graceful fallback w/ install link + continue-as-guest; record persists across reload keyed to pubkey; DevNet badge stays | **PASS** — direct provider connect()+signMessage (SIWS, no npm). Playwright (mocked Phantom): connect stores real pubkey kind=phantom, "PHANTOM · SIGNED IN", persists across reload. No-Phantom fallback: GET PHANTOM link + "continue as guest", persists. DevNet badge kept. 0 errors. |
| C3 | Wallet sheet redesign: no wrapped-orphan/misaligned text at 360/402/430px; copy ≤ half current length; game-flavored, centered, icons over words | **PASS** — rewritten centered + tight: ENLIST → JOIN THE CAMPAIGN → CONNECT PHANTOM/GET PHANTOM → RECRUIT/rank card; copy cut to one short line. Playwright: no horizontal overflow at 360/402/430. |
| C4 | Game loop: pick-a-side; two correct calls in a row show streak=2 w/ multiplier; wrong call resets; running points total in HUD; state survives reload | **PASS** — SidePick (auto once), CampaignHUD chip (PTS + streak flame + FIGHTING FOR side). Playwright: pick home; 2 correct calls → streak=2, pts 18→42 (1.25× mult applied); wrong → streak 0, −8; survives reload. 0 errors. |
| C5 | Onboarding + home/lobby: cold visit → home; returning w/ identity → lobby; deep-links (`?fixture=`) bypass home; ≤3 skippable tooltips seen once | **PASS** — Home hero (title/one-liner/connect+guest/CHOOSE YOUR BATTLE) + 3-tip onboarding (orbit/predict/verify, SKIP). Playwright: cold→hero, returning→lobby(picker), deep-link→battle w/ ts restored, tips show + SKIP sets flag. 0 errors. |
| C6 | RAID prompt redesign: never occludes center of diorama; market implied % legible at a glance; countdown visible; auto-dismiss | **PASS** — compact lower-right card (206×132), big % + countdown + auto-dismiss + streak badge. Playwright geometry: card at (186,592), does NOT cover screen centre (201,437). |
| C10 | Real-time rooms (ws sidecar :4490): two contexts join same code; a call in A appears on B's leaderboard <1s; late joiner gets full roster+scores; degrade to solo when server down | **PASS** — `npm run rooms` (:4490, ws) + pure room-store (6 hermetic tests); Vite `/rooms` ws proxy; ShareSheet create/join + invite deep-link (?fixture=&room=); RoomPanel live leaderboard. Playwright (2+1 contexts): A's update on B in **289ms**, late joiner C gets full roster [25,0,0]; server-down → "rooms offline · solo", still playable. 43/43 tests. |
| C7 | Desktop layout: no floating control overlaps diorama/side columns at 1280/1440/1920; scrubber docked in console chrome | **PASS** — removed the duplicate desktop transport trio (index.html); Scrubber docks into the center gap (left:384/right:404, sound toggle added); RAID card moved to right-middle on desktop. Playwright geometry: scrubber+RAID clear both columns at 1280/1440/1920. |
| C8 | Camera: orbit pivots pitch center (stays fixed on screen); double-tap recenter lands documented pose; flick spins + decays at 60fps | **PASS** — pitch centre (u0,v0.5) IS the pivot (rot-independent): orbit drag leaves cam.x/y unchanged → centre fixed on screen. Added flick-to-spin (velocity tracked on drag, `_spinVel` decays 0.94/frame in draw(), interrupted on touch). Double-tap recenter → rot -0.55/tilt 0.34. (engine.js camera edits — final-round spec explicitly requested; 43/43 tests, render verified.) |
| C9 | Picker ordering LIVE→upcoming(soonest)→finished(recent); search on name/abbr/country, diacritic-insensitive, instant ("arg" surfaces all Argentina; finished leads w/ most recent) | **PASS** — order by startTime (upcoming asc, finished desc), not market depth; diacritic-insensitive search on name+abbr+competition. Playwright: finished leads "France 4–6 England" (most recent); "arg" surfaces all 7 Argentina fixtures. |
| C11 | `?overlay=1` route: clean at 1920×1080, zero interactive chrome; `&bg=green|black` switches background | **PASS** — `?overlay=1` hides all HUD/console chrome (BattleConsole returns null; portrait/desktop blocks off), shows only diorama + a minimal score/prob strip; engine `stageBg` sets the chroma bg. Playwright 1920×1080: 0 buttons, no chrome, corner pixel green [0,119,43] vs black [0,0,0] via `&bg`, 0 errors. |

### P2 — If clock allows
| ID | Acceptance criterion | Status |
|---|---|---|
| D1 | Vendor CDN deps (React/Babel/fonts) into public/vendor/ with shim so venue Wi-Fi can't white-screen | PENDING |

## Phase log (final round)
| Phase | Status | Notes |
|---|---|---|
| Recon (read all 5 docs + engine manual + full source) | DONE | SDK installed is v0.1.0 (vendored), exports `TxlinePlatformClient`+`TxlinePlatformError`; has fixture/odds/state/validateScores/fixtures/stream. B3 root cause: `additional_time` events carry `minute` (when announced) but no added-minutes amount → `+0 MIN`. |
| B1 SDK unification (data) | PASS | New `app/data.js` = sole importer of `@txline/client-sdk` (DC runtime can't import npm directly, so HUD dynamic-imports it). replay-source `loadReplayModel(client,id)`, real-driver live SSE via `client.stream()`, session builds one client, HUD 4 helpers use `client.{fixtures,validateScores,state}`. `optimizeDeps.include` added. Restarted :4400. |

---

# Prior nightshift build — spec 05-battlefield (2026-07-16..18) [SHIPPED]

Overnight productization: synthetic prototype → real TxLINE data + consumer layer.
All P0 + P1 below verified in the prior run (see git history + STATUS-FOR-MIKAIL.md). Retained as the
baseline the final round builds on.

### P0 — Real data bridge
- [x] `bridge/mapping.js`: pure hermetic mappers, unit-tested. **(13/13 green)**
- [x] `bridge/replay-source.js`: ts-native match-clock model, prob path w/ suspension gaps. **(9/9 green)**
- [x] `bridge/real-driver.js`: `RealMatchDriver` — same surface as synthetic + seek + LIVE SSE. **(8/8 green)**
- [x] Score in sync w/ clock; HT frozen; stoppage/ET handled.
- [x] HUD team identity dynamic from fixture (teams.js palettes + SVG flags).
- [x] Synthetic driver still selectable (`?mode=synthetic`) as offline fallback.

### P1 — Consumer layer
- [x] Fixture picker (segmented live/upcoming/finished, flags, search).
- [x] Replay scrubber: seek + cinematic 1×/2×/4×/8× fast-forward.
- [x] Every-tick-inspectable → real Merkle proof walk via `/v1/validation/scores` (engine verify=1).
- [x] Predict-along: danger-spell prompt, log-scored vs market prob, localStorage record.
- [x] Share: replay deep-link + poster PNG export.
- [x] Wallet sign-in (devnet guest identity, labelled).

_36 hermetic bridge tests green (`node --test bridge/`). Prior run verified full phone-portrait
journey in Playwright, zero console errors._
