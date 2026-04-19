// battle.js - Auto-battle engine (1v1: active pokemon only)

// ---- Status condition helpers ----
function _hasStatus(pokemon, status) {
  return (pokemon.statusConditions || []).includes(status);
}
function _applyStatus(pokemon, status) {
  if (!pokemon.statusConditions) pokemon.statusConditions = [];
  if (!pokemon.statusConditions.includes(status)) pokemon.statusConditions.push(status);
}
function _removeStatus(pokemon, status) {
  if (!pokemon.statusConditions) return;
  const idx = pokemon.statusConditions.indexOf(status);
  if (idx >= 0) pokemon.statusConditions.splice(idx, 1);
}

function calcDamage(attacker, defender, move, items, defItems = [], extraCritChance = 0) {
  const lvl = attacker.level;
  const isSpecial = (attacker.baseStats?.special || 0) >= (attacker.baseStats?.atk || 0);
  const atk = getEffectiveStat(attacker, isSpecial ? 'special' : 'atk', items);
  const def = getEffectiveStat(defender, isSpecial ? 'spdef' : 'def', defItems);
  const power = move.power || 40;
  const moveType = move.type || 'Normal';

  let damage = Math.floor(((2 * lvl / 5 + 2) * power * atk / def / 50 + 2));

  const typeEff = move.typeless ? 1 : getTypeEffectiveness(moveType, defender.types || ['Normal']);
  damage = Math.floor(damage * typeEff);

  // STAB
  if (attacker.types && attacker.types.some(t => t.toLowerCase() === moveType.toLowerCase())) {
    damage = Math.floor(damage * 1.5);
  }

  const typeBoostItem = getTypeBoostItem(moveType, items);
  if (typeBoostItem) damage = Math.floor(damage * 1.5);

  if (hasItem(items, 'life_orb'))    damage = Math.floor(damage * 1.3);
  if (hasItem(items, 'wide_lens'))   damage = Math.floor(damage * 1.2);

  // Physical/special split items
  if (isSpecial) {
    if (hasItem(items, 'choice_specs'))  damage = Math.floor(damage * 1.4);
  } else {
    if (hasItem(items, 'choice_band'))   damage = Math.floor(damage * 1.4);
  }

  // Adaptability Band: +50% if every Pokémon on the team shares a type
  if (hasItem(items, 'metronome')) {
    const team = typeof state !== 'undefined' ? state.team : [];
    if (team.length > 0) {
      const sharedType = (attacker.types || []).find(t => {
        const count = team.filter(p => (p.types || []).some(pt => pt.toLowerCase() === t.toLowerCase())).length;
        return count >= 4;
      });
      if (sharedType) damage = Math.floor(damage * 1.5);
    }
  }

  if (hasItem(items, 'expert_belt') && typeEff >= 2) damage = Math.floor(damage * 1.3);
  if (hasItem(items, 'air_balloon') && moveType.toLowerCase() === 'ground') damage = 0;

  // Burn: halves physical damage from a burned attacker
  if (!isSpecial && _hasStatus(attacker, 'burn')) {
    damage = Math.max(1, Math.floor(damage * 0.5));
  }

  // Crit chance: 6.25% base, boosted by items and Fighting trait
  let critChance = 0.0625;
  if (hasItem(items, 'scope_lens') || hasItem(items, 'razor_claw')) critChance = 0.20;
  critChance = Math.min(0.90, critChance + extraCritChance);
  const crit = rng() < critChance;
  if (crit) damage = Math.floor(damage * 1.5);

  const dmgVariance = 0.85 + rng() * 0.15;
  damage = typeEff === 0 ? 0 : Math.max(1, Math.floor(damage * dmgVariance));

  return { damage, typeEff, moveType, crit, isSpecial };
}

function getEffectiveStat(pokemon, stat, items) {
  // spdef falls back to special for Gen 1 hardcoded teams that don't have it
  const rawStat = stat === 'spdef'
    ? (pokemon.baseStats?.spdef ?? pokemon.baseStats?.special ?? 50)
    : (pokemon.baseStats?.[stat] ?? 50);
  let val = rawStat || 50;
  val = Math.floor(val * pokemon.level / 50) + 5;

  const team = typeof state !== 'undefined' ? state.team : [];
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
    if (hasItem(items, 'choice_band'))                   val = Math.floor(val * 0.8);
  }
  if (stat === 'special') {
    if (hasItem(items, 'wise_glasses') && allSpecial)    val = Math.floor(val * 1.5);
  }
  if (stat === 'spdef') {
    if (hasItem(items, 'eviolite') && canEvolve(pokemon.speciesId)) val = Math.floor(val * 1.5);
    if (hasItem(items, 'assault_vest'))                  val = Math.floor(val * 1.5);
    if (hasItem(items, 'wise_glasses') && allSpecial)    val = Math.floor(val * 1.5);
    if (hasItem(items, 'choice_specs'))                  val = Math.floor(val * 0.8);
  }
  if (stat === 'speed') {
    if (hasItem(items, 'choice_scarf')) val = Math.floor(val * 1.5);
  }

  // Artifact: Red Chain — +20% speed, +30% atk/special for player pokemon
  if (typeof hasArtifact === 'function' && hasArtifact('red_chain')) {
    if (stat === 'atk' || stat === 'special') val = Math.floor(val * 1.3);
    if (stat === 'speed') val = Math.floor(val * 1.2);
  }
  // Artifact: Go-Goggles — -20% speed
  if (typeof hasArtifact === 'function' && hasArtifact('go_goggles') && stat === 'speed') {
    val = Math.floor(val * 0.8);
  }
  // Artifact: Gracidea — def/spdef stage buffs from healing
  if (typeof hasArtifact === 'function' && hasArtifact('gracidea')) {
    if (stat === 'def'   && pokemon._gracideaDefStage   > 0) val = Math.floor(val * (1 + 0.5 * Math.min(6, pokemon._gracideaDefStage)));
    if (stat === 'spdef' && pokemon._gracideaSpDefStage > 0) val = Math.floor(val * (1 + 0.5 * Math.min(6, pokemon._gracideaSpDefStage)));
  }

  return Math.max(1, val);
}

