// rooms/server.js — Battlefield friend-rooms sidecar (C10).
// A tiny in-memory WebSocket relay: no DB, no auth, no persistence. Rooms are keyed
// by a short code (+ the fixtureId they were created for). Each connected member
// broadcasts their side pick + running points/streak; the server fans the full
// sorted roster back to everyone in the room, so a late joiner gets the whole board.
// The room state itself lives in the hermetically-tested room-store module.
//
// Run: `npm run rooms` (→ :4490). Vite proxies /rooms → here so the page is same-origin.
import http from 'node:http';
import WS from 'ws';
import { createStore, join, update, leave, roster } from './room-store.js';

const WebSocketServer = WS.Server;
const OPEN = WS.OPEN;
const PORT = process.env.ROOMS_PORT ? Number(process.env.ROOMS_PORT) : 4490;

const store = createStore();

const server = http.createServer((req, res) => {
  // health probe (the client hits this to decide online vs degrade-to-solo)
  const path = (req.url || '').replace(/^\/rooms/, '') || '/';
  if (path.startsWith('/health')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: store.size }));
    return;
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, path: '/rooms' });

function fixtureOf(code) { const r = store.get(String(code || '').toUpperCase().slice(0, 8)); return r ? r.fixtureId : null; }
function broadcast(code) {
  const payload = JSON.stringify({ type: 'roster', room: code, fixtureId: fixtureOf(code), members: roster(store, code) });
  for (const c of wss.clients) if (c._room === code && c.readyState === OPEN) { try { c.send(payload); } catch {} }
}

wss.on('connection', (ws) => {
  ws._room = null; ws._id = null;
  ws.on('message', (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch { return; }
    if (msg.type === 'join') {
      const code = String(msg.room || '').toUpperCase().slice(0, 8);
      if (!code || msg.id == null) return;
      ws._room = code; ws._id = String(msg.id);
      join(store, code, msg, msg.fixtureId ?? null);
      broadcast(code); // late joiner + everyone receive the full current roster
    } else if (msg.type === 'update' && ws._room) {
      if (update(store, ws._room, ws._id, msg)) broadcast(ws._room);
    }
  });
  ws.on('close', () => {
    if (ws._room) { const r = leave(store, ws._room, ws._id); if (r) broadcast(ws._room); }
  });
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log(`[rooms] listening on :${PORT} (ws path /rooms)`));
