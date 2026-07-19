// rooms/room-store.js — pure in-memory room state (no ws, no http, no time), so the
// roster/join/update/leave logic is hermetically unit-testable. server.js wires the
// WebSocket transport around this.

export function createStore() { return new Map(); } // code -> { fixtureId, members: Map<id, member> }

// Add/replace a member and return the room's sorted roster.
export function join(store, code, member, fixtureId = null) {
  code = String(code || '').toUpperCase().slice(0, 8);
  if (!code || !member || member.id == null) return null;
  let room = store.get(code);
  if (!room) { room = { fixtureId, members: new Map() }; store.set(code, room); }
  const id = String(member.id);
  room.members.set(id, {
    id, name: String(member.name || 'guest').slice(0, 20), side: member.side || null,
    pts: member.pts | 0, streak: member.streak | 0, correct: member.correct | 0, made: member.made | 0,
  });
  return roster(store, code);
}

// Patch an existing member's fields; returns the sorted roster (or null if absent).
export function update(store, code, id, patch) {
  const room = store.get(String(code || '').toUpperCase().slice(0, 8));
  if (!room) return null;
  const m = room.members.get(String(id));
  if (!m) return null;
  if (patch.name !== undefined) m.name = String(patch.name || 'guest').slice(0, 20);
  if (patch.side !== undefined) m.side = patch.side;
  if (patch.pts !== undefined) m.pts = patch.pts | 0;
  if (patch.streak !== undefined) m.streak = patch.streak | 0;
  if (patch.correct !== undefined) m.correct = patch.correct | 0;
  if (patch.made !== undefined) m.made = patch.made | 0;
  return roster(store, code);
}

// Remove a member; drops the room when empty. Returns the roster, or null if the room is gone.
export function leave(store, code, id) {
  code = String(code || '').toUpperCase().slice(0, 8);
  const room = store.get(code);
  if (!room) return null;
  room.members.delete(String(id));
  if (room.members.size === 0) { store.delete(code); return null; }
  return roster(store, code);
}

// Leaderboard: members sorted by points desc, then streak desc.
export function roster(store, code) {
  const room = store.get(String(code || '').toUpperCase().slice(0, 8));
  if (!room) return [];
  return [...room.members.values()].sort((a, b) => (b.pts - a.pts) || (b.streak - a.streak));
}
