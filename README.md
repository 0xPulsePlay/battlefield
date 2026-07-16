# The Probability Battlefield

A World Cup match rendered as a war between two national armies on an undulating isometric
diorama. Army sizes are live de-margined win probabilities, the frontline is pushed by
possession-danger data, match events fire war cinematics, and market suspensions roll literal
fog of war over the field. England (green territory, bottom-of-phone) vs Argentina (sun-baked
khaki, top).

**Current phase: UI experience.** The app runs on a synthetic match driver that reproduces
measured TxLINE data behavior (tick cadence, suspension durations, the real semifinal's
28.4% → 69.7% goal jump). The real-data bridge plugs in later without touching the renderer —
see *Architecture*.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173  (--host serves on LAN for phone testing)
```

Open on a phone (portrait — the primary target) via the LAN URL Vite prints, or in a desktop
browser for the command-console layout (≥1024px wide).

## Controls

| Input | Action |
|---|---|
| Drag (one finger / left mouse) | **Orbit** — horizontal rotates (yaw), vertical tilts the camera angle |
| Two-finger drag | Pan |
| Pinch | Zoom |
| Shift-drag, Ctrl-drag, or right-drag (mouse) | Pan |
| Scroll wheel | Zoom |
| Alt + scroll wheel | Rotate |
| Double-tap / double-click | Recenter (resets pan, zoom, rotation, tilt) |
| Bottom sheet tabs | WAR FEED (event ticker) / STATS (live match stats) |
| ❚❚ / 1× / SND | Pause · replay speed · sound toggle |

Dev triggers (browser console): `BF.inject({kind:'goal', side:'home', minute:54, probJump:{from:28.4,to:69.7}})`,
`BF.threat('away')`, `BF.fog(true)`, `BF.mom('home', 0.9)`, `BF.finale()` — same event queue the
scripted timeline and tweaks panel use.

## Architecture

```
driver.js    Synthetic data source. Emits BattleFrame (~4Hz) + BattleEvent through the exact
             contract a real WebSocket feed will use. THIS is the file the real-data bridge
             replaces (point it at the ingestion engine's /battle WS instead).
engine.js    Pure canvas renderer: terrain relief, camps, armies, raids, ambient warfare,
             cinematics, fog, victory overrun. Zero business logic; replaying frames replays
             the war. Camera (pan/zoom/rotate) and all palettes live here.
index.html   HUD shell + component logic (probability bar, score/clock, war feed, stats panel,
             banners, bottom sheet). Uses the Design Components runtime (support.js) so the file
             stays in sync with the Claude Design project it was born from.
war-room.jsx / tweaks-panel.jsx   The floating tweaks panel — every trigger routes through
             window.BF → driver.inject(): one code path for scripted, hand-fired, and real data.
```

The `BattleFrame`/`BattleEvent` contract (see `driver.js` header) is the bridge boundary agreed
in the engineering dossier: when the ingestion engine (built in the txline-explorer repo) exposes
the folded TxLINE state, a ~50-line WebSocket driver with the same two callbacks replaces the
synthetic one and everything else stays identical.

## Provenance

Mirrors the Claude Design project "The Probability Battlefield" (claude.ai/design), including the
round of feedback applied 2026-07-16: richer palette + lakes/road, undulating relief with an
extruded board edge, world rotation, the horizontal three-way probability bar, the match-stats
HUD, and readable glass-card event banners. Iterate here; port polished changes back to the
design project as needed.
