// Hermetic tests for bridge/mapping.js — run with `node --test bridge/`.
// No network: everything is asserted against recorded fixtures in __fixtures__/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  statusIdToPhase, phaseLabelToPhase, orientProb, tickToPct, possessionLevelToZone,
  possessionSide, frontFromProb, deriveMomentum, actionToBattleEvent,
  normalizeShotOutcome, scoreFromStats, threatFromPredictors,
} from './mapping.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, '__fixtures__', f), 'utf8'));

test('statusIdToPhase covers the corpus status ids', () => {
  assert.equal(statusIdToPhase(1), 'PRE');
  assert.equal(statusIdToPhase(2), 'H1');
  assert.equal(statusIdToPhase(3), 'HT');
  assert.equal(statusIdToPhase(4), 'H2');
  assert.equal(statusIdToPhase(7), 'ET1');
  assert.equal(statusIdToPhase(9), 'ET2');
  assert.equal(statusIdToPhase(11), 'PENS');
  assert.equal(statusIdToPhase(100), 'FT');
  assert.equal(statusIdToPhase(999), 'PRE');
});

test('phaseLabelToPhase matches recorded phase labels', () => {
  const { timeline } = load('fixture-18241006.json');
  const labels = timeline.phases.map((p) => p.label);
  assert.deepEqual(labels.map(phaseLabelToPhase), ['PRE', 'H1', 'HT', 'H2', 'FT', 'FT']);
});

test('orientProb renormalises to 100 and orients by participant1IsHome', () => {
  const p = orientProb({ part1: 28.4, draw: 46.5, part2: 25.1 }, true);
  assert.ok(Math.abs(p.home + p.draw + p.away - 100) < 1e-9);
  assert.ok(Math.abs(p.home - 28.4) < 0.01);
  // participant1 is away → part1 becomes away
  const q = orientProb({ part1: 28.4, draw: 46.5, part2: 25.1 }, false);
  assert.ok(Math.abs(q.away - 28.4) < 0.01);
  assert.ok(Math.abs(q.home - 25.1) < 0.01);
});

test('tickToPct reads a real raw odds tick', () => {
  const pct = tickToPct({ PriceNames: ['part1', 'draw', 'part2'], Pct: ['27.420', '48.450', '24.131'] });
  assert.ok(Math.abs(pct.part1 - 27.42) < 1e-6);
  assert.ok(Math.abs(pct.draw - 48.45) < 1e-6);
  assert.ok(Math.abs(pct.part2 - 24.131) < 1e-6);
});

test('possessionLevelToZone folds 5 levels into 4 zones', () => {
  assert.equal(possessionLevelToZone('safe'), 'safe');
  assert.equal(possessionLevelToZone('neutral'), 'safe');
  assert.equal(possessionLevelToZone('attack'), 'attack');
  assert.equal(possessionLevelToZone('danger'), 'danger');
  assert.equal(possessionLevelToZone('high'), 'box');
});

test('possessionSide orients participant to side', () => {
  assert.equal(possessionSide(1, true), 'home');
  assert.equal(possessionSide(2, true), 'away');
  assert.equal(possessionSide(1, false), 'away');
  assert.equal(possessionSide(0, true), null);
});

test('frontFromProb clamps and centres', () => {
  assert.ok(Math.abs(frontFromProb({ home: 50, draw: 0, away: 50 }) - 0.5) < 1e-9);
  assert.ok(frontFromProb({ home: 99, draw: 0, away: 1 }) <= 0.935);
  assert.ok(frontFromProb({ home: 1, draw: 0, away: 99 }) >= 0.065);
});

test('deriveMomentum weights danger/high heavier than safe', () => {
  const calm = deriveMomentum([{ side: 'home', level: 'safe' }, { side: 'home', level: 'safe' }]);
  const storm = deriveMomentum([{ side: 'home', level: 'high' }, { side: 'home', level: 'danger' }]);
  assert.ok(storm.home > calm.home);
  assert.ok(calm.away === 0.3); // no away samples → default floor
});

test('actionToBattleEvent maps real goal + card + corner events', () => {
  const { timeline } = load('fixture-18241006.json');
  const ctx = { participant1IsHome: true, probJump: { from: 28.4, to: 69.7 }, score: { home: 1, away: 0 } };
  const goal = timeline.events.find((e) => e.action === 'goal');
  const be = actionToBattleEvent(goal, ctx);
  assert.equal(be.kind, 'goal');
  assert.equal(be.side, 'home'); // England participant 1, home
  assert.equal(be.minute, 54);
  assert.equal(be.probJump.to, 69.7);

  const yellow = timeline.events.find((e) => e.action === 'yellow_card');
  assert.equal(actionToBattleEvent(yellow, ctx).kind, 'card');
  assert.equal(actionToBattleEvent(yellow, ctx).color, 'yellow');

  const corner = timeline.events.find((e) => e.action === 'corner');
  assert.equal(actionToBattleEvent(corner, ctx).kind, 'corner');

  // an away goal orients to away
  const g2 = timeline.events.filter((e) => e.action === 'goal')[1];
  assert.equal(actionToBattleEvent(g2, ctx).side, 'away');
});

test('actionToBattleEvent returns null for non-battlefield actions', () => {
  assert.equal(actionToBattleEvent({ action: 'throw_in', participant: 1 }, {}), null);
  assert.equal(actionToBattleEvent({ action: 'free_kick', participant: 2 }, {}), null);
});

test('normalizeShotOutcome classifies detail strings', () => {
  assert.equal(normalizeShotOutcome('OnTarget'), 'OnTarget');
  assert.equal(normalizeShotOutcome('Woodwork'), 'Woodwork');
  assert.equal(normalizeShotOutcome('Blocked'), 'Blocked');
  assert.equal(normalizeShotOutcome('OffTarget'), 'OffTarget');
});

test('scoreFromStats reads goals from the real 64-key stats map', () => {
  const st = load('state-620.json');
  const score = scoreFromStats(st.raw.Stats, st.raw.Participant1IsHome);
  // seq 620 is after England's 54' goal → 1-0
  assert.deepEqual(score, { home: 1, away: 0 });
});

test('threatFromPredictors reads PossibleEvent predictors', () => {
  const raw = {
    Parti1State: { PossibleEvent: { Goal: true } },
    Parti2State: { PossibleEvent: { Corner: true } },
    PossibleEvent: { VAR: true },
  };
  const t = threatFromPredictors(raw, true);
  assert.equal(t.home.goal, true);
  assert.equal(t.away.corner, true);
  assert.equal(t.neutral.var, true);
});
