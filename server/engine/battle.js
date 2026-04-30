// engine/battle.js — server-side battle replay engine.
// Logic must stay identical to client battle.js; differences:
//   - rng/seedRng come from the rng module (not global)
//   - state (team context for metronome) is passed explicitly
//   - no DOM calls, no animations, no logging

const { rng, seedRng } = require('./rng');
const { getTypeEffectiveness, TYPE_ITEM_MAP, getBestMove, calcHp, canEvolve } = require('./data');

function stageMultiplier(n) {
  return n >= 0 ? (10 + 3 * n) / 10 : 10 / (10 + 3 * Math.abs(n));
}

function initBattleState(p) {
  p.stages = { atk: 0, def: 0, speed: 0, special: 0, spdef: 0 };
  p.status = null;
  return p;
}

function hasItem(items, id) {
  return items && items.some(it => it && it.id === id);
}

function getTypeBoostItem(moveType, items) {
  if (!items) return false;
  const cap = moveType.charAt(0).toUpperCase() + moveType.slice(1).toLowerCase();
  const needed = TYPE_ITEM_MAP[cap];
  if (!needed) return false;
  return items.some(it => it && it.id === needed);
}

function getEffectiveStat(pokemon, stat, items, stages, teamContext) {
  const rawStat = stat === 'spdef'
    ? (pokemon.baseStats?.spdef ?? pokemon.baseStats?.special ?? 50)
    : (pokemon.baseStats?.[stat] ?? 50);
  const buffCount = pokemon.statBuffs?.[stat] ?? 0;
  let val = Math.floor((rawStat || 50) * pokemon.level / 50) + 5;
  if (buffCount > 0) val = Math.floor(val * (1 + 0.1 * buffCount));

  const team = teamContext || [];
  const physicalCount = team.filter(p => (p.baseStats?.atk || 0) > (p.baseStats?.special || 0)).length;
  const specialCount  = team.filter(p => (p.baseStats?.special || 0) >= (p.baseStats?.atk || 0)).length;
  const allPhysical = team.length > 0 && physicalCount >= 4;
  const allSpecial  = team.length > 0 && specialCount  >= 4;

  if (stat === 'atk') {
    if (hasItem(items, 'muscle_band') && allPhysical) val = Math.floor(val * 1.5);
  }
  if (stat === 'def') {
    if (hasItem(items, 'eviolite') && canEvolve(pokemon.speciesId)) val = Math.floor(val * 1.5);
    if (hasItem(items, 'muscle_band') && allPhysical) val = Math.floor(val * 1.5);
    if (hasItem(items, 'choice_band')) val = Math.floor(val * 0.8);
  }
  if (stat === 'special') {
    if (hasItem(items, 'wise_glasses') && allSpecial) val = Math.floor(val * 1.5);
  }
  if (stat === 'spdef') {
    if (hasItem(items, 'eviolite') && canEvolve(pokemon.speciesId)) val = Math.floor(val * 1.5);
    if (hasItem(items, 'assault_vest'))  val = Math.floor(val * 1.5);
    if (hasItem(items, 'wise_glasses') && allSpecial) val = Math.floor(val * 1.5);
    if (hasItem(items, 'choice_specs')) val = Math.floor(val * 0.8);
  }
  if (stat === 'speed') {
    if (hasItem(items, 'choice_scarf')) val = Math.floor(val * 1.5);
  }
  if (stages && stages[stat] !== undefined && stages[stat] !== 0) {
    val = Math.floor(val * stageMultiplier(stages[stat]));
  }
  return Math.max(1, val);
}

