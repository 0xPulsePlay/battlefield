// bridge/mapping.js — pure, hermetic mapping from TxLINE engine payloads to the
// BattleFrame / BattleEvent contract the renderer consumes. No network, no DOM,
// no time — every function is deterministic given its inputs so it can be unit
// tested against recorded fixtures. See bridge/__fixtures__/ and bridge/mapping.test.mjs.
//
// Field-by-field spec source: battlefield/BRIDGE-NOTES.md §3 and the recon brief.

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── StatusId → clock.phase ────────────────────────────────────────────────
// Engine StatusId semantics (from the corpus): 1 NS/PRE, 2 H1, 3 HT, 4 H2,
// 7/9 ET halves, 11-13 penalties, 5/10/100 finished. Anything unknown → PRE.
export function statusIdToPhase(statusId) {
  switch (Number(statusId)) {
    case 2: return 'H1';
    case 3: return 'HT';
    case 4: return 'H2';
    case 7: return 'ET1';
    case 9: return 'ET2';
    case 11: case 12: case 13: return 'PENS';
    case 5: case 10: case 100: return 'FT';
    case 1: default: return 'PRE';
  }
}

// A phase-label string (from timeline.phases[].label) → phase, as a fallback when
// only labels are present. Kept in sync with statusIdToPhase.
export function phaseLabelToPhase(label) {
  const m = { NS: 'PRE', H1: 'H1', HT: 'HT', H2: 'H2', ET1: 'ET1', ET2: 'ET2',
    PENS: 'PENS', FT: 'FT', FINAL: 'FT', AET: 'FT' };
  return m[String(label || '').toUpperCase()] || 'PRE';
}

// ── de-margined 1X2 Pct → prob, oriented home/draw/away ───────────────────
// A downsampled odds row carries pctClose for one of priceName part1/draw/part2.
// part1 == participant1, part2 == participant2. participant1IsHome decides which
// side of the battlefield participant1 defends.
export function orientProb({ part1, draw, part2 }, participant1IsHome) {
  const home = participant1IsHome ? part1 : part2;
  const away = participant1IsHome ? part2 : part1;
  const sum = home + draw + away;
  if (!(sum > 0)) return { home: 33.3, draw: 33.3, away: 33.4 };
  // renormalise so home+draw+away === 100 exactly (buckets can drift a touch)
  return {
    home: (home / sum) * 100,
    draw: (draw / sum) * 100,
    away: (away / sum) * 100,
  };
}

// Raw odds tick (Pct is a string array ordered by PriceNames) → {part1,draw,part2}
export function tickToPct(tick) {
  const names = tick.PriceNames || ['part1', 'draw', 'part2'];
  const pct = tick.Pct || [];
  const out = {};
  names.forEach((n, i) => { out[n] = parseFloat(pct[i]); });
  return { part1: out.part1, draw: out.draw, part2: out.part2 };
}

// ── possession level → zone ───────────────────────────────────────────────
// Engine possession levels (possessionType): safe|neutral|attack|danger|high.
// The renderer speaks 4 zones: safe|attack|danger|box. Map per BRIDGE-NOTES §3.
export function possessionLevelToZone(level) {
  switch (String(level || '').toLowerCase()) {
    case 'high': return 'box';
    case 'danger': return 'danger';
    case 'attack': return 'attack';
    case 'neutral': return 'safe';
    case 'safe': default: return 'safe';
  }
}

// possession participant (1|2) → side, oriented by participant1IsHome
export function possessionSide(participant, participant1IsHome) {
  if (participant !== 1 && participant !== 2) return null;
  const isP1 = participant === 1;
  return (isP1 === !!participant1IsHome) ? 'home' : 'away';
}

// ── front line derived from prob ──────────────────────────────────────────
// Mirror of the synthetic driver's _frontBase so live and replay place the
// trench identically: home share of the decisive mass maps to 0.065..0.935.
export function frontFromProb(prob) {
  const denom = prob.home + prob.away;
  const r = denom > 0 ? prob.home / denom : 0.5;
  return clamp(0.08 + 0.84 * r, 0.065, 0.935);
}

// ── momentum: trailing-window weighted mean over possession levels ────────
// Not computed engine-side (BRIDGE-NOTES §3). Given a trailing window of recent
// possession samples [{side, level, w?}] produce {home, away} in 0..1.
const LEVEL_WEIGHT = { safe: 0.1, neutral: 0.1, attack: 0.45, danger: 0.72, high: 1.0, box: 1.0 };
export function deriveMomentum(window) {
  let hi = 0, ai = 0, hn = 0, an = 0;
  for (const s of window) {
    const w = LEVEL_WEIGHT[String(s.level || 'safe').toLowerCase()] ?? 0.1;
    if (s.side === 'home') { hi += w; hn++; } else if (s.side === 'away') { ai += w; an++; }
  }
  return {
    home: clamp(hn ? hi / hn : 0.3, 0, 1),
    away: clamp(an ? ai / an : 0.3, 0, 1),
  };
}

