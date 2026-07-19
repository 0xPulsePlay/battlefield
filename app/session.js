// app/session.js — one entry point the HUD calls to open a fixture. Unifies the
// synthetic driver (offline/demo fallback), the real replay driver, and the live
// SSE driver behind a single { driver, model, ident, engineTeams } result so
// index.html never branches on data source. Team palette + display names come
// from the fixture, so the whole diorama re-skins per match.

import { RealMatchDriver } from '../bridge/real-driver.js';
import { loadReplayModel } from '../bridge/replay-source.js';
import { engineTeam, flagSvg } from '../bridge/teams.js';
import { MatchDriver } from '../driver.js';
import { makeClient } from './data.js';

// same-origin by default: Vite proxies /v1 → the engine (see vite.config.js),
// so fetches are '/v1/...' with no CORS. Override with ?api= for a raw origin.
export const DEFAULT_BASE_URL = '';
export const DEFAULT_FIXTURE = 18241006; // England–Argentina

// identity block the HUD binds to (labels, names, flags)
function identOf(teams, competition, mode) {
  return {
    homeAbbr: teams.home.abbr, awayAbbr: teams.away.abbr,
    homeName: teams.home.name.toUpperCase(), awayName: teams.away.name.toUpperCase(),
    homeNation: teams.home.name, awayNation: teams.away.name,
    homeFlag: flagSvg(teams.home.name), awayFlag: flagSvg(teams.away.name),
    competition: competition || 'FRIENDLY',
    mode,
  };
}

// synthetic identity (the hardcoded ENG–ARG arc)
const SYN_TEAMS = {
  home: { name: 'England', abbr: 'ENG' },
  away: { name: 'Argentina', abbr: 'ARG' },
  participant1IsHome: true,
};

// SANDBOX identity — two fictional teams so nobody mistakes it for a real match.
// The War Room lives here (real fixtures take events only from the data).
const SANDBOX_TEAMS = {
  home: { name: 'Astoria', abbr: 'AST' },
  away: { name: 'Verdania', abbr: 'VRD' },
  participant1IsHome: true,
};

// Loads everything for a fixture and returns a `createDriver(onFrame,onEvent)`
// thunk so the caller can build the engine FIRST, then start the driver — no
// frame lands on a half-swapped engine during a fixture switch.
export async function openSession({ mode = 'replay', fixtureId = DEFAULT_FIXTURE, baseUrl = DEFAULT_BASE_URL, client, replayDurationSec, startTs }) {
  if (mode === 'synthetic') {
    return {
      model: null,
      ident: identOf(SYN_TEAMS, 'WORLD CUP · SEMIFINAL', 'synthetic'),
      engineTeams: { home: engineTeam('England'), away: engineTeam('Argentina') },
      names: { home: 'ENGLAND', away: 'ARGENTINA' },
      fixtureMeta: { fixtureId: DEFAULT_FIXTURE, status: 'played', competition: 'WORLD CUP', synthetic: true },
      createDriver: (onFrame, onEvent) => new MatchDriver({ onFrame, onEvent }),
    };
  }

  if (mode === 'sandbox') {
    return {
      model: null,
      ident: identOf(SANDBOX_TEAMS, 'SANDBOX ARENA', 'sandbox'),
      engineTeams: { home: engineTeam('Astoria'), away: engineTeam('Verdania') },
      names: { home: 'ASTORIA', away: 'VERDANIA' },
      fixtureMeta: { fixtureId: null, status: 'sandbox', competition: 'SANDBOX ARENA', sandbox: true },
      createDriver: (onFrame, onEvent) => new MatchDriver({ onFrame, onEvent }),
    };
  }

  // one SDK client for this session: model load + the live SSE stream both use it.
  const dataClient = client || makeClient(baseUrl);
  const model = await loadReplayModel(dataClient, fixtureId);
  const teams = model.teams;
  return {
    model,
    ident: identOf(teams, model.competition, mode),
    engineTeams: { home: engineTeam(teams.home.name), away: engineTeam(teams.away.name) },
    names: { home: teams.home.name.toUpperCase(), away: teams.away.name.toUpperCase() },
    fixtureMeta: {
      fixtureId: model.fixtureId, status: model.status, startTime: model.startTime,
      finalScore: model.finalScore, winner: model.winner, competition: model.competition,
    },
    createDriver: (onFrame, onEvent) =>
      new RealMatchDriver({ onFrame, onEvent, model, mode, baseUrl, fixtureId, replayDurationSec, startTs, client: dataClient }),
  };
}
