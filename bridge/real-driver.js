// bridge/real-driver.js — RealMatchDriver: the real-data replacement for the
// synthetic MatchDriver. Same constructor callbacks ({onFrame,onEvent}) and the
// same method surface (inject/forceThreat/setFogForced/setMomentumOverride/
// jumpToFinale/setPaused/setSpeed/destroy) so the HUD, War Room and window.BF
// keep working unchanged — plus seek(sec) for the scrubber and a LIVE SSE mode.
//
// REPLAY: a virtual match-clock sweeps the replay model (real prob, score, clock,
// events); the whole match plays in `replayDurationSec` at 1× (cinematic, never
// mush) and fast-forwards continuously at 2×/4×/8×. LIVE: consumes the composite
// per-fixture SSE and drives the same frame emitter from real-time ticks.

import { loadReplayModel } from './replay-source.js';
import {
  frontFromProb, statusIdToPhase, orientProb, tickToPct, possessionSide,
  possessionLevelToZone, threatFromPredictors, scoreFromStats, actionToBattleEvent, clamp,
} from './mapping.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const g3 = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;

export class RealMatchDriver {
  // opts: { onFrame, onEvent, model, mode:'replay'|'live', baseUrl, fixtureId,
  //         replayDurationSec=210, speed=1, startTs, loop=true, client }
  constructor(opts = {}) {
    this.onFrame = opts.onFrame || (() => {});
    this.onEvent = opts.onEvent || (() => {});
    this.model = opts.model;
    this.mode = opts.mode || 'replay';
    this.baseUrl = opts.baseUrl || 'http://localhost:3001';
    this.fixtureId = opts.fixtureId;
    this.replayDurationSec = opts.replayDurationSec || 210;
    this.loop = opts.loop !== false;
    this.client = opts.client || null;

    this.speed = opts.speed || 1;
    this.paused = false;
    this.momOverride = { home: null, away: null };
    this.fogForced = null;

    this._reset(opts.startTs);
    if (this.mode === 'live') this._startLive();
    this._iv = setInterval(() => this._tick(), 250);
  }

  destroy() {
    clearInterval(this._iv);
    if (this._stopLive) { try { this._stopLive(); } catch {} this._stopLive = null; }
  }

  // ── driver method surface (matches synthetic MatchDriver) ────────────────
  setPaused(p) { this.paused = p; }
  setSpeed(x) { this.speed = x; }
  setMomentumOverride(side, v) { this.momOverride[side] = v; }
  setFogForced(on) {
    if (on === this.fogForced) return;
    this.fogForced = on;
    if (on) { this.darkMs = 60000; this._emit({ kind: 'suspension_start' }); }
    else { this._emit({ kind: 'reopen', front: this._front(), prob: { ...this.prob } }); }
  }
  forceThreat(side, dur = 8, kind = 'goal') { this._threat[side][kind] = this.ts + dur * 1000; }

  inject(evt) {
    // one path for scripted/panel/manual events — mirror the synthetic driver's
    // side effects so War Room stays meaningful during a live/replay session.
    switch (evt.kind) {
      case 'shot':
        this.momEnv[evt.side] = clamp(this.momEnv[evt.side] + 0.15, 0, 1);
        return this._emit(evt);
      case 'corner':
        this.momEnv[evt.side] = clamp(this.momEnv[evt.side] + 0.1, 0, 1);
        this.forcePoss = { side: evt.side, until: this.ts + 8000, zones: ['box', 'danger'] };
        return this._emit(evt);
      case 'card':
        if (evt.color === 'red') this._threat.neutral.redCard = this.ts + 6000;
        else this._threat.neutral.yellowCard = this.ts + 5000;
        return this._emit(evt);
      case 'var': this._threat.neutral.var = this.ts + 999000; return this._emit(evt);
      case 'var_end': this._threat.neutral.var = 0; return this._emit(evt);
      default: return this._emit(evt);
    }
  }

  jumpToFinale() {
    if (!this.model) return;
    this.seek(this.model.endTs - 4000);
  }

  // seek to a wall-clock ts (scrubber). Resets transient cinematic state.
  seek(ts) {
    const t = this.model ? clamp(ts, this.model.firstTs, this.model.endTs) : ts;
    this._reset(t);
    this._emit({ kind: 'seek', ts: t });
  }
  seekProgress(p) { if (this.model) this.seek(this.model.progressToTs(p)); }

  getProgress() { return this.model ? this.model.tsToProgress(this.ts) : 0; }
  getMatchSec() { return this.model ? this.model.displayClock(this.ts).sec : 0; }

