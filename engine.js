// engine.js — isometric canvas battlefield renderer. Pure renderer over BattleFrames/BattleEvents.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const HEXC = {};
function rgbv(c) {
  let v = HEXC[c];
  if (!v) {
    if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    else { const m = c.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/); v = m ? [+m[1], +m[2], +m[3]] : [128, 128, 128]; }
    HEXC[c] = v;
  }
  return v;
}
function shade(c, f) { const [r, g, b] = rgbv(c); return `rgb(${r * f | 0},${g * f | 0},${b * f | 0})`; }
function mix(a, b, t) { const A = rgbv(a), B = rgbv(b); return `rgb(${A[0] + (B[0] - A[0]) * t | 0},${A[1] + (B[1] - A[1]) * t | 0},${A[2] + (B[2] - A[2]) * t | 0})`; }
function rgba(c, a) { const [r, g, b] = rgbv(c); return `rgba(${r},${g},${b},${a})`; }

const COL = {
  stage: '#060a07',
  homeEarth: '#4a7036', awayEarth: '#8a7b49',
  edge: '#2a3320', skirt: '#2a2114', skirtSide: '#1a1409', strata: '#463824',
  scorch: '#1c1409', sand: '#a68f5c', wire: '#7d7d72', trench: '#2c2413',
  water: '#2e6fb2', waterDeep: '#1d4f86', shore: '#b5a26b', road: '#8d8168', roadEdge: '#6f6450',
  tree: '#2f5c33', tree2: '#3f7a42', trunk: '#4a3b28', smoke: '#9a9e96', flash: '#ffd98c', gold: '#d3ab48',
  home: { main: '#f0f2f5', deep: '#2c4066', accent: '#c03a4e', tint: '#7086ab', tracer: '#f0e0c0' },
  away: { main: '#8fc4ec', deep: '#4f83ad', accent: '#d9b02a', tint: '#6fa3c4', tracer: '#ffe9a8' },
};
const CAMP_V = { home: 0.055, away: 0.945 };
const DIR = { home: 1, away: -1 }; // +v = toward away
const LAKES = [{ u: -0.55, v: 0.3, r: 0.1 }, { u: 0.5, v: 0.72, r: 0.12 }];
const ROAD_U = (v) => 0.16 + Math.sin(v * 2.7 + 0.5) * 0.38 + Math.sin(v * 6.1) * 0.08;

