// endless.js - Endless mode state, archetype pool, trait system, region/stage management

let endlessState = {
  active: false,
  stageNumber: 1,
  regionNumber: 1,
  mapIndexInRegion: 0,  // 0-3 = map bosses, 4 = Big Boss
  currentRegion: null,  // { stageNum, regionNum, levelRange, trainers[] }
  traitTiers: {},       // { Fire: 2, Water: 1, ... } — recomputed before each fight
};

// ── Trait descriptions (per tier) ─────────────────────────────────────────────

const TRAIT_DESCRIPTIONS = {
  Bug:     ['10% chance: +1 Level after fight',      '20% chance: +1 Level after fight',      '40% chance: +1 Level after fight'],
  Dragon:  ['+1 Spd/ATK/SpATK on KO (Dragon only)',  '+1 Spd/ATK/SpATK on KO (Dragon only)',  '+1 Spd/ATK/SpATK on KO (Dragon only)'],
  Electric:['10% chance to attack again',            '20% chance to attack again',            '30% chance to attack again'],
  Fire:    ['+1 ATK & Sp.ATK stages at fight start', '+2 ATK & Sp.ATK stages at fight start', '+3 ATK & Sp.ATK stages at fight start'],
  Flying:  ['15% chance to dodge incoming attacks',  '30% chance to dodge incoming attacks',  '50% chance to dodge incoming attacks'],
  Ghost:   ['Execute enemies below 15% HP',          'Execute enemies below 30% HP',          'Execute enemies below 50% HP'],
  Grass:   ['Heal 7% of damage dealt',               'Heal 14% of damage dealt',              'Heal 21% of damage dealt'],
  Ground:  ['+2 DEF stages at fight start',          '+4 DEF stages at fight start',          '+6 DEF stages at fight start'],
  Ice:     ['10% chance to freeze on hit',           '20% chance to freeze on hit',           '30% chance to freeze on hit'],
  Normal:  ['+25% max HP at fight start',            '+50% max HP at fight start',            '+100% max HP at fight start'],
  Poison:  ['33% chance to poison on hit',           '66% chance to poison on hit',           '100% chance to poison on hit'],
  Psychic: ['10% of damage splashes to all enemies', '10% of damage splashes to all enemies', '10% of damage splashes to all enemies'],
  Rock:    ['+1 DEF & Sp.DEF after each attack',     '+1 DEF & Sp.DEF after each attack',     '+1 DEF & Sp.DEF after each attack'],
  Water:   ['Enemy: -1 Spd/ATK/SpATK on hit',        'Enemy: -1 Spd/ATK/SpATK on hit',        'Enemy: -1 Spd/ATK/SpATK on hit'],
};

// Returns sorted type count data for the trait display panel.
// Each entry: { type, count, tier, nextThreshold, description, active }
function getTraitDisplayData(team) {
  const counts = {};
  for (const p of team) {
    const mult = p.isShiny ? 2 : 1;
    for (const t of (p.types || [])) {
      counts[t] = (counts[t] || 0) + mult;
    }
  }
  // Include all types that appear in TRAIT_DESCRIPTIONS
  const allTypes = Object.keys(TRAIT_DESCRIPTIONS);
  const entries = allTypes
    .map(type => {
      const count = counts[type] || 0;
      const tier = count >= 6 ? 3 : count >= 4 ? 2 : count >= 2 ? 1 : 0;
      const nextThreshold = count < 2 ? 2 : count < 4 ? 4 : 6;
      const descTier = Math.max(0, tier - 1); // 0-indexed for TRAIT_DESCRIPTIONS
      const description = TRAIT_DESCRIPTIONS[type]?.[tier > 0 ? tier - 1 : 0] || '';
      return { type, count, tier, nextThreshold, description, active: tier > 0 };
    })
    .filter(e => e.count > 0) // only show types the player actually has
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  return entries;
}

// ── Level scaling ─────────────────────────────────────────────────────────────

// Slot 0-8 = normal mode MAP_LEVEL_RANGES exactly. Beyond slot 8: extrapolate +8/slot.
const ENDLESS_LEVEL_SLOTS = [
  [1, 5], [8, 15], [14, 21], [21, 29], [29, 37],
  [37, 43], [43, 47], [47, 52], [53, 64],
];

