const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pokelike-ac.db');

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uuid TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS runs (
      run_id     TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      seed       INTEGER NOT NULL,
      mode       TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      status     TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      checkpoint_id   TEXT PRIMARY KEY,
      run_id          TEXT NOT NULL,
      gym_idx         INTEGER NOT NULL,
      rng_seed        INTEGER NOT NULL,
      player_team_json TEXT NOT NULL,
      prev_sig        TEXT,
      issued_at       INTEGER NOT NULL,
      signature       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hall_of_fame (
      entry_id         TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      run_id           TEXT NOT NULL,
      team_json        TEXT NOT NULL,
      mode             TEXT NOT NULL,
      starter_id       INTEGER,
      date_str         TEXT NOT NULL,
      server_sig       TEXT NOT NULL,
      created_at       INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS achievements (
      user_id        TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      run_id         TEXT,
      unlocked_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS elite_wins (
      user_id    TEXT PRIMARY KEY,
      count      INTEGER NOT NULL DEFAULT 0,
      win_streak INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

module.exports = { openDb };
