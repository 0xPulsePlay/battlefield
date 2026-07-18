// Integration test for RealMatchDriver replay mode — no network. Builds the model
// from recorded fixtures, then hand-cranks _tick() collecting frames + events.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildReplayModel } from './replay-source.js';
import { RealMatchDriver } from './real-driver.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, '__fixtures__', f), 'utf8'));
const model = buildReplayModel(load('fixture-18241006.json'), load('odds-18241006-1x2.json'));

function runReplay({ startTs, speed = 1, dur = 20 } = {}) {
  const frames = [], events = [];
  const d = new RealMatchDriver({
    onFrame: (f) => frames.push(f),
    onEvent: (e) => events.push(e),
    model, mode: 'replay', replayDurationSec: dur, loop: false, startTs, speed,
  });
  clearInterval(d._iv);
  for (let i = 0; i < 600 && !d.finished; i++) d._tick();
  d._tick();
  d.destroy();
  return { frames, events };
}

test('driver emits a well-formed BattleFrame every tick', () => {
  const { frames } = runReplay();
  assert.ok(frames.length > 50);
  const f = frames[10];
  for (const k of ['t', 'clock', 'score', 'prob', 'front', 'possession', 'momentum', 'threat', 'market']) {
    assert.ok(k in f, `frame missing ${k}`);
  }
  assert.ok(['PRE', 'H1', 'HT', 'H2', 'ET1', 'ET2', 'PENS', 'FT'].includes(f.clock.phase));
  assert.ok(Math.abs(f.prob.home + f.prob.draw + f.prob.away - 100) < 1);
});

test('kickoff fires once, fulltime fires with the real winner', () => {
  const { events } = runReplay();
  assert.equal(events.filter((e) => e.kind === 'kickoff').length, 1);
  const ft = events.find((e) => e.kind === 'fulltime');
  assert.ok(ft, 'fulltime not emitted');
  assert.equal(ft.winner, 'away');
  assert.deepEqual(ft.score, { home: 1, away: 2 });
});

test('all three goals fire with the right sides', () => {
  const { events } = runReplay({ dur: 60 }); // slower so no step skips a goal
  const goals = events.filter((e) => e.kind === 'goal');
  assert.equal(goals.length, 3);
  assert.equal(goals[0].side, 'home');
  assert.equal(goals[1].side, 'away');
  assert.equal(goals[2].side, 'away');
  assert.ok(goals[0].probJump.to > goals[0].probJump.from);
});

test('suspension_start and reopen bracket each goal even at high fast-forward', () => {
  const { events } = runReplay({ dur: 8 }); // aggressive: dark window < one tick step
  assert.ok(events.filter((e) => e.kind === 'suspension_start').length >= 3, 'missed a suspension');
  assert.ok(events.filter((e) => e.kind === 'reopen').length >= 3, 'missed a reopen');
});

test('score stays in sync with the clock as the match runs', () => {
  const { frames } = runReplay({ dur: 60 });
  const afterFirst = frames.find((f) => f.clock.s >= 55 * 60 && f.clock.phase === 'H2');
  assert.ok(afterFirst, 'no frame past 55:00');
  assert.deepEqual(afterFirst.score, { home: 1, away: 0 });
  const end = frames[frames.length - 1];
  assert.deepEqual(end.score, { home: 1, away: 2 });
});

test('the match clock never runs during halftime', () => {
  const { frames } = runReplay({ dur: 60 });
  for (const f of frames.filter((f) => f.clock.phase === 'HT')) assert.equal(f.clock.running, false);
});

test('final probability favours the winner (Argentina)', () => {
  const { frames } = runReplay();
  const end = frames[frames.length - 1];
  assert.ok(end.prob.away > end.prob.home, `expected away>home, got ${end.prob.away} vs ${end.prob.home}`);
});

test('seeking mid-match does not re-announce kickoff', () => {
  const { events } = runReplay({ startTs: model.progressToTs(0.6) });
  assert.equal(events.filter((e) => e.kind === 'kickoff').length, 0);
});
