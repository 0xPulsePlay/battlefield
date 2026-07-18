# Claude Design Prompt — "The Probability Battlefield" prototype

> Copy everything below the rule into Claude Design verbatim. It is fully self-contained (Claude
> Design has none of our project context). Companion engineering dossier: the "Battlefield
> Engineering Dossier" artifact / `docs/` in this repo.

---

Build a semi-functional, animated prototype called **The Probability Battlefield**.

**One-liner:** A live World Cup football match rendered as a war between two national armies on an
isometric low-poly battlefield diorama. The armies' sizes are the live win probabilities from a
real-money betting market, the battle frontline is pushed back and forth by real possession-danger
data, discrete match events (goals, cards, VAR) fire short war cinematics, and when the betting
market suspends after a goal, literal fog of war rolls over the battlefield until quotes return.
The war ends the way wars end: at full time the winning army overruns the loser's entire territory.
This prototype runs on a **scripted synthetic data timeline** (no network calls), but it must be
architected as a pure renderer over a typed data contract, so a real WebSocket feed can replace the
script later without touching the renderer.

**The match:** England vs Argentina — a World Cup semifinal replay (the real match: England led,
Argentina came back to win 2–1). England theming: white and navy with St George red accents.
Argentina theming: albiceleste sky-blue and white stripes with gold accents. Evoke national kits
through color and pattern only — no crests, no FIFA marks.

**Aesthetic:** a miniature war-table diorama viewed isometrically, floating on a dark ambient stage
(near-black with a deep green tint, soft vignette, subtle ground reflection). Low-poly / voxel
look: instanced tiny soldiers, tanks, planes, artillery, tents, flags, trees, terrain wedges, and a
scorched no-man's-land strip with trenches, sandbags, and barbed wire at the frontline. HUD chrome
floats above the stage in crisp panels: monospace tabular numerals, small uppercase labels with
letterspacing, thin rules — trading-terminal typography wrapped around war-room content. Overall
grade: muted and cinematic, slightly desaturated, with the two team colors as the only saturated
accents. Think "a toy battlefield built by a quant" — not cartoonish.

**Tech:** Three.js with instanced low-poly meshes preferred; a 2.5D canvas isometric approach is an
acceptable fallback if it holds 60fps on a mid-tier phone. Everything procedural — no external
assets. Respect `prefers-reduced-motion` (replace camera shake/shockwaves with crossfades).

**Layout — mobile web, PORTRAIT ONLY as the primary target.** This will be viewed in a mobile web
browser, so design for the browser, not an app shell:
- Build the app as a fixed, non-scrolling shell sized with `100dvh` — NEVER `100vh`; the URL bar
  collapsing/expanding must not reflow or jump the scene. Add `viewport-fit=cover` and pad HUD
  edges with `env(safe-area-inset-*)` so nothing hides behind the notch or the home indicator.
- Kill pull-to-refresh and overscroll bounce (`overscroll-behavior: none`); the diorama canvas
  gets `touch-action: none` so pan/pinch never fights browser gestures.
- All primary controls live in thumb reach (bottom half). Tap targets at least 44px.
- **The board runs vertically in portrait**: England's camp at the BOTTOM (the "our side" feel in
  the hand), Argentina's at the TOP, the frontline horizontal, moving up and down the board.
- Top strip: "WORLD CUP · SEMIFINAL · REPLAY" eyebrow, running match clock (e.g. `53:41 · H2`),
  score `ENG 0 — 1 ARG`.
- Hero number under it: England's live win probability, huge monospace, with a delta chip
  (`28.4% ▲0.2`). Tapping cycles the hero metric: England / Draw / Argentina.
- The diorama fills the remaining height (~55–60dvh). One-finger drag pans, pinch zooms,
  double-tap recenters.
- Team chips over the diorama: bottom `ENGLAND 28.4%`, top `ARGENTINA 25.1%`, a smaller
  `DRAW 46.5%` at mid-right.
- Bottom sheet docked above the home indicator (peek height ~96px, swipe up): **WAR FEED** —
  live ticker of events and big probability moves, newest first, minute stamps and a small
  "anchored ✓" badge per row.
- Mobile landscape is NOT a target: letterbox gracefully with a small "best in portrait" hint —
  do not build a separate mobile-landscape layout.
- Desktop (secondary): command-console layout — board horizontal (England left), diorama center,
  probability-history sparkline panel bottom-left (draws the session's probability path; leave a
  visible blank gap while the market is suspended — never interpolate across it), WAR FEED panel
  bottom-right, team walls top corners, UTC + match clock top-left.

**The data contract — build exactly this; the demo script feeds it, a WebSocket will later:**

