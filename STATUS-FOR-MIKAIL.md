# Battlefield — Final-Round handoff (2026-07-19)

## Round 2 (§G) — your post-review polish, done

After your hands-on review ("really cool … but mobile is jumbled and gobbled"), I did the §G pass:
- **G1 — room usernames:** a "YOU" name field in the share sheet (pre-filled, editable, ≤20 chars,
  persisted, broadcast); rename propagates live. Verified: A/B set Alice/Bob, both see both; A→Alicia
  updates for B. Also renameable inline from the room panel (pencil).
- **G2 — desktop:** the points/streak chip now sits directly above the RAID card (20px gap) so the
  stake and payoff read as one moment; no overlap with the console columns at 1440.
- **G3 — mobile frontline chip:** the bare "ENG 36%" is now a labelled **"FRONTLINE ODDS / ENG 36%"**
  tab, so it says what it does.
- **G4 — mobile composition (the big one):** nav auto-compacts under 420px (keeps the flags + a ▾,
  drops the "MATCHES" word) so it fits 360/402/430 without clipping; **points + "for ENG" moved to the
  bottom-right** (out of the score, filling the old empty gap); the **room leaderboard is now a tiny
  top-left pill** (member count + your rank) that clears the centred score and expands to the full
  roster only when tapped. Verified with Playwright screenshots at 360/402/430 — no overlaps, score
  fully visible, zero console errors through a full cold journey.

Round-2 HEAD is **`b2ffc3f`**; `npm test` = **44/44** (added the rename test). Everything below (the
final-round build) still stands.

## TL;DR

The final-round spec (`.nightshift/specs/05b-battlefield-final-round.md`) is **fully built** —
every P0 (B1–B7) and every P1 (C1–C11) item, plus the P2 (D1). All 14 items were verified in
Playwright (phone-portrait first) with **zero console errors**, and each shipped as its own commit.
Base was `7ec691b`. `npm test` = **44/44** (37 bridge + 7 rooms, incl. G1 rename).

Biggest change vs the last handoff: the app now runs entirely through the **SDKs** (data via
`@txline/client-sdk`, on-chain proof verified **twice** — once in your own browser via
`@txline/verify`, once by the engine), has a **real game loop** (pick-a-side · streaks · points ·
share), **real-time friend rooms**, a **Phantom** sign-in, a **creator overlay** route, and now runs
**fully offline** (React/Babel/fonts vendored) so venue Wi-Fi can't white-screen it.

**Check first:** open `http://localhost:4400/` (cold) → you land on the new HOME → *continue as guest*
→ CHOOSE YOUR BATTLE → the England–Argentina final. A "pick your side" prompt appears once; pick
England. That whole first-run flow is the single most important thing to eyeball.

---

## What I verified end-to-end (Playwright headless, mostly phone-portrait 402×874, zero console errors)

Everything below I actually watched pass — not "should work".

**Data + proof (B1, B2)**
- Every `/v1` call now goes through `@txline/client-sdk` — grep for `fetch(.*/v1)` in app code is
  zero; the fixtures list (117), odds, state, and Merkle proof all load via the SDK.
- Tap **VERIFY** → **VERIFY THIS TICK ON-CHAIN** proves the tick **twice, independently**: the browser
  reconstructs the Merkle root **and reads the mainnet PDA** (`@txline/verify`, via a same-origin
  `/rpc` proxy that strips the Origin header the public RPC 403s on), and the engine does it
  server-side. Computed root === on-chain root === `b23f6841…`; sheet reads "PROVEN AUTHENTIC ·
  VERIFIED TWICE".

