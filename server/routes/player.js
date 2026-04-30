const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /player/records — returns the player's server-verified records
router.get('/records', (req, res) => {
  const db = req.db;
  const userId = req.userId;

  try {
    const wins = db.prepare('SELECT count, win_streak FROM elite_wins WHERE user_id = ?').get(userId);
    const hof  = db.prepare('SELECT * FROM hall_of_fame WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    const achs = db.prepare('SELECT achievement_id FROM achievements WHERE user_id = ?').all(userId);

    res.json({
      eliteWins:    wins?.count      || 0,
      winStreak:    wins?.win_streak || 0,
      hallOfFame:   hof.map(e => ({
        entryId:   e.entry_id,
        runId:     e.run_id,
        team:      JSON.parse(e.team_json || '[]'),
        mode:      e.mode,
        starterId: e.starter_id,
        date:      e.date_str,
        verified:  true,
      })),
      achievements: achs.map(a => a.achievement_id),
    });
  } catch (err) {
    console.error('Records fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

module.exports = (db) => {
  router.use(requireAuth(db));
  return router;
};
