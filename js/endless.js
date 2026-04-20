// endless.js - Endless mode state, archetype pool, trait system, region/stage management

let endlessState = {
  active: false,
  stageNumber: 1,
  regionNumber: 1,
  mapIndexInRegion: 0,  // 0-1 = map bosses, 2 = Big Boss
  currentRegion: null,  // { stageNum, regionNum, levelRange, trainers[] }
  traitTiers: {},       // { Fire: 2, Water: 1, ... } — recomputed before each fight
};

// ── Trait descriptions (per tier) ─────────────────────────────────────────────

const TRAIT_DESCRIPTIONS = {
  Bug:     ['10% chance: +1 Level after fight',           '20% chance: +1 Level after fight',           '40% chance: +1 Level after fight'],
  Dark:    ['30% chance to steal enemy held item',        '60% chance to steal enemy held item',        '100% chance to steal enemy held item'],
  Dragon:  ['+1 Spd/ATK/SpATK on KO',      '+1 Spd/ATK/SpATK on KO',      '+1 Spd/ATK/SpATK on KO'],
  Electric:['10% chance to attack again',                 '20% chance to attack again',                 '30% chance to attack again'],
  Fairy:   ['Enemy: -1 ATK & Sp.ATK at fight start',     'Enemy: -2 ATK & Sp.ATK at fight start',     'Enemy: -3 ATK & Sp.ATK at fight start'],
  Fighting:['When a pokemon faints, survivors get +1 ATK', 'When a pokemon faints, survivors get +2 ATK', 'When a pokemon faints, survivors get +3 ATK'],
  Fire:    ['+1 ATK & Sp.ATK stages at fight start',     '+2 ATK & Sp.ATK stages at fight start',     '+3 ATK & Sp.ATK stages at fight start'],
  Flying:  ['15% chance to dodge incoming attacks',       '30% chance to dodge incoming attacks',       '50% chance to dodge incoming attacks'],
  Ghost:   ['Execute enemies below 15% HP',               'Execute enemies below 30% HP',               'Execute enemies below 50% HP'],
  Grass:   ['Heal 7% of damage dealt',                    'Heal 14% of damage dealt',                   'Heal 21% of damage dealt'],
  Ground:  ['+2 DEF stages at fight start',               '+4 DEF stages at fight start',               '+6 DEF stages at fight start'],
  Ice:     ['10% chance to freeze on hit',                '20% chance to freeze on hit',                '30% chance to freeze on hit'],
  Normal:  ['+25% max HP at fight start',                 '+50% max HP at fight start',                 '+100% max HP at fight start'],
  Poison:  ['33% chance to poison on hit',                '66% chance to poison on hit',                '100% chance to poison on hit'],
  Psychic: ['10% of damage splashes to all enemies',      '10% of damage splashes to all enemies',      '10% of damage splashes to all enemies'],
  Rock:    ['+1 DEF & Sp.DEF after each attack',          '+1 DEF & Sp.DEF after each attack',          '+1 DEF & Sp.DEF after each attack'],
  Steel:   ['Reduce incoming damage by 10%',              'Reduce incoming damage by 20%',              'Reduce incoming damage by 30%'],
  Water:   ['Enemy: -1 Spd/ATK/SpATK on hit',            'Enemy: -2 Spd/ATK/SpATK on hit',            'Enemy: -3 Spd/ATK/SpATK on hit'],
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

// Slot 0-8: max = gym leader's highest pokemon level - 2 (Brock→12, Misty→18, Surge→24,
// Erika→30, Koga→42, Sabrina→42, Blaine→51, Giovanni→58, Champion→63).
const ENDLESS_LEVEL_SLOTS = [
  [4, 10], [12, 18], [18, 24], [24, 30], [35, 42],
  [42, 46], [46, 51], [52, 58], [57, 63],
];
const ENDLESS_TEAM_SIZES = [2, 2, 3, 3, 4, 4, 5, 5, 6];

function getEndlessLevelRange(stageNum, regionNum, mapIndex) {
  // R1M1 (slot 0) is identical every stage. Every subsequent slot gains
  // floor(0.5 * slot * (stage - 1)) levels so later maps scale harder in higher stages.
  const localSlot = (regionNum - 1) * 3 + mapIndex;  // 0-8 within the stage
  const stageBonus = Math.floor(0.5 * localSlot * (stageNum - 1));
  if (localSlot < ENDLESS_LEVEL_SLOTS.length) {
    const [min, max] = ENDLESS_LEVEL_SLOTS[localSlot];
    return [min + stageBonus, max + stageBonus];
  }
  const extra = localSlot - (ENDLESS_LEVEL_SLOTS.length - 1);
  return [53 + stageBonus + extra * 8, 64 + stageBonus + extra * 8];
}

// ── Archetype pool ────────────────────────────────────────────────────────────

const ENDLESS_ARCHETYPES = [
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

  const slotBase = (regionNum - 1) * 3;

  const regularBosses = shuffled.slice(0, 2).map((arch, i) => {
    const [, maxL] = getEndlessLevelRange(stageNum, regionNum, i);
    const level = maxL;
    const teamSize = ENDLESS_TEAM_SIZES[slotBase + i] ?? 4;
    const eligible = arch.pool.filter(id => minLevelForSpecies(id) <= level);
    const srcPool = eligible.length ? eligible : arch.pool;
    const ids = [...srcPool].sort(() => rng() - 0.5).slice(0, teamSize);
    return { archetype: arch, level, moveTier, teamSize, speciesIds: ids };
  });

  // Region 3 big boss IS the stage final boss — use elite_alltype at +5 levels
  const isFinalRegion = regionNum === 3;
  const bigBossArch = isFinalRegion
    ? ENDLESS_ARCHETYPES.find(a => a.id === 'elite_alltype')
    : (shuffled[2] || ENDLESS_ARCHETYPES.find(a => a.id !== 'elite_alltype'));
  const [, bigMaxL] = getEndlessLevelRange(stageNum, regionNum, 2);
  const bigBossLevel = isFinalRegion ? bigMaxL + 5 : bigMaxL;
  const bigBossTeamSize = ENDLESS_TEAM_SIZES[slotBase + 2] ?? 6;
  const bigBossEligible = bigBossArch.pool.filter(id => minLevelForSpecies(id) <= bigBossLevel);
  const bigBossSrcPool = bigBossEligible.length ? bigBossEligible : bigBossArch.pool;
  const bigBossIds = [...bigBossSrcPool].sort(() => rng() - 0.5).slice(0, bigBossTeamSize);
  const bigBoss = {
    archetype: bigBossArch,
    level: bigBossLevel,
    moveTier: moveTier + 1,
    teamSize: bigBossTeamSize,
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
// enemyTiers is optional — pass it for boss fights so the enemy also benefits from type traits.
function buildTraitsConfig(playerTiers, enemyTiers = {}) {
  playerTiers = playerTiers || {};
  enemyTiers  = enemyTiers  || {};
  if (!Object.keys(playerTiers).length && !Object.keys(enemyTiers).length) return null;

  const tierFor   = (type, side) => ((side === 'player' ? playerTiers : enemyTiers)[type] || 0);
  const activeFor = (type, side) => tierFor(type, side) >= 1;

  return {

    onStartFight(pTeam, eTeam, log) {
      for (const [side, myTeam, theirTeam] of [['player', pTeam, eTeam], ['enemy', eTeam, pTeam]]) {
        const oppSide = side === 'player' ? 'enemy' : 'player';

        // Fire: +tier ATK and Sp.ATK to whole team
        if (activeFor('Fire', side)) {
          const tier = tierFor('Fire', side);
          const alive = myTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
          for (const { p, i } of alive)
            log.push({ type: 'trait_trigger', traitType: 'Fire', side, idx: i,
              name: p.nickname || p.name, description: `Fire Trait T${tier}: +ATK & Sp.ATK!` });
          for (const { p, i } of alive) {
            applyStageChange(p, 'atk',     tier, side, i, log);
            applyStageChange(p, 'special', tier, side, i, log);
          }
        }

        // Ground: +tier*2 DEF to whole team
        if (activeFor('Ground', side)) {
          const tier = tierFor('Ground', side);
          const boost = tier * 2;
          const alive = myTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
          for (const { p, i } of alive)
            log.push({ type: 'trait_trigger', traitType: 'Ground', side, idx: i,
              name: p.nickname || p.name, description: `Ground Trait T${tier}: +DEF!` });
          for (const { p, i } of alive)
            applyStageChange(p, 'def', boost, side, i, log);
        }

        // Fairy: opposing team gets -tier ATK and Sp.ATK
        if (activeFor('Fairy', side)) {
          const tier = tierFor('Fairy', side);
          const myAlive   = myTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
          const theirAlive = theirTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
          for (const { p, i } of myAlive)
            log.push({ type: 'trait_trigger', traitType: 'Fairy', side, idx: i,
              name: p.nickname || p.name, description: `Fairy Trait T${tier}: Charmed enemies!` });
          for (const { p, i } of theirAlive) {
            applyStageChange(p, 'atk',     -tier, oppSide, i, log);
            applyStageChange(p, 'special', -tier, oppSide, i, log);
          }
        }

        // Normal: +25/50/100% max HP bonus to whole team
        if (activeFor('Normal', side)) {
          const tier = tierFor('Normal', side);
          const pct = [0, 0.25, 0.50, 1.00][tier];
          const alive = myTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
          for (const { p, i } of alive)
            log.push({ type: 'trait_trigger', traitType: 'Normal', side, idx: i,
              name: p.nickname || p.name, description: `Normal Trait T${tier}: +${Math.round(pct*100)}% HP!` });
          for (const { p, i } of alive) {
            const bonus = Math.floor(p.maxHp * pct);
            p.maxHp += bonus;
            p.currentHp = Math.min(p.currentHp + bonus, p.maxHp);
            log.push({ type: 'effect', side, idx: i, name: p.nickname || p.name,
              hpChange: bonus, hpAfter: p.currentHp, newMaxHp: p.maxHp, reason: `Normal Trait: +${bonus} max HP!` });
          }
        }
      }
    },

    afterAttack(attacker, aIdx, aSide, target, tIdx, tSide, damage, log, pTeam, eTeam) {
      if (damage <= 0) return;

      // Collect triggers and effects separately so all trait_triggers are consecutive
      // in the log (enabling simultaneous batch animation), matching onStartFight pattern.
      const triggers = [];
      const efx = [];

      // Electric: 10/20/30% chance to deal the same damage again
      if (activeFor('Electric', aSide) && !attacker._electricBonusFired) {
        const tier = tierFor('Electric', aSide);
        const chance = [0, 0.10, 0.20, 0.30][tier];
        if (rng() < chance) {
          attacker._electricBonusFired = true;
          target.currentHp = Math.max(0, target.currentHp - damage);
          triggers.push({ type: 'trait_trigger', traitType: 'Electric', side: aSide, idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Electric Trait T${tier}: Second hit!` });
          efx.push({ type: 'effect', side: tSide, idx: tIdx, name: target.nickname || target.name,
            hpChange: -damage, hpAfter: target.currentHp, reason: `Electric Trait: −${damage} HP` });
          attacker._electricBonusFired = false;
        }
      }

      // Ghost: execute target below HP threshold
      if (activeFor('Ghost', aSide) && tSide !== aSide && target.currentHp > 0) {
        const tier = tierFor('Ghost', aSide);
        const threshold = [0, 0.15, 0.30, 0.50][tier];
        if (target.currentHp / target.maxHp < threshold) {
          const execDmg = target.currentHp;
          target.currentHp = 0;
          triggers.push({ type: 'trait_trigger', traitType: 'Ghost', side: aSide, idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Ghost Trait T${tier}: Execute!` });
          efx.push({ type: 'effect', side: tSide, idx: tIdx, name: target.nickname || target.name,
            hpChange: -execDmg, hpAfter: 0, reason: `Ghost Trait: executed!` });
        }
      }

      // Grass: heal % of dealt damage
      if (activeFor('Grass', aSide) && attacker.currentHp > 0) {
        const tier = tierFor('Grass', aSide);
        const pct = [0, 0.07, 0.14, 0.21][tier];
        const heal = Math.max(1, Math.floor(damage * pct));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        if (actual > 0) {
          attacker.currentHp += actual;
          triggers.push({ type: 'trait_trigger', traitType: 'Grass', side: aSide, idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Grass Trait T${tier}: healed ${actual}!` });
          efx.push({ type: 'effect', side: aSide, idx: aIdx, name: attacker.nickname || attacker.name,
            hpChange: actual, hpAfter: attacker.currentHp, reason: `Grass Trait: +${actual} HP` });
        }
      }

      // Ice: chance to freeze target
      if (activeFor('Ice', aSide) && tSide !== aSide && target.currentHp > 0 && !target.status) {
        const tier = tierFor('Ice', aSide);
        const chance = [0, 0.10, 0.20, 0.30][tier];
        if (rng() < chance) {
          applyStatus(target, 'freeze', tSide, tIdx, efx);
          triggers.push({ type: 'trait_trigger', traitType: 'Ice', side: aSide, idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Ice Trait T${tier}: Froze enemy!` });
        }
      }

      // Poison: chance to poison target
      if (activeFor('Poison', aSide) && tSide !== aSide && target.currentHp > 0 && !target.status) {
        const tier = tierFor('Poison', aSide);
        const chance = [0, 0.33, 0.66, 1.00][tier];
        if (rng() < chance) {
          applyStatus(target, 'poison', tSide, tIdx, efx);
          triggers.push({ type: 'trait_trigger', traitType: 'Poison', side: aSide, idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Poison Trait T${tier}: Poisoned!` });
        }
      }

      // Dark: chance to steal target's held item
      if (activeFor('Dark', aSide) && tSide !== aSide && target.currentHp > 0 && target.heldItem && !attacker.heldItem) {
        const tier = tierFor('Dark', aSide);
        const chance = [0, 0.30, 0.60, 1.00][tier];
        if (rng() < chance) {
          attacker.heldItem = target.heldItem;
          target.heldItem = null;
          triggers.push({ type: 'trait_trigger', traitType: 'Dark', side: aSide, idx: aIdx,
            name: attacker.nickname || attacker.name, description: `Dark Trait T${tier}: Stole ${attacker.heldItem.name || attacker.heldItem.id}!` });
        }
      }

      // Rock: +1 DEF and +1 Sp.DEF to attacker after each attack
      if (activeFor('Rock', aSide) && attacker.currentHp > 0) {
        triggers.push({ type: 'trait_trigger', traitType: 'Rock', side: aSide, idx: aIdx,
          name: attacker.nickname || attacker.name, description: `Rock Trait: +DEF, +Sp.DEF!` });
        applyStageChange(attacker, 'def',   1, aSide, aIdx, efx);
        applyStageChange(attacker, 'spdef', 1, aSide, aIdx, efx);
      }

      // Water: -tier Speed, ATK, Sp.ATK to target
      if (activeFor('Water', aSide) && tSide !== aSide && target.currentHp > 0) {
        const tier = tierFor('Water', aSide);
        triggers.push({ type: 'trait_trigger', traitType: 'Water', side: aSide, idx: aIdx,
          name: attacker.nickname || attacker.name, description: `Water Trait T${tier}: debuffed enemy!` });
        applyStageChange(target, 'speed',   -tier, tSide, tIdx, efx);
        applyStageChange(target, 'atk',     -tier, tSide, tIdx, efx);
        applyStageChange(target, 'special', -tier, tSide, tIdx, efx);
      }

      // Psychic: 10% splash to all other members of target's team
      if (activeFor('Psychic', aSide) && tSide !== aSide) {
        const targetTeam = tSide === 'enemy' ? eTeam : pTeam;
        const splash = Math.max(1, Math.floor(damage * 0.10));
        for (let i = 0; i < targetTeam.length; i++) {
          if (i === tIdx || targetTeam[i].currentHp <= 0) continue;
          targetTeam[i].currentHp = Math.max(0, targetTeam[i].currentHp - splash);
          triggers.push({ type: 'trait_trigger', traitType: 'Psychic', side: tSide, idx: i,
            name: targetTeam[i].nickname || targetTeam[i].name, description: `Psychic Trait: ${splash} splash!` });
          efx.push({ type: 'effect', side: tSide, idx: i, name: targetTeam[i].nickname || targetTeam[i].name,
            hpChange: -splash, hpAfter: targetTeam[i].currentHp, reason: `Psychic Trait: −${splash} HP` });
          if (targetTeam[i].currentHp === 0)
            efx.push({ type: 'faint', side: tSide, idx: i, name: targetTeam[i].nickname || targetTeam[i].name });
        }
      }

      for (const e of triggers) log.push(e);
      for (const e of efx) log.push(e);
    },

    whenAttacked(defender, dIdx, dSide, attacker, aIdx, aSide, damage, log) {
      // Steel: reduce incoming damage (retroactively heal back)
      if (activeFor('Steel', dSide) && defender.currentHp > 0) {
        const tier = tierFor('Steel', dSide);
        const reduction = Math.floor(damage * [0, 0.10, 0.20, 0.30][tier]);
        if (reduction > 0) {
          defender.currentHp = Math.min(defender.maxHp, defender.currentHp + reduction);
          log.push({ type: 'trait_trigger', traitType: 'Steel', side: dSide, idx: dIdx,
            name: defender.nickname || defender.name, description: `Steel Trait T${tier}: −${reduction} damage!` });
          log.push({ type: 'effect', side: dSide, idx: dIdx, name: defender.nickname || defender.name,
            hpChange: reduction, hpAfter: defender.currentHp, reason: `Steel Trait: absorbed ${reduction} damage` });
        }
      }

      // Flying: chance to dodge (retroactively heal back)
      if (activeFor('Flying', dSide) && defender.currentHp > 0) {
        const tier = tierFor('Flying', dSide);
        const chance = [0, 0.15, 0.30, 0.50][tier];
        if (rng() < chance) {
          const recovered = Math.min(damage, defender.maxHp - defender.currentHp);
          if (recovered > 0) {
            defender.currentHp = Math.min(defender.maxHp, defender.currentHp + recovered);
            log.push({ type: 'trait_trigger', traitType: 'Flying', side: dSide, idx: dIdx,
              name: defender.nickname || defender.name, description: `Flying Trait T${tier}: Dodged!` });
            log.push({ type: 'effect', side: dSide, idx: dIdx, name: defender.nickname || defender.name,
              hpChange: recovered, hpAfter: defender.currentHp, reason: `Flying Trait: dodged! +${recovered} HP` });
          }
        }
      }
    },

    onKO(fainted, fIdx, fSide, killer, kIdx, kSide, log, pTeam, eTeam) {
      // Fighting: when a pokemon faints, surviving teammates on the same side get ATK boost
      if (activeFor('Fighting', fSide)) {
        const tier = tierFor('Fighting', fSide);
        const fTeam = fSide === 'player' ? pTeam : eTeam;
        const survivors = fTeam.map((p, i) => ({ p, i })).filter(x => x.p.currentHp > 0);
        const triggers = [];
        const efx = [];
        for (const { p, i } of survivors) {
          triggers.push({ type: 'trait_trigger', traitType: 'Fighting', side: fSide, idx: i,
            name: p.nickname || p.name, description: `Fighting Trait T${tier}: Rally!` });
          applyStageChange(p, 'atk', tier, fSide, i, efx);
        }
        for (const e of triggers) log.push(e);
        for (const e of efx) log.push(e);
      }

      // Dragon: killer gets +1 Speed, ATK, Sp.ATK on KO
      if (activeFor('Dragon', kSide) && killer.currentHp > 0) {
        log.push({ type: 'trait_trigger', traitType: 'Dragon', side: kSide, idx: kIdx,
          name: killer.nickname || killer.name, description: `Dragon Trait: Powered up on KO!` });
        applyStageChange(killer, 'speed',   1, kSide, kIdx, log);
        applyStageChange(killer, 'atk',     1, kSide, kIdx, log);
        applyStageChange(killer, 'special', 1, kSide, kIdx, log);
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