// ── action → BattleEvent ──────────────────────────────────────────────────
// A folded timeline event (or a live score-update action) → the renderer's
// BattleEvent, or null when the action carries no battlefield meaning.
// `ctx` supplies participant1IsHome and, for goals, the prob jump.
export function actionToBattleEvent(ev, ctx = {}) {
  const p1Home = !!ctx.participant1IsHome;
  const sideOf = (participant) => (participant === 1) === p1Home ? 'home' : 'away';
  const action = String(ev.action || ev.Action || '').toLowerCase();

  switch (action) {
    case 'kickoff':
      return { kind: 'kickoff' };
    case 'goal': {
      const side = sideOf(ev.participant);
      const minute = ev.minute ?? 0;
      const jump = ctx.probJump || { from: 0, to: 0 };
      return { kind: 'goal', side, minute, probJump: jump };
    }
    case 'shot': {
      const side = sideOf(ev.participant);
      const outcome = normalizeShotOutcome(ev.detail || ev.outcome || ev.Outcome);
      return { kind: 'shot', side, outcome };
    }
    case 'corner':
      return { kind: 'corner', side: sideOf(ev.participant) };
    case 'yellow_card':
      return { kind: 'card', side: sideOf(ev.participant), color: 'yellow' };
    case 'red_card':
    case 'red card':
      return { kind: 'card', side: sideOf(ev.participant), color: 'red' };
    case 'substitution':
      return { kind: 'substitution', side: sideOf(ev.participant) };
    case 'additional_time': {
      // The folded event carries `minute` (when it was announced), not the added
      // amount. buildReplayModel derives the real stoppage from the clock segment
      // and passes it via ctx.minutes; the raw fields are a fallback.
      const minutes = ev.minutes ?? ctx.minutes ?? ev.detail?.Minutes ?? ev.Data?.Minutes ?? 0;
      return { kind: 'additional_time', minutes: Number(minutes) || 0 };
    }
    case 'var':
    case 'var_start':
      return { kind: 'var', subject: normalizeVarSubject(ev.detail || ev.subject) };
    case 'var_end':
      return { kind: 'var_end', outcome: /overturn/i.test(ev.detail || ev.outcome || '') ? 'Overturned' : 'Stands' };
    case 'game_finalised':
    case 'game_finalized':
    case 'fulltime':
      return { kind: 'fulltime', winner: ctx.winner || 'draw', score: ctx.score || { home: 0, away: 0 } };
    default:
      return null;
  }
}

export function normalizeShotOutcome(x) {
  const s = String(x || '').toLowerCase();
  if (s.includes('target') && !s.includes('off')) return 'OnTarget';
  if (s.includes('ontarget') || s === 'on') return 'OnTarget';
  if (s.includes('wood') || s.includes('post') || s.includes('bar')) return 'Woodwork';
  if (s.includes('block')) return 'Blocked';
  if (s.includes('off')) return 'OffTarget';
  return 'OnTarget';
}

export function normalizeVarSubject(x) {
  const s = String(x || '').toLowerCase();
  if (s.includes('pen')) return 'Penalty';
  return 'Goal';
}

// ── threat objects from a live score-update's predictor fields ────────────
// Live composite score events carry PossibleEvent predictors on the top level
// (VAR/RedCard/YellowCard) and per-participant (Goal/Penalty/Corner). Map to the
// renderer's threat shape. Absent predictors → empty objects (no flare).
export function threatFromPredictors(raw, participant1IsHome) {
  const t = { home: {}, away: {}, neutral: {} };
  const p1Home = !!participant1IsHome;
  const homeKey = p1Home ? 'Parti1State' : 'Parti2State';
  const awayKey = p1Home ? 'Parti2State' : 'Parti1State';
  const readSide = (stateKey, dest) => {
    const pe = raw?.[stateKey]?.PossibleEvent || {};
    if (pe.Goal) dest.goal = true;
    if (pe.Penalty) dest.penalty = true;
    if (pe.Corner) dest.corner = true;
  };
  readSide(homeKey, t.home);
  readSide(awayKey, t.away);
  const npe = raw?.PossibleEvent || {};
  if (npe.VAR) t.neutral.var = true;
  if (npe.RedCard) t.neutral.redCard = true;
  if (npe.YellowCard) t.neutral.yellowCard = true;
  return t;
}

// score from the 64-key stats map (keys "1"=P1 goals, "2"=P2 goals), oriented.
export function scoreFromStats(stats, participant1IsHome) {
  const p1 = Number(stats?.['1'] ?? stats?.[1] ?? 0);
  const p2 = Number(stats?.['2'] ?? stats?.[2] ?? 0);
  return participant1IsHome ? { home: p1, away: p2 } : { home: p2, away: p1 };
}
