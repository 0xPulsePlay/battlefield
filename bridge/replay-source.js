// bridge/replay-source.js — turns two REST payloads (fixture detail + 1X2 odds
// series) into a replay model the driver sweeps to produce BattleFrames.
//
// Master coordinate is wall-clock `ts` (milliseconds) — the one unambiguous,
// monotonic timeline the data actually lives in. Match-clock seconds (with HT
// frozen, H2 resuming at 45:00, stoppage/ET honoured) are DERIVED for display
// via the clock model. Everything the renderer sees is real: prob is the
// de-margined 1X2 Pct, score/clock/events come from the folded timeline; only
// front/momentum/ambient-possession are derived (as in the synthetic driver).
//
// `buildReplayModel(fixtureResp, oddsResp)` is PURE so it is unit-tested against
// recorded fixtures. `loadReplayModel(...)` fetches.

import {
  orientProb, frontFromProb, actionToBattleEvent, clamp,
} from './mapping.js';

const HALF_SEC = 2700;          // 45:00
const GOAL_DARK_MS = 18000;     // market-dark window at a goal (median ~21s real)
const GOAL_LEAD_MS = 78000;     // odds reprice ~1min before the folded goal ts; hold the
                                // pre-goal level across this lead so the sparkline jump and
                                // the goal cinematic stay coherent (suspension → step-reopen).
const VAR_DARK_MS = 20000;
const GOAL_SETTLE_MS = 30000;   // sample the reopened level this far past the dark window

const NATION_ABBR = {
  England: 'ENG', Argentina: 'ARG', Brazil: 'BRA', France: 'FRA', Germany: 'GER',
  Spain: 'ESP', Portugal: 'POR', Netherlands: 'NED', Belgium: 'BEL', Croatia: 'CRO',
  Italy: 'ITA', Uruguay: 'URU', Colombia: 'COL', Mexico: 'MEX', USA: 'USA',
  Japan: 'JPN', 'South Korea': 'KOR', Morocco: 'MAR', Senegal: 'SEN', Nigeria: 'NGA',
  Switzerland: 'SUI', Denmark: 'DEN', Sweden: 'SWE', Norway: 'NOR', Poland: 'POL',
  Austria: 'AUT', Ecuador: 'ECU', Ghana: 'GHA', Australia: 'AUS', Canada: 'CAN',
  Qatar: 'QAT', Iran: 'IRN', 'Saudi Arabia': 'KSA', Egypt: 'EGY', Tunisia: 'TUN',
  Chile: 'CHI', Paraguay: 'PAR', Peru: 'PER', Scotland: 'SCO', Turkey: 'TUR',
  'Czech Republic': 'CZE', Hungary: 'HUN', 'Ivory Coast': 'CIV', Algeria: 'ALG',
  'South Africa': 'RSA', 'Congo DR': 'COD', 'Cape Verde': 'CPV', 'Costa Rica': 'CRC',
  Panama: 'PAN', Haiti: 'HAI', Curacao: 'CUW', Jordan: 'JOR', Iraq: 'IRQ',
  Palestine: 'PLE', Uzbekistan: 'UZB', Kazakhstan: 'KAZ', Kyrgyzstan: 'KGZ',
  'New Zealand': 'NZL', India: 'IND', Vietnam: 'VIE', Myanmar: 'MYA', Azerbaijan: 'AZE',
  Armenia: 'ARM', Moldova: 'MDA', Gibraltar: 'GIB', Liechtenstein: 'LIE', 'San Marino': 'SMR',
  'Bosnia & Herzegovina': 'BIH',
};

export function abbr(name) {
  if (NATION_ABBR[name]) return NATION_ABBR[name];
  return String(name || '???').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???';
}