  // ── internals ────────────────────────────────────────────────────────────
  _reset(startTs) {
    this.ts = startTs != null ? startTs : (this.model ? this.model.firstTs : 0);
    this.prevTs = this.ts;
    this.finished = false;
    this._firedFinale = false;
    this._kicked = this.model ? this.ts > this.model.firstTs + 500 : false;
    this._activeSusp = null;
    this._suspStarted = new Set();
    this._suspReopened = new Set();
    this._threat = { home: {}, away: {}, neutral: {} };
    this._threatLatch = { home: null, away: null }; // {until, kind} so flares are visible at any speed
    this._predictAnnounced = new Set();
    this.forcePoss = null;
    this.possession = { side: 'home', zone: 'safe' };
    this._possT = rnd(4, 8);
    this._runSide = 'home'; this._runLen = 0;
    this.momEnv = { home: 0.32, away: 0.3 };
    this.mom = { home: 0.32, away: 0.3 };
    this.prob = this.model ? this._sanitizeProb(this.model.probAt(this.ts)) : { home: 33.3, draw: 33.4, away: 33.3 };
    this.score = this.model ? this.model.scoreAt(this.ts) : { home: 0, away: 0 };
    this.darkMs = 0;
  }

  _sanitizeProb(p) { return { home: p.home, draw: p.draw, away: p.away }; }
  _front() { return frontFromProb(this.prob); }

  _emit(evt) { this.onEvent({ ...evt, t: this.ts, matchSec: this.model ? this.model.displayClock(this.ts).sec : 0 }); }

  _tick() {
    if (this.mode === 'live') { this._tickLive(); return; }
    if (!this.model) { return; }
    if (!this.paused && !this.finished) {
      const dtReal = 0.25;
      const realSpanMs = this.model.endTs - this.model.firstTs;
      const dTs = dtReal * this.speed * (realSpanMs / this.replayDurationSec);
      this.prevTs = this.ts;
      this.ts = Math.min(this.model.endTs, this.ts + dTs);

      if (!this._kicked && this.ts > this.model.firstTs) { this._kicked = true; this._emit({ kind: 'kickoff' }); }

      for (const e of this.model.eventsBetween(this.prevTs, this.ts)) this._fireModelEvent(e);
      this._handleSuspensionBoundaries();
      this._latchThreats();
      this._advance(dTs, dtReal);

      if (this.ts >= this.model.endTs && !this._firedFinale) {
        this._firedFinale = true; this.finished = true;
        this._emit({ kind: 'fulltime', winner: this.model.winner, score: { ...this.model.finalScore } });
        if (this.loop) setTimeout(() => { if (this._iv) this._reset(this.model.firstTs); }, 4200);
      }
    }
    this.onFrame(this._frame());
  }

  _fireModelEvent(e) {
    const be = e.battleEvent;
    if (be.kind === 'goal') this.momEnv[be.side] = 0.85;
    if (be.kind === 'shot') this.momEnv[be.side] = clamp(this.momEnv[be.side] + 0.15, 0, 1);
    if (be.kind === 'corner') { this.momEnv[be.side] = clamp(this.momEnv[be.side] + 0.1, 0, 1); this.forcePoss = { side: be.side, until: this.ts + 8000, zones: ['box', 'danger'] }; }
    if (be.kind === 'card' && be.color === 'red') this._threat.neutral.redCard = this.ts + 6000;
    this.onEvent({ ...be, t: e.ts, seq: e.seq, matchSec: e.sec });
  }

  // edge-detect suspension windows across [prevTs, ts] so fast-forward that
  // steps clean over an 18s dark window still flashes the fog cinematic.
  _handleSuspensionBoundaries() {
    for (const w of this.model.suspends) {
      const key = w.goalTs;
      if (!this._suspStarted.has(key) && w.goalTs > this.prevTs && w.goalTs <= this.ts) {
        this._suspStarted.add(key);
        this._emit({ kind: 'suspension_start' });
      }
      if (this._suspStarted.has(key) && !this._suspReopened.has(key) && w.end > this.prevTs && w.end <= this.ts) {
        this._suspReopened.add(key);
        const p = this._sanitizeProb(this.model.probAt(w.end + 1));
        this._emit({ kind: 'reopen', front: frontFromProb(p), prob: { ...p } });
      }
    }
    this._activeSusp = this.model.inSuspension(this.ts);
    if (this._activeSusp && this.ts < (this._activeSusp.goalTs ?? this._activeSusp.start)) this._activeSusp = null; // still in quiet lead
  }

