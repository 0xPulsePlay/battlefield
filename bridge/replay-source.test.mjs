// Hermetic tests for bridge/replay-source.js against the recorded ENG-ARG match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildReplayModel, buildClockModel, abbr } from './replay-source.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, '__fixtures__', f), 'utf8'));
const fx = load('fixture-18241006.json');
const od = load('odds-18241006-1x2.json');
const model = buildReplayModel(fx, od);

// real timeline anchors
const GOAL1_TS = 1784146626116; // 54' England
const GOAL3_TS = 1784148871889; // 91' Argentina
const byStatus = {};
for (const p of fx.timeline.phases) if (byStatus[p.status] == null) byStatus[p.status] = p.ts;

test('teams orient home/away and abbreviate', () => {
  assert.equal(model.teams.home.name, 'England');
  assert.equal(model.teams.away.name, 'Argentina');
  assert.equal(model.teams.home.abbr, 'ENG');
  assert.equal(model.teams.away.abbr, 'ARG');
  assert.equal(abbr('Bosnia & Herzegovina'), 'BIH');
});

test('clock model: H1 starts at 0, HT frozen, H2 resumes at 45:00', () => {
  const clock = buildClockModel(fx.timeline.phases, fx.timeline.events);
  assert.ok(clock.tsToMatchSec(byStatus[2]).sec < 30);
  assert.equal(clock.tsToMatchSec(byStatus[2]).phase, 'H1');
  const ht = clock.tsToMatchSec((byStatus[3] + byStatus[4]) / 2);
  assert.equal(ht.phase, 'HT');
  assert.equal(ht.running, false);
  assert.ok(clock.tsToMatchSec(byStatus[4] + 1000).sec >= 2700);
  assert.equal(clock.tsToMatchSec(byStatus[4] + 1000).phase, 'H2');
});

test('goals land at their real match minute (displayed clock)', () => {
  assert.ok(Math.abs(model.displayClock(GOAL1_TS).sec - 54 * 60) < 60);
  assert.ok(Math.abs(model.displayClock(GOAL3_TS).sec - 91 * 60) < 60);
  const goalEvents = model.eventTimeline.filter((e) => e.battleEvent.kind === 'goal');
  assert.equal(goalEvents.length, 3);
  assert.equal(goalEvents[0].battleEvent.side, 'home');
  assert.equal(goalEvents[1].battleEvent.side, 'away');
  assert.equal(goalEvents[2].battleEvent.side, 'away');
});

test('score steps stay in sync with the clock', () => {
  assert.deepEqual(model.scoreAt(model.firstTs), { home: 0, away: 0 });
  assert.deepEqual(model.scoreAt(GOAL1_TS + 1000), { home: 1, away: 0 });
  assert.deepEqual(model.scoreAt(GOAL3_TS + 1000), { home: 1, away: 2 });
  assert.deepEqual(model.finalScore, { home: 1, away: 2 });
  assert.equal(model.winner, 'away');
});

test('England 54 goal shows a real de-margined prob jump', () => {
  const before = model.probAt(GOAL1_TS - 90000);
  const after = model.probAt(GOAL1_TS + 60000);
  assert.ok(after.home - before.home > 15, `jump ${before.home.toFixed(1)}->${after.home.toFixed(1)}`);
  const g = model.eventTimeline.find((e) => e.battleEvent.kind === 'goal');
  assert.ok(g.battleEvent.probJump.to > g.battleEvent.probJump.from + 10);
});

test('market is suspended in the dark window after a goal, prob held', () => {
  const w = model.inSuspension(GOAL1_TS + 5000);
  assert.ok(w, 'expected a suspension window just after the goal');
  const p = model.probAt(GOAL1_TS + 5000);
  assert.equal(p.suspended, true);
  assert.ok(p.darkMs >= 0);
  const pre = model.probAt(GOAL1_TS - 1000); // still in quiet lead → not suspended, held
  assert.equal(pre.suspended, false);
  assert.ok(Math.abs(p.home - pre.home) < 2, 'prob held across the goal window');
});

test('prob sums to ~100 across the match', () => {
  for (const ts of [model.firstTs, model.firstTs + 600000, GOAL1_TS + 120000, model.endTs - 60000]) {
    const p = model.probAt(ts);
    assert.ok(Math.abs(p.home + p.draw + p.away - 100) < 0.5, `sum off at ${ts}`);
  }
});

test('full time is past 90 minutes and progress spans 0..1', () => {
  assert.ok(model.fullTimeSec >= 90 * 60);
  assert.equal(model.tsToProgress(model.firstTs), 0);
  assert.equal(model.tsToProgress(model.endTs), 1);
  assert.ok(model.progressToTs(0.5) > model.firstTs && model.progressToTs(0.5) < model.endTs);
});

test('additional_time events carry the real stoppage, not 0', () => {
  const addl = model.eventTimeline.filter((e) => e.battleEvent.kind === 'additional_time');
  assert.equal(addl.length, 2, 'expected two added-time announcements (H1 + H2)');
  // H1 stoppage: the clock ran to 48:00, so 45+3
  assert.ok(Math.abs(addl[0].sec - 45 * 60) < 60, 'first announced ~45:00');
  assert.equal(addl[0].battleEvent.minutes, 3);
  // H2 stoppage: the clock ran to 101:00, so 90+11
  assert.ok(Math.abs(addl[1].sec - 90 * 60) < 60, 'second announced ~90:00');
  assert.ok(addl[1].battleEvent.minutes >= 1, 'H2 added minutes must be non-zero');
});

test('eventsBetween returns only material events in the window', () => {
  const evs = model.eventsBetween(GOAL1_TS - 60000, GOAL1_TS + 60000);
  assert.ok(evs.some((e) => e.battleEvent.kind === 'goal'));
  assert.ok(evs.every((e) => e.ts > GOAL1_TS - 60000 && e.ts <= GOAL1_TS + 60000));
});
