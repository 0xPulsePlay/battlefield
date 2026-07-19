// Hermetic tests for the friend-rooms store (no ws, no http, no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, join, update, leave, roster } from './room-store.js';

test('join adds a member and returns the roster', () => {
  const s = createStore();
  const r = join(s, 'abcd', { id: 'a', name: 'ALICE', side: 'home' }, 18241006);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'a');
  assert.equal(r[0].name, 'ALICE');
  assert.equal(s.get('ABCD').fixtureId, 18241006); // code is upper-cased
});

test('a late joiner sees the full roster', () => {
  const s = createStore();
  join(s, 'RM01', { id: 'a', pts: 5 });
  join(s, 'RM01', { id: 'b', pts: 9 });
  const late = join(s, 'RM01', { id: 'c', pts: 0 });
  assert.deepEqual(late.map((m) => m.id).sort(), ['a', 'b', 'c']);
});

test('roster sorts by points desc then streak desc', () => {
  const s = createStore();
  join(s, 'RM02', { id: 'a', pts: 10, streak: 1 });
  join(s, 'RM02', { id: 'b', pts: 30, streak: 0 });
  join(s, 'RM02', { id: 'c', pts: 30, streak: 4 });
  const r = roster(s, 'RM02');
  assert.deepEqual(r.map((m) => m.id), ['c', 'b', 'a']); // 30/streak4, 30/streak0, 10
});

test('update patches only provided fields and re-sorts', () => {
  const s = createStore();
  join(s, 'RM03', { id: 'a', pts: 0 });
  join(s, 'RM03', { id: 'b', pts: 5 });
  const r = update(s, 'RM03', 'a', { pts: 25, streak: 2 });
  assert.equal(r[0].id, 'a');
  assert.equal(r[0].pts, 25);
  assert.equal(r[0].streak, 2);
  assert.equal(update(s, 'RM03', 'ghost', { pts: 1 }), null); // unknown member
});

test('leave removes a member and drops the empty room', () => {
  const s = createStore();
  join(s, 'RM04', { id: 'a' });
  join(s, 'RM04', { id: 'b' });
  const after = leave(s, 'RM04', 'a');
  assert.deepEqual(after.map((m) => m.id), ['b']);
  assert.equal(leave(s, 'RM04', 'b'), null); // now empty
  assert.equal(s.has('RM04'), false);
});

test('malformed joins are ignored', () => {
  const s = createStore();
  assert.equal(join(s, '', { id: 'a' }), null);
  assert.equal(join(s, 'RM05', { name: 'x' }), null); // no id
  assert.equal(s.size, 0);
});