  _advance(dTs, dtReal) {
    if (this.fogForced !== true) {
      const p = this.model.probAt(this.ts);
      this.prob = { home: p.home, draw: p.draw, away: p.away };
      this.darkMs = p.darkMs;
    }
    this.score = this.model.scoreAt(this.ts); // keep the board in sync with the clock

    if (this.forcePoss && this.ts > this.forcePoss.until) this.forcePoss = null;
    this._possT -= dtReal * this.speed;
    if (this._possT <= 0) {
      this._possT = rnd(4, 9);
      if (this.forcePoss) {
        const z = this.forcePoss.zones;
        this.possession = { side: this.forcePoss.side, zone: z[(Math.random() * z.length) | 0] };
      } else {
        const bias = this.mom.home - this.mom.away;
        this._runLen++;
        if (this._runLen > 1 + Math.random() * 2) {
          this._runSide = Math.random() < 0.5 + bias * 0.4 ? 'home' : 'away';
          this._runLen = 0;
        }
        const r = Math.random();
        const zone = r < 0.42 ? 'safe' : r < 0.72 ? 'attack' : r < 0.9 ? 'danger' : 'box';
        this.possession = { side: this._runSide, zone };
      }
      const z = this.possession.zone, sd = this.possession.side;
      if (z === 'danger' || z === 'box') this.momEnv[sd] = clamp(this.momEnv[sd] + 0.1, 0, 1);
    }

    for (const k of ['home', 'away']) {
      this.momEnv[k] += (0.3 - this.momEnv[k]) * 0.004;
      this.mom[k] = clamp(this.mom[k] + (this.momEnv[k] - this.mom[k]) * 0.05 + g3() * 0.012, 0, 1);
      if (this.momOverride[k] != null) this.mom[k] = this.momOverride[k];
    }
  }

  // latch pre-goal threat windows so a flare stays lit for ~1.4s of real time even
  // when fast-forward steps clean over its (short) match-time window.
  _latchThreats() {
    if (!this.model || !this.model.threatWindows) return;
    const lo = Math.min(this.prevTs, this.ts), hi = Math.max(this.prevTs, this.ts);
    for (const w of this.model.threatWindows) {
      if (w.start < hi && w.end > lo) {
        this._threatLatch[w.side] = { until: Date.now() + 1400, kind: w.kind === 'corner' ? 'corner' : 'goal' };
        const id = `${w.side}:${w.start}`;
        if (w.prompt && !this._predictAnnounced.has(id) && !this.finished) {
          this._predictAnnounced.add(id);
          // carry the ground-truth outcome so predict-along scores deterministically at any speed
          this._emit({ kind: 'predict_prompt', side: w.side, outcome: w.outcome, windowId: id, momentum: { ...this.mom } });
        }
      }
    }
  }
  _threatObj(sd) {
    const o = {};
    const mt = this.model && this.model.threatAt ? this.model.threatAt(this.ts) : null; // exact (covers pause)
    if (mt && mt[sd]) { if (mt[sd].goal) o.goal = true; if (mt[sd].corner) o.corner = true; }
    const l = this._threatLatch && this._threatLatch[sd];                              // latched (covers fast-forward)
    if (l && l.until > Date.now()) o[l.kind] = true;
    for (const k in this._threat[sd]) if (this._threat[sd][k] > this.ts) o[k] = true;  // injected (panel/live)
    return o;
  }

  _frame() {
    const susp = this.fogForced === true || !!this._activeSusp;
    const disp = this.model ? this.model.displayClock(this.ts) : { sec: 0, phase: 'H2', running: true };
    const zone = this.possession.zone, sd = this.possession.side;
    const push = ({ safe: 0, attack: 0.015, danger: 0.045, box: 0.07 })[zone] * (sd === 'home' ? 1 : -1);
    const baseFront = this._front();
    const front = this.finished ? baseFront : susp ? (this._lastFront ?? baseFront) : (this._lastFront = clamp(baseFront + push, 0.05, 0.95));
    return {
      t: this.ts,
      clock: { s: Math.floor(disp.sec), running: !!disp.running && !this.paused && !this.finished, phase: disp.phase },
      score: { ...this.score },
      prob: {
        home: Math.round(this.prob.home * 10) / 10,
        draw: Math.round(this.prob.draw * 10) / 10,
        away: Math.round(this.prob.away * 10) / 10,
      },
      front,
      possession: this.finished ? { side: null, zone: 'safe' } : { ...this.possession },
      momentum: { home: Math.round(this.mom.home * 100) / 100, away: Math.round(this.mom.away * 100) / 100 },
      threat: (() => { const t = { home: this._threatObj('home'), away: this._threatObj('away'), neutral: this._threatObj('neutral') }; if (susp || this.finished) { delete t.home.goal; delete t.away.goal; } return t; })(),
      market: { suspended: susp, darkForMs: susp ? (this.fogForced ? 60000 : this.darkMs) : 0 },
    };
  }

