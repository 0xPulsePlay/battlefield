// driver.js — synthetic match driver for The Probability Battlefield.
// Pure data source: emits BattleFrames (~4Hz) + BattleEvents through the exact
// contract a real WebSocket feed would use. Renderer never reaches back in.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;

// demo-t → match seconds (piecewise linear anchors)
const CLOCK = [[0, 3120], [95, 3280], [140, 3900], [152, 3960], [180, 4380], [218, 4700], [233, 4790], [252, 5590], [269, 5640], [999, 5640]];

export class MatchDriver {
  constructor({ onFrame, onEvent } = {}) {
    this.onFrame = onFrame || (() => {});
    this.onEvent = onEvent || (() => {});
    this.speed = 1; this.paused = false;
    this.momOverride = { home: null, away: null };
    this.fogForced = null;
    this.reset();
    this._iv = setInterval(() => this._tick(), 250);
  }
  destroy() { clearInterval(this._iv); }

  reset() {
    this.t = 0; this._fired = new Set(); this._pending = [];
    this.prob = { home: 28.4, draw: 46.5, away: 25.1 };
    this.target = { home: 28.4, draw: 46.5, away: 25.1 };
    this.driftHome = 0;
    this.score = { home: 0, away: 0 };
    this.phase = 'H2'; this.running = true; this.finished = false;
    this.suspended = false; this.darkForMs = 0;
    this.possession = { side: 'home', zone: 'safe' };
    this._possT = 6; this._runSide = 'home'; this._runLen = 0;
    this.momEnv = { home: 0.35, away: 0.3 };
    this.mom = { home: 0.35, away: 0.3 };
    this._threat = { home: {}, away: {}, neutral: {} }; // kind -> expiry demo-t
    this.forcePoss = null;
  }

  clockSec() {
    const t = this.t;
    for (let i = 0; i < CLOCK.length - 1; i++) {
      const [t0, s0] = CLOCK[i], [t1, s1] = CLOCK[i + 1];
      if (t <= t1) return s0 + (s1 - s0) * ((t - t0) / (t1 - t0));
    }
    return CLOCK[CLOCK.length - 1][1];
  }

  setPaused(p) { this.paused = p; }
  setSpeed(x) { this.speed = x; }
  setMomentumOverride(side, v) { this.momOverride[side] = v; }
  setFogForced(on) {
    if (on === this.fogForced) return;
    this.fogForced = on;
    if (on) { this.darkForMs = 60000; this._suspStart = this.t; this._emit({ kind: 'suspension_start' }); }
    else if (!this._scriptSusp) { this._emit({ kind: 'reopen', front: this._frontBase(), prob: { ...this.prob } }); }
  }
  forceThreat(side, dur = 8, kind = 'goal') { this._threat[side][kind] = this.t + dur; }

  _frontBase() {
    const r = this.prob.home / (this.prob.home + this.prob.away);
    return clamp(0.08 + 0.84 * r, 0.065, 0.935);
  }

  // ---- single injection path: scripted, panel-triggered, and (later) live data ----
  inject(evt) {
    switch (evt.kind) {
      case 'goal': return this._goal(evt.side, evt._opts || {});
      case 'var': return this._var();
      case 'var_end': return this._varEnd(evt.outcome || 'Stands');
      case 'fulltime': return this._fulltime();
      case 'card':
        if (evt.color === 'red') {
          this._nudge(evt.side, -7); this._threat.neutral.redCard = this.t + 6;
        } else this._threat.neutral.yellowCard = this.t + 5;
        return this._emit(evt);
      case 'shot':
        this.momEnv[evt.side] = clamp(this.momEnv[evt.side] + 0.15, 0, 1);
        if (evt.outcome === 'OnTarget' || evt.outcome === 'Woodwork') this._nudge(evt.side, 0.6);
        return this._emit(evt);
      case 'corner':
        this.momEnv[evt.side] = clamp(this.momEnv[evt.side] + 0.1, 0, 1);
        this.forcePoss = { side: evt.side, until: this.t + 8, zones: ['box', 'danger'] };
        return this._emit(evt);
      default: return this._emit(evt);
    }
  }

  _nudge(side, d) {
    const o = side === 'home' ? 'away' : 'home';
    this.target[side] = clamp(this.target[side] + d, 0.3, 99);
    this.target[o] = clamp(this.target[o] - d * 0.6, 0.3, 99);
  }