function hasItem(items, id) {
  return items && items.some(it => it.id === id);
}

function getTypeBoostItem(moveType, items) {
  if (!items) return false;
  const cap = moveType.charAt(0).toUpperCase() + moveType.slice(1).toLowerCase();
  const needed = TYPE_ITEM_MAP[cap];
  if (!needed) return false;
  return items.some(it => it.id === needed);
}

function runBattle(playerTeam, enemyTeam, bagItems, enemyItems, onLog) {
  const pTeam = playerTeam.map(p => ({
    ...p,
    statusConditions: [...(p.statusConditions || [])],
    _toxicStacks: p._toxicStacks || 0,
  }));
  const eTeam = enemyTeam.map(p => ({
    ...p,
    currentHp: p.currentHp !== undefined ? p.currentHp : calcHp(p.baseStats.hp, p.level),
    maxHp:     p.maxHp     !== undefined ? p.maxHp     : calcHp(p.baseStats.hp, p.level),
    statusConditions: [...(p.statusConditions || [])],
    _toxicStacks: p._toxicStacks || 0,
  }));

  // Endless trait effects — computed once per battle
  const traitFx = (typeof state !== 'undefined' && state.isEndless && typeof getEndlessTraitEffects === 'function')
    ? getEndlessTraitEffects(state.team) : null;

  // Poison trait tier 3: enemy pokemon start combat with Toxic
  if (traitFx?.poisonStartCombat) {
    for (const ep of eTeam) {
      _applyStatus(ep, 'toxic');
      ep._toxicStacks = 1;
    }
  }

  // Dragon trait: accumulate damage bonus per KO this fight
  let dragonDmgBonus = 0;

  // Ghost trait: count KO saves used this fight
  let ghostSavesUsed = 0;

  // Artifact: Warden's Teeth — damage bonus per kill
  let wardenDmgBonus = 0;

  const log = [];
  const detailedLog = [];
  const addLog = (msg, cls = '') => { log.push({ msg, cls }); if (onLog) onLog(msg, cls); };
  const playerParticipants = new Set();

  // Announce initial send-outs
  const firstP = pTeam[0];
  const firstE = eTeam[0];
  if (firstP.currentHp > 0) playerParticipants.add(0);
  detailedLog.push({ type: 'send_out', side: 'player', idx: 0, name: firstP.nickname || firstP.name });
  detailedLog.push({ type: 'send_out', side: 'enemy',  idx: 0, name: firstE.name });

  let rounds = 0;
  const MAX_ROUNDS = 300;

  while (pTeam.some(p => p.currentHp > 0) && eTeam.some(p => p.currentHp > 0) && rounds < MAX_ROUNDS) {
    rounds++;

    // Artifact: Acro Bike — reset switch flags when all alive pokemon have rotated
    if (typeof hasArtifact === 'function' && hasArtifact('acro_bike')) {
      const aliveNonDeferred = pTeam.filter(p => p.currentHp > 0 && !p._ghostDeferred);
      if (aliveNonDeferred.length > 0 && aliveNonDeferred.every(p => p._acroSwitched)) {
        for (const p of pTeam) p._acroSwitched = false;
      }
    }

    // Active = first alive non-deferred non-acro-switched; fall back to deferred then any alive
    const pEntry = pTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0 && !x.p._ghostDeferred && !x.p._acroSwitched)
                ?? pTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0 && !x.p._ghostDeferred)
                ?? pTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
    const eEntry = eTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
    if (!pEntry || !eEntry) break;

    const { p: pActive, idx: pIdx } = pEntry;
    const { p: eActive, idx: eIdx } = eEntry;

    // Ditto: Transform into the active enemy pokemon (once per send-out)
    if (pActive.speciesId === 132 && !pActive._transformed) {
      pActive._transformed = true;
      pActive.types     = [...(eActive.types || ['Normal'])];
      pActive.baseStats = { ...eActive.baseStats };
      pActive.spriteUrl = eActive.spriteUrl || '';
      const dName = pActive.nickname || pActive.name;
      addLog(`${dName} transformed into ${eActive.name}!`, 'log-player');
      detailedLog.push({ type: 'transform', side: 'player', idx: pIdx,
        name: dName, intoName: eActive.name, spriteUrl: pActive.spriteUrl,
        types: pActive.types });
    }

    // Per-Pokemon held items for this round
    const pActiveItems = pActive.heldItem ? [pActive.heldItem] : [];
    const eActiveItems = eActive.heldItem ? [eActive.heldItem] : [];

    // Speed determines turn order (Ground trait reduces enemy speed)
    const pSpeed = getEffectiveStat(pActive, 'speed', pActiveItems);
    let eSpeed = getEffectiveStat(eActive, 'speed', eActiveItems);
    if (traitFx?.enemySpeedReduce > 0) eSpeed = Math.max(1, Math.floor(eSpeed * (1 - traitFx.enemySpeedReduce)));

    // If both active Pokemon can only use noDamage moves, force Struggle to break the stalemate
    const pMove = getBestMove(pActive.types || ['Normal'], pActive.baseStats, pActive.speciesId, pActive.moveTier ?? 1);
    const eMove = getBestMove(eActive.types || ['Normal'], eActive.baseStats, eActive.speciesId, eActive.moveTier ?? 1);
    const bothUseless = pMove.noDamage && eMove.noDamage;

    const turns = pSpeed >= eSpeed
      ? [{ attacker: pActive, aIdx: pIdx, side: 'player', target: eActive, tIdx: eIdx, tSide: 'enemy' },
         { attacker: eActive, aIdx: eIdx, side: 'enemy',  target: pActive, tIdx: pIdx, tSide: 'player' }]
      : [{ attacker: eActive, aIdx: eIdx, side: 'enemy',  target: pActive, tIdx: pIdx, tSide: 'player' },
         { attacker: pActive, aIdx: pIdx, side: 'player', target: eActive, tIdx: eIdx, tSide: 'enemy' }];

    for (const { attacker, aIdx, side, target, tIdx, tSide } of turns) {
      if (attacker.currentHp <= 0 || target.currentHp <= 0) continue;

      const aName = attacker.nickname || attacker.name;
      const tName = target.nickname || target.name;

      // Flinch: skip turn and clear
      if (attacker._flinched) {
        attacker._flinched = false;
        addLog(`${side === 'player' ? '' : '(enemy) '}${aName} flinched and couldn't move!`, 'log-item');
        detailedLog.push({ type: 'effect', side, idx: aIdx, name: aName, hpChange: 0, hpAfter: attacker.currentHp, reason: `${aName} flinched!` });
        continue;
      }

      // Freeze: skip with 20% thaw chance each turn
      if (_hasStatus(attacker, 'freeze')) {
        if (rng() < 0.20) {
          _removeStatus(attacker, 'freeze');
          addLog(`${side === 'player' ? '' : '(enemy) '}${aName} thawed out!`, 'log-item');
          detailedLog.push({ type: 'status_remove', side, idx: aIdx, name: aName, status: 'freeze' });
          // falls through — can attack this turn
        } else {
          addLog(`${side === 'player' ? '' : '(enemy) '}${aName} is frozen solid!`, 'log-item');
          detailedLog.push({ type: 'effect', side, idx: aIdx, name: aName, hpChange: 0, hpAfter: attacker.currentHp, reason: `${aName} is frozen!` });
          continue;
        }
      }

      // Paralysis: 25% skip chance (persistent each turn)
      if (_hasStatus(attacker, 'paralysis') && rng() < 0.25) {
        addLog(`${side === 'player' ? '' : '(enemy) '}${aName} is paralyzed and can't move!`, 'log-item');
        detailedLog.push({ type: 'effect', side, idx: aIdx, name: aName, hpChange: 0, hpAfter: attacker.currentHp, reason: `Paralyzed!` });
        continue;
      }

      // Flying trait: dodge chance on incoming enemy attack
      if (side === 'enemy' && traitFx?.dodgeChance > 0 && rng() < traitFx.dodgeChance) {
        const dName = target.nickname || target.name;
        addLog(`${dName} dodged the attack!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'player', idx: tIdx, name: dName, hpChange: 0, hpAfter: target.currentHp, reason: `${dName} dodged!` });
        continue;
      }

      let move = getBestMove(attacker.types || ['Normal'], attacker.baseStats, attacker.speciesId, attacker.moveTier ?? 1);
      if (bothUseless) {
        move = { name: 'Struggle', power: 50, type: 'Normal', isSpecial: false, typeless: true };
      }
      if (!move.noDamage && getTypeEffectiveness(move.type, target.types || ['Normal']) === 0) {
        move = { name: 'Struggle', power: 50, type: 'Normal', isSpecial: false, typeless: true };
      }
      const attackerItems = side === 'player' ? pActiveItems : eActiveItems;
      const defenderItems = side === 'player' ? eActiveItems : pActiveItems;

      if (move.noDamage) {
        addLog(`${side === 'player' ? '' : '(enemy) '}${aName} used ${move.name}! But nothing happened!`,
               side === 'player' ? 'log-player' : 'log-enemy');
        detailedLog.push({
          type: 'attack', side, attackerIdx: aIdx, attackerName: aName,
          targetSide: tSide, targetIdx: tIdx, targetName: tName,
          moveName: move.name, moveType: move.type, damage: 0, typeEff: 1, crit: false, isSpecial: false,
          attackerHpAfter: attacker.currentHp, targetHpAfter: target.currentHp,
        });
        continue;
      }

      // Fighting trait crit bonus applies to player attacks
      const critBonus = (side === 'player' && traitFx?.critBonus > 0) ? traitFx.critBonus : 0;
      let { damage, typeEff, moveType, crit, isSpecial } = calcDamage(attacker, target, move, attackerItems, defenderItems, critBonus);

      // Normal trait: common player pokemon deal extra damage
      if (side === 'player' && traitFx?.normalCommonBonus > 0
          && typeof getPokemonRarity === 'function'
          && getPokemonRarity(attacker.speciesId) === 'common') {
        damage = Math.floor(damage * (1 + traitFx.normalCommonBonus));
      }

      // Dragon trait: accumulated bonus from KOs this fight
      if (side === 'player' && dragonDmgBonus > 0) {
        damage = Math.floor(damage * (1 + dragonDmgBonus));
      }

      if (typeof hasArtifact === 'function') {
        // Warden's Teeth: +10% per defeated enemy
        if (side === 'player' && wardenDmgBonus > 0) {
          damage = Math.floor(damage * (1 + wardenDmgBonus));
        }
        // Sparkling Stone: shiny pokemon deal 20% more damage
        if (side === 'player' && attacker.isShiny && hasArtifact('sparkling_stone')) {
          damage = Math.floor(damage * 1.2);
        }
        // Mach Bike: Ground pokemon with more speed deal 20% more damage
        if (side === 'player' && hasArtifact('mach_bike') &&
            (attacker.types || []).some(t => t.toLowerCase() === 'ground') && pSpeed > eSpeed) {
          damage = Math.floor(damage * 1.2);
        }
        // Lustrous Orb: double damage below 30% HP
        if (side === 'player' && hasArtifact('lustrous_orb') && attacker.currentHp < attacker.maxHp * 0.3) {
          damage = Math.floor(damage * 2);
        }
        // Town Map: +5% damage per unique active trait
        if (side === 'player' && hasArtifact('town_map')) {
          const traitCount = (typeof getActiveTraits === 'function') ? getActiveTraits(state.team).length : 0;
          if (traitCount > 0) damage = Math.floor(damage * (1 + traitCount * 0.05));
        }
        // Magma Emblem: player deals 30% more, takes 20% more
        if (side === 'player' && hasArtifact('magma_emblem')) damage = Math.floor(damage * 1.3);
        if (side === 'enemy'  && hasArtifact('magma_emblem')) damage = Math.floor(damage * 1.2);
        // Devon Parts: halve damage (attack twice)
        if (side === 'player' && hasArtifact('devon_parts')) damage = Math.floor(damage / 2);
      }

      const targetPreHp = target.currentHp;
      target.currentHp = Math.max(0, target.currentHp - damage);

      // Focus Band: 20% chance to survive a KO at 1 HP
      if (target.currentHp === 0 && targetPreHp > 0 && tSide === 'player' && target.heldItem?.id === 'focus_band' && rng() < 0.2) {
        target.currentHp = 1;
      }
      // Focus Sash: guaranteed survive from full HP
      if (target.currentHp === 0 && targetPreHp === target.maxHp && tSide === 'player' && target.heldItem?.id === 'focus_sash') {
        target.currentHp = 1;
      }

      // Artifact: Go-Goggles — player pokemon cannot be one-shot
      if (typeof hasArtifact === 'function' && hasArtifact('go_goggles')
          && target.currentHp <= 0 && targetPreHp > 1 && tSide === 'player') {
        target.currentHp = 1;
        addLog(`Go-Goggles protected ${tName}!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'player', idx: tIdx, name: tName, hpChange: 0, hpAfter: 1, reason: `Go-Goggles protected ${tName}!` });
      }

      // Ghost trait: first N player pokemon that would faint instead go to back at 1 HP
      if (target.currentHp === 0 && targetPreHp > 0 && tSide === 'player'
          && traitFx?.ghostSurviveCount > 0 && ghostSavesUsed < traitFx.ghostSurviveCount) {
        target.currentHp = 1;
        target._ghostDeferred = true;
        ghostSavesUsed++;
        addLog(`Phantom saved ${tName}! (1 HP — sent to back)`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'player', idx: tIdx, name: tName,
          hpChange: 0, hpAfter: 1, reason: `Phantom saved ${tName}!` });
      }

      // Artifact: Silph Scope — execute enemies below 5% HP
      if (typeof hasArtifact === 'function' && hasArtifact('silph_scope')
          && side === 'player' && target.currentHp > 0 && tSide === 'enemy'
          && target.currentHp / target.maxHp < 0.05) {
        target.currentHp = 0;
        addLog(`${tName} was executed by the Silph Scope!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'enemy', idx: tIdx, name: tName, hpChange: -target.maxHp, hpAfter: 0, reason: 'Silph Scope execute' });
      }

      let effText = '';
      if (typeEff >= 2)   effText = ' Super effective!';
      else if (typeEff === 0) effText = ' No effect!';
      else if (typeEff < 1)  effText = ' Not very effective...';

      addLog(`${side === 'player' ? '' : '(enemy) '}${aName} used ${move.name} → ${tName} took ${damage} dmg.${effText}`,
             side === 'player' ? 'log-player' : 'log-enemy');

      detailedLog.push({
        type: 'attack', side, attackerIdx: aIdx, attackerName: aName,
        targetSide: tSide, targetIdx: tIdx, targetName: tName,
        moveName: move.name, moveType, damage, typeEff, crit, isSpecial: move.isSpecial ?? isSpecial,
        attackerHpAfter: attacker.currentHp, targetHpAfter: target.currentHp,
      });

      // Life Orb recoil
      if (side === 'player' && attacker.heldItem?.id === 'life_orb') {
        const recoil = Math.max(1, Math.floor(attacker.maxHp * 0.1));
        attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
        addLog(`${aName} lost ${recoil} HP from Life Orb!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'player', idx: aIdx, name: aName,
          hpChange: -recoil, hpAfter: attacker.currentHp, reason: `${aName} lost ${recoil} HP from Life Orb!` });
      }

      // Rocky Helmet
      if (target.heldItem?.id === 'rocky_helmet') {
        const helmet = Math.max(1, Math.floor(attacker.maxHp * 0.12));
        attacker.currentHp = Math.max(0, attacker.currentHp - helmet);
        addLog(`Rocky Helmet hurt ${aName} for ${helmet} HP!`, 'log-item');
        detailedLog.push({ type: 'effect', side, idx: aIdx, name: aName,
          hpChange: -helmet, hpAfter: attacker.currentHp, reason: `Rocky Helmet hurt ${aName} for ${helmet} HP!` });
      }

      // Shell Bell
      if (side === 'player' && attacker.heldItem?.id === 'shell_bell') {
        const heal   = Math.max(1, Math.floor(damage * 0.25));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        if (actual > 0) {
          attacker.currentHp += actual;
          addLog(`Shell Bell restored ${actual} HP to ${aName}!`, 'log-item');
          detailedLog.push({ type: 'effect', side: 'player', idx: aIdx, name: aName,
            hpChange: actual, hpAfter: attacker.currentHp, reason: `Shell Bell restored ${actual} HP to ${aName}!` });
          if (typeof hasArtifact === 'function' && hasArtifact('gracidea') && rng() < 0.25) {
            attacker._gracideaDefStage   = Math.min(6, (attacker._gracideaDefStage   || 0) + 1);
            attacker._gracideaSpDefStage = Math.min(6, (attacker._gracideaSpDefStage || 0) + 1);
          }
        }
      }

      // Grass trait: lifesteal
      if (side === 'player' && traitFx?.lifestealPct > 0 && damage > 0) {
        const heal = Math.max(1, Math.floor(damage * traitFx.lifestealPct));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        if (actual > 0) {
          attacker.currentHp += actual;
          addLog(`${aName} drained ${actual} HP!`, 'log-item');
          detailedLog.push({ type: 'effect', side: 'player', idx: aIdx, name: aName,
            hpChange: actual, hpAfter: attacker.currentHp, reason: 'Overgrowth lifesteal' });
          if (typeof hasArtifact === 'function' && hasArtifact('gracidea') && rng() < 0.25) {
            attacker._gracideaDefStage   = Math.min(6, (attacker._gracideaDefStage   || 0) + 1);
            attacker._gracideaSpDefStage = Math.min(6, (attacker._gracideaSpDefStage || 0) + 1);
          }
        }
      }

      // Psychic trait: 10% splash to other enemies after player hits
      if (side === 'player' && traitFx?.splashPct > 0 && damage > 0 && target.currentHp > 0) {
        const splash = Math.max(1, Math.floor(damage * traitFx.splashPct));
        for (let si = 0; si < eTeam.length; si++) {
          if (si === eIdx || eTeam[si].currentHp <= 0) continue;
          const sp = eTeam[si];
          sp.currentHp = Math.max(0, sp.currentHp - splash);
          addLog(`${sp.name} took ${splash} Mindscape splash!`, 'log-item');
          detailedLog.push({ type: 'effect', side: 'enemy', idx: si, name: sp.name,
            hpChange: -splash, hpAfter: sp.currentHp, reason: `Mindscape splash!` });
          if (sp.currentHp <= 0) {
            addLog(`${sp.name} fainted!`, 'log-faint');
            detailedLog.push({ type: 'faint', side: 'enemy', idx: si, name: sp.name });
          }
        }
      }

      // Post-hit status applications (player attacking enemy only)
      if (side === 'player' && damage > 0 && target.currentHp > 0) {
        // Electric: paralyze
        if (traitFx?.paralyzeChance > 0 && rng() < traitFx.paralyzeChance && !_hasStatus(target, 'paralysis')) {
          _applyStatus(target, 'paralysis');
          addLog(`${tName} was paralyzed!`, 'log-item');
          detailedLog.push({ type: 'status_apply', side: 'enemy', idx: tIdx, name: tName, status: 'paralysis' });
        }
        // Fire: burn
        if (traitFx?.burnChance > 0 && rng() < traitFx.burnChance && !_hasStatus(target, 'burn')) {
          _applyStatus(target, 'burn');
          addLog(`${tName} was burned!`, 'log-item');
          detailedLog.push({ type: 'status_apply', side: 'enemy', idx: tIdx, name: tName, status: 'burn' });
        }
        // Ice: freeze
        if (traitFx?.freezeChance > 0 && rng() < traitFx.freezeChance && !_hasStatus(target, 'freeze')) {
          _applyStatus(target, 'freeze');
          addLog(`${tName} was frozen!`, 'log-item');
          detailedLog.push({ type: 'status_apply', side: 'enemy', idx: tIdx, name: tName, status: 'freeze' });
        }
        // Poison: toxic
        if (traitFx?.poisonApplyChance > 0 && rng() < traitFx.poisonApplyChance && !_hasStatus(target, 'toxic')) {
          _applyStatus(target, 'toxic');
          target._toxicStacks = 1;
          addLog(`${tName} was badly poisoned!`, 'log-item');
          detailedLog.push({ type: 'status_apply', side: 'enemy', idx: tIdx, name: tName, status: 'toxic' });
        }
        // Rock: flinch
        if (traitFx?.flinchChance > 0 && rng() < traitFx.flinchChance) {
          target._flinched = true;
        }
      }

      // Artifact: Devon Parts — second hit at same halved damage
      if (typeof hasArtifact === 'function' && hasArtifact('devon_parts') && side === 'player' && target.currentHp > 0 && damage > 0) {
        const secondDmg = damage;
        const preHp2 = target.currentHp;
        target.currentHp = Math.max(0, target.currentHp - secondDmg);
        // Silph Scope on second hit
        if (hasArtifact('silph_scope') && target.currentHp > 0 && tSide === 'enemy' && target.currentHp / target.maxHp < 0.05) {
          target.currentHp = 0;
        }
        // Go-Goggles on second hit
        if (hasArtifact('go_goggles') && target.currentHp <= 0 && preHp2 > 1 && tSide === 'player') {
          target.currentHp = 1;
        }
        addLog(`${aName} struck again → ${tName} took ${secondDmg} dmg!`, 'log-player');
        detailedLog.push({ type: 'attack', side, attackerIdx: aIdx, attackerName: aName,
          targetSide: tSide, targetIdx: tIdx, targetName: tName,
          moveName: move.name, moveType, damage: secondDmg, typeEff, crit: false, isSpecial: move.isSpecial ?? isSpecial,
          attackerHpAfter: attacker.currentHp, targetHpAfter: target.currentHp });
      }

      // Faint checks
      if (target.currentHp <= 0) {
        addLog(`${tName} fainted!`, 'log-faint');
        detailedLog.push({ type: 'faint', side: tSide, idx: tIdx, name: tName });

        // Dragon trait: gain bonus damage on KO
        if (side === 'player' && traitFx?.dragonKoBonus > 0) {
          dragonDmgBonus += traitFx.dragonKoBonus;
        }
        // Warden's Teeth: +10% per kill
        if (typeof hasArtifact === 'function' && side === 'player' && tSide === 'enemy' && hasArtifact('wardens_teeth')) {
          wardenDmgBonus += 0.10;
        }
        // Reveal Glass: 50% chance to pass status to next enemy
        if (typeof hasArtifact === 'function' && side === 'player' && tSide === 'enemy' && hasArtifact('reveal_glass')) {
          const statuses = (target.statusConditions || []).filter(s => s);
          if (statuses.length > 0) {
            const nextE = eTeam.find(ep => ep !== target && ep.currentHp > 0);
            if (nextE && rng() < 0.5) {
              const st = statuses[Math.floor(rng() * statuses.length)];
              _applyStatus(nextE, st);
              if (st === 'toxic') nextE._toxicStacks = Math.max(1, nextE._toxicStacks || 1);
              addLog(`${nextE.name} is afflicted by the lingering ${st}!`, 'log-item');
              detailedLog.push({ type: 'status_apply', side: 'enemy', idx: eTeam.indexOf(nextE), name: nextE.name, status: st });
            }
          }
        }

        const nextTeam = tSide === 'player' ? pTeam : eTeam;
        const next = nextTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0 && !x.p._ghostDeferred)
                  ?? nextTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
        if (next) {
          if (tSide === 'player') playerParticipants.add(next.idx);
          const nName = next.p.nickname || next.p.name;
          addLog(`${nName} was sent out!`, tSide === 'player' ? 'log-player' : 'log-enemy');
          detailedLog.push({ type: 'send_out', side: tSide, idx: next.idx, name: nName });
        }
      }

      if (attacker.currentHp <= 0) {
        addLog(`${aName} fainted!`, 'log-faint');
        detailedLog.push({ type: 'faint', side, idx: aIdx, name: aName });
        const nextTeam = side === 'player' ? pTeam : eTeam;
        const next = nextTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0 && !x.p._ghostDeferred)
                  ?? nextTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
        if (next) {
          if (side === 'player') playerParticipants.add(next.idx);
          const nName = next.p.nickname || next.p.name;
          addLog(`${nName} was sent out!`, side === 'player' ? 'log-player' : 'log-enemy');
          detailedLog.push({ type: 'send_out', side, idx: next.idx, name: nName });
        }
      }

      // Artifact: Acro Bike — switch out after attacking
      if (typeof hasArtifact === 'function' && hasArtifact('acro_bike') && side === 'player' && attacker.currentHp > 0) {
        attacker._acroSwitched = true;
        const nextP = pTeam.find(p => p.currentHp > 0 && !p._ghostDeferred && !p._acroSwitched && p !== attacker);
        if (nextP) {
          playerParticipants.add(pTeam.indexOf(nextP));
          addLog(`${aName} switched out! ${nextP.nickname || nextP.name} is ready!`, 'log-player');
          detailedLog.push({ type: 'send_out', side: 'player', idx: pTeam.indexOf(nextP), name: nextP.nickname || nextP.name });
        }
      }
    }

    // ---- End-of-round effects ----

    // Burn damage to all burned pokemon (1/8 max HP)
    for (const [team, teamSide] of [[pTeam, 'player'], [eTeam, 'enemy']]) {
      for (let i = 0; i < team.length; i++) {
        const p = team[i];
        if (p.currentHp <= 0 || !_hasStatus(p, 'burn')) continue;
        let dot = Math.max(1, Math.floor(p.maxHp / 8));
        if (typeof hasArtifact === 'function' && teamSide === 'enemy' && hasArtifact('lunar_wing')) dot = Math.floor(dot * 1.5);
        p.currentHp = Math.max(0, p.currentHp - dot);
        const pn = p.nickname || p.name;
        addLog(`${teamSide === 'enemy' ? '(enemy) ' : ''}${pn} is hurt by its burn! ${dot} HP.`, 'log-item');
        detailedLog.push({ type: 'effect', side: teamSide, idx: i, name: pn,
          hpChange: -dot, hpAfter: p.currentHp, reason: `${pn} is burned! -${dot} HP` });
        if (p.currentHp <= 0) {
          addLog(`${pn} fainted!`, 'log-faint');
          detailedLog.push({ type: 'faint', side: teamSide, idx: i, name: pn });
        }
      }
    }

    // Toxic damage (doubles each turn)
    for (const [team, teamSide] of [[pTeam, 'player'], [eTeam, 'enemy']]) {
      for (let i = 0; i < team.length; i++) {
        const p = team[i];
        if (p.currentHp <= 0 || !_hasStatus(p, 'toxic')) continue;
        if (!p._toxicStacks) p._toxicStacks = 1;
        let dot = Math.max(1, Math.floor(p.maxHp * p._toxicStacks / 16));
        if (typeof hasArtifact === 'function' && teamSide === 'enemy' && hasArtifact('lunar_wing')) dot = Math.floor(dot * 1.5);
        p.currentHp = Math.max(0, p.currentHp - dot);
        p._toxicStacks = Math.min(p._toxicStacks * 2, 16); // cap at 16/16
        const pn = p.nickname || p.name;
        addLog(`${teamSide === 'enemy' ? '(enemy) ' : ''}${pn} is badly poisoned! ${dot} HP.`, 'log-item');
        detailedLog.push({ type: 'effect', side: teamSide, idx: i, name: pn,
          hpChange: -dot, hpAfter: p.currentHp, reason: `${pn} toxic! -${dot} HP` });
        if (p.currentHp <= 0) {
          addLog(`${pn} fainted!`, 'log-faint');
          detailedLog.push({ type: 'faint', side: teamSide, idx: i, name: pn });
          if (teamSide === 'enemy') {
            const nextE = eTeam.map((ep, ei) => ({ p: ep, idx: ei })).find(x => x.p.currentHp > 0);
            if (nextE) {
              addLog(`${nextE.p.name} was sent out!`, 'log-enemy');
              detailedLog.push({ type: 'send_out', side: 'enemy', idx: nextE.idx, name: nextE.p.name });
            }
          }
        }
      }
    }

    // Water trait: heal active player pokemon each turn
    if (traitFx?.waterHealPct > 0) {
      const active = pTeam.map((p, i) => ({ p, i })).find(x => x.p.currentHp > 0 && !x.p._ghostDeferred)
                  ?? pTeam.map((p, i) => ({ p, i })).find(x => x.p.currentHp > 0);
      if (active) {
        const heal = Math.max(1, Math.floor(active.p.maxHp * traitFx.waterHealPct));
        const actual = Math.min(heal, active.p.maxHp - active.p.currentHp);
        if (actual > 0) {
          active.p.currentHp += actual;
          const n = active.p.nickname || active.p.name;
          addLog(`${n} healed ${actual} HP from Torrent!`, 'log-item');
          detailedLog.push({ type: 'effect', side: 'player', idx: active.i, name: n,
            hpChange: actual, hpAfter: active.p.currentHp, reason: `Torrent healed ${actual} HP` });
          if (typeof hasArtifact === 'function' && hasArtifact('gracidea') && rng() < 0.25) {
            active.p._gracideaDefStage   = Math.min(6, (active.p._gracideaDefStage   || 0) + 1);
            active.p._gracideaSpDefStage = Math.min(6, (active.p._gracideaSpDefStage || 0) + 1);
          }
        }
      }
    }

    // Leftovers: heal active player pokemon 1/16 maxHP each round (if they hold it)
    const activeP = pTeam.map((p, i) => ({ p, i })).find(x => x.p.currentHp > 0);
    if (activeP?.p.heldItem?.id === 'leftovers') {
      const heal = Math.max(1, Math.floor(activeP.p.maxHp / 16));
      const actual = Math.min(heal, activeP.p.maxHp - activeP.p.currentHp);
      if (actual > 0) {
        activeP.p.currentHp += actual;
        const n = activeP.p.nickname || activeP.p.name;
        addLog(`Leftovers restored ${actual} HP to ${n}!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'player', idx: activeP.i, name: n,
          hpChange: actual, hpAfter: activeP.p.currentHp, reason: `Leftovers restored ${actual} HP to ${n}!` });
        if (typeof hasArtifact === 'function' && hasArtifact('gracidea') && rng() < 0.25) {
          activeP.p._gracideaDefStage   = Math.min(6, (activeP.p._gracideaDefStage   || 0) + 1);
          activeP.p._gracideaSpDefStage = Math.min(6, (activeP.p._gracideaSpDefStage || 0) + 1);
        }
      }
    }
  }

  const playerWon = pTeam.some(p => p.currentHp > 0) && !eTeam.some(p => p.currentHp > 0);
  addLog(playerWon ? '--- Victory! ---' : '--- Defeat! ---', playerWon ? 'log-win' : 'log-lose');
  detailedLog.push({ type: 'result', playerWon });

  return { playerWon, log, detailedLog, pTeam, eTeam, playerParticipants };
}

function getLevelGain(team, bagItems) {
  return 2;
}

// Applies level gains and returns an array of level-up events for animation.
// Each entry: { idx, pokemon, oldLevel, newLevel, preHp }
// baseGainOverride: if set, uses this as the base gain (e.g. 1 for wild battles)
function applyLevelGain(team, bagItems, participantIdxs, maxEnemyLevel = 0, hardMode = false, baseGainOverride = null) {
  const isWild = baseGainOverride !== null;
  const baseGain = isWild ? baseGainOverride : (hardMode ? 1 : getLevelGain(team, bagItems));
  const levelUps = [];

  for (let i = 0; i < team.length; i++) {
    const p = team[i];
    const getsXp = p.currentHp > 0 || (participantIdxs && participantIdxs.has(i));
    if (!getsXp) continue;

    const luckyBonus = isWild && p.heldItem?.id === 'lucky_egg' ? 1 : 0;
    let gain = baseGain + luckyBonus;

    // Bug trait: chance of +1 bonus level in endless mode
    const isEndlessMode = typeof state !== 'undefined' && state.isEndless;
    if (isEndlessMode && typeof getEndlessTraitEffects === 'function') {
      const fx = getEndlessTraitEffects(state.team);
      if (fx.bonusLevelChance > 0 && rng() < fx.bonusLevelChance) gain += 1;
    }

    const oldLevel = p.level;
    const newLevel = isEndlessMode ? oldLevel + gain : Math.min(100, oldLevel + gain);
    if (newLevel === oldLevel) continue;

    const preHp = p.currentHp;
    p.level = newLevel;
    const newMaxHp = calcHp(p.baseStats.hp, newLevel);
    if (p.currentHp > 0) {
      p.currentHp = Math.min(p.currentHp + (newMaxHp - p.maxHp), newMaxHp);
    }
    p.maxHp = newMaxHp;

    levelUps.push({ idx: i, pokemon: p, oldLevel, newLevel, preHp });
  }

  return levelUps;
}
