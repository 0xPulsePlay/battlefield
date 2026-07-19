// bridge/teams.js — pure data: national-team army palettes (fed to engine.js
// opts.teams) and self-contained SVG flag strings (for the fixture picker).
// No imports, no DOM, no network; deterministic; runs in browser and Node.

export const NATIONS = [
  'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Belgium',
  'Bosnia & Herzegovina', 'Brazil', 'Canada', 'Cape Verde', 'Chile', 'Colombia', 'Congo DR',
  'Costa Rica', 'Croatia', 'Curacao', 'Czech Republic', 'Ecuador', 'Egypt', 'England', 'France',
  'Germany', 'Ghana', 'Gibraltar', 'Haiti', 'Hungary', 'India', 'Iran', 'Iraq', 'Ivory Coast',
  'Japan', 'Jordan', 'Kazakhstan', 'Kyrgyzstan', 'Liechtenstein', 'Mexico', 'Moldova', 'Morocco',
  'Myanmar', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Palestine', 'Panama', 'Paraguay',
  'Portugal', 'Qatar', 'San Marino', 'Saudi Arabia', 'Scotland', 'Senegal', 'South Africa',
  'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Tunisia', 'Turkey', 'USA', 'Uruguay',
  'Uzbekistan', 'Vietnam',
].sort();