  _goal(side, opts = {}) {
    if (this.finished) return;
    this.score[side]++;
    const from = opts.from ?? this.prob[side];
    let to = opts.to;
    if (!to) {
      const o = side === 'home' ? 'away' : 'home';
      const s = clamp(this.prob[side] + (100 - this.prob[side]) * 0.52, 0, 98);
      const ov = this.prob[o] * 0.33, dr = Math.max(1, 100 - s - ov);
      to = { [side]: Math.round(s * 10) / 10, [o]: Math.round(ov * 10) / 10, draw: Math.round(dr * 10) / 10 };
    }
    const minute = opts.minute ?? Math.floor(this.clockSec() / 60);
    const fog = opts.fog ?? 14000;
    this._emit({ kind: 'goal', side, minute, probJump: { from, to: to[side] } });
    this.momEnv[side] = 0.85;
    this._pending.push({ at: this.t + 1.2, fn: () => {
      this._scriptSusp = true; this.suspended = true; this.darkForMs = fog; this._suspStart = this.t;
      this._emit({ kind: 'suspension_start' });
    }});
    this._pending.push({ at: this.t + 1.2 + fog / 1000, fn: () => {
      this.prob = { ...to }; this.target = { ...to };
      this._scriptSusp = false; this.suspended = false;
      this._emit({ kind: 'reopen', front: this._frontBase(), prob: { ...to } });
    }});
  }

  _var() { this._threat.neutral.var = this.t + 999; this._emit({ kind: 'var' }); }
  _varEnd(outcome) {
    this._threat.neutral.var = 0;
    if (outcome === 'Overturned') this._nudge('home', -0.8);
    this._emit({ kind: 'var_end', outcome });
  }

  _fulltime() {
    if (this.finished) return;
    this.finished = true; this.phase = 'FT'; this.running = false;
    this._pending = this._pending.filter(p => p.keep); // no suspensions/reopens survive into FT
    this.suspended = false; this._scriptSusp = false; this.fogForced = null;
    const w = this.score.home > this.score.away ? 'home' : this.score.away > this.score.home ? 'away' : 'draw';
    if (w !== 'draw') { this.momEnv[w] = 1; this.prob = { home: w === 'home' ? 100 : 0, away: w === 'away' ? 100 : 0, draw: 0 }; }
    this._emit({ kind: 'fulltime', winner: w, score: { ...this.score } });
  }

  jumpToFinale() {
    if (this.finished) return;
    this._pending = [];
    let w = this.score.home > this.score.away ? 'home' : this.score.away > this.score.home ? 'away' : null;
    if (!w) { w = this.prob.home >= this.prob.away ? 'home' : 'away'; this.score[w]++; }
    const to = w === 'away' ? { home: 0.5, draw: 3, away: 96.5 } : { home: 96.5, draw: 3, away: 0.5 };
    this.prob = { ...to }; this.target = { ...to };
    this.suspended = false; this._scriptSusp = false; this.fogForced = null;
    this._emit({ kind: 'reopen', front: this._frontBase(), prob: { ...to } });
    this.t = Math.max(this.t, 267);
    for (const s of TIMELINE) if (s.at < 280) this._fired.add(s.at); // only the loop entry remains
    this._pending.push({ at: this.t + 1.5, fn: () => this._fulltime() });
    this._pending.push({ at: this.t + 16, keep: true, fn: () => this._loop() });
  }

  _loop() { const s = this.speed, p = this.paused; this.reset(); this.speed = s; this.paused = p; }

  _emit(evt) { this.onEvent({ ...evt, t: this.t }); }

  _tick() {
    if (!this.paused) {
      this.t += 0.25 * this.speed;
      for (const s of TIMELINE) if (this.t >= s.at && !this._fired.has(s.at)) { this._fired.add(s.at); s.fn(this); }
      this._pending = this._pending.filter(p => { if (this.t >= p.at) { p.fn(); return false; } return true; });
      this._advance(0.25 * this.speed);
    }
    this.onFrame(this._frame());
  }

  _advance(dt) {
    // probabilities: random walk around targets, frozen while market dark
    if (!this.suspended && !this.finished && this.fogForced !== true) {
      this.target.home = clamp(this.target.home + this.driftHome * dt, 0.3, 99);
      for (const k of ['home', 'draw', 'away'])
        this.prob[k] = clamp(this.prob[k] + (this.target[k] - this.prob[k]) * 0.015 + g() * 0.14, 0.3, 99);
      const s = this.prob.home + this.prob.draw + this.prob.away;
      for (const k of ['home', 'draw', 'away']) this.prob[k] = this.prob[k] * 100 / s;
    }
    // possession
    if (this.forcePoss && this.t > this.forcePoss.until) this.forcePoss = null;
    this._possT -= dt;
    if (this._possT <= 0) {
      this._possT = rnd(5, 10);
      if (this.forcePoss) {
        const z = this.forcePoss.zones;
        this.possession = { side: this.forcePoss.side, zone: z[Math.floor(Math.random() * z.length)] };
      } else {
        this._runLen++;
        if (this._runLen > 1 + Math.random() * 2) { this._runSide = this._runSide === 'home' ? 'away' : 'home'; this._runLen = 0; }
        const r = Math.random();
        const zone = r < 0.4 ? 'safe' : r < 0.7 ? 'attack' : r < 0.88 ? 'danger' : 'box';
        this.possession = { side: this._runSide, zone };
      }
      const z = this.possession.zone, sd = this.possession.side;
      if (z === 'danger' || z === 'box') this.momEnv[sd] = clamp(this.momEnv[sd] + 0.12, 0, 1);
    }
    // momentum: ease to envelope + slow decay of envelope
    for (const k of ['home', 'away']) {
      this.momEnv[k] += (0.32 - this.momEnv[k]) * 0.004;
      this.mom[k] = clamp(this.mom[k] + (this.momEnv[k] - this.mom[k]) * 0.04 + g() * 0.015, 0, 1);
      if (this.momOverride[k] != null) this.mom[k] = this.momOverride[k];
    }
  }

