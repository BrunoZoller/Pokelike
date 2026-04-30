// anticheat.js — client-side API wrapper for the anti-cheat verification server.
// All functions return null on network failure so the game degrades gracefully.

const ANTICHEAT_SERVER = 'https://ac.pokelike.xyz';

function _acHeaders() {
  const uuid = localStorage.getItem('poke_save_uuid');
  const headers = { 'Content-Type': 'application/json' };
  if (uuid) headers['Authorization'] = 'Bearer ' + uuid;
  return headers;
}

// Strips Pokemon objects down to only what the server needs for replay,
// avoiding sending unnecessary UI data (spriteUrls, etc.).
function _acSanitizeTeam(team) {
  if (!Array.isArray(team)) return [];
  return team.map(p => ({
    speciesId: p.speciesId,
    name: p.name,
    level: p.level,
    types: p.types,
    baseStats: p.baseStats,
    heldItem: p.heldItem ? { id: p.heldItem.id } : null,
    currentHp: p.currentHp,
    maxHp: p.maxHp,
    statBuffs: p.statBuffs || {},
    moveTier: p.moveTier ?? 1,
    isShiny: !!p.isShiny,
  }));
}

// Called at the start of a new run. Returns a signed run token string, or null.
async function acStartRun(seed, mode) {
  try {
    const res = await fetch(`${ANTICHEAT_SERVER}/run/start`, {
      method: 'POST',
      headers: _acHeaders(),
      body: JSON.stringify({ seed: seed >>> 0, mode }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.runToken || null;
  } catch { return null; }
}

// Called after each gym badge is earned. Returns a signed checkpoint token string, or null.
// gymIdx: 0–7 for gyms. prevCheckpoints: array of previously returned checkpoint token strings.
async function acCheckpoint(runToken, prevCheckpoints, gymIdx, rngSeedAtStart, playerTeam) {
  if (!runToken) return null;
  try {
    const res = await fetch(`${ANTICHEAT_SERVER}/run/checkpoint`, {
      method: 'POST',
      headers: _acHeaders(),
      body: JSON.stringify({
        runToken,
        prevCheckpoints: prevCheckpoints || [],
        gymIdx,
        rngSeedAtStart: rngSeedAtStart >>> 0,
        playerTeam: _acSanitizeTeam(playerTeam),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.checkpointToken || null;
  } catch { return null; }
}

// Called when the player wins (after defeating the Champion).
// Returns server response with { eliteWins, winStreak, newAchievements, verified } or null.
async function acCompleteRun(runToken, checkpoints, summary) {
  if (!runToken) return null;
  try {
    const res = await fetch(`${ANTICHEAT_SERVER}/run/complete`, {
      method: 'POST',
      headers: _acHeaders(),
      body: JSON.stringify({
        runToken,
        checkpoints: checkpoints || [],
        summary: {
          nuzlockeMode: summary.nuzlockeMode,
          usedPokecenter: summary.usedPokecenter,
          pickedUpItem: summary.pickedUpItem,
          maxTeamSize: summary.maxTeamSize,
          starterSpeciesId: summary.starterSpeciesId,
          championRngSeed: summary.championRngSeed >>> 0,
          finalTeam: _acSanitizeTeam(summary.finalTeam),
        },
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Fetches the player's server-verified records (hall of fame, achievements, wins).
async function acGetRecords() {
  try {
    const res = await fetch(`${ANTICHEAT_SERVER}/player/records`, {
      headers: _acHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
