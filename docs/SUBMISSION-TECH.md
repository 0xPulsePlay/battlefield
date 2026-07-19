# The Probability Battlefield — Technical Documentation

_Submission: TxODDS World Cup Hackathon · Track 2 — Consumer & Fan Experiences._

## Core idea

TV shows you the ball; the Battlefield shows you **belief**. A World Cup match is rendered as a
war between two national armies on an isometric diorama, where every visual element is real,
anchored market data: army sizes are live **de-margined 1X2 win probabilities**, the frontline
is pushed by **possession-danger states**, goals and VAR fire war cinematics from the **real
event timeline**, and market **suspensions roll literal fog of war** over the field. All 116
matches of the tournament corpus are replayable battles on a true match clock (halftime frozen,
stoppage and extra time honoured); the final plays live.

It is a fan product, not a chart: you enlist with a Solana wallet, pick a side, answer
"raid incoming" prompts scored **against the market's own implied probability** (log-scored, so
beating an unlikely call pays more), build streaks and points, battle friends in shared
real-time rooms, and share any moment as a replay deep-link or poster. And uniquely — **every
pixel is inspectable**: tap a threat flare, the fog, or the frontline itself and walk the
underlying tick's Merkle proof to the root anchored on Solana. No other fan app can prove its
data is real, because no other feed is provable.

## Highlights

- **Real data, zero fabrication** — probabilities, scores, events, suspensions, and clock all
  derive from the TxLINE feed; momentum/ambience are derived but never contradict the market.
- **True match-clock replay** with cinematic 1×/2×/4×/8× fast-forward that never degrades into
  chart mush — the judged replay is the same engine the live mode drives.
- **On-chain trust surface** — any tick → Merkle leaf → sibling branch → computed root →
  compared against the root anchored by TxLINE's Solana program. Verified in the browser via
  `@txline/verify` and cross-checked server-side (two independent verifications).
- **Fan game loop** — sign-in with Solana (Phantom `connect()` + `signMessage()`), pick-a-side,
  market-scored predictions, streak multipliers, real-time friend rooms (WebSocket), share
  links + poster export.
- **Creator/monetization path** — a chroma-key-friendly `?overlay=1` second-screen route,
  embeddable in any stream or watch party.
- **116-match breadth** — segmented live/upcoming/finished picker; choosing any fixture
  re-skins the entire war (palettes, flags, abbreviations) from fixture data.

## How TxLINE powers it

### TxLINE (TxODDS) endpoints ingested by our platform layer

Our team built a shared ingestion platform that all our submissions consume. It ingests and folds:

| TxLINE endpoint | Used for |
|---|---|
| `GET /api/scores/updates/{fixtureId}` (SSE-framed full sequence) | complete score/event/possession history — ~1,000–1,400 updates per match, every update carrying the full 64-key period-bucketed `Stats` snapshot |
| `GET /api/odds/snapshot/{fixtureId}?asOf=` + interval endpoints (`/updates/{epochDay}/{hourOfDay}/{interval}`) | the odds tick corpus — ~35,000 ticks per match at sub-second cadence, incl. `1X2_PARTICIPANT_RESULT` with de-margined `Pct` |
| Live real-time streams (scores + odds SSE) | live mode during matches |
| `GET /api/odds/validation` / scores validation | Merkle proofs for individual ticks |
| TxLINE on-chain program (`validate_stat` / `validateStatV2`/V3) accounts | the anchored roots our proof walk compares against |

### Platform `/v1` surface consumed by this app — via `@txline/client-sdk`

All app data access goes through the typed SDK (no raw fetches):

- `GET /v1/fixtures?status=all` — the picker corpus
- `GET /v1/fixtures/:id` — teams, phases, event timeline
- `GET /v1/fixtures/:id/odds?market=1X2_PARTICIPANT_RESULT` — the de-margined probability path
- `GET /v1/fixtures/:id/state?ts=|seq=` — point-in-time tick inspection
- `GET /v1/validation/scores?fixtureId=&seq=&statKeys=&verify=1` — Merkle proof + on-chain verdict
- `GET /v1/stream/fixtures/:id` — composite SSE for live mode, resumable via `Last-Event-ID`

