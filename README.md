# The Probability Battlefield

A World Cup match rendered as a war between two national armies on a floating acre of land — an
isometric diorama with a cut-earth skirt on its edges. Army sizes are live de-margined win
probabilities, the frontline is pushed by possession-danger data, match events fire war
cinematics, and market suspensions roll literal fog of war over the field. England (white/St
George red, green territory) vs Argentina (albiceleste/gold, sun-baked khaki). The warzone is a
real-proportioned soccer pitch — mowing stripes, bright chalk lines, goals behind each HQ,
benches with pacing coaches, corner flags, floodlights — set apart from the dimmer scrubland
around it. The frontline trench is never straight: a living wave that meanders with momentum
and bulges toward whichever side is under pressure. Team palettes are configurable
(`opts.teams` on the engine) so any two nations can fight. The camera rests at the south-east
corner of England's side with the whole pitch framed in view.

**Real TxLINE data, consumer product.** A real-data bridge (`bridge/`) folds live TxLINE market
state into the same `BattleFrame`/`BattleEvent` contract, so **all 116 corpus matches are replayable
battles** driven by
real de-margined 1X2 probabilities, real scores and events, with true match-clock semantics. On top
sits the consumer layer: fixture picker, replay scrubber, tap-to-inspect with a **real Merkle proof
walk**, predict-along, share/poster, and devnet wallet. The synthetic driver remains as an offline
fallback (`?mode=synthetic`). The renderer (`engine.js`) and the data contract are unchanged. See
`TECHNICAL.md` for the full picture and `bridge/` for the mapping.

## Run it

```bash
npm install                    # Vite + the two @txline SDK tarballs
npm run dev                    # → http://localhost:4400  (LAN URL printed for phone testing)
npm test                       # node --test bridge/  → 36 hermetic tests

# deep-links: ?fixture=<id>&mode=replay|live|synthetic&t=<ts>&dur=<seconds>
```

Requires the TxLINE engine on `:3001` (Vite proxies `/v1` → it, same-origin, no CORS). Open on a
phone (portrait — the primary target) via the LAN URL, or a desktop ≥1024px for the command console.

## Controls

| Input | Action |
|---|---|
| Drag (one finger / left mouse) | **Orbit** — horizontal rotates (yaw), vertical drag-up lowers / drag-down raises the camera angle (tilt 0.15–0.85) |
| Two-finger drag | Pan (bounded to the plot) |
| Pinch | Zoom (0.42–2.6) |
| Shift-drag, Ctrl-drag, or right-drag (mouse) | Pan |
| Scroll wheel | Zoom |
| Alt + scroll wheel | Rotate |
| Double-tap / double-click | Recenter (resets pan, zoom, rotation, tilt) |
| MATCHES (top-left) | Fixture picker — all 116 battles, segmented live/upcoming/finished, flags, search |
| VERIFY (top-right) | Inspect the current tick → walk its Merkle proof to the on-chain root |
| Scrubber (bottom) | Seek anywhere · play/pause · 1×/2×/4×/8× cinematic fast-forward |
| ⚔ RAID INCOMING | Predict-along prompt during danger spells — scored vs the market |
| Share / wallet (top-right) | Replay deep-link + poster PNG · devnet sign-in |
| FEED / STATS (bottom-left) | Centered overlays: war feed ticker · live match stats |
| WAR ROOM (bottom-right) | Dev tweaks panel — fire goals, threats, fog, momentum, finale |
| SND (bottom-left) | Sound toggle (audio off by default) |

On desktop (≥1024px) the feed and stats live in permanent side columns instead of overlays.

Dev triggers (browser console): `BF.inject({kind:'goal', side:'home', minute:54, probJump:{from:37.2,to:64.1}})`,
`BF.threat('away')`, `BF.fog(true)`, `BF.mom('home', 0.9)`, `BF.finale()` — same event queue the
scripted timeline and tweaks panel use.

## Architecture

```
bridge/      THE REAL-DATA BRIDGE (new). mapping.js (pure StatusId/1X2-Pct/possession/action
             mappers) + replay-source.js (ts-native match-clock replay model, real prob path,
             honest suspension gaps) + real-driver.js (RealMatchDriver — same {onFrame,onEvent}
             + method surface as the synthetic driver; virtual-clock replay + seek + live SSE)
             + teams.js (nation army palettes + SVG flags). 36 hermetic tests.
app/         session.js (openSession: synthetic|replay|live) + console.jsx (consumer overlay:
             picker, scrubber, inspect+Merkle-proof, predict-along, share, wallet — via window.BATTLE).
driver.js    Synthetic data source (UNCHANGED) — kept as the offline/demo fallback (?mode=synthetic).
engine.js    Pure canvas renderer: finite skirted diorama (chunked, cached terrain), real-
             proportioned pitch, living two-part trench (ambient wave + momentum lean +
             possession-pressure bulge), camps, armies, raids, ambient warfare, cinematics,
             fog, victory overrun. Zero business logic; replaying frames replays the war.
             Camera (orbit/pan/zoom + fit-to-pitch default framing) and the configurable team
             palettes (TEAMS_DEFAULT / opts.teams) live here.
index.html   HUD shell + component logic (three-way probability boxes with trend arrows,
             score/clock, war feed, live match stats, banners, corner buttons + overlays).
             Uses a small component runtime (support.js), loaded as a non-module script
             alongside the runtime JSX transform.
war-room.jsx / tweaks-panel.jsx   The floating tweaks panel — every trigger routes through
             window.BF → driver.inject(): one code path for scripted, hand-fired, and real data.
```

The `BattleFrame`/`BattleEvent` contract (see `driver.js` header) is the bridge boundary: when the
ingestion platform exposes the folded TxLINE state, a ~50-line WebSocket driver with the same two
callbacks replaces the synthetic one and everything else stays identical.

## Design

The world is a finite skirted diorama — a real-proportioned soccer pitch with mowing stripes, chalk
lines, goals behind each HQ, benches, corner flags and floodlights, set apart from the dimmer
scrubland around it — under an orbit camera that rests at the south-east corner with the whole pitch
in frame. The frontline is a living two-part trench: an ambient wave plus a possession-pressure
bulge toward the defending side. The HUD is corner-button and mobile-first, with three-way
probability boxes, live trend arrows, and live match stats. England and Argentina ship as the
default identities with accurate flags and palettes; any two nations can fight via `opts.teams`.
