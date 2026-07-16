# Real-data bridge notes (researched 2026-07-16)

The ingestion engine in `~/Desktop/PulsePlay/txline-explorer` is **fully built** (all spec phases
plus platform phases complete): standing SSE worker, SQLite corpus (116 fixtures, 114k score
updates, 5.5M odds ticks), versioned Fastify API. The battlefield's future data source is:

- **Live**: `GET /v1/stream/fixtures/:id` — composite scores+odds SSE for one fixture, resumable
  via `Last-Event-ID` (DB-as-log; zero gap on reconnect). Requires a scoped bearer key
  (loopback-exempt in dev).
- **State**: `GET /v1/fixtures/:id/state?seq=|ts=` (point-in-time), `GET /v1/fixtures/:id/odds`
  (probability), `GET /v1/fixtures/:id` (detail incl. lineups/playerStats).

## Field mapping → BattleFrame

| BattleFrame | Real source | Status |
|---|---|---|
| `clock.s` / `clock.running` | `Clock.Seconds` / `Clock.Running` | direct |
| `clock.phase` | derive from `StatusId` (1→PRE, 2→H1, 3→HT, 4→H2, 7/9→ET1/ET2, 11–13→PENS, 5/10/13/100→FT) | bridge derives |
| `score` | `Stats["1"]/["2"]`, ordered via `Participant1IsHome` | direct |
| `prob` | `1X2_PARTICIPANT_RESULT` de-margined `Pct` (`part1/draw/part2`), ordered via `Participant1IsHome` | direct |
| `front` | derived from `prob` (engine formula) | bridge derives |
| `possession.side` | `Possession` (1\|2) via `Participant1IsHome` | direct |
| `possession.zone` | classified possession level — **5 engine levels → 4 zones**: `safe→safe`, `neutral→safe` (or `attack`), `attack→attack`, `danger→danger`, `high→box` | map |
| `momentum` | **not computed engine-side** — derive: trailing-window weighted mean over possession levels (weights ≈ safe/neutral 0.1, attack 0.45, danger 0.72, high 1.0), split per side, 0..1 | bridge derives |
| `threat.home/away` | `Parti1State/Parti2State.PossibleEvent` (`{Goal,Penalty,Corner}`) | direct |
| `threat.neutral` | top-level `PossibleEvent` (`{VAR,RedCard,YellowCard}`) — case-map keys | map |
| `market.suspended` | `suspend` action markers + odds inter-tick gap | derive |
| `market.darkForMs` | now − last odds tick `Ts` | bridge derives |

BattleEvents map 1:1 from actions (`goal`, `shot`+`Data.Outcome`, `corner`, `yellow_card`/`red_card`,
`var`/`var_end`, `substitution`, `additional_time` `Data.Minutes`, `game_finalised`→`fulltime`).

Cadence truth (measured): possession frames ≈ every ~6s in play (~65% of feed); odds sub-second
(p90 < 1s); goal suspensions 6–73s (median ~21s). The synthetic driver already reproduces these.

Extra data available for future HUD use, not yet in BattleFrame: per-player stats
(goals/shots/cards by `normativeId`), period-bucketed corners/cards counters, `Kickoff.Team`,
`VenueType`, weather/pitch `Conditions[]`. Note: no shots-on-target aggregate exists — count
`shot` actions with `Outcome=OnTarget` (the HUD already does exactly this).