### Data → war mapping (the `BattleFrame` contract)

| Data | Visual |
|---|---|
| de-margined 1X2 `Pct` | army sizes + frontline position |
| possession-danger zone (safe/attack/danger/box) | raid pressure, trench bulge toward the defending side |
| market suspension windows | fog of war (exact spans) |
| event timeline (goals, VAR, cards) | war cinematics at their true timestamps, payload-accurate |
| `StatusId` phases | match clock semantics — HT frozen, stoppage `45+x`, ET, shootout |
| `PossibleEvent` predictors | threat flares (tap to inspect the payload) |

The renderer (`engine.js`) never touches a data source — it speaks only `BattleFrame`/
`BattleEvent`, which is why replay, live, and the offline synthetic fallback are the same
product.

## Architecture

```
TxODDS TxLINE API ──▶ platform engine (:3001)
                          │  REST /v1 + resumable composite SSE
                          ▼
                @txline/client-sdk  (typed REST + resumable SSE)
                          ▼
        bridge/ ── replay-source (match-clock model) · real-driver · mapping · teams
                          ▼  BattleFrame / BattleEvent (the one seam)
        engine.js (canvas war renderer) + index.html HUD + app/console (picker,
        scrubber, inspect+proof via @txline/verify, predict, share, wallet)
        rooms server (:4490, WebSocket) ── live friend rooms / shared leaderboards
        ?overlay=1 ── chroma-key second-screen route
```

## Run it

```bash
# engine up on :3001, then:
npm install && npm run dev        # → http://localhost:4400 (LAN URL printed)
npm test                          # hermetic bridge tests
# deep links: ?fixture=18241006&mode=replay|live · ?mode=synthetic (offline) · ?overlay=1&bg=green
```

Solana: devnet identity, clearly badged; proof verification reads the mainnet-anchored roots
(read-only). No TxL token is used peer-to-peer anywhere — it authorizes data only.

## Feedback — our experience with the TxLINE API

The good, first: **de-margined `Pct` is a gift.** Honest probabilities straight from the source
is exactly the right primitive for consumer products — we lean on it everywhere. Sub-second odds
cadence, full period-bucketed `Stats` on every score update (point-in-time state as a pure
lookup, no folding), `PossibleEvent` predictors, and provable individual ticks are all more than
a fan app needs, in the best way.

Friction we hit (offered constructively):

1. **`/api/scores/updates/{fixtureId}` changed shape mid-hackathon** — plain JSON array in June,
   SSE-framed dump in July, regardless of `Accept`. Clients must sniff per response.
2. **Casing is inconsistent across surfaces** (PascalCase wire fields vs camelCase elsewhere) —
   every consumer needs a normalization layer.
3. **`weeks=1` is rejected** on the token/fixtures parameter path where other values work.
4. **Token-expiry semantics are opaque** — our tier token outlived its nominal on-chain window
   by weeks; the only reliable signal is a live 401. Documented grace-period semantics would let
   consumers plan backfills.
5. **`/api/scores/historical/{fixtureId}` has a short retention window** (empty 200 at ~34
   days) while `updates/{fixtureId}` retains everything — the reliable-backfill path deserves a
   doc callout.
6. **The on-chain program ships no published IDL** — we reverse-engineered the `validate_stat`
   CPI surface (single read-only PDA) ourselves; the stat-tier turned out to be an indexed
   sparse tree where `value=0` is a non-membership sentinel. Worth documenting: it's the best
   part of the product.
7. **Hosted docs lag the GitHub source** (`txodds/tx-on-chain` main is the ground truth, incl.
   V3 multiproof); leaf hashing needed vendor confirmation via Telegram. Support there was
   responsive — thank you.
8. **Oracle publish latency is ~40s** from event to anchored root — fine for settlement, worth
   stating for anyone building "verify instantly" UX.
9. **Undocumented action types appear in the feed** (`possible`, `action_discarded`,
   `penalty_outcome`, …) — treat the action set as open in the docs so consumers build tolerant
   parsers (we did, and the extra actions became features).
