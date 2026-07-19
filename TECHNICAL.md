# The Probability Battlefield — Technical Documentation

_TxODDS World Cup Hackathon · Track 2 — Consumer & Fan Experiences._

- **Live app:** https://battlefield.gershwin.dev
- **Repo:** https://github.com/0xPulsePlay/battlefield
- **TxLINE data layer:** https://txline-api.gershwin.dev
- **Demo video:** `[DEMO VIDEO LINK]`

A judge should be able to read this in three minutes and know exactly what is real.

---

## Core idea

TV shows you the ball; the Battlefield shows you **belief**. A World Cup match is rendered as a
war between two national armies on an isometric diorama, where every visual element is real,
anchored market data:

- army sizes are the live **de-margined 1X2 win probabilities**,
- the frontline is pushed by **possession-danger states**,
- goals, VAR, and cards fire war cinematics from the **real event timeline** at their true
  timestamps,
- market **suspensions roll literal fog of war** over the field for their exact spans.

All 116 matches of the tournament corpus are replayable battles on a true match clock (halftime
frozen, stoppage `45+3`, extra time and shootouts honoured); the final plays **live**.

It is a fan product, not a chart. You **enlist with a Solana wallet**, pick a side, answer
"raid incoming" prompts scored **against the market's own implied probability** (log-scored, so
beating an unlikely call pays more), build streaks and points, battle friends in shared real-time
rooms, and share any moment as a replay deep-link or poster. And uniquely — **every pixel is
inspectable**: tap a threat flare, the fog, or the frontline and walk the underlying tick's Merkle
proof to the root anchored on Solana. No other fan app can prove its data is real, because no
other feed is provable.

---

## How it meets Track 2

| Criterion | How Battlefield answers it |
|---|---|
| **Works live during a match** | `?mode=live` opens the composite per-fixture SSE and drives the same renderer from real ticks; the final plays live. Replay of all 116 corpus matches carries the identical experience when no match is running. |
| **Sign up through Solana** | Real Phantom `connect()` + `signMessage()` sign-in-with-Solana (no funds, no gas); guest fallback with a GET-PHANTOM link. Records key off the pubkey. |
| **Mainstream, non-technical UX** | Phone-portrait first. You watch a war, not a dashboard — no odds literacy required. One-time skippable tips; the market surfaces as army size, fog, and cinematics. |
| **Real-time responsiveness to the pitch** | The renderer speaks one `BattleFrame`/`BattleEvent` contract; a goal, a suspension, or a danger spell in the feed becomes a surge, fog, or a raid on-screen within a tick. |
| **Originality** | A genuinely new interaction model: the live betting market **as a battlefield you can watch, play, and cryptographically prove** — not a scoreboard or a prediction ladder. |
| **Commercial path** | A chroma-key `?overlay=1&bg=green` second-screen route embeds the battlefield into any stream or watch party — the creator/broadcast product. |
| **Deliberately small scope, complete** | One loop — watch, inspect, prove, play, share — built end to end, with 44 hermetic tests and an offline-hardened build, rather than sprawling. |

---

## Technical highlights

**One seam, three data sources.** The renderer (`engine.js`) is a pure canvas war machine with
zero business logic — it speaks only the `BattleFrame` / `BattleEvent` contract. Everything behind
that seam (`bridge/`) folds a data source into frames:

- **replay** — `bridge/replay-source.js` builds a match-clock model from the fixture detail + the
  de-margined odds series, then plays it on a virtual clock with real suspension gaps;
- **live** — `bridge/real-driver.js` tails the resumable SSE stream and emits the same frames;
- **synthetic** — the original `driver.js`, kept as an offline demo fallback (`?mode=synthetic`).

Because the seam is identical, **replay, live, and offline are the same product** — the judged
replay is driven by the exact engine the live match uses.

**Match-clock semantics done honestly.** The feed carries no match clock, so the bridge derives it
from `StatusId` (PRE / H1 / HT / H2 / ET1 / ET2 / PENS / FT). Halftime freezes; first-half
stoppage reads `45+3`, second-half `90+n`, extra time `105+n / 120+n`; the added-minutes figure is
derived from the clock segment because the data does not carry it.