```ts
type Side = 'home' | 'away';

// Continuous state, emitted ~4 times per second by the driver
interface BattleFrame {
  t: number;
  clock: { s: number; running: boolean;
           phase: 'PRE'|'H1'|'HT'|'H2'|'ET1'|'ET2'|'PENS'|'FT' };
  score: { home: number; away: number };
  prob:  { home: number; draw: number; away: number };   // percentages, sum ≈ 100
  front: number;                               // 0..1 battle-line position (0 = England camp)
  possession: { side: Side | null; zone: 'safe'|'attack'|'danger'|'box' };
  momentum: { home: number; away: number };    // 0..1 ambient pressure
  threat: { home:    { goal?: boolean; penalty?: boolean; corner?: boolean };
            away:    { goal?: boolean; penalty?: boolean; corner?: boolean };
            neutral: { var?: boolean; redCard?: boolean; yellowCard?: boolean } };
  market: { suspended: boolean; darkForMs: number };
}

// Discrete events, queued; each triggers one cinematic (1.5–4s, never overlapping)
type BattleEvent =
  | { kind: 'goal'; side: Side; minute: number; probJump: { from: number; to: number } }
  | { kind: 'shot'; side: Side; outcome: 'OnTarget'|'OffTarget'|'Blocked'|'Woodwork' }
  | { kind: 'corner'; side: Side }
  | { kind: 'card'; side: Side; color: 'yellow'|'red' }
  | { kind: 'var'; subject: 'Goal'|'Penalty' }
  | { kind: 'var_end'; outcome: 'Stands'|'Overturned' }
  | { kind: 'substitution'; side: Side }
  | { kind: 'additional_time'; minutes: number }
  | { kind: 'suspension_start' }
  | { kind: 'reopen'; front: number; prob: BattleFrame['prob'] }
  | { kind: 'kickoff' | 'halftime' }
  | { kind: 'fulltime'; winner: Side | 'draw'; score: { home: number; away: number } };
```

**Choreography rules (renderer logic):**
- `front` maps to the battle line's position along the board axis (vertical in portrait — England
  at the bottom; horizontal on desktop — England left). Ease toward the target over ~800ms. Never
  snap — EXCEPT when a `reopen` event arrives: then step directly with a shockwave ripple and a
  fast count-up on the hero number.
- **Territory IS probability**: terrain behind each army subtly tints toward its color, so the
  split of the board always reads as the state of the match. At extreme probabilities the line
  physically reaches the enemy camp gates (97% ≈ at the gates).
- Army sizes: about `round(prob × 1.5)` soldier units per side (28.4% → ~43 units), clustered in
  loose ranks behind the line. Spawn/despawn in squads of 3–5 that march in from the camp or
  retreat back — units never pop in or out.
- `possession.zone` drives one raid squad from the side in possession: `safe` = mill around own
  half; `attack` = squad advances to midfield; `danger` = raid pushes deep into enemy territory;
  `box` = assault right at the enemy trench with muzzle flashes. Zone changes every 5–10 seconds.
- `momentum` drives ambient intensity per side (see the ambient warfare layer below).
- `threat` flags are warning flares: a pulsing gold flare over the threatened area plus a HUD chip
  (e.g. `⚠ ENGLAND GOAL THREAT`). Neutral threats (VAR / cards) flare at the center circle.
- `market.suspended` = fog of war: within ~2s fog banks roll across the whole field, colors
  desaturate, HUD probability numbers freeze and show `MARKET REPRICING…` with an elapsed timer.
  On `reopen`: fog rips away and the step-change plays. Use a light haze (not full fog) if
  `darkForMs` is under ~15s.
- Cinematics: `goal` = detonation at the enemy camp + scorch decal + banner `GOAL — ENGLAND 54'`
  + score flip; `shot` = artillery shell arc with outcome (saved = sandbag block, woodwork =
  post clang + ricochet, off target = overshoot into the trees); `corner` = flanking maneuver
  from the field corner; `card` = referee spotlight, red card marches one visible soldier off and
  tags the army `10 MEN`; `var` = full ceasefire, everything freezes under a tribunal spotlight
  until `var_end` (Stands = play resumes, Overturned = rewind flourish); `substitution` = fresh
  squad column marches in as a tired one exits; `additional_time` = banner `+4 MIN — BATTLE
  EXTENDED`.
- **The endgame — victory overrun**: on `fulltime` with a winner, the winning army surges the
  remaining distance, floods the enemy camp, plants its flag on the enemy HQ, and the ENTIRE board
  repaints in the winner's colors — banner `ARGENTINA TAKE THE FIELD — 2–1`, tracer-fire salute,
  ~12s hold on the conquered board. A draw at fulltime = armistice: both armies withdraw a step
  and the trench becomes a neutral monument line. Winning means taking the whole board — make it
  feel like that.
- WAR FEED rows mirror every event plus any probability move bigger than ±1.5% within a minute
  (`ENG +2.1% · danger raid repelled`).