  _threatObj(sd) {
    const o = {};
    for (const k in this._threat[sd]) if (this._threat[sd][k] > this.t) o[k] = true;
    return o;
  }

  _frame() {
    const susp = this.fogForced === true || this.suspended;
    const zone = this.possession.zone, sd = this.possession.side;
    const push = ({ safe: 0, attack: 0.015, danger: 0.045, box: 0.07 })[zone] * (sd === 'home' ? 1 : -1);
    const front = this.finished ? this._lastFront ?? this._frontBase()
      : susp ? (this._lastFront ?? this._frontBase())
      : (this._lastFront = clamp(this._frontBase() + push, 0.05, 0.95));
    return {
      t: this.t,
      clock: { s: Math.floor(this.clockSec()), running: this.running && !this.paused, phase: this.phase },
      score: { ...this.score },
      prob: { home: Math.round(this.prob.home * 10) / 10, draw: Math.round(this.prob.draw * 10) / 10, away: Math.round(this.prob.away * 10) / 10 },
      front,
      possession: this.finished ? { side: null, zone: 'safe' } : { ...this.possession },
      momentum: { home: Math.round(this.mom.home * 100) / 100, away: Math.round(this.mom.away * 100) / 100 },
      threat: { home: this._threatObj('home'), away: this._threatObj('away'), neutral: this._threatObj('neutral') },
      market: { suspended: susp, darkForMs: susp ? this.darkForMs : 0 },
    };
  }
}

// ---- the ~4.5 min scripted arc: England lead, Argentina come back 2–1 ----
const TIMELINE = [
  { at: 0.5, fn: d => d._emit({ kind: 'kickoff' }) },
  { at: 30, fn: d => d.inject({ kind: 'shot', side: 'away', outcome: 'OffTarget' }) },
  { at: 52, fn: d => d.inject({ kind: 'shot', side: 'home', outcome: 'Blocked' }) },
  { at: 75, fn: d => { d.forceThreat('home', 20); d.forcePoss = { side: 'home', until: 95, zones: ['danger', 'box', 'box'] }; d.momEnv.home = 0.85; } },
  { at: 95, fn: d => d._goal('home', { from: 28.4, to: { home: 69.7, draw: 22.4, away: 7.9 }, fog: 20000, minute: 54 }) },
  { at: 122, fn: d => { d.momEnv = { home: 0.5, away: 0.42 }; d.driftHome = -0.5 / 60; } },
  { at: 132, fn: d => d.inject({ kind: 'shot', side: 'away', outcome: 'OnTarget' }) },
  { at: 140, fn: d => d._var() },
  { at: 152, fn: d => d._varEnd('Overturned') },
  { at: 165, fn: d => d.inject({ kind: 'substitution', side: 'away' }) },
  { at: 180, fn: d => d.inject({ kind: 'card', side: 'away', color: 'yellow' }) },
  { at: 188, fn: d => d.inject({ kind: 'corner', side: 'home' }) },
  { at: 196, fn: d => d.inject({ kind: 'additional_time', minutes: 4 }) },
  { at: 205, fn: d => { d.forceThreat('away', 13); d.forcePoss = { side: 'away', until: 218, zones: ['danger', 'box'] }; d.momEnv.away = 0.88; d.driftHome = 0; } },
  { at: 218, fn: d => d._goal('away', { to: { home: 31, draw: 31, away: 38 }, fog: 15000, minute: 78 }) },
  { at: 236, fn: d => { d.momEnv.away = 0.85; d.forcePoss = { side: 'away', until: 252, zones: ['danger', 'danger', 'box'] }; d.forceThreat('away', 14); } },
  { at: 244, fn: d => d.inject({ kind: 'shot', side: 'away', outcome: 'Woodwork' }) },
  { at: 252, fn: d => d._goal('away', { to: { home: 0.5, draw: 3.0, away: 96.5 }, fog: 15000, minute: 93 }) },
  { at: 269.5, fn: d => d._fulltime() },
  { at: 284, fn: d => d._loop() },
];