function calcDamage(attacker, defender, move, items, defItems, teamContext) {
  const lvl = attacker.level;
  const isSpecial = (attacker.baseStats?.special || 0) >= (attacker.baseStats?.atk || 0);
  const atk = getEffectiveStat(attacker, isSpecial ? 'special' : 'atk', items, attacker.stages, teamContext);
  const def = getEffectiveStat(defender, isSpecial ? 'spdef' : 'def', defItems, defender.stages, []);
  const power = move.power || 40;
  const moveType = move.type || 'Normal';

  let damage = Math.floor(((2 * lvl / 5 + 2) * power * atk / def / 50 + 2));

  const typeEff = move.typeless ? 1 : getTypeEffectiveness(moveType, defender.types || ['Normal']);
  damage = Math.floor(damage * typeEff);

  if (attacker.types && attacker.types.some(t => t.toLowerCase() === moveType.toLowerCase())) {
    damage = Math.floor(damage * 1.5);
  }

  const typeBoostItem = getTypeBoostItem(moveType, items);
  if (typeBoostItem) damage = Math.floor(damage * 1.5);

  if (hasItem(items, 'life_orb'))  damage = Math.floor(damage * 1.3);
  if (hasItem(items, 'wide_lens')) damage = Math.floor(damage * 1.2);

  if (isSpecial) {
    if (hasItem(items, 'choice_specs')) damage = Math.floor(damage * 1.4);
  } else {
    if (hasItem(items, 'choice_band'))  damage = Math.floor(damage * 1.4);
  }

  // Metronome (Adaptability Band): +50% if 4+ team members share attacker's type
  if (hasItem(items, 'metronome')) {
    const team = teamContext || [];
    if (team.length > 0) {
      const sharedType = (attacker.types || []).find(t => {
        const count = team.filter(p => (p.types || []).some(pt => pt.toLowerCase() === t.toLowerCase())).length;
        return count >= 4;
      });
      if (sharedType) damage = Math.floor(damage * 1.5);
    }
  }

  if (hasItem(items, 'expert_belt') && typeEff >= 2) damage = Math.floor(damage * 1.3);
  if (hasItem(defItems, 'air_balloon') && moveType.toLowerCase() === 'ground') damage = 0;

  let critChance = 0.0625;
  if (hasItem(items, 'scope_lens')) critChance = 0.20;
  const crit = rng() < critChance;
  if (crit) damage = Math.floor(damage * 1.5);

  const dmgVariance = 0.85 + rng() * 0.15;
  damage = typeEff === 0 ? 0 : Math.max(1, Math.floor(damage * dmgVariance));

  return { damage, typeEff, moveType, crit };
}