// hand-tuned army palettes for the prominent teams
const PALETTES = {
  England:     { main: '#f4f6f8', deep: '#22355c', accent: '#d3273e', tint: '#8fa3c4', tracer: '#f0e0c0', pattern: 'cross',   kit2: '#d3273e' },
  Argentina:   { main: '#ffffff', deep: '#4f92cf', accent: '#f2b705', tint: '#7ab5e8', tracer: '#ffe9a8', pattern: 'stripes', kit2: '#86c5f4' },
  Brazil:      { main: '#f7d716', deep: '#0a7d3b', accent: '#1c3f9c', tint: '#7fce9a', tracer: '#fff0a8', pattern: 'plain',   kit2: '#0a7d3b' },
  France:      { main: '#f4f6f8', deep: '#1f3b8c', accent: '#e0273a', tint: '#8aa0d8', tracer: '#f0e0c0', pattern: 'stripes', kit2: '#1f3b8c' },
  Germany:     { main: '#f4f6f8', deep: '#151515', accent: '#d3273e', tint: '#9a9a9a', tracer: '#f2c94c', pattern: 'stripes', kit2: '#1a1a1a' },
  Spain:       { main: '#c8102e', deep: '#7a0c1e', accent: '#f2b705', tint: '#e08a97', tracer: '#ffe08a', pattern: 'plain',   kit2: '#1c2c66' },
  Portugal:    { main: '#c8102e', deep: '#0a6640', accent: '#f2b705', tint: '#e28a97', tracer: '#ffe08a', pattern: 'sash',    kit2: '#0a6640' },
  Netherlands: { main: '#e8632a', deep: '#1c2c66', accent: '#f4f6f8', tint: '#f0a97e', tracer: '#ffd6a8', pattern: 'plain',   kit2: '#1c2c66' },
  Belgium:     { main: '#151515', deep: '#7a0c1e', accent: '#f2c94c', tint: '#9a9a9a', tracer: '#ffe08a', pattern: 'stripes', kit2: '#c8102e' },
  Croatia:     { main: '#f4f6f8', deep: '#1c2c66', accent: '#d3273e', tint: '#9aa8c4', tracer: '#f0e0c0', pattern: 'hoops',   kit2: '#d3273e' },
  Italy:       { main: '#2a7de0', deep: '#12356b', accent: '#f4f6f8', tint: '#8ab6ea', tracer: '#e0edff', pattern: 'plain',   kit2: '#12356b' },
  Uruguay:     { main: '#5aa0dc', deep: '#151515', accent: '#f2b705', tint: '#a8cdec', tracer: '#ffe9a8', pattern: 'plain',   kit2: '#151515' },
  Colombia:    { main: '#f7d716', deep: '#0e3a8c', accent: '#d3273e', tint: '#f5e58a', tracer: '#fff0a8', pattern: 'plain',   kit2: '#0e3a8c' },
  Mexico:      { main: '#0a7d3b', deep: '#7a0c1e', accent: '#f4f6f8', tint: '#7fce9a', tracer: '#e0f0e6', pattern: 'plain',   kit2: '#0a7d3b' },
  USA:         { main: '#f4f6f8', deep: '#0a1f5c', accent: '#c8102e', tint: '#8a9ad0', tracer: '#f0e0c0', pattern: 'stripes', kit2: '#0a1f5c' },
  Japan:       { main: '#f4f6f8', deep: '#12356b', accent: '#d3273e', tint: '#8aa0d0', tracer: '#f0e0c0', pattern: 'plain',   kit2: '#12356b' },
  'South Korea': { main: '#f4f6f8', deep: '#1c3fa0', accent: '#d3273e', tint: '#9ab0e0', tracer: '#f0e0c0', pattern: 'plain', kit2: '#c8102e' },
  Morocco:     { main: '#b81c2e', deep: '#0a5a34', accent: '#0a7d3b', tint: '#dd8a95', tracer: '#e0f0e0', pattern: 'plain',   kit2: '#0a5a34' },
  Senegal:     { main: '#0a7d3b', deep: '#7a0c1e', accent: '#f7d716', tint: '#7fce9a', tracer: '#fff0a8', pattern: 'plain',   kit2: '#f7d716' },
  Nigeria:     { main: '#0a7d3b', deep: '#065426', accent: '#f4f6f8', tint: '#7fce9a', tracer: '#e0f0e6', pattern: 'stripes', kit2: '#065426' },
  Switzerland: { main: '#d3273e', deep: '#7a0c1e', accent: '#f4f6f8', tint: '#e28a97', tracer: '#f5d6d6', pattern: 'cross',   kit2: '#7a0c1e' },
  Sweden:      { main: '#2a6ddc', deep: '#12356b', accent: '#f2c94c', tint: '#8ab0ea', tracer: '#ffe9a8', pattern: 'cross',   kit2: '#f2c94c' },
  Norway:      { main: '#d3273e', deep: '#12356b', accent: '#f4f6f8', tint: '#e28a97', tracer: '#f0e0c0', pattern: 'cross',   kit2: '#12356b' },
  Austria:     { main: '#d3273e', deep: '#7a0c1e', accent: '#f4f6f8', tint: '#e28a97', tracer: '#f5d6d6', pattern: 'stripes', kit2: '#f4f6f8' },
  Ecuador:     { main: '#f7d716', deep: '#0e3a8c', accent: '#d3273e', tint: '#f5e58a', tracer: '#fff0a8', pattern: 'plain',   kit2: '#0e3a8c' },
  Ghana:       { main: '#d3273e', deep: '#0a7d3b', accent: '#f7d716', tint: '#e28a97', tracer: '#fff0a8', pattern: 'plain',   kit2: '#151515' },
  Australia:   { main: '#f2c94c', deep: '#0a5a34', accent: '#0a7d3b', tint: '#f5e58a', tracer: '#fff0a8', pattern: 'plain',   kit2: '#0a5a34' },
  Canada:      { main: '#d3273e', deep: '#7a0c1e', accent: '#f4f6f8', tint: '#e28a97', tracer: '#f5d6d6', pattern: 'plain',   kit2: '#f4f6f8' },
  Qatar:       { main: '#7a1533', deep: '#4a0d20', accent: '#f4f6f8', tint: '#c48a99', tracer: '#f0d6dd', pattern: 'plain',   kit2: '#f4f6f8' },
  Iran:        { main: '#f4f6f8', deep: '#0a7d3b', accent: '#d3273e', tint: '#9ac4a8', tracer: '#e0f0e0', pattern: 'plain',   kit2: '#0a7d3b' },
  'Saudi Arabia': { main: '#0a7d3b', deep: '#065426', accent: '#f4f6f8', tint: '#7fce9a', tracer: '#e0f0e6', pattern: 'plain', kit2: '#f4f6f8' },
  Scotland:    { main: '#1c3fa0', deep: '#12275c', accent: '#f4f6f8', tint: '#8ab0ea', tracer: '#e0edff', pattern: 'plain',   kit2: '#f4f6f8' },
  // fictional teams for the SANDBOX battle (clearly not real nations)
  Astoria:     { main: '#e0483c', deep: '#7a1420', accent: '#f2c94c', tint: '#f0958c', tracer: '#ffd6a8', pattern: 'stripes', kit2: '#7a1420' },
  Verdania:    { main: '#2fa15a', deep: '#0d5a30', accent: '#f4f6f8', tint: '#8fd6a8', tracer: '#e0f0e6', pattern: 'plain',   kit2: '#0d5a30' },
};

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hsl(h, s, l) { return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`; }

// deterministic fallback palette from the name
function generatedPalette(name) {
  const h = hashStr(name);
  const hue = h % 360, hue2 = (hue + 150) % 360;
  return {
    main: hsl(hue, 62, 55), deep: hsl(hue, 55, 26), accent: hsl(hue2, 72, 55),
    tint: hsl(hue, 40, 72), tracer: hsl((hue2 + 20) % 360, 80, 78),
    pattern: (h & 1) ? 'stripes' : 'plain', kit2: hsl(hue2, 55, 40),
  };
}

export function teamPalette(nationName) {
  const base = PALETTES[nationName] || generatedPalette(nationName || '');
  return { name: String(nationName || '???').toUpperCase(), ...base };
}

// ── flags ──────────────────────────────────────────────────────────────────
const R = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const C = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
// inner content builders (viewBox 0 0 24 16)
const FLAGS = {
  England: () => R(0, 0, 24, 16, '#fff') + R(10, 0, 4, 16, '#d3273e') + R(0, 6, 24, 4, '#d3273e'),
  Argentina: () => R(0, 0, 24, 16, '#75aadb') + R(0, 5.33, 24, 5.33, '#fff') + C(12, 8, 1.6, '#f6b40e'),
  Brazil: () => R(0, 0, 24, 16, '#0a7d3b') + `<polygon points="12,2 22,8 12,14 2,8" fill="#f7d716"/>` + C(12, 8, 2.6, '#1c3f9c'),
  France: () => R(0, 0, 8, 16, '#1f3b8c') + R(8, 0, 8, 16, '#fff') + R(16, 0, 8, 16, '#e0273a'),
  Germany: () => R(0, 0, 24, 5.33, '#151515') + R(0, 5.33, 24, 5.33, '#d3273e') + R(0, 10.66, 24, 5.33, '#f2c94c'),
  Spain: () => R(0, 0, 24, 4, '#c8102e') + R(0, 4, 24, 8, '#f2b705') + R(0, 12, 24, 4, '#c8102e'),
  Portugal: () => R(0, 0, 9, 16, '#0a6640') + R(9, 0, 15, 16, '#c8102e') + C(9, 8, 2, '#f2b705'),
  Netherlands: () => R(0, 0, 24, 5.33, '#c8102e') + R(0, 5.33, 24, 5.33, '#fff') + R(0, 10.66, 24, 5.33, '#1c2c66'),
  Belgium: () => R(0, 0, 8, 16, '#151515') + R(8, 0, 8, 16, '#f2c94c') + R(16, 0, 8, 16, '#c8102e'),
  Croatia: () => R(0, 0, 24, 5.33, '#d3273e') + R(0, 5.33, 24, 5.33, '#fff') + R(0, 10.66, 24, 5.33, '#1c2c66') + R(10.5, 5.5, 3, 3, '#d3273e'),
  Italy: () => R(0, 0, 8, 16, '#0a7d3b') + R(8, 0, 8, 16, '#fff') + R(16, 0, 8, 16, '#d3273e'),
  Uruguay: () => R(0, 0, 24, 16, '#fff') + R(0, 1.8, 24, 1.8, '#5aa0dc') + R(0, 5.4, 24, 1.8, '#5aa0dc') + R(0, 9, 24, 1.8, '#5aa0dc') + R(0, 12.6, 24, 1.8, '#5aa0dc') + R(0, 0, 9, 9, '#fff') + C(4.5, 4.5, 1.6, '#f6b40e'),
  Colombia: () => R(0, 0, 24, 8, '#f7d716') + R(0, 8, 24, 4, '#0e3a8c') + R(0, 12, 24, 4, '#c8102e'),
  Mexico: () => R(0, 0, 8, 16, '#0a7d3b') + R(8, 0, 8, 16, '#fff') + R(16, 0, 8, 16, '#c8102e') + C(12, 8, 1.3, '#7a5a2a'),
  USA: () => R(0, 0, 24, 16, '#b31942') + R(0, 1.2, 24, 1.2, '#fff') + R(0, 3.6, 24, 1.2, '#fff') + R(0, 6, 24, 1.2, '#fff') + R(0, 8.4, 24, 1.2, '#fff') + R(0, 10.8, 24, 1.2, '#fff') + R(0, 13.2, 24, 1.2, '#fff') + R(0, 0, 10, 8.4, '#0a1f5c'),
  Japan: () => R(0, 0, 24, 16, '#fff') + C(12, 8, 4.2, '#bc002d'),
  'South Korea': () => R(0, 0, 24, 16, '#fff') + `<path d="M12 4.5a3.5 3.5 0 0 1 0 7 3.5 3.5 0 0 0 0-7z" fill="#cd2e3a"/>` + `<path d="M12 4.5a3.5 3.5 0 0 0 0 7 3.5 3.5 0 0 1 0-7z" fill="#0047a0"/>`,
  Morocco: () => R(0, 0, 24, 16, '#c1272d') + `<polygon points="12,5 13,8 16,8 13.5,10 14.5,13 12,11 9.5,13 10.5,10 8,8 11,8" fill="none" stroke="#0a7d3b" stroke-width="0.7"/>`,
  Switzerland: () => R(0, 0, 24, 16, '#d3273e') + R(10.5, 4, 3, 8, '#fff') + R(8, 6.5, 8, 3, '#fff'),
  Sweden: () => R(0, 0, 24, 16, '#2a6ddc') + R(7, 0, 3, 16, '#f2c94c') + R(0, 6.5, 24, 3, '#f2c94c'),
  Norway: () => R(0, 0, 24, 16, '#d3273e') + R(6.5, 0, 4, 16, '#fff') + R(0, 6, 24, 4, '#fff') + R(7.5, 0, 2, 16, '#12356b') + R(0, 7, 24, 2, '#12356b'),
  Denmark: () => R(0, 0, 24, 16, '#d3273e') + R(7, 0, 3, 16, '#fff') + R(0, 6.5, 24, 3, '#fff'),
  Australia: () => R(0, 0, 24, 16, '#0a1f5c') + R(0, 0, 10, 8, '#12275c') + `<path d="M3 1.5l.6 1.8H5.5l-1.5 1.1.6 1.8-1.6-1.1-1.6 1.1.6-1.8L.5 3.3h1.9z" fill="#fff"/>` + C(18, 10, 1.4, '#fff'),
  Canada: () => R(0, 0, 6, 16, '#d3273e') + R(6, 0, 12, 16, '#fff') + R(18, 0, 6, 16, '#d3273e') + `<polygon points="12,4 12.7,6 14.5,5.6 13.3,7.4 15,8 13.3,8.6 14.5,10.4 12.7,10 12,12 11.3,10 9.5,10.4 10.7,8.6 9,8 10.7,7.4 9.5,5.6 11.3,6" fill="#d3273e"/>`,
  Scotland: () => R(0, 0, 24, 16, '#0065bd') + `<path d="M0 0L24 16M24 0L0 16" stroke="#fff" stroke-width="2.4"/>`,
  Nigeria: () => R(0, 0, 8, 16, '#0a7d3b') + R(8, 0, 8, 16, '#fff') + R(16, 0, 8, 16, '#0a7d3b'),
  Ghana: () => R(0, 0, 24, 5.33, '#d3273e') + R(0, 5.33, 24, 5.33, '#f7d716') + R(0, 10.66, 24, 5.33, '#0a7d3b') + `<polygon points="12,6.5 12.5,8 14,8 12.8,9 13.3,10.5 12,9.6 10.7,10.5 11.2,9 10,8 11.5,8" fill="#151515"/>`,
  Senegal: () => R(0, 0, 8, 16, '#0a7d3b') + R(8, 0, 8, 16, '#f7d716') + R(16, 0, 8, 16, '#d3273e') + `<polygon points="12,6 12.5,7.5 14,7.5 12.8,8.5 13.3,10 12,9.1 10.7,10 11.2,8.5 10,7.5 11.5,7.5" fill="#0a7d3b"/>`,
  Ecuador: () => R(0, 0, 24, 8, '#f7d716') + R(0, 8, 24, 4, '#0e3a8c') + R(0, 12, 24, 4, '#c8102e'),
  Iran: () => R(0, 0, 24, 5.33, '#0a7d3b') + R(0, 5.33, 24, 5.33, '#fff') + R(0, 10.66, 24, 5.33, '#d3273e'),
  'Saudi Arabia': () => R(0, 0, 24, 16, '#0a7d3b') + R(4, 9, 16, 1.4, '#fff'),
  Qatar: () => R(0, 0, 24, 16, '#7a1533') + R(0, 0, 7, 16, '#fff'),
};

// generated 3-stripe fallback from the palette
function generatedFlag(name) {
  const p = teamPalette(name);
  return R(0, 0, 24, 16, p.deep) + R(0, 0, 24, 5.33, p.main) + R(0, 10.66, 24, 5.33, p.accent);
}

export function flagSvg(nationName, opts = {}) {
  const w = opts.w ?? 24, h = opts.h ?? 16;
  const inner = (FLAGS[nationName] || (() => generatedFlag(nationName)))();
  const id = 'fc' + (hashStr(nationName || '') % 100000);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 16" role="img" aria-label="${String(nationName || '').replace(/[<>&"]/g, '')}">`
    + `<defs><clipPath id="${id}"><rect x="0" y="0" width="24" height="16" rx="2.2"/></clipPath></defs>`
    + `<g clip-path="url(#${id})">${inner}</g>`
    + `<rect x="0.4" y="0.4" width="23.2" height="15.2" rx="2" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="0.7"/></svg>`;
}

// full engine team object (palette + display name) for a fixture side
export function engineTeam(nationName) {
  const p = teamPalette(nationName);
  return { ...p, name: String(nationName || '???').toUpperCase() };
}
