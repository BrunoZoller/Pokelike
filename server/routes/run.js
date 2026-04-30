const express = require('express');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { replayBattle } = require('../engine/battle');
const { GYM_LEADERS, ELITE_4, createInstance } = require('../engine/data');

const JWT_SECRET = process.env.ANTICHEAT_SECRET || 'change-me-in-production';
// Minimum seconds expected between run start and a given gym checkpoint (sanity check).
const MIN_SECONDS_PER_GYM = 60;
// Minimum total run time before a win is accepted.
const MIN_RUN_SECONDS = 20 * 60;

function signToken(payload, expiresIn = '4h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}
function newUuid() { return crypto.randomUUID(); }

// Build the server's authoritative enemy team for a battle slot.
// gymIdx 0–7 = gym leaders, 8–12 = Elite 4 (0=Lorelei … 4=Champion).
function getEnemyTeam(gymIdx) {
  if (gymIdx >= 0 && gymIdx <= 7) {
    const leader = GYM_LEADERS[gymIdx];
    return leader.team.map(p => createInstance(p, p.level, leader.moveTier ?? 1));
  }
  if (gymIdx >= 8 && gymIdx <= 12) {
    const boss = ELITE_4[gymIdx - 8];
    return boss.team.map(p => createInstance(p, p.level, 2));
  }
  return null;
}

module.exports = (db) => {
  const router = express.Router();
  router.use(requireAuth(db));

  // POST /run/start — issue a signed run token
  router.post('/start', (req, res) => {
    const { seed, mode } = req.body;
    if (!seed || !mode) return res.status(400).json({ error: 'Missing seed or mode' });
    if (!['normal', 'nuzlocke', 'endless'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    const runId = newUuid();
    const startedAt = Date.now();
    db.prepare(
      'INSERT INTO runs (run_id, user_id, seed, mode, started_at) VALUES (?, ?, ?, ?, ?)'
    ).run(runId, req.userId, seed >>> 0, mode, startedAt);

    const runToken = signToken({ runId, userId: req.userId, seed: seed >>> 0, mode, startedAt });
    res.json({ runToken });
  });

  // POST /run/checkpoint — verify a gym battle and issue a signed checkpoint token
  router.post('/checkpoint', (req, res) => {
    const { runToken, prevCheckpoints, gymIdx, rngSeedAtStart, playerTeam } = req.body;
    if (gymIdx === undefined || rngSeedAtStart === undefined || !playerTeam) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!Number.isInteger(gymIdx) || gymIdx < 0 || gymIdx > 12) {
      return res.status(400).json({ error: 'Invalid gymIdx' });
    }

    const tokenData = verifyToken(runToken);
    if (!tokenData || tokenData.userId !== req.userId) {
      return res.status(401).json({ error: 'Invalid or expired run token' });
    }

    const run = db.prepare('SELECT * FROM runs WHERE run_id = ? AND status = ?').get(tokenData.runId, 'active');
    if (!run) return res.status(404).json({ error: 'Run not found or already completed' });

    // Timestamp sanity check
    const elapsedSeconds = (Date.now() - run.started_at) / 1000;
    if (elapsedSeconds < MIN_SECONDS_PER_GYM * (gymIdx + 1)) {
      return res.status(400).json({ error: `Checkpoint ${gymIdx} submitted too quickly` });
    }

    // Validate previous checkpoint token chain
    const prevSigs = [];
    for (const cp of (Array.isArray(prevCheckpoints) ? prevCheckpoints : [])) {
      const cpData = verifyToken(cp);
      if (!cpData || cpData.runId !== tokenData.runId) {
        return res.status(400).json({ error: 'Invalid checkpoint chain' });
      }
      prevSigs.push(cpData.sig);
    }
    const prevHash = prevSigs.length
      ? crypto.createHash('sha256').update(prevSigs.join('|')).digest('hex')
      : null;

    // Replay the battle to verify the player actually won
    const enemyTeam = getEnemyTeam(gymIdx);
    if (!enemyTeam) return res.status(400).json({ error: 'Unknown gymIdx' });

    let replayResult;
    try {
      replayResult = replayBattle(rngSeedAtStart >>> 0, playerTeam, enemyTeam);
    } catch (err) {
      console.error('Replay error (gym %d):', gymIdx, err.message);
      return res.status(400).json({ error: 'Battle replay failed' });
    }
    if (!replayResult.playerWon) {
      return res.status(400).json({ error: 'Replay shows player did not win this battle' });
    }

    // Issue signed checkpoint token
    const checkpointId = newUuid();
    const sig = crypto.randomBytes(16).toString('hex');
    const issuedAt = Date.now();
    const checkpointToken = signToken({ checkpointId, runId: tokenData.runId, gymIdx, prevHash, issuedAt, sig }, '48h');

    db.prepare(
      'INSERT INTO checkpoints (checkpoint_id, run_id, gym_idx, rng_seed, player_team_json, prev_sig, issued_at, signature) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(checkpointId, tokenData.runId, gymIdx, rngSeedAtStart >>> 0, JSON.stringify(playerTeam), prevHash, issuedAt, sig);

    res.json({ checkpointToken });
  });

  // POST /run/complete — verify full run and record it
  router.post('/complete', (req, res) => {
    const { runToken, checkpoints, summary } = req.body;
    if (!summary) return res.status(400).json({ error: 'Missing summary' });

    const tokenData = verifyToken(runToken);
    if (!tokenData || tokenData.userId !== req.userId) {
      return res.status(401).json({ error: 'Invalid or expired run token' });
    }

    const run = db.prepare('SELECT * FROM runs WHERE run_id = ? AND status = ?').get(tokenData.runId, 'active');
    if (!run) return res.status(404).json({ error: 'Run not found or already completed' });

    // Total run time check
    const nowMs = Date.now();
    if ((nowMs - run.started_at) / 1000 < MIN_RUN_SECONDS) {
      return res.status(400).json({ error: 'Run completed too quickly' });
    }

    // All 8 gym checkpoints must be present and valid
    const cpArray = Array.isArray(checkpoints) ? checkpoints : [];
    if (cpArray.length < 8) {
      return res.status(400).json({ error: `Expected 8 gym checkpoints, got ${cpArray.length}` });
    }
    const verifiedGyms = new Set();
    for (const cp of cpArray) {
      const cpData = verifyToken(cp);
      if (!cpData || cpData.runId !== tokenData.runId) {
        return res.status(400).json({ error: 'Invalid checkpoint in chain' });
      }
      verifiedGyms.add(cpData.gymIdx);
    }
    for (let i = 0; i < 8; i++) {
      if (!verifiedGyms.has(i)) return res.status(400).json({ error: `Missing checkpoint for gym ${i}` });
    }

    // Replay the Champion battle (ELITE_4[4] = Gary, gymIdx slot 12)
    const { championRngSeed, finalTeam } = summary;
    if (championRngSeed !== undefined && Array.isArray(finalTeam) && finalTeam.length) {
      const champTeam = getEnemyTeam(12);
      let champResult;
      try {
        champResult = replayBattle(championRngSeed >>> 0, finalTeam, champTeam);
      } catch (err) {
        console.error('Champion replay error:', err.message);
        return res.status(400).json({ error: 'Champion battle replay failed' });
      }
      if (!champResult.playerWon) {
        return res.status(400).json({ error: 'Champion replay shows player did not win' });
      }
    }

    // Mark run complete
    db.prepare('UPDATE runs SET status = ?, completed_at = ? WHERE run_id = ?').run('complete', nowMs, tokenData.runId);

    // Update elite wins + win streak
    const prev = db.prepare('SELECT count, win_streak FROM elite_wins WHERE user_id = ?').get(req.userId);
    const newCount  = (prev?.count      || 0) + 1;
    const newStreak = (prev?.win_streak || 0) + 1;
    db.prepare(
      'INSERT INTO elite_wins (user_id, count, win_streak) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET count = excluded.count, win_streak = excluded.win_streak'
    ).run(req.userId, newCount, newStreak);

    // Hall of Fame entry
    const entryId  = newUuid();
    const serverSig = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${tokenData.runId}|${req.userId}|${newCount}`)
      .digest('hex');
    db.prepare(
      'INSERT INTO hall_of_fame (entry_id, user_id, run_id, team_json, mode, starter_id, date_str, server_sig) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(entryId, req.userId, tokenData.runId, JSON.stringify(finalTeam || []), run.mode, summary.starterSpeciesId || null, new Date().toLocaleDateString(), serverSig);

    // Grant run-based achievements
    const newAchievements = [];
    const grant = (id) => {
      const exists = db.prepare('SELECT 1 FROM achievements WHERE user_id = ? AND achievement_id = ?').get(req.userId, id);
      if (!exists) {
        db.prepare('INSERT INTO achievements (user_id, achievement_id, run_id) VALUES (?, ?, ?)').run(req.userId, id, tokenData.runId);
        newAchievements.push(id);
      }
    };

    grant('elite_four');
    if (newCount === 10)  grant('elite_10');
    if (newCount === 100) grant('elite_100');
    if (run.mode === 'nuzlocke')      grant('nuzlocke_win');
    if (summary.maxTeamSize === 1)    grant('solo_run');
    if (!summary.usedPokecenter)      grant('no_pokecenter');
    if (!summary.pickedUpItem)        grant('no_items');
    if (newStreak >= 2)               grant('back_to_back');
    if (newStreak >= 3)               grant('back_3_back');
    const sid = summary.starterSpeciesId;
    if ([1,2,3].includes(sid))        grant('starter_1');
    if ([4,5,6].includes(sid))        grant('starter_4');
    if ([7,8,9].includes(sid))        grant('starter_7');
    const team = finalTeam || [];
    if ([144,145,146].every(id => team.some(p => p.speciesId === id))) grant('three_birds');
    if (team.length >= 3 && team.every(p => p.isShiny))               grant('all_shiny_win');
    if (team.length === 6) {
      const tc = {};
      for (const p of team) for (const t of (p.types || [])) tc[t] = (tc[t] || 0) + 1;
      if (Object.values(tc).some(c => c >= 4)) grant('type_quartet');
    }

    res.json({ verified: true, eliteWins: newCount, winStreak: newStreak, newAchievements });
  });

  return router;
};