// ── clock model ───────────────────────────────────────────────────────────
// Piecewise ts→matchSec. Segments carry [ts0,ts1] and [sec0,sec1] plus inner
// event anchors so every real event minute is hit exactly. HT is frozen; H2
// resumes at 45:00; stoppage/ET honoured by the real phase-transition ts.
export function buildClockModel(phases, events) {
  const byStatus = {};
  for (const p of phases) if (byStatus[p.status] == null) byStatus[p.status] = p.ts;
  const H1 = byStatus[2], HT = byStatus[3], H2 = byStatus[4];
  const ET1 = byStatus[7], ET2 = byStatus[9];
  const FT = byStatus[5] ?? byStatus[10] ?? byStatus[100];
  const kickoff = H1 ?? phases[0]?.ts ?? 0;

  // kickoff/restart actions carry an unreliable `minute` (the post-goal restart
  // is labelled minutes ahead), so they are not used as clock anchors — the
  // phase transitions already fix the half boundaries.
  const evByWindow = (t0, t1) =>
    events.filter((e) => e.ts >= t0 && (t1 == null || e.ts < t1) && Number.isFinite(e.minute) && e.action !== 'kickoff')
      .map((e) => ({ ts: e.ts, sec: e.minute * 60 }))
      .sort((a, b) => a.ts - b.ts);

  const segs = [];
  segs.push({ phase: 'PRE', running: false, ts0: -Infinity, ts1: kickoff, sec0: 0, sec1: 0, anchors: [] });
  const h1Anchors = evByWindow(H1, HT);
  const h1EndSec = Math.max(HALF_SEC, h1Anchors.length ? h1Anchors[h1Anchors.length - 1].sec : HALF_SEC);
  if (H1 != null) segs.push({ phase: 'H1', running: true, ts0: H1, ts1: HT ?? Infinity, sec0: 0, sec1: h1EndSec, anchors: h1Anchors });
  if (HT != null) segs.push({ phase: 'HT', running: false, ts0: HT, ts1: H2 ?? Infinity, sec0: h1EndSec, sec1: h1EndSec, anchors: [] });
  const h2Anchors = evByWindow(H2, ET1 ?? FT);
  const h2EndSec = Math.max(HALF_SEC * 2, h2Anchors.length ? h2Anchors[h2Anchors.length - 1].sec : HALF_SEC * 2);
  if (H2 != null) segs.push({ phase: 'H2', running: true, ts0: H2, ts1: (ET1 ?? FT) ?? Infinity, sec0: HALF_SEC, sec1: h2EndSec, anchors: h2Anchors });
  let endSec = h2EndSec;
  if (ET1 != null) {
    const a1 = evByWindow(ET1, ET2 ?? FT);
    const et1End = Math.max(6300, a1.length ? a1[a1.length - 1].sec : 6300);
    segs.push({ phase: 'ET1', running: true, ts0: ET1, ts1: (ET2 ?? FT) ?? Infinity, sec0: 5400, sec1: et1End, anchors: a1 });
    endSec = et1End;
    if (ET2 != null) {
      const a2 = evByWindow(ET2, FT);
      const et2End = Math.max(7200, a2.length ? a2[a2.length - 1].sec : 7200);
      segs.push({ phase: 'ET2', running: true, ts0: ET2, ts1: FT ?? Infinity, sec0: 6300, sec1: et2End, anchors: a2 });
      endSec = et2End;
    }
  }
  if (FT != null) segs.push({ phase: 'FT', running: false, ts0: FT, ts1: Infinity, sec0: endSec, sec1: endSec, anchors: [] });

  const interpInSeg = (seg, ts) => {
    const pts = [{ ts: seg.ts0, sec: seg.sec0 }, ...seg.anchors, { ts: seg.ts1 === Infinity ? seg.ts0 + 1 : seg.ts1, sec: seg.sec1 }]
      .filter((p) => Number.isFinite(p.ts)).sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (ts <= b.ts) {
        if (b.ts === a.ts) return a.sec;
        return a.sec + (b.sec - a.sec) * clamp((ts - a.ts) / (b.ts - a.ts), 0, 1);
      }
    }
    return seg.sec1;
  };

  const tsToMatchSec = (ts) => {
    for (const seg of segs) {
      if (ts >= seg.ts0 && ts < seg.ts1) {
        return { sec: Math.max(0, seg.running ? interpInSeg(seg, ts) : seg.sec0), phase: seg.phase, running: seg.running };
      }
    }
    const last = segs[segs.length - 1];
    return { sec: last.sec1, phase: last.phase, running: false };
  };

  return { segs, tsToMatchSec, kickoff, fullTimeSec: endSec, firstTs: kickoff, ftTs: FT };
}

