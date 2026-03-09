// battle.js - Auto-battle engine (1v1: active pokemon only)

function calcDamage(attacker, defender, move, items) {
  const lvl = attacker.level;
  const atk = getEffectiveStat(attacker, 'atk', items);
  const def = getEffectiveStat(defender, 'def', items);
  const power = move.power || 40;
  const moveType = move.type || 'Normal';

  let damage = Math.floor(((2 * lvl / 5 + 2) * power * atk / def / 50 + 2));

  const typeEff = getTypeEffectiveness(moveType, defender.types || ['Normal']);
  damage = Math.floor(damage * typeEff);

  // STAB
  if (attacker.types && attacker.types.some(t => t.toLowerCase() === moveType.toLowerCase())) {
    damage = Math.floor(damage * 1.5);
  }

  const typeBoostItem = getTypeBoostItem(moveType, items);
  if (typeBoostItem) damage = Math.floor(damage * 1.5);

  if (hasItem(items, 'life_orb'))    damage = Math.floor(damage * 1.3);
  if (hasItem(items, 'choice_band')) damage = Math.floor(damage * 1.5);
  if (hasItem(items, 'scope_lens') && Math.random() < 0.2) damage = Math.floor(damage * 1.5);
  if (hasItem(items, 'razor_claw')  && Math.random() < 0.4) damage = Math.floor(damage * 1.5);
  if (hasItem(items, 'expert_belt') && typeEff >= 2) damage = Math.floor(damage * 1.2);
  if (hasItem(items, 'air_balloon') && moveType.toLowerCase() === 'ground') damage = 0;

  const rng = 0.85 + Math.random() * 0.15;
  damage = Math.max(1, Math.floor(damage * rng));

  return { damage, typeEff, moveType };
}