export class BattleEngine {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.opts = opts;
    this.names = opts.names || { home: 'ENGLAND', away: 'ARGENTINA' };
    this.reduced = opts.reducedMotion ?? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.portrait = true;
    this.cam = { zoom: 1, x: 0, y: 0, rot: 0 };
    this._cr = 1; this._sr = 0; this._shx = 0; this._shy = 0;
    this.shake = 0; this.flashOv = 0;
    this.now = 0; this.budget = 1; this.fpsE = 60;
    this.F = { front: 0.5, prob: { home: 28.4, draw: 46.5, away: 25.1 }, momentum: { home: 0.3, away: 0.3 }, possession: { side: 'home', zone: 'safe' }, threat: { home: {}, away: {}, neutral: {} }, market: { suspended: false, darkForMs: 0 }, score: { home: 0, away: 0 } };
    this.frontE = 0.5; this.snapTo = null;
    this.fogT = 0; this.fogTarget = 0; this.fogRip = false;
    this.tintOv = 0; this.victory = null; this.armistice = false;
    this.varFreeze = false; this.spot = null; this.cardFx = null;
    this.queue = []; this.cine = null; this.cineFx = [];
    this.shells = []; this.parts = []; this.rings = []; this.planes = []; this.flanks = []; this.trucks = []; this.walkers = [];
    this.craters = []; this.scars = []; this.decals = [];
    this.squads = { home: [], away: [] }; this._adjCool = { home: 0, away: 0 };
    this.radarA = 0; this._planeT = rnd(8, 20); this._truckT = { home: rnd(4, 9), away: rnd(4, 9) };
    this._buildWorld();
    this._trench(0.5, true);
    this._bindInput();
    this._raf = requestAnimationFrame(this._loop = (ts) => {
      const dt = Math.min(0.05, (ts - (this._lt || ts)) / 1000); this._lt = ts;
      this.update(dt); this.draw();
      this._raf = requestAnimationFrame(this._loop);
    });
  }
  destroy() { cancelAnimationFrame(this._raf); this._unbind && this._unbind(); }

  resize(w, h) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = w; this.H = h;
    this.cv.width = w * dpr; this.cv.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._layout();
  }
  setMode(portrait) { this.portrait = portrait; if (this.W) this._layout(); }
  _layout() {
    const { W, H } = this;
    if (this.portrait) { this.su = W * 0.44; this.sv = H * 0.50; this.sh = W * 0.09; this.sz = H * 0.0085; this.cx = W / 2; this.cy = H * 0.545; }
    else { this.sv = W * 0.58; this.su = H * 0.30; this.sh = W * 0.028; this.sz = H * 0.012; this.cx = W / 2; this.cy = H * 0.52; }
    this.k = Math.min(W, H) / 430;
    this._vig = null;
  }
  recenter() { this.cam = { zoom: 1, x: 0, y: 0, rot: 0 }; }

  // world rotation (around board centre) — cached sin/cos set each frame
  _rot(u, v) { const w = (v - 0.5) * 2; return { u: u * this._cr - w * this._sr, w: u * this._sr + w * this._cr }; }
  // gentle rolling relief; flattens at the camps, the board rim, and the lakes
  _hgt(u, v) {
    const a = Math.sin(u * 3.9 + 1.7) * Math.cos(v * 7.1 - 0.5)
      + Math.sin(u * 8.3 + v * 4.4 - 2.1) * 0.5
      + Math.cos(u * 1.9 + v * 12.7) * 0.35;
    const camp = clamp((Math.min(v - 0.015, 0.985 - v)) / 0.12, 0, 1);
    const rim = clamp((1.04 - Math.abs(u)) / 0.22, 0, 1);
    let m = 0.7 * (0.2 + 0.8 * camp) * (0.35 + 0.65 * rim);
    for (const L of LAKES) { const d = Math.hypot((u - L.u) * 0.75, v - L.v); m *= clamp((d - L.r * 0.7) / (L.r * 0.9), 0.08, 1); }
    return a * m;
  }
  _p(u, v, z = 0) {
    const c = this.cam, R = this._rot(u, v), ru = R.u, rv = R.w / 2 + 0.5;
    const zz = z + this._hgt(u, v);
    if (this.portrait) return { x: this.cx + (ru * this.su + (rv - 0.5) * this.sh) * c.zoom + c.x + this._shx, y: this.cy + ((0.5 - rv) * this.sv - zz * this.sz) * c.zoom + c.y + this._shy };
    return { x: this.cx + ((rv - 0.5) * this.sv + ru * this.sh) * c.zoom + c.x + this._shx, y: this.cy + (ru * this.su - zz * this.sz) * c.zoom + c.y + this._shy };
  }
  _depth(u, v) { const R = this._rot(u, v), rv = R.w / 2 + 0.5; return this.portrait ? (1 - rv) + R.u * 0.02 : (R.u + 1) * 0.5 + rv * 0.02; }
  _ribbon(u0, u1, v0, v1, fill, steps = 16) {
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push(this._p(u0 + (u1 - u0) * i / steps, v0, 0));
    for (let i = steps; i >= 0; i--) pts.push(this._p(u0 + (u1 - u0) * i / steps, v1, 0));
    this._poly(pts, fill);
  }

  // ---------- world ----------
  _buildWorld() {
    this.patches = [];
    for (let i = 0; i < 64; i++) {
      const v = Math.random(); if (Math.abs(v - 0.5) < 0.06) continue;
      this.patches.push({ u: rnd(-0.95, 0.95), v, r: rnd(0.02, 0.06), f: rnd(0.85, 1.12) });
    }
    this.trees = [];
    for (let i = 0; i < 26; i++) this.trees.push({ u: (Math.random() < 0.5 ? -1 : 1) * rnd(0.78, 0.97), v: rnd(0.06, 0.94), s: rnd(0.7, 1.25) });
    for (let i = 0; i < 10; i++) this.trees.push({ u: rnd(-0.9, 0.9), v: Math.random() < 0.5 ? rnd(0.005, 0.02) : rnd(0.98, 0.995), s: rnd(0.6, 1) });
    for (const L of LAKES) for (let i = 0; i < 5; i++) { const a2 = rnd(0, Math.PI * 2); this.trees.push({ u: L.u + Math.cos(a2) * L.r * rnd(1.6, 2.1), v: L.v + Math.sin(a2) * L.r * rnd(0.9, 1.2), s: rnd(0.6, 1) }); }
    this.trees = this.trees.filter(tr => Math.abs(tr.u - ROAD_U(tr.v)) > 0.09 && LAKES.every(L => Math.hypot((tr.u - L.u) * 0.75, tr.v - L.v) > L.r * 1.3));
    this.camps = {};
    for (const side of ['home', 'away']) {
      const v0 = CAMP_V[side], d = DIR[side];
      this.camps[side] = {
        hq: { u: 0, v: v0, du: 0.085, dv: 0.03, h: 2.4 },
        tents: [{ u: -0.32, v: v0 + d * 0.012, du: 0.045, dv: 0.02, h: 1 }, { u: -0.48, v: v0 - d * 0.015, du: 0.04, dv: 0.018, h: 0.9 }, { u: 0.3, v: v0 - d * 0.01, du: 0.042, dv: 0.02, h: 0.95 }],
        depot: { u: 0.52, v: v0 + d * 0.01 },
        hospital: { u: 0.68, v: v0 - d * 0.005, du: 0.04, dv: 0.02, h: 1.1 },
        radar: { u: -0.66, v: v0 },
        aa: [{ u: -0.82, v: v0 + d * 0.045 }, { u: 0.82, v: v0 + d * 0.045 }],
        flag: { u: 0.13, v: v0 - d * 0.012 },
        fires: [{ u: -0.18, v: v0 + d * 0.035 }, { u: 0.42, v: v0 + d * 0.038 }],
        parked: [{ u: -0.6, v: v0 + d * 0.03 }, { u: 0.6, v: v0 + d * 0.055 }],
      };
    }
    this.arty = [];
    for (const side of ['home', 'away']) for (const u of [-0.55, 0, 0.55])
      this.arty.push({ side, u: u + rnd(-0.05, 0.05), v: CAMP_V[side] + DIR[side] * rnd(0.09, 0.12), cool: rnd(0, 8) });
    this.tanks = [];
    for (const side of ['home', 'away']) for (let i = 0; i < 4; i++) {
      const t = { side, u: rnd(-0.7, 0.7), v: CAMP_V[side] + DIR[side] * rnd(0.08, 0.2), cool: rnd(2, 6) };
      t.wu = t.u; t.wv = t.v; this.tanks.push(t);
    }
    this.raiders = {};
    for (const side of ['home', 'away']) {
      const us = []; for (let i = 0; i < 6; i++) us.push({ u: rnd(-0.3, 0.3), v: CAMP_V[side] + DIR[side] * 0.15, tu: 0, tv: 0, ph: rnd(0, 9), wT: 0, sp: rnd(0.06, 0.085) });
      this.raiders[side] = { units: us };
    }
    this.mortars = { home: [{ u: -0.3, cool: rnd(3, 8) }, { u: 0.3, cool: rnd(3, 8) }], away: [{ u: -0.25, cool: rnd(3, 8) }, { u: 0.35, cool: rnd(3, 8) }] };
    this.patrols = [];
    for (const side of ['home', 'away']) this.patrols.push({ side, u: rnd(-0.5, 0.5), dir: 1, v: CAMP_V[side] + DIR[side] * 0.055, ph: rnd(0, 9) });
  }

  _trench(v, first) {
    if (!first && this.trench) { this.scars.push({ v: this.trench.v, a: 0.5 }); if (this.scars.length > 6) this.scars.shift(); }
    const bags = []; for (let u = -0.88; u < 0.88; u += 0.055) bags.push({ u: u + rnd(-0.012, 0.012), s: rnd(0.8, 1.2), o: Math.random() < 0.5 ? 1 : -1 });
    this.trench = { v, bags, dugT: this.now };
  }

  resetBoard() {
    this.craters = []; this.scars = []; this.decals = []; this.shells = []; this.parts = [];
    this.planes = []; this.flanks = []; this.trucks = []; this.walkers = []; this.rings = [];
    this.victory = null; this.armistice = false; this.tintOv = 0; this.fogT = 0; this.fogTarget = 0;
    this.queue = []; this.cine = null; this.cineFx = []; this.varFreeze = false; this.spot = null; this.cardFx = null;
    this.squads = { home: [], away: [] };
    this.frontE = 0.5; this._trench(0.5, true);
    for (const t of this.tanks) { t.v = CAMP_V[t.side] + DIR[t.side] * rnd(0.08, 0.2); t.wv = t.v; t.u = rnd(-0.7, 0.7); t.wu = t.u; }
  }

  // ---------- data in ----------
  setFrame(f) {
    this.F = f;
    if (f.market.suspended) this.fogTarget = f.market.darkForMs && f.market.darkForMs < 15000 ? 0.5 : 0.92;
    else this.fogTarget = 0;
  }
  event(e) {
    switch (e.kind) {
      case 'reopen':
        this.snapTo = e.front; this.fogRip = true;
        this.rings.push({ u: 0, v: e.front, t: 0, dur: 0.9, r0: 0.05, r1: 1.1, col: COL.gold });
        if (!this.reduced) this.shake = Math.max(this.shake, 7); else this.flashOv = 0.25;
        this.opts.onSfx?.('rip', 0.6);
        return;
      case 'suspension_start': return; // fog handled via frames
      case 'var_end': {
        this.varFreeze = false; this.spot = null;
        if (this.cine && this.cine.kind === 'var') this.cine = null;
        if (e.outcome === 'Overturned') {
          for (let i = 0; i < 26; i++) this.parts.push(this._pt(rnd(-0.2, 0.2), 0.5 + rnd(-0.08, 0.08), rnd(0, 2), 'spark', COL.gold, 1.2));
          this.opts.onBanner?.({ title: 'VAR — OVERTURNED', sub: 'NO PENALTY', tone: 'neutral', hold: 2600 });
        } else this.opts.onBanner?.({ title: 'VAR — STANDS', sub: 'PLAY ON', tone: 'neutral', hold: 2200 });
        return;
      }
      case 'additional_time':
        this.opts.onBanner?.({ title: `+${e.minutes} MIN`, sub: 'BATTLE EXTENDED', tone: 'neutral', hold: 2600 });
        return;
      case 'kickoff': this.resetBoard(); return;
      case 'fulltime': this._startFulltime(e); return;
      default: this.queue.push(e);
    }
  }

  _startFulltime(e) {
    this.queue = []; this.cine = null; this.varFreeze = false; this.spot = null; this.fogTarget = 0;
    if (e.winner === 'draw') {
      this.armistice = true;
      this.opts.onBanner?.({ title: 'ARMISTICE', sub: `HONOURS SHARED — ${e.score.home}–${e.score.away}`, tone: 'neutral', hold: 6000 });
      return;
    }
    const w = e.winner, l = w === 'home' ? 'away' : 'home';
    this.victory = { side: w, loser: l, t: 0, flag: 0, bannered: false, saluteT: 0, score: e.score };
    for (const s of this.squads[w]) s.state = 'surge';
    for (const s of this.squads[l]) { s.state = 'rout'; s.alpha = 1; }
    for (const t of this.tanks) if (t.side === w) { t.wu = rnd(-0.6, 0.6); t.wv = CAMP_V[l] + DIR[l] * rnd(0.02, 0.1); }
    if (!this.reduced) this.shake = 8;
    this.opts.onSfx?.('boom', 0.8);
  }

  // ---------- particles / fx primitives ----------
  _pt(u, v, z, kind, col, life, o = {}) {
    return { u, v, z, kind, col, life, max: life, vu: o.vu || rnd(-0.02, 0.02), vv: o.vv || rnd(-0.02, 0.02), vz: o.vz ?? rnd(1, 3), size: o.size || rnd(1.5, 3) };
  }
  _explosion(u, v, s = 1, scorch = false) {
    const n = Math.round(14 * s * this.budget);
    for (let i = 0; i < n; i++) this.parts.push(this._pt(u, v, 0.2, 'dirt', i % 3 ? '#4a3f28' : '#2a2318', rnd(0.5, 1.1), { vu: rnd(-0.06, 0.06) * s, vv: rnd(-0.06, 0.06) * s, vz: rnd(2, 7) * s, size: rnd(1.5, 3.5) * s }));
    for (let i = 0; i < Math.round(5 * s * this.budget); i++) this.parts.push(this._pt(u, v, 0.5, 'smoke', COL.smoke, rnd(1.2, 2.4), { vu: rnd(-0.01, 0.01), vv: rnd(-0.01, 0.01), vz: rnd(0.8, 1.6), size: rnd(3, 6) * s }));
    this.parts.push(this._pt(u, v, 0.4, 'flash', COL.flash, 0.22, { vz: 0, size: 9 * s }));
    if (this.craters.length < 70) this.craters.push({ u, v, r: rnd(0.012, 0.02) * s, a: 0.55 });
    if (scorch) this.decals.push({ u, v, r: 0.07 * s, a: 0.75 });
  }
  _fireShell(o) { this.shells.push({ t: 0, dur: o.dur || rnd(1.5, 2.2), h: o.h || rnd(5, 8), dud: o.dud || false, ...o }); this.opts.onSfx?.('fire', 0.25); }

  // ---------- update ----------
  update(dt) {
    this.now += dt;
    const fps = 1 / Math.max(dt, 1e-3); this.fpsE = this.fpsE * 0.95 + fps * 0.05;
    if (this.fpsE < 48) this.budget = Math.max(0.35, this.budget - 0.01); else if (this.fpsE > 56) this.budget = Math.min(1, this.budget + 0.005);
    this.shake *= Math.exp(-dt * 3.2); this.flashOv *= Math.exp(-dt * 4);
    // front easing / snap
    if (this.snapTo != null) { this.frontE = this.snapTo; this.snapTo = null; }
    else if (!this.F.market.suspended) this.frontE += (this.F.front - this.frontE) * (1 - Math.exp(-dt / 0.28));
    // fog
    const fr = this.fogRip ? 0.12 : (this.fogTarget > this.fogT ? 0.8 : 0.5);
    this.fogT += (this.fogTarget - this.fogT) * (1 - Math.exp(-dt / fr));
    if (this.fogT < 0.02 && this.fogTarget === 0) this.fogRip = false;
    for (const b of (this.fogBlobs || (this.fogBlobs = Array.from({ length: 9 }, () => ({ u: rnd(-1.3, 1.3), v: Math.random(), r: rnd(0.3, 0.6), vu: rnd(0.015, 0.045) * (Math.random() < 0.5 ? -1 : 1) }))))) {
      b.u += b.vu * dt; if (b.u > 1.5) b.u = -1.5; if (b.u < -1.5) b.u = 1.5;
    }
    // trench re-dig
    if (!this.victory && Math.abs(this.frontE - this.trench.v) > 0.03 && this.now - this.trench.dugT > 4) this._trench(this.frontE);
    // scars fade slightly
    for (const s of this.scars) s.a = Math.max(0.16, s.a - dt * 0.01);
    this.radarA += dt * 1.4;
    // cinematics queue
    this._cineUpdate(dt);
    const frozen = this.varFreeze;
    if (!frozen) {
      if (this.victory) this._victoryUpdate(dt);
      else if (!this.armistice) this._armies(dt);
      else this._armisticeUpdate(dt);
      this._ambient(dt);
    }
    // shells always fly
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i]; s.t += dt / s.dur;
      if (s.t >= 1) { this.shells.splice(i, 1); this._impact(s); }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.u += p.vu * dt; p.v += p.vv * dt; p.z += p.vz * dt;
      if (p.kind === 'dirt' || p.kind === 'spark') { p.vz -= 14 * dt; if (p.z < 0) { p.z = 0; p.vz = 0; p.vu *= 0.6; p.vv *= 0.6; } }
      if (p.kind === 'smoke') { p.size += dt * 2.5; p.vz *= 0.99; }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt / r.dur; if (r.t >= 1) this.rings.splice(i, 1); }
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i]; const du = w.tu - w.u, dv = w.tv - w.v, d = Math.hypot(du, dv);
      if (d < 0.01) { this.walkers.splice(i, 1); continue; }
      w.u += du / d * 0.05 * dt; w.v += dv / d * 0.05 * dt; w.ph += dt * 9;
    }
    if (this.cardFx) { this.cardFx.t += dt; if (this.cardFx.t > 1.6) this.cardFx = null; }
    if (this.victory) { this.tintOv = clamp(this.tintOv + (this.victory.t > 2.4 ? dt / 1.8 : 0), 0, 1); }
  }

  _impact(s) {
    if (s.onland) { s.onland(s); return; }
    if (s.dud) { for (let i = 0; i < 4; i++) this.parts.push(this._pt(s.u1, s.v1, 0.1, 'dirt', '#3a3223', 0.5, { vz: rnd(0.5, 1.5), size: 1.5 })); return; }
    this._explosion(s.u1, s.v1, s.big ? 2.4 : s.small ? 0.55 : 1, s.big);
    this.opts.onSfx?.('impact', s.big ? 1 : 0.35);
    if (s.big && !this.reduced) this.shake = Math.max(this.shake, 12);
    if (s.big && this.reduced) this.flashOv = 0.3;
  }

  // ---------- armies ----------
  _desired(side) { return clamp(Math.round((this.F.prob[side] * 1.5) / 4), 2, 36); }
  _slot(side, si, ui) {
    const d = DIR[side], row = Math.floor(si / 3), col = si % 3;
    const jit = Math.sin(si * 37.7) * 0.06;
    let v = this.frontE - d * (0.075 + row * 0.034);
    v = side === 'home' ? clamp(v, 0.09, 0.9) : clamp(v, 0.1, 0.91);
    const u = (col - 1) * 0.52 + jit + (ui % 2) * 0.075 - 0.037 + Math.floor(ui / 2) * 0.02;
    return { u: clamp(u, -0.9, 0.9), v: v - d * Math.floor(ui / 2) * 0.02 };
  }
  _spawnSquad(side) {
    const us = []; const n = 4;
    const u0 = rnd(-0.4, 0.4);
    for (let i = 0; i < n; i++) us.push({ u: u0 + rnd(-0.05, 0.05), v: CAMP_V[side] + DIR[side] * 0.02, ph: rnd(0, 9), sp: rnd(0.05, 0.065) });
    this.squads[side].push({ side, units: us, state: 'in', alpha: 1 });
  }
  _armies(dt) {
    for (const side of ['home', 'away']) {
      this._adjCool[side] -= dt;
      const live = this.squads[side].filter(s => s.state !== 'out');
      if (this._adjCool[side] <= 0) {
        const want = this._desired(side);
        if (live.length < want) { this._spawnSquad(side); this._adjCool[side] = 1.1; }
        else if (live.length > want) { const s = live[live.length - 1]; s.state = 'out'; this._adjCool[side] = 1.1; }
      }
      let si = 0;
      for (let qi = this.squads[side].length - 1; qi >= 0; qi--) {
        const sq = this.squads[side][qi];
        const idx = sq.state === 'out' ? -1 : si++;
        let done = true;
        sq.units.forEach((un, ui) => {
          const tgt = sq.state === 'out' ? { u: un.u * 0.3, v: CAMP_V[side] + DIR[side] * 0.015 } : this._slot(side, idx, ui);
          const du = tgt.u - un.u, dv = tgt.v - un.v, d = Math.hypot(du, dv);
          if (d > 0.006) { done = false; un.u += du / d * un.sp * dt; un.v += dv / d * un.sp * dt; un.ph += dt * 9; un.moving = true; }
          else un.moving = false;
        });
        if (sq.state === 'in' && done) sq.state = 'hold';
        if (sq.state === 'out' && done) this.squads[side].splice(qi, 1);
      }
    }
    // raiders
    for (const side of ['home', 'away']) {
      const R = this.raiders[side], d = DIR[side];
      const active = this.F.possession.side === side && !this.F.market.suspended;
      const zone = active ? this.F.possession.zone : 'safe';
      const base = { safe: this.frontE - d * rnd(0.16, 0.24), attack: this.frontE - d * 0.035, danger: this.frontE + d * 0.11, box: this.frontE + d * 0.02 }[zone];
      for (const un of R.units) {
        un.wT -= dt;
        if (un.wT <= 0) { un.wT = rnd(1.5, 3.5); un.tu = clamp(rnd(-0.45, 0.45), -0.85, 0.85); un.tv = clamp(base + rnd(-0.03, 0.03), 0.06, 0.94); }
        const du = un.tu - un.u, dv = un.tv - un.v, dd = Math.hypot(du, dv);
        if (dd > 0.008) { un.u += du / dd * un.sp * dt; un.v += dv / dd * un.sp * dt; un.ph += dt * 10; un.moving = true; } else un.moving = false;
        if (active && zone === 'box' && Math.random() < dt * 5 * this.budget) {
          this.parts.push(this._pt(un.u, un.v, 0.9, 'flash', COL.flash, 0.1, { vz: 0, size: 2.5 }));
          this.parts.push(this._pt(un.u, un.v, 0.8, 'tracer', COL[side].tracer, 0.28, { vu: rnd(-0.1, 0.1), vv: d * rnd(0.5, 0.8), vz: 0, size: 1 }));
          if (Math.random() < 0.4) this.parts.push(this._pt(un.u + rnd(-0.1, 0.1), un.v + d * 0.06, 0.9, 'flash', COL.flash, 0.09, { vz: 0, size: 2 }));
        }
      }
    }
    // patrols
    for (const p of this.patrols) {
      p.u += p.dir * 0.03 * dt; p.ph += dt * 7;
      if (p.u > 0.6) p.dir = -1; if (p.u < -0.6) p.dir = 1;
    }
  }

  _victoryUpdate(dt) {
    const V = this.victory; V.t += dt;
    const w = V.side, l = V.loser, dw = DIR[w];
    let si = 0;
    for (const sq of this.squads[w]) {
      const base = CAMP_V[l] - dw * (0.03 + (si % 6) * 0.035); si++;
      sq.units.forEach((un, ui) => {
        const tu = ((si % 5) - 2) * 0.34 + (ui % 2) * 0.08 + Math.sin(si * 9 + ui) * 0.05;
        const tv = base - dw * Math.floor(ui / 2) * 0.02;
        const du = tu - un.u, dv = tv - un.v, d = Math.hypot(du, dv);
        if (d > 0.008) { un.u += du / d * 0.14 * dt; un.v += dv / d * 0.14 * dt; un.ph += dt * 12; un.moving = true; } else un.moving = false;
      });
    }
    for (let qi = this.squads[l].length - 1; qi >= 0; qi--) {
      const sq = this.squads[l][qi]; sq.alpha = Math.max(0, sq.alpha - dt * 0.25);
      sq.units.forEach(un => { un.v += DIR[l] * -1 * -0.06 * dt * DIR[l]; un.v += DIR[l] * 0.0; un.v = un.v + (CAMP_V[l] - un.v) * dt * 1.2; un.ph += dt * 11; un.moving = true; });
      if (sq.alpha <= 0) this.squads[l].splice(qi, 1);
    }
    for (const t of this.tanks) if (t.side === w) this._moveTank(t, dt, 0.05);
    if (V.t > 2.4) {
      V.flag = clamp(V.flag + dt / 1.2, 0, 1);
      if (!V.bannered) {
        V.bannered = true;
        const sc = w === 'home' ? `${V.score.home}–${V.score.away}` : `${V.score.away}–${V.score.home}`;
        this.opts.onBanner?.({ title: `${this.names[w]} TAKE THE FIELD`, sub: `FULL TIME — ${sc}`, tone: w, hold: 9000 });
      }
      V.saluteT -= dt;
      if (V.saluteT <= 0 && this.squads[w].length) {
        V.saluteT = 0.09 / this.budget;
        const sq = this.squads[w][Math.floor(Math.random() * this.squads[w].length)];
        const un = sq.units[Math.floor(Math.random() * sq.units.length)];
        this.parts.push(this._pt(un.u, un.v, 1, 'tracer', COL[w].tracer, rnd(0.5, 0.9), { vu: rnd(-0.03, 0.03), vv: rnd(-0.03, 0.03), vz: rnd(9, 14), size: 1.2 }));
      }
      if (Math.random() < dt * 1.2) this.parts.push(this._pt(rnd(-0.6, 0.6), CAMP_V[l] + DIR[l] * rnd(0, 0.15), rnd(6, 10), 'flash', COL[w].accent, 0.4, { vz: 0, size: rnd(3, 6) }));
    }
  }
  _armisticeUpdate(dt) {
    for (const side of ['home', 'away']) {
      let si = 0;
      for (const sq of this.squads[side]) {
        sq.units.forEach((un, ui) => {
          const s = this._slot(side, si, ui); const tv = s.v - DIR[side] * 0.08;
          const du = s.u - un.u, dv = tv - un.v, d = Math.hypot(du, dv);
          if (d > 0.008) { un.u += du / d * 0.04 * dt; un.v += dv / d * 0.04 * dt; un.ph += dt * 8; un.moving = true; } else un.moving = false;
        });
        si++;
      }
    }
  }

  _moveTank(t, dt, sp = 0.02) {
    const du = t.wu - t.u, dv = t.wv - t.v, d = Math.hypot(du, dv);
    if (d < 0.02) return true;
    t.u += du / d * sp * dt; t.v += dv / d * sp * dt; return false;
  }

  // ---------- ambient warfare ----------
  _ambient(dt) {
    const F = this.F;
    // artillery
    for (const a of this.arty) {
      if (this.victory && a.side !== this.victory.side) continue;
      const mom = this.victory ? 0.9 : F.momentum[a.side];
      const rate = (4 + 26 * mom) * this.budget / 60;
      a.cool -= dt;
      if (a.cool <= 0 && Math.random() < rate * 1.6) {
        a.cool = 0.7;
        const d = DIR[a.side];
        this._fireShell({ u0: a.u, v0: a.v, u1: rnd(-0.8, 0.8), v1: clamp(this.frontE + d * rnd(0.03, 0.17), 0.06, 0.94), dud: Math.random() < 0.07 });
        this.parts.push(this._pt(a.u, a.v, 0.8, 'flash', COL.flash, 0.12, { vz: 0, size: 3.5 }));
      }
    }
    // tanks
    for (const t of this.tanks) {
      if (this.victory) { if (t.side === this.victory.side) this._moveTank(t, dt, 0.05); continue; }
      if (this._moveTank(t, dt)) {
        const d = DIR[t.side];
        t.wu = rnd(-0.72, 0.72);
        const lo = t.side === 'home' ? 0.09 : Math.min(this.frontE + 0.08, 0.9);
        const hi = t.side === 'home' ? Math.max(this.frontE - 0.08, 0.14) : 0.91;
        t.wv = clamp(rnd(lo, hi) * 0.35 + (this.frontE - d * 0.14) * 0.65 + rnd(-0.06, 0.06), Math.min(lo, hi), Math.max(lo, hi));
      }
      t.cool -= dt;
      if (t.cool <= 0 && F.possession.side === t.side && F.possession.zone === 'box') {
        t.cool = rnd(3, 5);
        this._fireShell({ u0: t.u, v0: t.v, u1: rnd(-0.5, 0.5), v1: clamp(this.frontE + DIR[t.side] * rnd(0.04, 0.1), 0.06, 0.94), h: 3.5, dur: 1.2 });
      }
    }
    // mortars (at trench)
    for (const side of ['home', 'away']) for (const m of this.mortars[side]) {
      m.cool -= dt;
      if (m.cool <= 0) {
        m.cool = rnd(5, 10);
        const d = DIR[side], v0 = this.frontE - d * 0.025;
        this._fireShell({ u0: m.u, v0, u1: m.u + rnd(-0.15, 0.15), v1: clamp(this.frontE + d * rnd(0.03, 0.07), 0.06, 0.94), h: 2.2, dur: 1, small: true });
      }
    }
    // planes
    this._planeT -= dt;
    if (this._planeT <= 0 && this.planes.length < 2) {
      this._planeT = rnd(45, 90) * (this.victory ? 0.4 : 1);
      const side = this.victory ? this.victory.side : (F.momentum.home >= F.momentum.away ? 'home' : 'away');
      const bomber = (this.victory ? 0.9 : F.momentum[side]) >= 0.7;
      this.planes.push({ side, t: 0, dur: rnd(3.6, 4.6), u0: rnd(-0.5, 0.5), bomber, dropped: 0, aaT: 0 });
      this.opts.onSfx?.('plane', 0.3);
    }
    for (let i = this.planes.length - 1; i >= 0; i--) {
      const p = this.planes[i]; p.t += dt / p.dur;
      if (p.t >= 1) { this.planes.splice(i, 1); continue; }
      const d = DIR[p.side];
      p.v = d === 1 ? lerp(-0.12, 1.12, p.t) : lerp(1.12, -0.12, p.t);
      p.u = p.u0 + Math.sin(p.t * 5) * 0.06;
      if (p.bomber && !this.victory) {
        const distToFront = Math.abs(p.v - this.frontE);
        if (distToFront < 0.12 && p.dropped < 3 && Math.random() < dt * 8) {
          p.dropped++;
          this._explosion(p.u + (p.dropped - 2) * 0.14, this.frontE + d * rnd(-0.02, 0.05), 1.3);
          this.opts.onSfx?.('impact', 0.5);
        }
      }
      const enemy = p.side === 'home' ? 'away' : 'home';
      const inEnemy = (enemy === 'away') ? p.v > 0.55 : p.v < 0.45;
      if (inEnemy) {
        p.aaT -= dt;
        if (p.aaT <= 0) {
          p.aaT = 0.09;
          for (const gun of this.camps[enemy].aa) {
            const dz = 9, du = p.u - gun.u, dv = p.v - gun.v, len = Math.hypot(du, dv, dz / 20);
            this.parts.push(this._pt(gun.u, gun.v, 1, 'tracer', '#ffd27a', 0.5, { vu: du / len * 0.9 + rnd(-0.08, 0.08), vv: dv / len * 0.9 + rnd(-0.08, 0.08), vz: 16, size: 1 }));
          }
          if (Math.random() < 0.25) this.parts.push(this._pt(p.u + rnd(-0.08, 0.08), p.v + rnd(-0.08, 0.08), rnd(7.5, 10), 'smoke', '#5a5c56', 0.7, { vz: 0.3, size: 2.5 }));
        }
      }
    }
    // trucks
    for (const side of ['home', 'away']) {
      this._truckT[side] -= dt * (0.4 + (this.victory ? 0.6 : F.momentum[side]));
      if (this._truckT[side] <= 0) {
        this._truckT[side] = rnd(9, 16);
        this.trucks.push({ side, u: rnd(-0.55, 0.55), v: CAMP_V[side] + DIR[side] * 0.02, phase: 'out' });
      }
    }
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      const tr = this.trucks[i], d = DIR[tr.side];
      const tv = tr.phase === 'out' ? this.frontE - d * 0.09 : CAMP_V[tr.side] + d * 0.01;
      const dv = tv - tr.v;
      tr.v += Math.sign(dv) * Math.min(Math.abs(dv), 0.11 * dt);
      if (Math.abs(dv) < 0.01) { if (tr.phase === 'out') tr.phase = 'back'; else this.trucks.splice(i, 1); }
    }
    // campfires smoke
    for (const side of ['home', 'away']) for (const f of this.camps[side].fires)
      if (Math.random() < dt * 2 * this.budget) this.parts.push(this._pt(f.u, f.v, 0.4, 'smoke', '#787c74', rnd(1.5, 2.8), { vu: rnd(-0.004, 0.004), vv: rnd(-0.004, 0.004), vz: rnd(0.5, 0.9), size: rnd(1.5, 3) }));
    // flanking squads (corner cinematic)
    for (let i = this.flanks.length - 1; i >= 0; i--) {
      const fl = this.flanks[i]; fl.t += dt;
      for (const un of fl.units) {
        const du = fl.tu - un.u, dv = fl.tv - un.v, d = Math.hypot(du, dv);
        if (d > 0.01) { un.u += du / d * 0.11 * dt; un.v += dv / d * 0.11 * dt; un.ph += dt * 11; un.moving = true; }
        else if (Math.random() < dt * 4) this.parts.push(this._pt(un.u, un.v, 0.9, 'flash', COL.flash, 0.1, { vz: 0, size: 2 }));
      }
      if (fl.t > 4.5) this.flanks.splice(i, 1);
    }
  }

  // ---------- cinematics ----------
  _cineUpdate(dt) {
    for (let i = this.cineFx.length - 1; i >= 0; i--) { const c = this.cineFx[i]; c.at -= dt; if (c.at <= 0) { this.cineFx.splice(i, 1); c.fn(); } }
    if (this.cine) {
      this.cine.t += dt;
      if (this.cine.t >= this.cine.dur) this.cine = null; else return;
    }
    if (!this.queue.length || this.victory) { if (this.victory) this.queue = []; return; }
    const e = this.queue.shift();
    this._startCine(e);
  }
  _startCine(e) {
    const S = e.side, d = S ? DIR[S] : 0, enemy = S === 'home' ? 'away' : 'home';
    switch (e.kind) {
      case 'goal': {
        this.cine = { kind: 'goal', t: 0, dur: 3 };
        const cv = CAMP_V[enemy], tgt = { u: rnd(-0.2, 0.2), v: cv - DIR[enemy] * 0.02 };
        this._fireShell({ u0: rnd(-0.3, 0.3), v0: this.frontE - d * 0.05, u1: tgt.u, v1: tgt.v, big: true, h: 9, dur: 0.9 });
        this.cineFx.push({ at: 0.9, fn: () => { this._explosion(tgt.u + 0.12, tgt.v + DIR[enemy] * 0.02, 1.6, true); this.rings.push({ u: tgt.u, v: tgt.v, t: 0, dur: 1.1, r0: 0.03, r1: 0.55, col: COL[S].accent }); this.opts.onSfx?.('boom', 1); } });
        this.cineFx.push({ at: 1.15, fn: () => this._explosion(tgt.u - 0.14, tgt.v - DIR[enemy] * 0.015, 1.3, true) });
        this.opts.onBanner?.({ title: `GOAL — ${this.names[S]}`, sub: `${e.minute}'  ·  ${e.probJump.from.toFixed(1)}% → ${e.probJump.to.toFixed(1)}%`, tone: S, hold: 3400 });
        break;
      }
      case 'shot': {
        this.cine = { kind: 'shot', t: 0, dur: 2.2 };
        const out = e.outcome;
        const tv = out === 'OffTarget' ? clamp(this.frontE + d * 0.22, 0.05, 0.95) : this.frontE + d * 0.012;
        const tu = out === 'OffTarget' ? (Math.random() < 0.5 ? -1 : 1) * rnd(0.75, 0.92) : rnd(-0.35, 0.35);
        this._fireShell({
          u0: rnd(-0.3, 0.3), v0: this.frontE - d * 0.08, u1: tu, v1: tv, h: 6, dur: 1.1,
          onland: (s) => {
            if (out === 'Woodwork') {
              this.parts.push(this._pt(s.u1, s.v1, 1.2, 'flash', '#ffffff', 0.18, { vz: 0, size: 7 }));
              for (let i = 0; i < 8; i++) this.parts.push(this._pt(s.u1, s.v1, 1.2, 'spark', COL.flash, 0.7, { vu: rnd(-0.15, 0.15), vv: -d * rnd(0.05, 0.2), vz: rnd(4, 9), size: 1.4 }));
              this.opts.onSfx?.('clang', 0.8);
            } else if (out === 'OffTarget') { this._explosion(s.u1, s.v1, 0.8); this.opts.onSfx?.('impact', 0.3); }
            else { // OnTarget saved / Blocked — sandbag wall takes it
              this.parts.push(this._pt(s.u1, s.v1, 0.5, 'flash', COL.flash, 0.15, { vz: 0, size: 5 }));
              for (let i = 0; i < 10; i++) this.parts.push(this._pt(s.u1, s.v1, 0.4, 'dirt', COL.sand, rnd(0.4, 0.8), { vu: rnd(-0.05, 0.05), vv: rnd(-0.04, 0.04), vz: rnd(2, 5), size: 2 }));
              this.opts.onSfx?.('impact', 0.4);
            }
          }
        });
        break;
      }
      case 'corner': {
        this.cine = { kind: 'corner', t: 0, dur: 2.6 };
        const cu = Math.random() < 0.5 ? -0.95 : 0.95;
        const cv = CAMP_V[enemy] - DIR[enemy] * 0.03;
        const us = []; for (let i = 0; i < 5; i++) us.push({ u: cu + rnd(-0.03, 0.03), v: cv + rnd(-0.02, 0.02), ph: rnd(0, 9) });
        this.flanks.push({ side: S, units: us, tu: cu * 0.35, tv: clamp(this.frontE + d * 0.05, 0.08, 0.92), t: 0 });
        break;
      }
      case 'card': {
        this.cine = { kind: 'card', t: 0, dur: 2 };
        const sq = this.squads[S].find(q => q.state === 'hold') || this.squads[S][0];
        const un = sq ? sq.units[0] : { u: 0, v: this.frontE - d * 0.1 };
        this.spot = { u: un.u, v: un.v, r: 0.16, until: this.now + 1.9 };
        this.cardFx = { u: un.u, v: un.v, color: e.color, t: 0 };
        this.opts.onSfx?.('whistle', 0.5);
        if (e.color === 'red') {
          this.walkers.push({ u: un.u, v: un.v, tu: un.u < 0 ? -1.15 : 1.15, tv: un.v, side: S, ph: 0 });
          this.opts.onChip?.(S, '10 MEN');
        }
        this.cineFx.push({ at: 1.9, fn: () => { if (this.spot && !this.varFreeze) this.spot = null; } });
        break;
      }
      case 'var': {
        this.cine = { kind: 'var', t: 0, dur: 1e9 };
        this.varFreeze = true;
        this.spot = { u: 0, v: 0.5, r: 0.3, until: Infinity };
        this.opts.onBanner?.({ title: 'VAR — CEASEFIRE', sub: 'TRIBUNAL IN SESSION', tone: 'neutral', hold: 3200 });
        this.opts.onSfx?.('whistle', 0.6);
        break;
      }
      case 'substitution': {
        this.cine = { kind: 'sub', t: 0, dur: 2 };
        const live = this.squads[S].filter(q => q.state === 'hold');
        if (live.length) live[live.length - 1].state = 'out';
        this._spawnSquad(S);
        break;
      }
      default: break;
    }
  }

  // ---------- drawing ----------
  draw() {
    const { ctx, W, H } = this;
    if (!W) return;
    this._shx = (Math.random() - 0.5) * this.shake; this._shy = (Math.random() - 0.5) * this.shake;
    this._cr = Math.cos(this.cam.rot); this._sr = Math.sin(this.cam.rot);
    ctx.fillStyle = COL.stage; ctx.fillRect(0, 0, W, H);
    // ground glow
    const gc = this._p(0, 0.5, 0);
    let gr = ctx.createRadialGradient(gc.x, gc.y, 10, gc.x, gc.y, Math.max(W, H) * 0.62);
    gr.addColorStop(0, 'rgba(48,70,44,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    this._drawBoard();
    // drawables
    const D = [];
    this._collect(D);
    D.sort((a, b) => a.d - b.d);
    for (const it of D) it.f();
    this._drawShells();
    this._drawPlanes();
    this._drawParticles();
    this._drawThreat();
    for (const r of this.rings) this._ring(r);
    if (this.spot) this._drawSpot();
    if (this.fogT > 0.02) this._drawFog();
    if (this.flashOv > 0.02) { ctx.fillStyle = `rgba(240,235,220,${this.flashOv})`; ctx.fillRect(0, 0, W, H); }
    // vignette
    if (!this._vig) {
      this._vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.75);
      this._vig.addColorStop(0, 'rgba(0,0,0,0)'); this._vig.addColorStop(1, 'rgba(2,4,2,0.52)');
    }
    ctx.fillStyle = this._vig; ctx.fillRect(0, 0, W, H);
  }

  _poly(pts, fill) { const c = this.ctx; c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y); c.closePath(); c.fill(); }
  _quadUV(u0, v0, u1, v1, fill, z = 0) { this._poly([this._p(u0, v0, z), this._p(u1, v0, z), this._p(u1, v1, z), this._p(u0, v1, z)], fill); }

  _box(u, v, du, dv, h, col, z0 = 0, alpha = 1) {
    const ctx = this.ctx; if (alpha < 1) ctx.globalAlpha = alpha;
    const cs = [[u - du, v - dv], [u + du, v - dv], [u + du, v + dv], [u - du, v + dv]];
    const lo = cs.map(c => this._p(c[0], c[1], z0)), hi = cs.map(c => this._p(c[0], c[1], z0 + h));
    const shades = [0.82, 0.66, 0.5, 0.6];
    const order = [0, 1, 2, 3].map(i => { const j = (i + 1) % 4; return { i, d: this._depth((cs[i][0] + cs[j][0]) / 2, (cs[i][1] + cs[j][1]) / 2) }; }).sort((a, b) => a.d - b.d);
    for (const { i } of order) {
      const j = (i + 1) % 4;
      this._poly([lo[i], lo[j], hi[j], hi[i]], shade(col, shades[i]));
    }
    this._poly(hi, shade(col, 1));
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  _terrain() {
    if (this._terr) return this._terr;
    const NU = 22, NV = 30, cells = [];
    const eu = 0.012, ev = 0.0045;
    for (let iv = 0; iv < NV; iv++) for (let iu = 0; iu < NU; iu++) {
      const u0 = -1 + 2 * iu / NU, u1 = -1 + 2 * (iu + 1) / NU, v0 = iv / NV, v1 = (iv + 1) / NV;
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      const dhdu = this._hgt(u1, vc) - this._hgt(u0, vc), dhdv = this._hgt(uc, v1) - this._hgt(uc, v0);
      const hsh = Math.abs(Math.sin(iu * 12.9898 + iv * 78.233) * 43758.5453) % 1;
      cells.push({ u0e: u0 - eu, u1e: u1 + eu, v0e: v0 - ev, v1e: v1 + ev, uc, vc, lf: clamp((0.93 + hsh * 0.14) * (1 + dhdv * 1.15 - dhdu * 0.45), 0.64, 1.36), d: 0 });
    }
    return (this._terr = { cells });
  }
  _skirt() {
    const ctx = this.ctx, D = 3.4, S = 14;
    const edges = [
      { pts: (i) => [-1 + 2 * i / S, 0], col: COL.skirt },
      { pts: (i) => [-1 + 2 * i / S, 1], col: COL.skirt },
      { pts: (i) => [-1, i / S], col: COL.skirtSide },
      { pts: (i) => [1, i / S], col: COL.skirtSide },
    ];
    for (const E of edges) {
      const top = [], bot = [];
      for (let i = 0; i <= S; i++) {
        const [u, v] = E.pts(i);
        top.push(this._p(u, v, 0));
        bot.push(this._p(u, v, -(D + this._hgt(u, v))));
      }
      this._poly(top.concat(bot.reverse()), E.col);
    }
    // strata line
    ctx.strokeStyle = rgba(COL.strata, 0.5); ctx.lineWidth = Math.max(1, this.k * 0.8);
    for (const E of edges) {
      ctx.beginPath();
      for (let i = 0; i <= S; i++) { const [u, v] = E.pts(i); const p = this._p(u, v, -(1.3 + this._hgt(u, v))); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
      ctx.stroke();
    }
  }
  _lake(L) {
    const ctx = this.ctx, steps = 22;
    const ring = (rr, z) => { const pts = []; for (let i = 0; i < steps; i++) { const a2 = i / steps * Math.PI * 2; pts.push(this._p(L.u + Math.cos(a2) * rr * 1.35, L.v + Math.sin(a2) * rr * 0.75, z)); } return pts; };
    this._poly(ring(L.r * 1.24, 0.015), COL.shore);
    this._poly(ring(L.r, -0.1), COL.water);
    this._poly(ring(L.r * 0.6, -0.14), COL.waterDeep);
    const c = this._p(L.u - L.r * 0.3, L.v - L.r * 0.12, -0.06);
    ctx.fillStyle = 'rgba(235,248,255,0.16)';
    ctx.beginPath(); ctx.ellipse(c.x, c.y, L.r * 0.55 * this.su * this.cam.zoom * 0.6, L.r * 0.22 * this.sv * this.cam.zoom * 0.35, 0, 0, 7); ctx.fill();
  }
  _road() {
    const ctx = this.ctx, HALF = 0.045, pts = [];
    for (let v = 0; v <= 1.0001; v += 0.04) pts.push({ v: Math.min(v, 1), u: ROAD_U(Math.min(v, 1)) });
    const left = pts.map(p => this._p(p.u - HALF, p.v, 0.012));
    const right = [...pts].reverse().map(p => this._p(p.u + HALF, p.v, 0.012));
    this._poly(left.concat(right), COL.road);
    ctx.strokeStyle = rgba(COL.roadEdge, 0.9); ctx.lineWidth = Math.max(0.8, this.k * 0.8 * this.cam.zoom);
    for (const off of [-HALF, HALF]) {
      ctx.beginPath();
      pts.forEach((p, i) => { const q = this._p(p.u + off, p.v, 0.016); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.stroke();
    }
  }
  _drawBoard() {
    const t = this.tintOv, F = this.F;
    const win = this.victory ? COL[this.victory.side].tint : null;
    // territory base colors — lush home green vs sun-baked away khaki, deepened by probability
    let hCol = mix(COL.homeEarth, COL.home.tint, 0.08 + 0.3 * (F.prob.home / 100));
    let aCol = mix(COL.awayEarth, COL.away.tint, 0.05 + 0.22 * (F.prob.away / 100));
    if (win) { hCol = mix(hCol, win, t * 0.75); aCol = mix(aCol, win, t * 0.75); }
    // extruded edge (real thickness), then relief mesh far-to-near
    this._skirt();
    const cells = this._terrain().cells;
    for (const c of cells) c.d = this._depth(c.uc, c.vc);
    cells.sort((x, y) => x.d - y.d);
    for (const c of cells) {
      const base = c.vc < this.frontE ? hCol : aCol;
      this._poly([this._p(c.u0e, c.v0e), this._p(c.u1e, c.v0e), this._p(c.u1e, c.v1e), this._p(c.u0e, c.v1e)], shade(base, c.lf));
    }
    for (const L of LAKES) this._lake(L);
    this._road();
    // patches
    const ctx = this.ctx;
    for (const p of this.patches) {
      const c = this._p(p.u, p.v);
      ctx.fillStyle = p.f > 1 ? 'rgba(255,255,240,0.05)' : 'rgba(8,18,4,0.1)';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, p.r * this.su * this.cam.zoom, p.r * this.sv * this.cam.zoom * 0.5, 0, 0, 7); ctx.fill();
    }
    // grid (follows the terrain)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let v = 0.1; v < 1; v += 0.1) {
      ctx.beginPath();
      for (let u = -1; u <= 1.0001; u += 0.08) { const p = this._p(u, v, 0.008); u <= -1 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
      ctx.stroke();
    }
    // no-man's-land
    ctx.globalAlpha = 0.4; this._ribbon(-1, 1, this.frontE - 0.05, this.frontE + 0.05, COL.scorch);
    ctx.globalAlpha = 0.5; this._ribbon(-1, 1, this.frontE - 0.022, this.frontE + 0.022, COL.scorch);
    ctx.globalAlpha = 1;
    // scars
    for (const s of this.scars) { ctx.globalAlpha = s.a; this._ribbon(-0.9, 0.9, s.v - 0.006, s.v + 0.006, '#100d07', 12); ctx.globalAlpha = 1; }
    // decals + craters
    for (const dd of this.decals) { const c = this._p(dd.u, dd.v); ctx.globalAlpha = dd.a; ctx.fillStyle = '#0c0a06'; ctx.beginPath(); ctx.ellipse(c.x, c.y, dd.r * this.su * this.cam.zoom, dd.r * this.sv * this.cam.zoom * 0.5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    for (const cr of this.craters) { const c = this._p(cr.u, cr.v); ctx.globalAlpha = cr.a; ctx.fillStyle = '#14100a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, cr.r * this.su * this.cam.zoom, cr.r * this.sv * this.cam.zoom * 0.5, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    // edge line (follows the relief)
    ctx.strokeStyle = 'rgba(215,225,205,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath();
    const rim = [];
    for (let u = -1; u <= 1.0001; u += 0.125) rim.push([u, 0]);
    for (let v = 0; v <= 1.0001; v += 0.125) rim.push([1, v]);
    for (let u = 1; u >= -1.0001; u -= 0.125) rim.push([u, 1]);
    for (let v = 1; v >= -0.0001; v -= 0.125) rim.push([-1, v]);
    rim.forEach(([u, v], i) => { const p = this._p(u, v, 0.01); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
    ctx.closePath(); ctx.stroke();
    // trench band + wire (flat-ish, draw before entities)
    const tv = this.trench.v;
    this._ribbon(-0.92, 0.92, tv - 0.011, tv + 0.011, COL.trench);
    this._ribbon(-0.92, 0.92, tv - 0.003, tv + 0.003, '#0d0a05');
    ctx.strokeStyle = COL.wire; ctx.lineWidth = Math.max(0.6, this.k * 0.7);
    for (const off of [-0.02, 0.02]) {
      ctx.beginPath();
      for (let u = -0.9; u <= 0.9; u += 0.03) {
        const p = this._p(u, tv + off + (Math.abs(u * 100) % 2 < 1 ? 0.004 : -0.004), 0.28);
        u === -0.9 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      for (let u = -0.9; u <= 0.9; u += 0.09) { const a = this._p(u, tv + off, 0), b = this._p(u, tv + off, 0.3); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    if (this.armistice) for (let u = -0.85; u <= 0.85; u += 0.12) this._box(u, tv, 0.006, 0.004, 0.7, '#d8d8d0');
  }

  _collect(D) {
    const push = (u, v, f, bias = 0) => D.push({ d: this._depth(u, v) + bias, f });
    // sandbags
    for (const b of this.trench.bags) push(b.u, this.trench.v + b.o * 0.016, () => this._box(b.u, this.trench.v + b.o * 0.016, 0.016 * b.s, 0.007, 0.32, COL.sand));
    // trees
    for (const tr of this.trees) push(tr.u, tr.v, () => this._tree(tr));
    // camps
    for (const side of ['home', 'away']) this._collectCamp(side, push);
    // artillery
    for (const a of this.arty) push(a.u, a.v, () => this._arty(a));
    // tanks
    for (const t of this.tanks) push(t.u, t.v, () => this._tank(t));
    // trucks
    for (const tr of this.trucks) push(tr.u, tr.v, () => this._truck(tr));
    // squads
    for (const side of ['home', 'away']) for (const sq of this.squads[side]) for (const un of sq.units)
      push(un.u, un.v, () => this._unit(un, side, sq.alpha ?? 1));
    // raiders + patrols + walkers + flanks
    for (const side of ['home', 'away']) for (const un of this.raiders[side].units) push(un.u, un.v, () => this._unit(un, side, 1));
    for (const p of this.patrols) push(p.u, p.v, () => this._unit(p, p.side, 1));
    for (const w of this.walkers) push(w.u, w.v, () => this._unit(w, w.side, 1));
    for (const fl of this.flanks) for (const un of fl.units) push(un.u, un.v, () => this._unit(un, fl.side, 1));
    // card fx
    if (this.cardFx) push(this.cardFx.u, this.cardFx.v, () => this._card(this.cardFx), 0.1);
    // victory flag on enemy HQ
    if (this.victory && this.victory.flag > 0) {
      const hq = this.camps[this.victory.loser].hq;
      push(hq.u, hq.v, () => this._flag(hq.u, hq.v, this.victory.side, 2.4 + 2.2 * this.victory.flag, 1.3, hq.h), 0.1);
    }
  }
  _collectCamp(side, push) {
    const C = this.camps[side], team = COL[side];
    const mob = this.victory ? (side === this.victory.side ? 1 : 0) : this.F.momentum[side];
    const b = (o, col) => push(o.u, o.v, () => this._box(o.u, o.v, o.du, o.dv, o.h, col));
    b(C.hq, team.deep);
    push(C.hq.u, C.hq.v, () => { this._box(C.hq.u, C.hq.v, C.hq.du * 0.5, C.hq.dv * 0.55, 0.8, team.main, C.hq.h); }, 0.001);
    for (const t of C.tents) b(t, mix(team.main, '#6a6a5a', 0.45));
    b(C.hospital, '#c9cCc2'.replace('C', 'c'));
    push(C.depot.u, C.depot.v, () => { for (let i = 0; i < 3; i++) this._box(C.depot.u + i * 0.022 - 0.02, C.depot.v + (i % 2) * 0.01, 0.011, 0.008, 0.4 + (i % 2) * 0.15, '#5c5744'); });
    push(C.radar.u, C.radar.v, () => this._radar(C.radar, team));
    for (const g2 of C.aa) push(g2.u, g2.v, () => this._aa(g2, side));
    push(C.flag.u, C.flag.v, () => this._flag(C.flag.u, C.flag.v, side, 3.2, 1, 0));
    for (const pk of C.parked) push(pk.u, pk.v, () => this._tank({ side, u: pk.u, v: pk.v }, true));
    for (const f of C.fires) push(f.u, f.v, () => {
      const c = this._p(f.u, f.v, 0.15), fl = 0.6 + Math.sin(this.now * 11 + f.u * 40) * 0.4;
      this.ctx.fillStyle = `rgba(230,150,60,${0.35 + fl * 0.3})`;
      this.ctx.beginPath(); this.ctx.arc(c.x, c.y, (1.6 + fl) * this.k * this.cam.zoom, 0, 7); this.ctx.fill();
    });
    // mobilization lights
    if (mob > 0.45) push(C.hq.u, C.hq.v, () => {
      const ctx = this.ctx; ctx.fillStyle = `rgba(255,220,140,${(mob - 0.45) * 0.9})`;
      for (let i = -1; i <= 1; i++) { const p = this._p(C.hq.u + i * 0.04, C.hq.v - DIR[side] * C.hq.dv, 1.2); ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }
    }, 0.002);
  }

  _tree(tr) {
    const k = this.k * this.cam.zoom * tr.s;
    const p = this._p(tr.u, tr.v, 0);
    this.ctx.fillStyle = 'rgba(0,0,0,0.25)'; this.ctx.beginPath(); this.ctx.ellipse(p.x + 1, p.y + 1, 3.4 * k, 1.6 * k, 0, 0, 7); this.ctx.fill();
    this.ctx.fillStyle = COL.trunk; this.ctx.fillRect(p.x - 0.7 * k, p.y - 3.4 * k, 1.4 * k, 3.4 * k);
    const top = this._p(tr.u, tr.v, 1.9 * tr.s);
    this.ctx.fillStyle = shade(((tr.s * 100) | 0) % 2 ? COL.tree2 : COL.tree, 0.85 + (tr.u * 31 % 1) * 0.3);
    this.ctx.beginPath(); this.ctx.moveTo(top.x, top.y - 4.5 * k); this.ctx.lineTo(top.x - 3.1 * k, top.y + 3.5 * k); this.ctx.lineTo(top.x + 3.1 * k, top.y + 3.5 * k); this.ctx.closePath(); this.ctx.fill();
  }
  _unit(un, side, alpha) {
    const ctx = this.ctx, k = this.k * this.cam.zoom, team = COL[side];
    const bob = un.moving ? Math.abs(Math.sin(un.ph)) * 1.2 * k : Math.sin(this.now * 2 + (un.ph || 0)) * 0.25 * k;
    const p = this._p(un.u, un.v, 0);
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 2 * k, 0.9 * k, 0, 0, 7); ctx.fill();
    ctx.fillStyle = team.main; ctx.fillRect(p.x - 1.2 * k, p.y - 5.6 * k - bob, 2.4 * k, 5 * k);
    ctx.fillStyle = side === 'home' ? team.deep : '#e8eef2'; ctx.fillRect(p.x - 1.2 * k, p.y - 5.6 * k - bob, 2.4 * k, 1.5 * k);
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  _tank(t, parked = false) {
    const team = COL[t.side], d = DIR[t.side];
    this._box(t.u, t.v, 0.03, 0.042, 0.55, mix(team.deep, '#4a4c42', 0.55));
    this._box(t.u, t.v, 0.016, 0.02, 0.4, mix(team.deep, '#5a5c50', 0.4), 0.55);
    const a = this._p(t.u, t.v, 0.8), b = this._p(t.u, t.v + d * 0.05, 0.85);
    const ctx = this.ctx; ctx.strokeStyle = '#3c3e36'; ctx.lineWidth = Math.max(1, 1.6 * this.k * this.cam.zoom);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (!parked) { ctx.fillStyle = rgba(team.main, 0.9); const m = this._p(t.u, t.v, 1); ctx.fillRect(m.x - 1, m.y - 1, 2, 2); }
  }
  _truck(tr) {
    const team = COL[tr.side];
    this._box(tr.u, tr.v, 0.014, 0.026, 0.5, '#565848');
    this._box(tr.u, tr.v + DIR[tr.side] * (tr.phase === 'out' ? 0.018 : -0.018), 0.013, 0.009, 0.62, mix(team.deep, '#666', 0.5));
  }
  _arty(a) {
    const d = DIR[a.side], team = COL[a.side];
    this._box(a.u, a.v, 0.02, 0.014, 0.3, mix(team.deep, '#54564a', 0.6));
    const p0 = this._p(a.u, a.v, 0.35), p1 = this._p(a.u, a.v + d * 0.035, 1.5);
    const ctx = this.ctx; ctx.strokeStyle = '#494b40'; ctx.lineWidth = Math.max(1, 1.8 * this.k * this.cam.zoom);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; const s = this._p(a.u, a.v); ctx.beginPath(); ctx.ellipse(s.x, s.y + 2, 5 * this.k * this.cam.zoom, 2 * this.k * this.cam.zoom, 0, 0, 7); ctx.fill();
  }
  _aa(g2, side) {
    this._box(g2.u, g2.v, 0.013, 0.011, 0.3, '#4c4e44');
    const p0 = this._p(g2.u, g2.v, 0.35), p1 = this._p(g2.u + 0.015, g2.v, 1.3);
    const ctx = this.ctx; ctx.strokeStyle = '#565850'; ctx.lineWidth = Math.max(1, 1.3 * this.k * this.cam.zoom);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  _radar(r, team) {
    this._box(r.u, r.v, 0.012, 0.01, 1.2, '#4e5046');
    const c = this._p(r.u, r.v, 1.5);
    const ctx = this.ctx; ctx.strokeStyle = rgba(team.main, 0.8); ctx.lineWidth = 1.2;
    const a = this.radarA;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 4.5 * this.k * this.cam.zoom, 2 * this.k * this.cam.zoom, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(a) * 4.5 * this.k * this.cam.zoom, c.y + Math.sin(a) * 2 * this.k * this.cam.zoom); ctx.stroke();
  }
  _flag(u, v, side, h, scale, z0) {
    const ctx = this.ctx, k = this.k * this.cam.zoom * scale, team = COL[side];
    const base = this._p(u, v, z0), top = this._p(u, v, z0 + h);
    ctx.strokeStyle = '#8b8878'; ctx.lineWidth = Math.max(1, k);
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    const fw = 11 * k, fh = 6.5 * k, n = 5;
    for (let i = 0; i < n; i++) {
      const wob = Math.sin(this.now * 3.2 + i * 0.9 + u * 10) * 1.3 * k * (i / n);
      const x = top.x + (i / n) * fw, w = fw / n + 0.5;
      if (side === 'home') {
        ctx.fillStyle = '#e8e8e4'; ctx.fillRect(x, top.y + wob, w, fh);
        ctx.fillStyle = COL.home.accent; ctx.fillRect(x, top.y + wob + fh * 0.38, w, fh * 0.24);
      } else {
        ctx.fillStyle = COL.away.main; ctx.fillRect(x, top.y + wob, w, fh * 0.33);
        ctx.fillStyle = '#eef2f4'; ctx.fillRect(x, top.y + wob + fh * 0.33, w, fh * 0.34);
        ctx.fillStyle = COL.away.main; ctx.fillRect(x, top.y + wob + fh * 0.67, w, fh * 0.33);
      }
    }
  }
  _card(cf) {
    const ctx = this.ctx, k = this.k * this.cam.zoom;
    const rise = Math.min(1, cf.t * 1.4);
    const p = this._p(cf.u, cf.v, 1.5 + rise * 1.2);
    ctx.globalAlpha = cf.t > 1.1 ? Math.max(0, 1 - (cf.t - 1.1) * 2) : 1;
    ctx.fillStyle = cf.color === 'red' ? '#c82b2b' : '#e6c33a';
    ctx.fillRect(p.x - 2.5 * k, p.y - 4 * k, 5 * k, 7 * k);
    ctx.globalAlpha = 1;
  }
  _drawShells() {
    const ctx = this.ctx;
    for (const s of this.shells) {
      const u = lerp(s.u0, s.u1, s.t), v = lerp(s.v0, s.v1, s.t), z = s.h * 4 * s.t * (1 - s.t);
      const p = this._p(u, v, z), sh = this._p(u, v, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 1.6, 0.8, 0, 0, 7); ctx.fill();
      const tp = this._p(lerp(s.u0, s.u1, Math.max(0, s.t - 0.06)), lerp(s.v0, s.v1, Math.max(0, s.t - 0.06)), s.h * 4 * Math.max(0, s.t - 0.06) * (1 - Math.max(0, s.t - 0.06)));
      ctx.strokeStyle = s.big ? 'rgba(255,200,120,0.85)' : 'rgba(255,220,160,0.5)'; ctx.lineWidth = s.big ? 2.2 : 1.2;
      ctx.beginPath(); ctx.moveTo(tp.x, tp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.arc(p.x, p.y, s.big ? 2.6 : 1.5, 0, 7); ctx.fill();
    }
  }
  _drawPlanes() {
    const ctx = this.ctx, k = this.k * this.cam.zoom;
    for (const pl of this.planes) {
      const team = COL[pl.side];
      const sh = this._p(pl.u, pl.v, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 7 * k, 2.6 * k, 0, 0, 7); ctx.fill();
      const p = this._p(pl.u, pl.v, 9);
      const p2 = this._p(pl.u, pl.v + DIR[pl.side] * 0.04, 9);
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
      ctx.fillStyle = mix(team.deep, '#8a9099', 0.35);
      ctx.beginPath(); ctx.moveTo(7 * k, 0); ctx.lineTo(-5 * k, -2 * k); ctx.lineTo(-3.4 * k, 0); ctx.lineTo(-5 * k, 2 * k); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(1.5 * k, 0); ctx.lineTo(-2.5 * k, -5.5 * k); ctx.lineTo(-3.4 * k, -4.6 * k); ctx.lineTo(-1.2 * k, 0); ctx.lineTo(-3.4 * k, 4.6 * k); ctx.lineTo(-2.5 * k, 5.5 * k); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(team.main, 0.9); ctx.fillRect(-1 * k, -1 * k, 2 * k, 2 * k);
      ctx.restore();
    }
  }
  _drawParticles() {
    const ctx = this.ctx, k = this.k * this.cam.zoom;
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      const pp = this._p(p.u, p.v, p.z);
      if (p.kind === 'tracer') {
        const tail = this._p(p.u - p.vu * 0.04, p.v - p.vv * 0.04, p.z - p.vz * 0.04);
        ctx.strokeStyle = rgba(p.col, a * 0.9); ctx.lineWidth = p.size * k;
        ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(pp.x, pp.y); ctx.stroke();
      } else if (p.kind === 'flash') {
        const g2 = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, p.size * 2.2 * k);
        g2.addColorStop(0, rgba(p.col, a * 0.95)); g2.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(pp.x, pp.y, p.size * 2.2 * k, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = rgba(p.col, a * (p.kind === 'smoke' ? 0.35 : 0.9));
        ctx.beginPath(); ctx.arc(pp.x, pp.y, p.size * k * (p.kind === 'smoke' ? (2 - a) : 1), 0, 7); ctx.fill();
      }
    }
  }
  _ring(r) {
    const ctx = this.ctx, e = 1 - Math.pow(1 - r.t, 3);
    const rad = lerp(r.r0, r.r1, e);
    const c = this._p(r.u, r.v, 0.1);
    ctx.strokeStyle = rgba(r.col, (1 - r.t) * 0.8); ctx.lineWidth = 2.4 * (1 - r.t) + 0.6;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, rad * this.su * this.cam.zoom, rad * this.sv * this.cam.zoom * 0.42, 0, 0, 7); ctx.stroke();
  }
  _drawThreat() {
    const T = this.F.threat, ctx = this.ctx;
    const pulse = (Math.sin(this.now * 5) + 1) / 2;
    const flare = (u, v) => {
      const c = this._p(u, v, 0.2);
      const R = (24 + pulse * 14) * this.k * this.cam.zoom;
      const g2 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
      g2.addColorStop(0, rgba(COL.gold, 0.28 + pulse * 0.2)); g2.addColorStop(1, 'rgba(211,171,72,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7); ctx.fill();
      ctx.strokeStyle = rgba(COL.gold, 0.5 + pulse * 0.4); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, R * 0.7, R * 0.32, 0, 0, 7); ctx.stroke();
    };
    if (T.home.goal || T.home.penalty || T.home.corner) flare(0, 0.86);
    if (T.away.goal || T.away.penalty || T.away.corner) flare(0, 0.14);
    if (T.neutral.var || T.neutral.redCard || T.neutral.yellowCard) flare(0, 0.5);
  }
  _drawSpot() {
    const s = this.spot, ctx = this.ctx;
    const c = this._p(s.u, s.v, 0);
    const R = s.r * this.su * this.cam.zoom * 2.2;
    const g2 = ctx.createRadialGradient(c.x, c.y, R * 0.2, c.x, c.y, Math.max(this.W, this.H));
    g2.addColorStop(0, 'rgba(255,244,210,0.09)');
    g2.addColorStop(0.14, 'rgba(0,0,0,0)');
    g2.addColorStop(0.5, 'rgba(0,0,0,0.66)');
    g2.addColorStop(1, 'rgba(0,0,0,0.74)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, this.W, this.H);
  }
  _drawFog() {
    const ctx = this.ctx, f = this.fogT;
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = `rgba(128,128,128,${0.75 * f})`; ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
    const n = Math.round(this.fogBlobs.length * this.budget);
    for (let i = 0; i < n; i++) {
      const b = this.fogBlobs[i];
      const c = this._p(b.u, b.v, 1);
      const R = b.r * this.su * this.cam.zoom * 2;
      const g2 = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
      g2.addColorStop(0, `rgba(146,153,144,${0.34 * f})`); g2.addColorStop(1, 'rgba(146,153,144,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7); ctx.fill();
    }
    ctx.fillStyle = `rgba(120,128,118,${0.16 * f})`; ctx.fillRect(0, 0, this.W, this.H);
  }

  // ---------- input ----------
  _bindInput() {
    const cv = this.cv, ptrs = new Map();
    let lastTap = 0, pinch0 = 0, zoom0 = 1, twist0 = 0, rot0 = 0;
    const angOf = () => { const [a, b] = [...ptrs.values()]; return Math.atan2(b.y - a.y, b.x - a.x); };
    const down = e => {
      cv.setPointerCapture?.(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        const now = performance.now();
        if (now - lastTap < 300) this.recenter();
        lastTap = now;
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = this.cam.zoom;
        twist0 = angOf(); rot0 = this.cam.rot;
      }
    };
    const move = e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 1) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        // mouse: right-drag / shift-drag / ctrl-drag rotates; plain drag pans. touch: one finger pans.
        const rotating = e.pointerType === 'mouse' && ((e.buttons & 2) || e.shiftKey || e.ctrlKey || e.metaKey);
        if (rotating) this.cam.rot += dx * 0.006;
        else { this.cam.x += dx; this.cam.y += dy; }
      }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0) this.cam.zoom = clamp(zoom0 * d / pinch0, 0.55, 2.4);
        this.cam.rot = rot0 + (angOf() - twist0); // two-finger twist rotates
      }
    };
    const up = e => ptrs.delete(e.pointerId);
    const wheel = e => {
      e.preventDefault();
      if (e.altKey) { this.cam.rot += e.deltaY * 0.0022; return; } // alt+wheel rotates
      this.cam.zoom = clamp(this.cam.zoom * Math.pow(1.0012, -e.deltaY), 0.55, 2.4);
    };
    const ctxm = e => e.preventDefault();
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.addEventListener('contextmenu', ctxm);
    this._unbind = () => { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up); cv.removeEventListener('wheel', wheel); cv.removeEventListener('contextmenu', ctxm); };
  }
}
