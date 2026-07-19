# Battlefield — Demo Plan (video ≤ 5:00)

_Authored 2026-07-19 morning, in parallel with the final-round build
(`.nightshift/specs/05b-battlefield-final-round.md`). Each beat lists its spec dependency and a
fallback, so the video can be recorded even if a late item slips._

**Hard requirements the video must satisfy** (from `HACKATHON-MUST-INCLUDES.md`): ≤ 5 minutes ·
shows the problem → live app walkthrough → how TxLINE powers the backend · judging happens AFTER
the tournament, so the video carries the full experience on its own.

**Recording logistics**
- Primary capture: **phone portrait** (QuickTime iPhone mirror or 402×874 browser window) — it is
  the polished target. Secondary: desktop console 1440×900 for the beats that need it.
- Rehearse on `http://localhost:4400/?fixture=18241006&mode=replay` (ENG–ARG final — the richest
  arc: 1–0 → 1–1 → 1–2).
- **19:00 UTC today = the real World Cup final.** Capture 20–30s of `?mode=live` during it for
  Beat 6 b-roll. This is the only chance; set an alarm.
- Sound: engine audio is off by default — decide before recording; war-drums under Beat 3 land
  well, otherwise record clean and voice-over.

---

## The seven beats

### 0:00–0:25 · Cold open — the problem
On screen: TV-broadcast stock shot or just the app title moment → cut to the diorama mid-battle.
> **SPIKE:** "TV shows you the ball. The Battlefield shows you belief. Every match is also a
> market — thousands of probability ticks per minute that fans never see. We turned that feed
> into a war you can watch, play, and *prove*."

### 0:25–1:30 · Beat 1 — The battle (the core loop)
Actions: land on home → (one glance at lobby) → enter the ENG–ARG final → hit **4×** and let it
play: England's 54' goal (army surges as win-prob leaps ~37%→64%), fog rolls over the field
(market suspension), Argentina claw back, full-time overrun.
> **SPIKE:** "Every soldier on this field is a basis point of real, de-margined win probability
> from TxLINE. When England score, you don't read a number — you watch an army surge."
> **SPIKE (fog):** "When the market goes dark, fog of war rolls in. That's a real trading
> suspension in the data — not an animation we invented."
Depends on: B3/B4 (sync). Fallback: none needed — this works today; B4 makes it honest.

### 1:30–2:15 · Beat 2 — Every pixel provable
Actions: pause right after the goal → tap the goal in the War Feed (or a threat flare / the
frontline — the new C1 surfaces) → payload → **VERIFY THIS TICK ON-CHAIN** → walk leaf → branch
→ root → the anchored Solana account → **PROVEN AUTHENTIC**.
> **SPIKE:** "No other fan app can do this, because no other feed is provable. Every tick walks
> a Merkle proof to a root anchored on Solana."
> **SPIKE (if B2 landed):** "And it's verified twice, independently — once in your browser with
> our verify SDK, once by the engine. Same root, both ways."
Depends on: C1 (flare/fog/frontline taps), B2 (browser-side verify). Fallback: War Feed tap +
engine verdict — already works.

### 2:15–3:00 · Beat 3 — Play along: streaks and points
Actions: scrub back into a danger spell → **RAID INCOMING** (new compact card) → call the goal →
correct → points bank + **streak flame ticks up**. Make a second call to show the streak build.
> **SPIKE:** "You're not betting against your friends — you're scored against the market itself.
> Beating a 20-percent call pays more than a coin flip ever could. Streaks multiply it."
Depends on: C4 (streaks/points), C6 (raid card), B4 (scrub). Fallback: current predict-along +
record sheet (works today); drop the streak line.

### 3:00–3:30 · Beat 4 — Friends at war (rooms)
Actions: create a room → second device joins via the share link → both make calls → the live
room leaderboard reorders in real time.
> **SPIKE:** "Every room is a private battlefield — this is the watch-party layer. Your group,
> one match, live scoreboard of who reads the game best."
Depends on: C10 (room server). Fallback: cut the beat; extend Beat 3 by one more call and say
rooms in the close ("shared rooms ship next").

### 3:30–3:55 · Beat 5 — Breadth + sign-in with Solana
Actions: open **MATCHES** → 116 battles, segmented + search "arg" → tap Brazil–Haiti, the whole
diorama re-skins → open wallet → **Connect Phantom** → signed in, record persists.
> **SPIKE:** "A hundred and sixteen real matches, tick-by-tick — every one a replayable battle.
> And you enlist with your Solana wallet — one tap, Phantom, done."
Depends on: C9 (picker polish), C2 (Phantom). Fallback: picker works today; if Phantom slipped,
show guest identity and say "wallet connect via Phantom" over the sheet — do NOT claim it works.

### 3:55–4:20 · Beat 6 — Creator overlay + live proof
Actions: open `?overlay=1&bg=green` in a second window (or OBS chroma-key over match footage) —
the diorama as a broadcast second-screen. Then cut to the captured live-final clip with the LIVE
badge.
> **SPIKE:** "The battlefield embeds in any stream — a second screen for watch parties and
> creators. That's the business."
> **SPIKE (live clip):** "And this isn't a simulation of the final. This *is* the final — live."
Depends on: C11 (overlay), live capture at 19:00 UTC. Fallback: skip overlay window, keep the
live clip; if no live clip, the replay beats already carry the judging criterion (judging is
post-tournament anyway).

### 4:20–4:50 · Beat 7 — Under the hood (the TxLINE requirement)
On screen: the architecture diagram from `docs/SUBMISSION-TECH.md` (or a slow network-tab pan).
> **SPIKE:** "Under the hood: TxLINE's odds and scores feeds — thirty-five thousand ticks a
> match — folded by our platform, consumed through our typed client SDK, replayed on a true
> match clock. Probabilities are de-margined Pct values: honest probabilities, straight from
> the source. And the proofs come from TxLINE's on-chain validation program."
Name on screen (text overlay): fixtures · odds (1X2 de-margined) · state · validation/scores
`verify=1` · resumable SSE stream.

### 4:50–5:00 · Close
Diorama at full time, scars and all → poster export flashes → title card with repo link.
> **SPIKE:** "The match, as the market lives it. The Probability Battlefield."

---

## Money-lines summary (say these, verbatim)
1. "TV shows you the ball. The Battlefield shows you belief."
2. "Every soldier is a basis point of real, de-margined win probability."
3. "Fog of war is a real trading suspension — not an animation."
4. "No other fan app can do this, because no other feed is provable."
5. "Scored against the market itself — beating a 20% call pays more than a coin flip."
6. "Every room is a private battlefield."
7. "This isn't a simulation of the final. This *is* the final."
8. "The match, as the market lives it."

## Don'ts
- Don't show the War Room in any real-match beat (it's sandbox-only after B5).
- Don't claim anything not verified — Phantom, rooms, overlay each have honest fallbacks above.
- Don't linger on desktop; portrait is the identity. Desktop appears only in Beats 6–7.
- Don't exceed 5:00 — auto-DQ risk. Target 4:45 with the close as the buffer.