**Bugs (B3–B6)**
- Stoppage/extra-time is real now: the clock reads **45+3 · H1** in first-half stoppage, **90+n** in
  the second, **105+n / 120+n** in ET; the added-time feed shows **+3 / +11 MIN** (derived from the
  clock model — the data doesn't carry the number). ET fixture 18202783 labels ET1/ET2 correctly.
- Seeking is atomically in sync: scrubbing to any moment jumps the front/armies/score/clock/fog to the
  feed at that ts (fixed a stale-front-into-fog bug); the 54' goal cinematic fires with the real side
  ("GOAL — ENGLAND"), minute, and prob jump; forward-seeking re-fires no past goals.
- War Room is gone from real matches (events come only from the data) and lives in a **SANDBOX** battle
  (Astoria vs Verdania) reachable from the picker; its triggers work there.
- Poster export + copy-link work on phone and desktop; the deep-link restores fixture + timestamp.

**Product (C1–C11)**
- **Every pixel inspectable:** tapping the front chip, a threat flare, or the fog each opens the
  inspect sheet with the real payload (de-margined 1X2 triplet / PossibleEvent / suspension window).
- **Phantom wallet:** connect + `signMessage` sign-in (mocked in tests; **you'll want to try the real
  Phantom flow manually**); graceful GET-PHANTOM + continue-as-guest fallback; record persists across
  reload keyed to the pubkey.
- **Game loop:** pick-a-side flavors the HUD; two correct predict calls in a row show **streak ×2 with
  the multiplier applied**, a wrong call resets it; a POINTS + streak chip sits in the HUD; all survive
  reload.
- **Home / lobby / onboarding:** cold visit → HOME; returning → straight to the lobby; deep-links
  (`?fixture=`) bypass HOME into the battle; 3 skippable one-time tooltips.
- **RAID redesign:** compact lower-right (desktop: right-middle) war-drum card with the market %,
  a countdown, auto-dismiss — never over the diorama centre.
- **Real-time rooms:** create a room → invite deep-link; a second browser's score update lands on the
  first's leaderboard in **~289ms**; a late joiner gets the full roster; server-down degrades to
  "rooms offline · solo".
- **Desktop:** the scrubber is docked between the stat/feed columns (no floating overlap at
  1280/1440/1920); the camera orbits around the pitch centre, double-tap recenters, and **flick-to-spin**
  is in.
- **Picker:** ordered LIVE → upcoming(soonest) → finished(most recent); diacritic-insensitive search on
  name/abbr/country ("arg" surfaces all 7 Argentina fixtures).
- **Creator overlay:** `?overlay=1` renders just the diorama + a clean score/prob strip, no chrome;
  `&bg=green|black` sets a chroma-key background.

**Offline (D1)** — with unpkg + Google Fonts fully blocked, the app still boots, renders, and uses the
right fonts, with **zero external requests and zero console errors**.

---

## Honest rough edges

- **Live mode is still smoke-tested, not match-tested** — no live match ran during the build. Replay is
  the judged weapon; the live path lights up at the final (Sun 19:00 UTC).
- **The browser proof read uses a `/rpc` proxy on the dev server** (strips the Origin the public mainnet
  RPC 403s on). It's dev-server-only, same as `/v1` — fine for the demo, and it degrades to engine-only
  if the browser path ever fails.
- **The "pick your side" prompt is a modal** — on a fresh visit it briefly covers the screen until you
  pick a side or "just watching". Intended, but worth knowing when you record (dismiss it first).
- **The War Room panel keeps its light "tweaks" styling** (it's the DC editor panel). Functional; I
  left its look alone since it's a sandbox tool.
- **Rooms + browser-verify need their servers/network up** — see run commands. A room WebSocket that
  can't reach the server logs one unavoidable browser "WebSocket failed" console line (only when the
  rooms server is down); the app stays playable in solo mode.
- **A real deployed link + repo push are still yours to run** — I did not push or tunnel. The exact
  runbook is in `BLOCKED.md §0` (honest: `cloudflared` isn't installed — `brew install cloudflared` or
  the zero-install `npx localtunnel` fallback; one tunnel over :4400 exposes everything).

---

## Run commands

```bash
# 0. engine must be up (it already is):  curl -s localhost:3001/health  → {"ok":true}
cd /Users/mikail/Desktop/PulsePlay/battlefield

npm run dev            # → http://localhost:4400   (the app; LAN URL printed for phone)
npm run rooms          # → :4490   (friend-rooms WebSocket sidecar — needed for C10)
npm test               # node --test bridge/ rooms/   → 43 passing

# Routes / deep-links
#   http://localhost:4400/                                  cold visit → HOME → lobby
#   http://localhost:4400/?fixture=18241006&mode=replay     the ENG–ARG final, straight in
#   ...&t=<ms>                                              restore an exact moment (share links)
#   ...&room=CODE                                           join a friend room
#   http://localhost:4400/?overlay=1&bg=green               creator/second-screen (green screen)
#   http://localhost:4400/?overlay=1&bg=black               creator overlay (black)
#   http://localhost:4400/?dur=90                            faster full-match playback (default 210s)
#   pick "SANDBOX ARENA" in the match picker for the War Room playground
```

Currently running: engine `:3001`, dev server `:4400`, rooms sidecar `:4490` — all healthy.

---

## Demo script (~2 min, 4 beats)

1. **"The market, as a war."** Land on HOME → *continue as guest* → CHOOSE YOUR BATTLE → the England–
   Argentina final. **Pick England.** Hit 4× and let it play: England's line surges as their win-prob
   leaps ~37→64% at the 54' goal (the real de-margined jump), the market suspends (fog rolls in), then
   Argentina claw it back and overrun at full time. The clock shows real stoppage (45+3, 90+n).

2. **"Every pixel is provable — twice."** Pause, tap the **fog** (or the **VERIFY** button) → the raw
   TxLINE tick → **VERIFY THIS TICK ON-CHAIN**: your browser reconstructs the Merkle root and reads the
   Solana account, the engine does it independently — **PROVEN AUTHENTIC · VERIFIED TWICE**. No other
   fan app can do this, because no other feed is provable.

3. **"Play along, build a streak."** Scrub into a danger spell → the compact **RAID** war-drum shows the
   market's goal chance → call it, beat the market, watch the **streak ×2** multiplier and points climb
   in the HUD. Tap **SHARE → CREATE A ROOM**, open the invite link in a second window — your calls show
   on the live leaderboard in real time.

4. **"Take it anywhere."** Open **MATCHES** to show all 116 battles one tap away (search "arg"), then
   `?overlay=1&bg=green` — the same battle as a clean green-screen creator overlay (the monetization
   story), and note it all runs offline with the deps vendored.