**On-chain trust surface, verified twice.** Any tick → Merkle leaf → sibling branch → computed root
→ compared against the root anchored by TxLINE's Solana program. The engine verifies it server-side
(`verify=1`), and the browser verifies it **independently** via `@txline/verify` (`app/verify.js`,
lazy-loaded so `@solana/web3.js` never touches page load): it reconstructs the fixture-summary root
client-side and reads the mainnet `daily_scores_roots` PDA **read-only** (no wallet, no gas). Same
root both ways → "PROVEN AUTHENTIC · VERIFIED TWICE".

**Real-time multiplayer rooms.** A tiny WebSocket sidecar (`rooms/server.js`, `:4490`, fanned in
same-origin through the dev server's `/rooms` proxy) holds an in-memory roster per room code. A
player broadcasts their side pick and running points/streak; the server fans the full leaderboard
to everyone, so a call in one browser lands on another's leaderboard sub-second (measured ~289ms),
a late joiner gets the full roster, and a downed server degrades cleanly to "rooms offline · solo".
The room logic is a pure store with 6 hermetic tests.

**Reacting to the pitch.** possession-danger zones bulge the living two-part trench toward the
defending side and drive the "raid incoming" prompts; `PossibleEvent` predictors become tappable
threat flares; a de-margined win-prob jump surges an army; a suspension window rolls fog. None of
the ambience (momentum smoothing, ambient warfare) ever contradicts the market — it is derived from
it.

**Data access is 100% typed SDK.** Every `/v1` read and the live SSE go through
`@txline/client-sdk` (`app/data.js` is the sole importer); a grep for `fetch(.../v1` in app code
returns zero. No raw fetches, no hand-rolled EventSource.

---

## The specific TxLINE endpoints used

### What this app calls directly (the platform `/v1` surface, served by the TxLINE data layer)

Every one of these is a real call in the source; the SDK method, the call site, and the resulting
HTTP request are listed together. In production these paths resolve against
`https://txline-api.gershwin.dev`; in dev they are same-origin, proxied to the engine on `:3001`
(so the browser makes zero cross-origin requests).

| SDK call (call site) | HTTP request | Drives |
|---|---|---|
| `client.fixtures({status:'all',limit:300})` — `index.html:337` | `GET /v1/fixtures?status=all&limit=300` | the picker corpus (116 matches, segmented live/upcoming/finished) |
| `client.fixture(id)` — `bridge/replay-source.js:316` | `GET /v1/fixtures/:id` | teams, phases, and the event timeline |
| `client.odds(id,{market:'1X2_PARTICIPANT_RESULT'})` — `bridge/replay-source.js:317` | `GET /v1/fixtures/:id/odds?market=1X2_PARTICIPANT_RESULT` | **the de-margined win-probability path — army sizes + frontline** |
| `client.state(id,{ts}\|{seq})` — `index.html:349-350` | `GET /v1/fixtures/:id/state?ts=…` / `?seq=…` | point-in-time tick inspection (tap-to-inspect) |
| `client.validateScores(id,seq,statKeys,{verify:1})` — `index.html:342` | `GET /v1/validation/scores?fixtureId=…&seq=…&statKeys=1,2&verify=1` | the Merkle proof + engine-side on-chain verdict |
| `client.stream({fixtureId},…,{since:'0'})` — `bridge/real-driver.js:300` | `GET /v1/stream/fixtures/:id` (SSE, resumable via `Last-Event-ID`) | **live mode** during the match |

Plus one direct on-chain read, in the browser: `@txline/verify` reads the mainnet
`daily_scores_roots` PDA via Solana `getAccountInfo` (through a same-origin `/rpc` proxy that strips
the `Origin`/`Referer` headers the public RPC 403s on). This is the anchored root the browser-side
proof walk compares against.

**TxLINE data is the primary live input, not a garnish:** the de-margined `1X2` `Pct` series *is*
the army sizes and the frontline; the score/event/possession stream *is* the cinematics, the clock,
the fog, and the raids; `validation/scores` + the on-chain PDA *are* the proof surface. Strip TxLINE
out and there is no battlefield.

### Upstream TxODDS endpoints the shared platform ingests

Our team built one shared ingestion platform (the `txline-explorer` engine) that all our
submissions consume through the `/v1` surface above. For completeness, the raw TxODDS endpoints that
platform folds (documented in `BRIDGE-NOTES.md` and `docs/SUBMISSION-TECH.md`) are: the SSE-framed
`GET /api/scores/updates/{fixtureId}` full sequence (complete score/event/possession history, every
update carrying the full period-bucketed `Stats`), the `GET /api/odds/snapshot/{fixtureId}` +
interval-update odds corpus (`1X2_PARTICIPANT_RESULT` de-margined `Pct` among them), the live
scores + odds SSE streams, the scores/odds validation endpoints, and the on-chain `validate_stat`
program accounts.

---

## Architecture

```
TxODDS TxLINE API ──▶ platform engine (txline-explorer, :3001 dev / txline-api.gershwin.dev)
                          │  REST /v1  +  resumable composite SSE
                          ▼
                @txline/client-sdk  (typed REST + resumable SSE — app/data.js is the sole importer)
                          ▼
      bridge/ ── replay-source (match-clock model) · real-driver (live SSE) · mapping · teams
                          ▼  BattleFrame / BattleEvent  (the one seam)
      engine.js  (pure canvas war renderer)   +   index.html HUD
      app/console.jsx  (picker · scrubber · inspect + Merkle proof · predict-along · share · wallet)
      app/verify.js  ── browser-side @txline/verify → mainnet daily_scores_roots PDA (read-only)
      rooms/server.js  (:4490, WebSocket)  ── live friend rooms / shared leaderboards
      ?overlay=1  ── chroma-key second-screen route (the creator/monetization surface)
```

The renderer never touches a data source — replaying the frames replays the war exactly. When a
genuinely live match runs, a ~50-line SSE driver with the same two callbacks is the only thing that
changes.

---

## How to run locally

```bash
# Prerequisite: the TxLINE engine up on :3001  →  curl -s localhost:3001/health  ⇒  {"ok":true}
npm install            # Vite + the two vendored @txline SDK tarballs
npm run dev            # → http://localhost:4400   (LAN URL printed for phone testing)
npm run rooms          # → :4490   (friend-rooms WebSocket sidecar, for real-time rooms)
npm test               # node --test bridge/ rooms/   → 44 hermetic tests

# Deep links
#   /?fixture=18241006&mode=replay        the England–Argentina final, straight in
#   /?fixture=18241006&mode=replay&t=<ms> restore an exact moment (share links)
#   /?fixture=<id>&mode=live              tail a live match's SSE
#   /?mode=synthetic                      offline synthetic fallback
#   /?overlay=1&bg=green|black            chroma-key creator / second-screen route
#   pick "SANDBOX ARENA" in the picker    the War Room trigger playground (fictional teams)
```

The app is served same-origin behind the `:4400` dev server, which proxies `/v1` → the engine,
`/rpc` → Solana mainnet (browser proof read), and `/rooms` → the sidecar — so one tunnel over
`:4400` exposes the whole app. `vite build` is intentionally not the run path: the app runs as
static files + a runtime JSX transform, so it needs no bundler. Deps (React, Babel, fonts) are
vendored into `public/vendor/`, so venue Wi-Fi cannot white-screen the demo (zero external
requests verified).

**Solana:** devnet identity, clearly badged "DEVNET · NO REAL FUNDS"; proof verification reads the
mainnet-anchored roots read-only. **No TxL token is used peer-to-peer** anywhere — predict-along is
a points-only skill game and the wallet is identity-only; nothing is staked.

---

## Honest notes

- **Live mode is smoke-tested, not match-tested.** It connects, streams, and renders without error,
  but no live match ran during the build (the final is the first). Replay is the primary judged
  path and carries the full experience; the live path lights up at the final.
- **The browser-side proof read uses the dev server's `/rpc` proxy** (to strip the origin the public
  mainnet RPC rejects). It degrades to the engine-only verdict if that path ever fails, so the proof
  is never lost.
- **The deploy is the dev server behind a tunnel**, not a static bundle — deliberate, since the DC
  runtime + runtime JSX transform are not bundler-friendly and don't need to be.
