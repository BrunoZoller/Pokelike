require('dotenv').config({ path: '.env' });

const express = require('express');
const { openDb }  = require('./db');
const runRoutes    = require('./routes/run');
const playerRoutes = require('./routes/player');

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || '*').split(',').map(o => o.trim());

const db  = openDb();
const app = express();

app.use(express.json({ limit: '256kb' }));

// CORS — set ALLOWED_ORIGIN as comma-separated list in .env
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/run',    runRoutes(db));
app.use('/player', playerRoutes(db));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Pokelike anti-cheat server listening on :${PORT}`));