// ── prob timeline (ts indexed) ────────────────────────────────────────────
// `goalTsList` lets us drop the noisy transition samples in each goal's
// lead+dark window so the held pre-goal level is clean and the reopen jumps
// straight to the settled post-goal level.
export function buildProbTimeline(oddsResp, participant1IsHome, goalTsList = []) {
  const rows = (oddsResp.series || []).filter((r) => (r.marketPeriod || '') === '');
  const byBucket = new Map();
  for (const r of rows) {
    const ts = r.minuteBucket * 60000;
    let e = byBucket.get(ts);
    if (!e) { e = { ts }; byBucket.set(ts, e); }
    e[r.priceName] = r.pctClose;
  }
  let samples = [];
  for (const e of byBucket.values()) {
    if (e.part1 == null || e.draw == null || e.part2 == null) continue;
    samples.push({ ts: e.ts, ...orientProb({ part1: e.part1, draw: e.draw, part2: e.part2 }, participant1IsHome) });
  }
  samples.sort((a, b) => a.ts - b.ts);
  for (const gTs of goalTsList) {
    samples = samples.filter((s) => !(s.ts > gTs - GOAL_LEAD_MS && s.ts < gTs + GOAL_DARK_MS));
  }
  return samples;
}

// ── the model ─────────────────────────────────────────────────────────────
export function buildReplayModel(fixtureResp, oddsResp) {
  const f = fixtureResp.fixture || fixtureResp;
  const tl = fixtureResp.timeline || { phases: [], events: [] };
  const p1Home = !!f.participant1IsHome;
  const home = { name: p1Home ? f.participant1 : f.participant2, id: p1Home ? f.participant1Id : f.participant2Id };
  const away = { name: p1Home ? f.participant2 : f.participant1, id: p1Home ? f.participant2Id : f.participant1Id };
  const teams = {
    home: { ...home, abbr: abbr(home.name) },
    away: { ...away, abbr: abbr(away.name) },
    participant1IsHome: p1Home,
  };

  const clock = buildClockModel(tl.phases || [], tl.events || []);
  const goals = (tl.events || []).filter((e) => e.action === 'goal');
  const prob = buildProbTimeline(oddsResp || { series: [] }, p1Home, goals.map((g) => g.ts));

  // suspension windows (ts): a goal holds the pre-goal level across its lead +
  // dark window, then reopens; VAR darkens for a short spell. `goalTs` is the
  // moment fog/suspension actually engages (the lead is a quiet hold).
  const suspends = [];
  for (const e of tl.events || []) {
    if (e.action === 'goal') suspends.push({ start: e.ts - GOAL_LEAD_MS, end: e.ts + GOAL_DARK_MS, goalTs: e.ts });
    if (e.action === 'var' || e.action === 'var_start') suspends.push({ start: e.ts, end: e.ts + VAR_DARK_MS, goalTs: e.ts });
  }
  suspends.sort((a, b) => a.start - b.start);

  // material events → {ts, battleEvent, raw}. The driver announces the single
  // match kickoff itself, so the timeline's per-half `kickoff` actions (which
  // would each reset the renderer) are excluded here.
  const eventTimeline = [];
  for (const e of tl.events || []) {
    if (e.action === 'kickoff') continue;
    let ctx = { participant1IsHome: p1Home };
    if (e.action === 'goal') {
      const from = probAtSamples(prob, e.ts - GOAL_LEAD_MS - 5000);
      const to = probAtSamples(prob, e.ts + GOAL_DARK_MS + GOAL_SETTLE_MS);
      const side = (e.participant === 1) === p1Home ? 'home' : 'away';
      ctx.probJump = {
        from: from ? Math.round(from[side] * 10) / 10 : 0,
        to: to ? Math.round(to[side] * 10) / 10 : 0,
      };
      ctx.score = orientScore(e.score, p1Home);
    }
    const be = actionToBattleEvent(e, ctx);
    if (be) eventTimeline.push({ ts: e.ts, sec: clock.tsToMatchSec(e.ts).sec, seq: e.seq, battleEvent: be, action: e.action, raw: e });
  }
  eventTimeline.sort((a, b) => a.ts - b.ts || a.seq - b.seq);

  // score step function (ts): the goal is on the board the moment it's scored.
  const scoreSteps = [{ ts: -Infinity, home: 0, away: 0 }];
  for (const g of goals) scoreSteps.push({ ts: g.ts, ...orientScore(g.score, p1Home) });
  scoreSteps.sort((a, b) => a.ts - b.ts);

  const finalScore = orientScore(f.finalScore, p1Home);
  const winner = finalScore.home > finalScore.away ? 'home' : finalScore.away > finalScore.home ? 'away' : 'draw';
  const firstTs = clock.firstTs;
  const endTs = clock.ftTs ?? (eventTimeline.length ? eventTimeline[eventTimeline.length - 1].ts + 60000 : firstTs + 5_400_000);

  return {
    fixtureId: f.fixtureId,
    teams,
    competition: f.competition,
    startTime: f.startTime,
    status: f.status,
    finalScore,
    winner,
    firstTs,
    endTs,
    fullTimeSec: clock.fullTimeSec || HALF_SEC * 2,
    clock,
    prob,
    suspends,
    eventTimeline,
    scoreSteps,

    // ── query API (ts) ───────────────────────────────────────────────────
    inSuspension(ts) {
      for (const w of suspends) if (ts >= w.start && ts < w.end) return w;
      return null;
    },
    probAt(ts) {
      const w = this.inSuspension(ts);
      if (w) {
        const held = probAtSamples(prob, w.start - 1) || probAtSamples(prob, ts) || { home: 33.3, draw: 33.4, away: 33.3 };
        const inDark = ts >= (w.goalTs ?? w.start);
        return { ...held, suspended: inDark, darkMs: inDark ? Math.round(ts - (w.goalTs ?? w.start)) : 0 };
      }
      const p = probAtSamples(prob, ts) || { home: 33.3, draw: 33.4, away: 33.3 };
      return { ...p, suspended: false, darkMs: 0 };
    },
    frontAt(ts) { return frontFromProb(this.probAt(ts)); },
    scoreAt(ts) {
      let s = { home: 0, away: 0 };
      for (const st of scoreSteps) if (ts >= st.ts) s = { home: st.home, away: st.away };
      return s;
    },
    displayClock(ts) { return clock.tsToMatchSec(ts); },
    eventsBetween(fromTs, toTs) { return eventTimeline.filter((e) => e.ts > fromTs && e.ts <= toTs); },
    // progress 0..1 over the playable span, and its inverse for the scrubber
    tsToProgress(ts) { return clamp((ts - firstTs) / (endTs - firstTs), 0, 1); },
    progressToTs(p) { return firstTs + clamp(p, 0, 1) * (endTs - firstTs); },
  };
}