function getEndlessLevelRange(stageNum, regionNum, mapIndex) {
  // Each stage restarts from slot 0 with a +10 level boost per stage
  const localSlot = (regionNum - 1) * 5 + mapIndex;  // 0-14 within the stage
  const stageBoost = (stageNum - 1) * 10;
  if (localSlot < ENDLESS_LEVEL_SLOTS.length) {
    const [min, max] = ENDLESS_LEVEL_SLOTS[localSlot];
    return [min + stageBoost, max + stageBoost];
  }
  const extra = localSlot - (ENDLESS_LEVEL_SLOTS.length - 1);
  return [53 + stageBoost + extra * 8, 64 + stageBoost + extra * 8];
}

// ── Archetype pool ────────────────────────────────────────────────────────────

const ENDLESS_ARCHETYPES = [
  { id: 'dragon_master',    name: 'Dragon Master',    type: 'Dragon',   sprite: 'aceTrainer',
    pool: [147,148,149,230,445,373,334,330,384,383] },
  { id: 'fire_ace',         name: 'Fire Ace',         type: 'Fire',     sprite: 'aceTrainer',
    pool: [4,5,6,58,59,77,78,126,136,38,250,157,156] },
  { id: 'psychic_sage',     name: 'Psychic Sage',     type: 'Psychic',  sprite: 'scientist',
    pool: [63,64,65,79,80,96,97,102,103,122,150,151,196] },
  { id: 'water_lord',       name: 'Water Lord',       type: 'Water',    sprite: 'fisherman',
    pool: [54,55,60,61,62,72,73,86,87,90,91,98,99,116,117,118,119,129,130,134] },
  { id: 'rock_titan',       name: 'Rock Titan',       type: 'Rock',     sprite: 'hiker',
    pool: [74,75,76,95,111,112,138,139,140,141,142,248,213] },
  { id: 'bug_queen',        name: 'Bug Queen',         type: 'Bug',      sprite: 'bugcatcher',
    pool: [10,11,12,13,14,15,46,47,48,49,123,127,165,166,212] },
  { id: 'ghost_lord',       name: 'Ghost Lord',       type: 'Ghost',    sprite: 'scientist',
    pool: [92,93,94,200,292,356,477,302,354,355] },
  { id: 'electric_sage',    name: 'Electric Sage',    type: 'Electric', sprite: 'aceTrainer',
    pool: [25,26,81,82,100,101,125,135,145,243,125,466] },
  { id: 'ice_master',       name: 'Ice Master',       type: 'Ice',      sprite: 'aceTrainer',
    pool: [87,91,124,131,144,215,220,221,361,362,471,473] },
  { id: 'ground_giant',     name: 'Ground Giant',     type: 'Ground',   sprite: 'hiker',
    pool: [27,28,50,51,74,75,76,104,105,111,112,194,195] },
  { id: 'poison_witch',     name: 'Poison Witch',     type: 'Poison',   sprite: 'teamrocket',
    pool: [23,24,29,30,31,32,33,34,41,42,43,44,45,88,89,109,110,169] },
  { id: 'normal_champion',  name: 'Normal Champion',  type: 'Normal',   sprite: 'aceTrainer',
    pool: [19,20,52,53,55,83,84,85,128,133,143,163,164,241,235] },
  { id: 'flying_master',    name: 'Flying Master',    type: 'Flying',   sprite: 'aceTrainer',
    pool: [16,17,18,21,22,83,84,85,123,142,145,146,149,469,227] },
  { id: 'grass_druid',      name: 'Grass Druid',      type: 'Grass',    sprite: 'aceTrainer',
    pool: [1,2,3,43,44,45,69,70,71,102,103,114,182,187,188,189,357] },
  // Stage Final Boss — mixed elite team
  { id: 'elite_alltype',    name: 'Elite Master',     type: null,       sprite: 'aceTrainer',
    pool: [130,149,59,65,94,143,6,131,248,376,373,445,380,381,384,385] },
];

// ── Region rolling ────────────────────────────────────────────────────────────