**The ambient warfare layer — critical; the board must NEVER look static.** Between data beats
there is continuous low-stakes warfare so the world always feels alive. This layer is decorative
but MODULATED by the data, so the background never contradicts the numbers:
- Artillery pieces dug in behind each line lob shells across no-man's-land continuously: base ~4
  shells/min per side, scaling to ~30/min at full momentum. Dirt-puff impacts, tracer arcs, the
  occasional dud.
- Tanks (3–5 per side) patrol their own territory, creep forward when their side's front advances,
  and fire in support of box-zone raids.
- Aircraft: a flyover every 45–90 seconds from whichever side has higher momentum — recon passes
  normally, a bombing run (2–3 explosions walking along the front) when that side's momentum is
  0.7 or higher. The other camp's AA guns send up tracer fire at passing planes.
- Trench-warfare furniture at the frontline: a dug trench + sandbags + barbed wire that re-digs
  itself at the new position whenever the front moves more than ~3% of the board — and leaves the
  old trench as a scar in the terrain, so the battlefield remembers the match's history.
- Infantry idle loops: patrols, mortar teams taking pot-shots from the trench, medics dragging
  units back, supply trucks shuttling between camp and front, flag bearers, campfire smoke.
- Both camps are FULL army bases in team colors: HQ tent cluster, ammo depots, parked tanks and
  aircraft, AA emplacements, a radar dish, field hospital, campfires, one tall flag. Camps visibly
  mobilize (more vehicles depart, lights come on) as that side's momentum rises.
- Performance: ambient effects adaptively throttle (instance counts, particle budgets) to hold
  50fps+ on a mid-tier phone; cinematics always take visual priority over ambient activity.

**Controls & tweaks panel (required):** on-screen play/pause and 1×/2×/4× speed. In addition,
expose a **tweaks panel** with direct event triggers so any specific moment can be fired on demand
at any time, independent of the scripted timeline: trigger goal (England / Argentina), trigger
shot (with outcome picker: OnTarget / Blocked / Woodwork / OffTarget), trigger corner (per side),
trigger yellow / red card (per side), trigger VAR (then resolve Stands / Overturned), force a
threat flare (per side), toggle fog of war on/off, momentum sliders (per side, 0–1), and "jump to
finale" (plays the victory overrun immediately). Triggered events must inject into the exact same
BattleEvent queue the demo script uses — one code path for scripted, triggered, and (later) real
data.

**The demo script (this is what makes it feel real):** a ~4.5 minute embedded JSON timeline played
on loop. The pacing reproduces measured behavior of the real data feed, and
the arc is the real match's arc — England led, Argentina came back to win 2–1:
- Continuous probability random-walk: ±0.05–0.3% ticks every 300–900ms around slow trends. Start
  England 28.4%, Draw 46.5%, Argentina 25.1%.
- Possession zone changes every 5–10s (weights: safe 40%, attack 30%, danger 18%, box 12%), with
  runs alternating sides. Ambient warfare running throughout per the rules above.
- t≈75s: threat flare `{home: {goal: true}}` → 20 seconds of England danger/box raids → **GOAL,
  England, minute 54** → `suspension_start` → fog for a scripted 20s (right on the real median:
  across 14 measured goal suspensions in six matches the gaps ran 6–73s, median ~21s — this
  particular England goal was the 73s outlier) → `reopen` with England
  stepping **28.4% → 69.7%** in one move (these two numbers are real measured values — keep them
  exactly) → slow drift back down ~0.5%/min.
- t≈140s: `var` on a penalty check → `var_end: Overturned` (crowd-groan moment).
- t≈180s: yellow card (Argentina), corner (England) flanking move, `additional_time: 4`.
- t≈205s: threat flare `{away: {goal: true}}` → Argentina box assault → **GOAL, Argentina,
  minute 78** → fog ~15s → `reopen`: England 31%, Draw 31%, Argentina 38%. The front slides back
  down the board.
- t≈240s: sustained Argentina danger raids → **GOAL, Argentina, minute 90+3** → fog ~15s →
  `reopen`: Argentina 96.5%, Draw 3%, England 0.5% — the front collapses to England's camp gates.
- t≈265s: `fulltime, winner: away, 1–2` → **VICTORY OVERRUN**: Argentina floods the board, plants
  the flag on England's HQ, full territory repaint, `ARGENTINA TAKE THE FIELD — 2–1`, ~12s hold.
- Clean `REPLAY` interstitial → loop back to kickoff.

**Do not:** make network calls; use real crests or FIFA marks; interpolate the probability
sparkline across suspension gaps; size anything with `100vh`; build a separate mobile-landscape
layout; let the ambient warfare contradict the data (no heavy shelling from the low-momentum
side); let cinematics block frame processing; drop below ~50fps on a mid-tier phone; autoplay
sound (audio off by default behind a toggle).