function getEffectiveStat(pokemon, stat, items) {
  let val = pokemon.baseStats ? pokemon.baseStats[stat] || 50 : 50;
  val = Math.floor(val * pokemon.level / 50) + 5;

  if (stat === 'def') {
    if (hasItem(items, 'choice_band'))  val = Math.floor(val * 0.75);
    if (hasItem(items, 'eviolite'))     val = Math.floor(val * 1.5);
    if (hasItem(items, 'assault_vest')) val = Math.floor(val * 1.5);
  }
  if (stat === 'atk') {
    if (hasItem(items, 'choice_band'))  val = Math.floor(val * 1.5);
    if (hasItem(items, 'choice_scarf')) val = Math.floor(val * 0.75);
  }
  if (stat === 'speed') {
    if (hasItem(items, 'macho_brace'))  val = Math.floor(val * 0.75);
    if (hasItem(items, 'choice_scarf')) val = Math.floor(val * 1.5);
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

function runBattle(playerTeam, enemyTeam, playerItems, enemyItems, onLog) {
  const items = playerItems; // alias for applyLevelGain / leftovers / focus band (player-only)
  const pTeam = playerTeam.map(p => ({ ...p }));
  const eTeam = enemyTeam.map(p => ({
    ...p,
    currentHp: p.currentHp !== undefined ? p.currentHp : calcHp(p.baseStats.hp, p.level),
    maxHp:     p.maxHp     !== undefined ? p.maxHp     : calcHp(p.baseStats.hp, p.level),
  }));

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

    // Active = first alive on each side
    const pEntry = pTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
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

    // Speed determines turn order
    const pSpeed = getEffectiveStat(pActive, 'speed', playerItems);
    const eSpeed = getEffectiveStat(eActive, 'speed', enemyItems);

    const turns = pSpeed >= eSpeed
      ? [{ attacker: pActive, aIdx: pIdx, side: 'player', target: eActive, tIdx: eIdx, tSide: 'enemy' },
         { attacker: eActive, aIdx: eIdx, side: 'enemy',  target: pActive, tIdx: pIdx, tSide: 'player' }]
      : [{ attacker: eActive, aIdx: eIdx, side: 'enemy',  target: pActive, tIdx: pIdx, tSide: 'player' },
         { attacker: pActive, aIdx: pIdx, side: 'player', target: eActive, tIdx: eIdx, tSide: 'enemy' }];

    for (const { attacker, aIdx, side, target, tIdx, tSide } of turns) {
      if (attacker.currentHp <= 0 || target.currentHp <= 0) continue;

      const move = getBestMove(attacker.types || ['Normal']);
      const attackerItems = side === 'player' ? playerItems : enemyItems;
      const { damage, typeEff, moveType } = calcDamage(attacker, target, move, attackerItems);

      const targetPreHp = target.currentHp;
      target.currentHp = Math.max(0, target.currentHp - damage);

      // Focus Band: 10% chance to survive a KO at 1 HP
      if (target.currentHp === 0 && targetPreHp > 0 && tSide === 'player' && hasItem(items, 'focus_band') && Math.random() < 0.1) {
        target.currentHp = 1;
      }

      const aName = attacker.nickname || attacker.name;
      const tName = target.nickname || target.name;

      let effText = '';
      if (typeEff >= 2)   effText = ' Super effective!';
      else if (typeEff === 0) effText = ' No effect!';
      else if (typeEff < 1)  effText = ' Not very effective...';

      addLog(`${side === 'player' ? '' : '(enemy) '}${aName} used ${move.name} → ${tName} took ${damage} dmg.${effText}`,
             side === 'player' ? 'log-player' : 'log-enemy');

      detailedLog.push({
        type: 'attack', side, attackerIdx: aIdx, attackerName: aName,
        targetSide: tSide, targetIdx: tIdx, targetName: tName,
        moveName: move.name, moveType, damage, typeEff,
        attackerHpAfter: attacker.currentHp, targetHpAfter: target.currentHp,
      });

      // Life Orb recoil
      if (side === 'player' && hasItem(items, 'life_orb')) {
        const recoil = Math.max(1, Math.floor(attacker.maxHp * 0.1));
        attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
        addLog(`${aName} lost ${recoil} HP from Life Orb!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'player', idx: aIdx, name: aName,
          hpChange: -recoil, hpAfter: attacker.currentHp, reason: `${aName} lost ${recoil} HP from Life Orb!` });
      }

      // Rocky Helmet
      if (side === 'enemy' && hasItem(items, 'rocky_helmet')) {
        const helmet = Math.max(1, Math.floor(attacker.maxHp * 0.15));
        attacker.currentHp = Math.max(0, attacker.currentHp - helmet);
        addLog(`Rocky Helmet hurt ${aName} for ${helmet} HP!`, 'log-item');
        detailedLog.push({ type: 'effect', side: 'enemy', idx: aIdx, name: aName,
          hpChange: -helmet, hpAfter: attacker.currentHp, reason: `Rocky Helmet hurt ${aName} for ${helmet} HP!` });
      }

      // Shell Bell
      if (side === 'player' && hasItem(items, 'shell_bell')) {
        const heal   = Math.max(1, Math.floor(damage * 0.25));
        const actual = Math.min(heal, attacker.maxHp - attacker.currentHp);
        if (actual > 0) {
          attacker.currentHp += actual;
          addLog(`Shell Bell restored ${actual} HP to ${aName}!`, 'log-item');
          detailedLog.push({ type: 'effect', side: 'player', idx: aIdx, name: aName,
            hpChange: actual, hpAfter: attacker.currentHp, reason: `Shell Bell restored ${actual} HP to ${aName}!` });
        }
      }

      // Faint checks
      if (target.currentHp <= 0) {
        addLog(`${tName} fainted!`, 'log-faint');
        detailedLog.push({ type: 'faint', side: tSide, idx: tIdx, name: tName });
        const nextTeam = tSide === 'player' ? pTeam : eTeam;
        const next = nextTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
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
        const next = nextTeam.map((p, i) => ({ p, idx: i })).find(x => x.p.currentHp > 0);
        if (next) {
          if (side === 'player') playerParticipants.add(next.idx);
          const nName = next.p.nickname || next.p.name;
          addLog(`${nName} was sent out!`, side === 'player' ? 'log-player' : 'log-enemy');
          detailedLog.push({ type: 'send_out', side, idx: next.idx, name: nName });
        }
      }
    }

    // Leftovers: heal active player pokemon 1/16 maxHP each round
    if (hasItem(items, 'leftovers')) {
      const active = pTeam.map((p, i) => ({ p, i })).find(x => x.p.currentHp > 0);
      if (active) {
        const heal = Math.max(1, Math.floor(active.p.maxHp / 16));
        const actual = Math.min(heal, active.p.maxHp - active.p.currentHp);
        if (actual > 0) {
          active.p.currentHp += actual;
          const n = active.p.nickname || active.p.name;
          addLog(`Leftovers restored ${actual} HP to ${n}!`, 'log-item');
          detailedLog.push({ type: 'effect', side: 'player', idx: active.i, name: n,
            hpChange: actual, hpAfter: active.p.currentHp, reason: `Leftovers restored ${actual} HP to ${n}!` });
        }
      }
    }
  }

  const playerWon = pTeam.some(p => p.currentHp > 0) && !eTeam.some(p => p.currentHp > 0);
  addLog(playerWon ? '--- Victory! ---' : '--- Defeat! ---', playerWon ? 'log-win' : 'log-lose');
  detailedLog.push({ type: 'result', playerWon });

  return { playerWon, log, detailedLog, pTeam, eTeam, playerParticipants };
}

function getLevelGain(items) {
  let macho = hasItem(items, 'macho_brace') ? 1 : 0;
  let lucky = hasItem(items, 'lucky_egg') ? 1 : 0;
  if (macho && lucky) return 5;
  if (macho) return 4;
  if (lucky) return 3;
  return 2;
}

// Applies level gains and returns an array of level-up events for animation.
// Each entry: { idx, pokemon, oldLevel, newLevel, preHp }
function applyLevelGain(team, items, participantIdxs, maxEnemyLevel = 0) {
  const baseGain = getLevelGain(items);
  const levelUps = [];

  for (let i = 0; i < team.length; i++) {
    const p = team[i];
    const getsXp = p.currentHp > 0 || (participantIdxs && participantIdxs.has(i));
    if (!getsXp) continue;

    const overleveled = maxEnemyLevel > 0 && p.level > maxEnemyLevel + 5;
    const gain = overleveled ? 1 : baseGain;
    const oldLevel = p.level;
    const newLevel = Math.min(100, oldLevel + gain);
    if (newLevel === oldLevel) continue; // already at cap

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
