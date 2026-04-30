// Mulberry32 seeded PRNG — identical to client game.js implementation.
// Must stay byte-for-byte equivalent so server replays match client results.

let _rngSeed = 0;

function rng() {
  _rngSeed = (_rngSeed + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngSeed ^ (_rngSeed >>> 15), 1 | _rngSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seedRng(seed) { _rngSeed = seed >>> 0; }
function getRngSeed()  { return _rngSeed >>> 0; }

module.exports = { rng, seedRng, getRngSeed };