function rollRegion(stageNum, regionNum) {
  const moveTier = stageNum <= 1 ? 1 : 2;

  // Shuffle all non-elite archetypes
  const pool = ENDLESS_ARCHETYPES.filter(a => a.id !== 'elite_alltype');
  const shuffled = [...pool].sort(() => rng() - 0.5);

  const regularBosses = shuffled.slice(0, 4).map((arch, i) => {
    const [minL, maxL] = getEndlessLevelRange(stageNum, regionNum, i);
    const level = Math.floor(minL + rng() * (maxL - minL + 1));
    const eligible = arch.pool.filter(id => minLevelForSpecies(id) <= level);
    const srcPool = eligible.length ? eligible : arch.pool;
    const ids = [...srcPool].sort(() => rng() - 0.5).slice(0, 4);
    return { archetype: arch, level, moveTier, teamSize: 4, speciesIds: ids };
  });

  const bigBossArch = shuffled[4] || ENDLESS_ARCHETYPES.find(a => a.id !== 'elite_alltype');
  const [bigMinL, bigMaxL] = getEndlessLevelRange(stageNum, regionNum, 4);
  const bigBossLevel = Math.floor(bigMinL + rng() * (bigMaxL - bigMinL + 1));
  const bigBossEligible = bigBossArch.pool.filter(id => minLevelForSpecies(id) <= bigBossLevel);
  const bigBossSrcPool = bigBossEligible.length ? bigBossEligible : bigBossArch.pool;
  const bigBossIds = [...bigBossSrcPool].sort(() => rng() - 0.5).slice(0, 6);
  const bigBoss = {
    archetype: bigBossArch,
    level: bigBossLevel,
    moveTier: moveTier + 1,
    teamSize: 6,
    speciesIds: bigBossIds,
  };

  return {
    stageNum,
    regionNum,
    trainers: [...regularBosses, bigBoss],
  };
}

// ── Trait computation ─────────────────────────────────────────────────────────

// Returns { Fire: 2, Water: 1, ... } — tier per type (1/2/3), omits inactive types.
// Shiny pokemon count as 2 of each of their types.
function computeTraitTiers(team) {
  const counts = {};
  for (const p of team) {
    const multiplier = p.isShiny ? 2 : 1;
    for (const t of (p.types || [])) {
      counts[t] = (counts[t] || 0) + multiplier;
    }
  }
  const tiers = {};
  for (const [type, count] of Object.entries(counts)) {
    const tier = Math.min(3, Math.floor(count / 2));
    if (tier > 0) tiers[type] = tier;
  }
  return tiers;
}

// ── Trait config builder ──────────────────────────────────────────────────────