  // ── LIVE mode (composite SSE) ─────────────────────────────────────────────
  _startLive() {
    this.finished = false;
    this._liveScore = { home: 0, away: 0 };
    this._liveClock = { s: 0, running: false, phase: 'PRE' };
    this._liveThreat = { home: {}, away: {}, neutral: {} };
    this._livePoss = { side: null, zone: 'safe' };
    this._lastOddsTs = 0;
    this.prob = { home: 33.3, draw: 33.4, away: 33.3 };
    const onEvt = (evt) => this._onLiveEvent(evt);
    if (this.client && typeof this.client.stream === 'function') {
      this._stopLive = this.client.stream({ fixtureId: this.fixtureId }, onEvt, { since: '0' });
    } else {
      // raw EventSource fallback
      const es = new EventSource(`${this.baseUrl}/v1/stream/fixtures/${this.fixtureId}?since=0`);
      const wrap = (name) => (m) => { try { onEvt({ event: name, id: m.lastEventId, data: JSON.parse(m.data) }); } catch {} };
      es.addEventListener('score', wrap('score'));
      es.addEventListener('odds', wrap('odds'));
      this._stopLive = () => es.close();
    }
  }

  _onLiveEvent(evt) {
    const d = evt.data;
    if (evt.event === 'odds') {
      if (d.SuperOddsType !== '1X2_PARTICIPANT_RESULT') return;
      if ((d.MarketPeriod || '') !== '' && d.MarketPeriod != null) return; // full-match only
      const pct = tickToPct(d);
      if (pct.part1 == null) return;
      this.prob = orientProb(pct, d.Participant1IsHome);
      this._lastOddsTs = d.Ts || Date.now();
    } else if (evt.event === 'score') {
      const p1Home = d.Participant1IsHome;
      if (d.Clock) this._liveClock = { s: d.Clock.Seconds || 0, running: !!d.Clock.Running, phase: statusIdToPhase(d.StatusId) };
      if (d.Stats) this._liveScore = scoreFromStats(d.Stats, p1Home);
      this._liveThreat = threatFromPredictors(d, p1Home);
      if (d.Possession) this._livePoss = { side: possessionSide(d.Possession, p1Home), zone: possessionLevelToZone(d.PossessionType || d.possessionType) };
      const be = actionToBattleEvent({ action: d.Action, participant: d.Possession, detail: d.Data?.Outcome, minute: Math.floor((d.Clock?.Seconds || 0) / 60) }, {
        participant1IsHome: p1Home,
        winner: this._liveScore.home > this._liveScore.away ? 'home' : this._liveScore.away > this._liveScore.home ? 'away' : 'draw',
        score: this._liveScore,
      });
      if (be) this._emit(be);
    }
  }

  _tickLive() {
    const dark = this._lastOddsTs ? Date.now() - this._lastOddsTs : 0;
    const susp = this.fogForced === true || dark > 8000;
    const front = frontFromProb(this.prob);
    this.onFrame({
      t: this._liveClock.s,
      clock: { ...this._liveClock },
      score: { ...this._liveScore },
      prob: { home: Math.round(this.prob.home * 10) / 10, draw: Math.round(this.prob.draw * 10) / 10, away: Math.round(this.prob.away * 10) / 10 },
      front,
      possession: this._livePoss.side ? this._livePoss : { side: 'home', zone: 'safe' },
      momentum: { home: this.mom.home, away: this.mom.away },
      threat: this._liveThreat,
      market: { suspended: susp, darkForMs: susp ? dark : 0 },
    });
  }
}

// factory: load the model then construct the driver (async).
export async function createReplayDriver({ onFrame, onEvent, baseUrl = 'http://localhost:3001', fixtureId, replayDurationSec, speed, startTs, client }) {
  const model = await loadReplayModel(baseUrl, fixtureId);
  return new RealMatchDriver({ onFrame, onEvent, model, mode: 'replay', baseUrl, fixtureId, replayDurationSec, speed, startTs, client });
}
