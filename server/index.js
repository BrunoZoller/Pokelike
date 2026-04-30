require('dotenv').config({ path: '.env' });

const express = require('express');
const { openDb }  = require('./db');
const runRoutes    = require('./routes/run');
const playerRoutes = require('./routes/player');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const db  = openDb();
const app = express();

app.use(express.json({ limit: '256kb' }));

// CORS — restrict to your game's domain in production via ALLOWED_ORIGIN env var
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/run',    runRoutes(db));
app.use('/player', playerRoutes(db));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Pokelike anti-cheat server listening on :${PORT}`));