// Replays a battle given the RNG seed at the moment runBattle was called on the client.
// playerTeam and enemyTeam should be the pre-battle snapshots sent in the checkpoint.
// Returns { playerWon: boolean }.
function replayBattle(rngSeedAtStart, playerTeam, enemyTeam) {
  seedRng(rngSeedAtStart);

  const pTeam = playerTeam.map(p => initBattleState({ ...p }));
  const eTeam = enemyTeam.map(p => initBattleState({
    ...p,
    currentHp: p.currentHp !== undefined ? p.currentHp : calcHp(p.baseStats.hp, p.level),
    maxHp:     p.maxHp     !== undefined ? p.maxHp     : calcHp(p.baseStats.hp, p.level),
  }));

  const teamContext = [...pTeam]; // for metronome item calculation

  let rounds = 0;
  const MAX_ROUNDS = 300;

  while (pTeam.some(p => p.currentHp > 0) && eTeam.some(p => p.currentHp > 0) && rounds < MAX_ROUNDS) {
    rounds++;

    const pEntry = pTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
    const eEntry = eTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
    if (!pEntry || !eEntry) break;

    const { p: pActive, idx: pIdx } = pEntry;
    const { p: eActive, idx: eIdx } = eEntry;

    // Ditto transform — consumes no RNG (just copies stats)
    if (pActive.speciesId === 132 && !pActive._transformed) {
      pActive._transformed = true;
      pActive.types     = [...(eActive.types || ['Normal'])];
      pActive.baseStats = { ...eActive.baseStats };
    }

    const pActiveItems = pActive.heldItem ? [pActive.heldItem] : [];
    const eActiveItems = eActive.heldItem ? [eActive.heldItem] : [];

    const pSpeed = getEffectiveStat(pActive, 'speed', pActiveItems, pActive.stages, teamContext);
    const eSpeed = getEffectiveStat(eActive, 'speed', eActiveItems, eActive.stages, []);

    const pMove = getBestMove(pActive.types || ['Normal'], pActive.baseStats, pActive.speciesId, pActive.moveTier ?? 1);
    const eMove = getBestMove(eActive.types || ['Normal'], eActive.baseStats, eActive.speciesId, eActive.moveTier ?? 1);
    const bothUseless = pMove.noDamage && eMove.noDamage;

    const playerFirst = pSpeed >= eSpeed;
    const turns = playerFirst
      ? [{ attacker: pActive, aIdx: pIdx, side: 'player', target: eActive, tIdx: eIdx, tSide: 'enemy' },
         { attacker: eActive, aIdx: eIdx, side: 'enemy',  target: pActive, tIdx: pIdx, tSide: 'player' }]
      : [{ attacker: eActive, aIdx: eIdx, side: 'enemy',  target: pActive, tIdx: pIdx, tSide: 'player' },
         { attacker: pActive, aIdx: pIdx, side: 'player', target: eActive, tIdx: eIdx, tSide: 'enemy' }];

    for (const { attacker, aIdx, side, target, tIdx, tSide } of turns) {
      if (attacker.currentHp <= 0 || target.currentHp <= 0) continue;

      if (attacker.status === 'freeze') continue;

      let move = getBestMove(attacker.types || ['Normal'], attacker.baseStats, attacker.speciesId, attacker.moveTier ?? 1);
      if (bothUseless) {
        move = { name: 'Struggle', power: 50, type: 'Normal', isSpecial: false, typeless: true };
      }
      if (!move.noDamage && getTypeEffectiveness(move.type, target.types || ['Normal']) === 0) {
        move = { name: 'Struggle', power: 50, type: 'Normal', isSpecial: false, typeless: true };
      }
      if (move.noDamage) continue;

      const attackerItems = side === 'player' ? pActiveItems : eActiveItems;
      const defenderItems = side === 'player' ? eActiveItems : pActiveItems;
      const ctx = side === 'player' ? teamContext : [];

      const { damage: rawDamage, typeEff } = calcDamage(attacker, target, move, attackerItems, defenderItems, ctx);
      const targetPreHp = target.currentHp;
      target.currentHp = Math.max(0, target.currentHp - rawDamage);

      // Focus Band (20% survive KO)
      if (target.currentHp === 0 && targetPreHp > 0 && tSide === 'player' && target.heldItem?.id === 'focus_band' && rng() < 0.2) {
        target.currentHp = 1;
      }
      // Focus Sash (survive from full HP)
      if (target.currentHp === 0 && targetPreHp === target.maxHp && tSide === 'player' && target.heldItem?.id === 'focus_sash') {
        target.currentHp = 1;
      }

      // Life Orb recoil
      if (side === 'player' && attacker.heldItem?.id === 'life_orb') {
        const recoil = Math.max(1, Math.floor(attacker.maxHp * 0.1));
        attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
      }
      // Rocky Helmet
      if (target.heldItem?.id === 'rocky_helmet') {
        const helmet = Math.max(1, Math.floor(attacker.maxHp * 0.12));
        attacker.currentHp = Math.max(0, attacker.currentHp - helmet);
      }
      // Shell Bell
      if (side === 'player' && attacker.heldItem?.id === 'shell_bell') {
        const heal = Math.max(1, Math.floor(rawDamage * 0.15));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
      }
    }

    // Leftovers
    const active = pTeam.map((p, i) => ({ p, i })).find(x => x.p.currentHp > 0);
    if (active?.p.heldItem?.id === 'leftovers') {
      const heal = Math.max(1, Math.floor(active.p.maxHp * 0.10));
      active.p.currentHp = Math.min(active.p.maxHp, active.p.currentHp + heal);
    }

    // Status ticks
    for (const [team, teamSide] of [[pTeam, 'player'], [eTeam, 'enemy']]) {
      for (let i = 0; i < team.length; i++) {
        const p = team[i];
        if (p.currentHp <= 0 || !p.status) continue;
        if (p.status === 'poison') {
          const tick = Math.max(1, Math.floor(p.maxHp / 8));
          p.currentHp = Math.max(0, p.currentHp - tick);
        }
        if (p.status === 'freeze') {
          if (rng() < 0.2) p.status = null;
        }
      }
    }
  }

  return { playerWon: pTeam.some(p => p.currentHp > 0) && !eTeam.some(p => p.currentHp > 0) };
}

module.exports = { replayBattle };