function orientScore(arr, p1Home) {
  const a = Array.isArray(arr) ? arr : [0, 0];
  return p1Home ? { home: a[0] || 0, away: a[1] || 0 } : { home: a[1] || 0, away: a[0] || 0 };
}

function probAtSamples(samples, ts) {
  if (!samples.length) return null;
  if (ts <= samples[0].ts) return pick(samples[0]);
  if (ts >= samples[samples.length - 1].ts) return pick(samples[samples.length - 1]);
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].ts <= ts) lo = mid; else hi = mid; }
  const a = samples[lo], b = samples[hi];
  if (b.ts === a.ts) return pick(a);
  const fr = (ts - a.ts) / (b.ts - a.ts);
  return { home: a.home + (b.home - a.home) * fr, draw: a.draw + (b.draw - a.draw) * fr, away: a.away + (b.away - a.away) * fr };
}
const pick = (s) => ({ home: s.home, draw: s.draw, away: s.away });

// ── async loader (browser/node) ───────────────────────────────────────────
export async function loadReplayModel(baseUrl, fixtureId, fetchImpl = fetch) {
  const [fx, od] = await Promise.all([
    fetchImpl(`${baseUrl}/v1/fixtures/${fixtureId}`).then((r) => r.json()),
    fetchImpl(`${baseUrl}/v1/fixtures/${fixtureId}/odds?market=1X2_PARTICIPANT_RESULT`).then((r) => r.json()),
  ]);
  return buildReplayModel(fx, od);
}
