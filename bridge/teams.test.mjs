import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamPalette, flagSvg, engineTeam, NATIONS } from './teams.js';

test('NATIONS has the full corpus set', () => {
  assert.equal(NATIONS.length, 64);
  assert.ok(NATIONS.includes('England') && NATIONS.includes('Argentina'));
  assert.equal(new Set(NATIONS).size, NATIONS.length); // no dupes
});

test('teamPalette returns a full palette for known and unknown nations', () => {
  const fields = ['name', 'main', 'deep', 'accent', 'tint', 'tracer', 'pattern', 'kit2'];
  for (const n of ['England', 'Brazil', 'Totally Made Up FC']) {
    const p = teamPalette(n);
    for (const f of fields) assert.ok(p[f] != null, `${n} missing ${f}`);
    assert.equal(p.name, n.toUpperCase());
  }
  assert.equal(teamPalette('England').accent, '#d3273e');
});

test('teamPalette is deterministic for fallback names', () => {
  assert.deepEqual(teamPalette('Zzz Land'), teamPalette('Zzz Land'));
});

test('flagSvg returns a clean self-contained SVG for every nation', () => {
  for (const n of NATIONS) {
    const svg = flagSvg(n);
    assert.ok(svg.startsWith('<svg'), `${n} not an svg`);
    assert.ok(!svg.includes('undefined'), `${n} has undefined`);
    assert.ok(!svg.includes('http://') || svg.includes('www.w3.org'), `${n} external ref`);
    assert.ok(!svg.includes('<image'), `${n} uses <image>`);
  }
});

test('flagSvg honours w/h', () => {
  const svg = flagSvg('Brazil', { w: 48, h: 32 });
  assert.ok(svg.includes('width="48"') && svg.includes('height="32"'));
});

test('engineTeam shape works for the renderer', () => {
  const t = engineTeam('Croatia');
  assert.equal(t.name, 'CROATIA');
  assert.ok(t.main.startsWith('#') || t.main.startsWith('hsl'));
});