// Returns a traitsConfig object to pass to runBattle, or null if no active traits.
function buildTraitsConfig(tiers) {
  if (!tiers || Object.keys(tiers).length === 0) return null;

  const traitTier = type => tiers[type] || 0;
  const traitActive = type => traitTier(type) >= 1;

  return {

    onStartFight(pTeam, eTeam, log) {
      // Fire: +1/+2/+3 ATK and Sp.ATK stages to whole player team
      if (traitActive('Fire')) {
        const tier = traitTier('Fire');
        const alive = pTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
        for (const { p, i } of alive)
          log.push({ type: 'trait_trigger', traitType: 'Fire', side: 'player', idx: i,
            name: p.nickname || p.name, description: `Fire Trait T${tier}: +ATK & Sp.ATK!` });
        for (const { p, i } of alive) {
          applyStageChange(p, 'atk',     tier, 'player', i, log);
          applyStageChange(p, 'special', tier, 'player', i, log);
        }
      }

      // Ground: +2/+4/+6 DEF stages to whole player team
      if (traitActive('Ground')) {
        const tier = traitTier('Ground');
        const boost = tier * 2;
        const alive = pTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
        for (const { p, i } of alive)
          log.push({ type: 'trait_trigger', traitType: 'Ground', side: 'player', idx: i,
            name: p.nickname || p.name, description: `Ground Trait T${tier}: +DEF!` });
        for (const { p, i } of alive)
          applyStageChange(p, 'def', boost, 'player', i, log);
      }

      // Normal: +25/50/100% max HP bonus to whole player team
      if (traitActive('Normal')) {
        const tier = traitTier('Normal');
        const pct = [0, 0.25, 0.50, 1.00][tier];
        const alive = pTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
        for (const { p, i } of alive)
          log.push({ type: 'trait_trigger', traitType: 'Normal', side: 'player', idx: i,
            name: p.nickname || p.name, description: `Normal Trait T${tier}: +${Math.round(pct*100)}% HP!` });
        for (const { p, i } of alive) {
          const bonus = Math.floor(p.maxHp * pct);
          p.maxHp += bonus;
          p.currentHp = Math.min(p.currentHp + bonus, p.maxHp);
          log.push({ type: 'effect', side: 'player', idx: i, name: p.nickname || p.name,
            hpChange: bonus, hpAfter: p.currentHp, reason: `Normal Trait: +${bonus} max HP!` });
        }
      }
    },

    afterAttack(attacker, aIdx, aSide, target, tIdx, tSide, damage, log, pTeam, eTeam) {
      if (aSide !== 'player' || damage <= 0) return;

      // Electric: 10/20/30% chance to deal the same damage again
      if (traitActive('Electric') && !attacker._electricBonusFired) {
        const tier = traitTier('Electric');
        const chance = [0, 0.10, 0.20, 0.30][tier];
        if (rng() < chance) {
          attacker._electricBonusFired = true;
          target.currentHp = Math.max(0, target.currentHp - damage);
          log.push({ type: 'trait_trigger', traitType: 'Electric', side: 'player', idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Electric Trait T${tier}: Second hit!` });
          log.push({ type: 'effect', side: tSide, idx: tIdx, name: target.nickname || target.name,
            hpChange: -damage, hpAfter: target.currentHp, reason: `Electric Trait: −${damage} HP` });
          // Don't push faint here — battle.js faint check handles it after afterAttack returns
          attacker._electricBonusFired = false;
        }
      }

      // Ghost: execute enemy below 15/30/50% HP threshold
      if (traitActive('Ghost') && tSide === 'enemy' && target.currentHp > 0) {
        const tier = traitTier('Ghost');
        const threshold = [0, 0.15, 0.30, 0.50][tier];
        if (target.currentHp / target.maxHp < threshold) {
          const execDmg = target.currentHp;
          target.currentHp = 0;
          log.push({ type: 'trait_trigger', traitType: 'Ghost', side: 'player', idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Ghost Trait T${tier}: Execute!` });
          log.push({ type: 'effect', side: 'enemy', idx: tIdx, name: target.nickname || target.name,
            hpChange: -execDmg, hpAfter: 0, reason: `Ghost Trait: executed!` });
          // Don't push faint here — battle.js faint check handles it after afterAttack returns
        }
      }

      // Grass: heal 7/14/21% of dealt damage
      if (traitActive('Grass') && attacker.currentHp > 0) {
        const tier = traitTier('Grass');
        const pct = [0, 0.07, 0.14, 0.21][tier];
        const heal = Math.max(1, Math.floor(damage * pct));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        if (actual > 0) {
          attacker.currentHp += actual;
          log.push({ type: 'trait_trigger', traitType: 'Grass', side: 'player', idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Grass Trait T${tier}: healed ${actual}!` });
          log.push({ type: 'effect', side: 'player', idx: aIdx, name: attacker.nickname || attacker.name,
            hpChange: actual, hpAfter: attacker.currentHp, reason: `Grass Trait: +${actual} HP` });
        }
      }

      // Ice: 10/20/30% chance to freeze enemy
      if (traitActive('Ice') && tSide === 'enemy' && target.currentHp > 0 && !target.status) {
        const tier = traitTier('Ice');
        const chance = [0, 0.10, 0.20, 0.30][tier];
        if (rng() < chance) {
          applyStatus(target, 'freeze', tSide, tIdx, log);
          log.push({ type: 'trait_trigger', traitType: 'Ice', side: 'player', idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Ice Trait T${tier}: Froze enemy!` });
        }
      }

      // Poison: 33/66/100% chance to poison enemy
      if (traitActive('Poison') && tSide === 'enemy' && target.currentHp > 0 && !target.status) {
        const tier = traitTier('Poison');
        const chance = [0, 0.33, 0.66, 1.00][tier];
        if (rng() < chance) {
          applyStatus(target, 'poison', tSide, tIdx, log);
          log.push({ type: 'trait_trigger', traitType: 'Poison', side: 'player', idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Poison Trait T${tier}: Poisoned!` });
        }
      }

      // Rock: attacker gets +1 DEF and +1 Sp.DEF after each attack
      if (traitActive('Rock') && attacker.currentHp > 0) {
        log.push({ type: 'trait_trigger', traitType: 'Rock', side: 'player', idx: aIdx,
          name: attacker.nickname || attacker.name, description: `Rock Trait: +DEF, +Sp.DEF!` });
        applyStageChange(attacker, 'def',   1, 'player', aIdx, log);
        applyStageChange(attacker, 'spdef', 1, 'player', aIdx, log);
      }

      // Water: enemy gets -tier Speed, ATK, Sp.ATK
      if (traitActive('Water') && tSide === 'enemy' && target.currentHp > 0) {
        const tier = traitTier('Water');
        log.push({ type: 'trait_trigger', traitType: 'Water', side: 'player', idx: aIdx,
          name: attacker.nickname || attacker.name, description: `Water Trait T${tier}: debuffed enemy!` });
        applyStageChange(target, 'speed',   -tier, tSide, tIdx, log);
        applyStageChange(target, 'atk',     -tier, tSide, tIdx, log);
        applyStageChange(target, 'special', -tier, tSide, tIdx, log);
      }

      // Psychic: deal 10% of dealt damage to all other alive enemy pokemon
      if (traitActive('Psychic') && tSide === 'enemy') {
        const splash = Math.max(1, Math.floor(damage * 0.10));
        for (let i = 0; i < eTeam.length; i++) {
          if (i === tIdx || eTeam[i].currentHp <= 0) continue;
          eTeam[i].currentHp = Math.max(0, eTeam[i].currentHp - splash);
          log.push({ type: 'trait_trigger', traitType: 'Psychic', side: 'player', idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Psychic Trait: ${splash} splash!` });
          log.push({ type: 'effect', side: 'enemy', idx: i, name: eTeam[i].nickname || eTeam[i].name,
            hpChange: -splash, hpAfter: eTeam[i].currentHp, reason: `Psychic Trait: −${splash} HP` });
          if (eTeam[i].currentHp === 0) {
            log.push({ type: 'faint', side: 'enemy', idx: i, name: eTeam[i].nickname || eTeam[i].name });
          }
        }
      }
    },

    whenAttacked(defender, dIdx, dSide, attacker, aIdx, aSide, damage, log) {
      if (dSide !== 'player') return;

      // Flying: 15/30/50% chance to dodge (retroactively heal the damage back)
      if (traitActive('Flying') && defender.currentHp > 0) {
        const tier = traitTier('Flying');
        const chance = [0, 0.15, 0.30, 0.50][tier];
        if (rng() < chance) {
          const recovered = Math.min(damage, defender.maxHp - defender.currentHp);
          if (recovered > 0) {
            defender.currentHp = Math.min(defender.maxHp, defender.currentHp + recovered);
            log.push({ type: 'trait_trigger', traitType: 'Flying', side: 'player', idx: dIdx,
              name: defender.nickname || defender.name, description: `Flying Trait T${tier}: Dodged!` });
            log.push({ type: 'effect', side: 'player', idx: dIdx, name: defender.nickname || defender.name,
              hpChange: recovered, hpAfter: defender.currentHp, reason: `Flying Trait: dodged! +${recovered} HP` });
          }
        }
      }
    },

    onKO(fainted, fIdx, fSide, killer, kIdx, kSide, log) {
      if (kSide !== 'player') return;

      // Dragon: active Dragon-type killer gets +1 Speed, +1 ATK, +1 Sp.ATK on KO
      if (traitActive('Dragon') && killer.currentHp > 0) {
        if ((killer.types || []).some(t => t === 'Dragon')) {
          log.push({ type: 'trait_trigger', traitType: 'Dragon', side: 'player', idx: kIdx,
            name: killer.nickname || killer.name, description: `Dragon Trait: Powered up on KO!` });
          applyStageChange(killer, 'speed',   1, 'player', kIdx, log);
          applyStageChange(killer, 'atk',     1, 'player', kIdx, log);
          applyStageChange(killer, 'special', 1, 'player', kIdx, log);
        }
      }
    },
  };
}

// ── Bug trait level bonus (applied post-fight in game.js) ─────────────────────

function getBugLevelBonus(tiers) {
  const tier = tiers['Bug'] || 0;
  if (tier === 0) return 0;
  const chance = [0, 0.10, 0.20, 0.40][tier];
  return rng() < chance ? 1 : 0;
}

// ── Persistence ───────────────────────────────────────────────────────────────

function saveEndlessState() {
  try { localStorage.setItem('poke_endless_state', JSON.stringify(endlessState)); } catch {}
}

function loadEndlessState() {
  try {
    const raw = localStorage.getItem('poke_endless_state');
    if (!raw) return false;
    endlessState = JSON.parse(raw);
    return true;
  } catch { return false; }
}

function clearEndlessState() {
  localStorage.removeItem('poke_endless_state');
}
