// game.js - Central game state and entry point

let state = {
  currentMap: 0,
  currentNode: null,
  team: [],
  items: [],
  badges: 0,
  map: null,
  eliteIndex: 0,
  trainer: 'boy',
  starterSpeciesId: null,
  maxTeamSize: 1,
  hardMode: false,
};

// ---- Initialization ----

async function initGame() {
  showScreen('title-screen');
  document.getElementById('btn-new-run').addEventListener('click', () => startNewRun(false));

  const hardBtn = document.getElementById('btn-hard-run');
  const hardHint = document.getElementById('hard-mode-hint');
  if (isPokedexComplete()) {
    hardBtn.disabled = false;
    hardBtn.textContent = '💀 Hard Mode';
    hardHint.textContent = 'Every fight grants exactly 1 level';
  } else {
    hardHint.textContent = 'Complete the Pokédex to unlock';
  }
  hardBtn.addEventListener('click', () => startNewRun(true));
}

async function startNewRun(hardMode = false) {
  state = { currentMap: 0, currentNode: null, team: [], items: [], badges: 0, map: null, eliteIndex: 0, trainer: 'boy', starterSpeciesId: null, maxTeamSize: 1, hardMode };
  await showTrainerSelect();
}

async function showTrainerSelect() {
  showScreen('trainer-screen');
  const boyCard  = document.getElementById('trainer-boy');
  const girlCard = document.getElementById('trainer-girl');
  boyCard.querySelector('.trainer-icon-wrap').innerHTML  = TRAINER_SVG.boy;
  girlCard.querySelector('.trainer-icon-wrap').innerHTML = TRAINER_SVG.girl;

  await new Promise(resolve => {
    function pick(gender) { state.trainer = gender; resolve(); }
    boyCard.onclick   = () => pick('boy');
    boyCard.onkeydown = e => { if (e.key==='Enter'||e.key===' ') pick('boy'); };
    girlCard.onclick   = () => pick('girl');
    girlCard.onkeydown = e => { if (e.key==='Enter'||e.key===' ') pick('girl'); };
  });
  await showStarterSelect();
}

async function showStarterSelect() {
  showScreen('starter-screen');
  const container = document.getElementById('starter-choices');
  container.innerHTML = '<div class="loading">Loading starters...</div>';

  const starters = await Promise.all(STARTER_IDS.map(id => fetchPokemonById(id)));
  const startLevel = 5;

  container.innerHTML = '';
  for (const species of starters) {
    if (!species) continue;
    const isShiny = Math.random() < 0.01; // 1/100 shiny chance for starters
    const inst = createInstance(species, startLevel, isShiny);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(inst, true, false);
    const card = wrapper.querySelector('.poke-card');
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => selectStarter(inst));
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') selectStarter(inst); });
    container.appendChild(card);
  }
}

function selectStarter(pokemon) {
  const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.speciesId}.png`;
  markPokedexCaught(pokemon.speciesId, pokemon.name, pokemon.types, normalUrl);
  if (pokemon.isShiny) markShinyDexCaught(pokemon.speciesId, pokemon.name, pokemon.types, pokemon.spriteUrl);
  state.team = [pokemon];
  state.starterSpeciesId = pokemon.speciesId;
  state.maxTeamSize = 1;
  startMap(0);
}

// ---- Map Management ----

function startMap(mapIndex) {
  state.currentMap = mapIndex;
  state.map = generateMap(mapIndex);

  // Full heal between arenas (skip the very first map)
  if (mapIndex > 0) {
    for (const p of state.team) {
      p.currentHp = p.maxHp;
    }
  }

  const startNode = state.map.nodes['n0_0'];
  state.currentNode = startNode;

  showMapScreen();
}

function showMapScreen() {
  showScreen('map-screen');
  const mapInfo = document.getElementById('map-info');
  if (mapInfo) {
    const isFinal = state.currentMap === 8;
    const leader = isFinal ? null : GYM_LEADERS[state.currentMap];
    const range = MAP_LEVEL_RANGES[state.currentMap];
    mapInfo.innerHTML = isFinal
      ? `<span>Elite Four & Champion</span><span>Levels ${range[0]}–${range[1]}</span>`
      : `<span>Map ${state.currentMap+1}: vs <b>${leader.name}</b> (${leader.type})</span><span>Levels ${range[0]}–${range[1]}</span>`;
  }
  const badgeEl = document.getElementById('badge-count');
  if (badgeEl) badgeEl.textContent = `Badges: ${state.badges}/8`;
  const winsEl = document.getElementById('elite-wins-count');
  if (winsEl) winsEl.textContent = `Wins: ${getEliteWins()}`;

  renderTeamBar(state.team);
  renderItemBadges(state.items);

  const mapContainer = document.getElementById('map-container');
  renderMap(state.map, mapContainer, onNodeClick);
}

async function onNodeClick(node) {
  state.currentNode = node;
  let resolvedType = node.type;

  if (node.type === NODE_TYPES.QUESTION) {
    resolvedType = resolveQuestionMark();
  }

  switch (resolvedType) {
    case NODE_TYPES.BATTLE:
      await doBattleNode(node);
      break;
    case NODE_TYPES.CATCH:
      await doCatchNode(node);
      break;
    case NODE_TYPES.ITEM:
      doItemNode(node);
      break;
    case NODE_TYPES.BOSS:
      await doBossNode(node);
      break;
    case NODE_TYPES.POKECENTER:
      doPokeCenterNode(node);
      break;
    case 'shiny':
      await doShinyNode(node);
      break;
    case 'mega':
      doMegaNode(node);
      break;
    default:
      await doBattleNode(node);
  }
}

function resolveQuestionMark() {
  const r = Math.random();
  if (r < 0.4) return NODE_TYPES.BATTLE;
  if (r < 0.6) return NODE_TYPES.CATCH;
  if (r < 0.8) return NODE_TYPES.ITEM;
  // Hard mode win reward: shiny chance doubled (10% → 20%)
  const shinyThreshold = hasHardModeWin() ? 0.8 : 0.9;
  if (r < shinyThreshold) return 'shiny';
  return 'mega';
}

// ---- Node Handlers ----

// Returns a level scaled to the node's layer (layer 1 = map min, layer 6 = map max).
function getLevelForNode(node) {
  const [minL, maxL] = MAP_LEVEL_RANGES[state.currentMap];
  const t = Math.min(1, Math.max(0, (node.layer - 1) / 5)); // 0.0 at layer 1, 1.0 at layer 6
  const base = Math.round(minL + t * (maxL - minL));
  const spread = Math.max(1, Math.round((maxL - minL) / 8));
  return Math.min(maxL, Math.max(minL, base + Math.floor(Math.random() * spread)));
}

async function doBattleNode(node) {
  const level = getLevelForNode(node);
  let choices = await getCatchChoices(state.currentMap);

  // On the first layer of the first map, exclude enemies super effective against the starter
  if (state.currentMap === 0 && node.layer === 1 && state.team.length > 0) {
    const starterTypes = state.team[0].types || [];
    const isSafe = sp => !(sp.types || []).some(et =>
      starterTypes.some(st => (TYPE_CHART[et]?.[st] || 1) >= 2)
    );
    const safe = choices.filter(isSafe);
    if (safe.length > 0) {
      choices = safe;
    } else {
      // Fallback: Eevee (Normal type, never super effective)
      const eevee = await fetchPokemonById(133);
      if (eevee) choices = [eevee];
    }
  }

  const enemySpecies = choices[Math.floor(Math.random() * choices.length)];
  if (!enemySpecies) {
    advanceFromNode(state.map, node.id);
    showMapScreen();
    return;
  }
  const enemy = createInstance(enemySpecies, level);
  const titleEl = document.getElementById('battle-title');
  const subEl = document.getElementById('battle-subtitle');
  if (titleEl) titleEl.textContent = `Wild ${enemy.name} appeared!`;
  if (subEl) subEl.textContent = `Level ${enemy.level}`;
  await runBattleScreen([enemy], false, () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  }, () => {
    showGameOver();
  });
}

async function doBossNode(node) {
  if (state.currentMap === 8) {
    await doElite4();
    return;
  }
  const leader = GYM_LEADERS[state.currentMap];
  const enemyTeam = leader.team.map(p => createInstance(p, p.level));

  showScreen('battle-screen');
  document.getElementById('battle-title').textContent = `Gym Battle vs ${leader.name}!`;
  document.getElementById('battle-subtitle').textContent = `${leader.badge} is on the line!`;
  await runBattleScreen(enemyTeam, true, () => {
    state.badges++;
    advanceFromNode(state.map, node.id);
    showBadgeScreen(leader);
    const ach = unlockAchievement(`gym_${state.currentMap}`);
    if (ach) showAchievementToast(ach);
  }, () => {
    showGameOver();
  }, leader.name, leader.items || []);
}

async function doElite4() {
  const bosses = ELITE_4;
  for (let i = state.eliteIndex; i < bosses.length; i++) {
    state.eliteIndex = i;
    const boss = bosses[i];
    const enemyTeam = boss.team.map(p => createInstance(p, p.level));

    showScreen('battle-screen');
    document.getElementById('battle-title').textContent = `${boss.title}: ${boss.name}!`;
    document.getElementById('battle-subtitle').textContent = i === 4 ? 'Final Battle!' : `Elite Four - Battle ${i+1}/4`;
    const won = await new Promise(resolve => {
      runBattleScreen(enemyTeam, true, () => resolve(true), () => resolve(false), boss.name, boss.items || []);
    });

    if (!won) { showGameOver(); return; }
    if (i < bosses.length - 1) {
      await showEliteTransition(boss.name, i + 1);
    }
  }
  const eliteAch = unlockAchievement('elite_four');
  if (eliteAch) showAchievementToast(eliteAch);
  showWinScreen();
}

function showEliteTransition(defeatedName, nextIndex) {
  return new Promise(resolve => {
    const el = document.getElementById('transition-screen');
    if (!el) { resolve(); return; }
    document.getElementById('transition-msg').textContent = `${defeatedName} defeated!`;
    document.getElementById('transition-sub').textContent =
      nextIndex < 4 ? `Next: ${ELITE_4[nextIndex].name}...` : `The Champion awaits!`;
    showScreen('transition-screen');
    setTimeout(() => resolve(), 2000);
  });
}

async function doCatchNode(node) {
  showScreen('catch-screen');
  renderTeamBar(state.team, document.getElementById('catch-team-bar'));
  const choicesEl = document.getElementById('catch-choices');
  choicesEl.innerHTML = '<div class="loading">Finding Pokemon...</div>';

  const choices = await getCatchChoices(state.currentMap);
  const level = getLevelForNode(node);

  const instances = choices.map(sp => createInstance(sp, level));

  choicesEl.innerHTML = '';
  const dex = getPokedex();
  for (const inst of instances) {
    const caught = !!(dex[inst.speciesId]?.caught);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(inst, true, false, caught);
    const card = wrapper.querySelector('.poke-card');
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => catchPokemon(inst, node));
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') catchPokemon(inst, node); });
    choicesEl.appendChild(card);
  }

  document.getElementById('btn-skip-catch').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

function checkDexAchievements() {
  if (isPokedexComplete()) {
    const ach = unlockAchievement('pokedex_complete');
    if (ach) showAchievementToast(ach);
  }
  if (isShinyDexComplete()) {
    const ach = unlockAchievement('shinydex_complete');
    if (ach) showAchievementToast(ach);
  }
}

function catchPokemon(pokemon, node) {
  markPokedexCaught(pokemon.speciesId, pokemon.name, pokemon.types, pokemon.spriteUrl);
  checkDexAchievements();
  if (state.team.length < 6) {
    state.team.push(pokemon);
    if (state.team.length > state.maxTeamSize) state.maxTeamSize = state.team.length;
    advanceFromNode(state.map, node.id);
    showMapScreen();
  } else {
    showSwapScreen(pokemon, node);
  }
}

function showSwapScreen(newPoke, node) {
  showScreen('swap-screen');
  const el = document.getElementById('swap-choices');
  el.innerHTML = `<p class="swap-prompt">Your team is full! Choose a Pokemon to release:</p>`;
  for (let i = 0; i < state.team.length; i++) {
    const p = state.team[i];
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(p, true, false);
    const card = wrapper.querySelector('.poke-card');
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    const idx = i;
    card.addEventListener('click', () => {
      if (newPoke.isShiny) markShinyDexCaught(newPoke.speciesId, newPoke.name, newPoke.types, newPoke.spriteUrl);
      const released = state.team[idx];
      if (released.heldItem) state.items.push(released.heldItem);
      state.team.splice(idx, 1, newPoke);
      advanceFromNode(state.map, node.id);
      showMapScreen();
    });
    el.appendChild(card);
  }
  document.getElementById('btn-cancel-swap').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

function doItemNode(node) {
  showScreen('item-screen');
  renderTeamBar(state.team, document.getElementById('item-team-bar'));

  // Exclude items already in bag or held by any Pokemon
  const usedIds = new Set([
    ...state.items.map(it => it.id),
    ...state.team.filter(p => p.heldItem).map(p => p.heldItem.id),
  ]);
  const available = ITEM_POOL.filter(it =>
    !usedIds.has(it.id) && (it.minMap === undefined || state.currentMap >= it.minMap)
  );
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 2);

  const el = document.getElementById('item-choices');
  el.innerHTML = '';
  for (const item of picks) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `<div class="item-icon">${itemIconHtml(item, 36)}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>`;
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
      openItemEquipModal(item, {
        onComplete: () => { advanceFromNode(state.map, node.id); showMapScreen(); },
      });
    });
    el.appendChild(div);
  }

  document.getElementById('btn-skip-item').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
}

function openItemEquipModal(item, { fromBagIdx = -1, fromPokemonIdx = -1, onComplete = null } = {}) {
  document.getElementById('item-equip-modal')?.remove();

  const done = onComplete || (() => {
    renderItemBadges(state.items);
    renderTeamBar(state.team);
  });

  const modal = document.createElement('div');
  modal.id = 'item-equip-modal';
  modal.className = 'item-equip-overlay';

  const rows = state.team.map((p, i) => {
    const isSelf = fromPokemonIdx === i;
    const hasHeld = !!p.heldItem;
    const btnLabel = isSelf ? 'Holding' : hasHeld ? 'Swap' : 'Equip';
    return `<div class="equip-pokemon-row">
      <img src="${p.spriteUrl}" class="equip-poke-sprite" onerror="this.style.display='none'">
      <div class="equip-poke-info">
        <div class="equip-poke-name">${p.nickname || p.name}</div>
        <div class="equip-poke-lv">Lv${p.level}</div>
      </div>
      <div class="equip-held-slot">
        ${hasHeld
          ? `<span class="equip-held-item" title="${p.heldItem.desc}">${itemIconHtml(p.heldItem, 18)} ${p.heldItem.name}</span>`
          : '<span class="equip-empty-slot">— empty —</span>'}
      </div>
      <div class="equip-btn-group">
        ${isSelf
          ? `<button class="equip-btn equip-btn-unequip" data-unequip="${i}">Unequip</button>`
          : `<button class="equip-btn${hasHeld ? ' equip-btn-swap' : ''}" data-idx="${i}">${btnLabel}</button>`}
        ${hasHeld && !isSelf ? `<button class="equip-btn equip-btn-unequip" data-unequip="${i}" title="Unequip ${p.heldItem.name}">×</button>` : ''}
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="item-equip-box">
      <div class="equip-item-header">
        <span class="equip-item-icon">${itemIconHtml(item, 32)}</span>
        <div>
          <div class="equip-item-name">${item.name}</div>
          <div class="equip-item-desc">${item.desc}</div>
        </div>
      </div>
      <div class="equip-pokemon-list">${rows}</div>
      <button id="btn-equip-to-bag" class="btn-secondary" style="width:100%;margin-top:8px;">
        ${fromPokemonIdx >= 0 ? '⬇ Unequip (return to bag)' : 'Keep in Bag'}
      </button>
    </div>`;

  document.body.appendChild(modal);

  // Unequip buttons — strip item off a Pokemon and bag it, without equipping current item
  modal.querySelectorAll('[data-unequip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.unequip);
      const pokemon = state.team[idx];
      if (pokemon.heldItem) {
        state.items.push(pokemon.heldItem);
        pokemon.heldItem = null;
      }
      modal.remove();
      done();
    });
  });

  modal.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const pokemon = state.team[idx];
      const displaced = pokemon.heldItem;

      // Remove item from its source
      if (fromBagIdx >= 0) {
        state.items.splice(fromBagIdx, 1);
      } else if (fromPokemonIdx >= 0) {
        state.team[fromPokemonIdx].heldItem = null;
      }

      // If target already held something, send it to bag
      if (displaced) state.items.push(displaced);

      pokemon.heldItem = item;
      modal.remove();
      done();
    });
  });

  modal.querySelector('#btn-equip-to-bag').addEventListener('click', () => {
    if (fromPokemonIdx >= 0) {
      state.team[fromPokemonIdx].heldItem = null;
      state.items.push(item);
    } else if (fromBagIdx < 0) {
      // Brand new item — put in bag
      state.items.push(item);
    }
    // fromBagIdx >= 0 means it's already in bag — do nothing
    modal.remove();
    done();
  });

  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); done(); } });
}

function doPokeCenterNode(node) {
  for (const p of state.team) p.currentHp = p.maxHp;
  advanceFromNode(state.map, node.id);
  showMapScreen();
  showMapNotification('🏥 Your team was fully healed!');
}

async function doShinyNode(node) {
  const choices = await getCatchChoices(state.currentMap);
  const level = getLevelForNode(node);
  const species = choices[0];
  if (!species) { advanceFromNode(state.map, node.id); showMapScreen(); return; }

  const shiny = createInstance(species, level, true);

  const shinyCaught = !!(getShinyDex()[shiny.speciesId]);
  showScreen('shiny-screen');
  document.getElementById('shiny-content').innerHTML = `
    <div class="shiny-title">✨ A Shiny Pokemon appeared!</div>
    ${renderPokemonCard(shiny, false, false, shinyCaught)}
    <button id="btn-take-shiny" class="btn-primary">Take ${shiny.name}!</button>
  `;
  document.getElementById('btn-take-shiny').onclick = () => {
    if (state.team.length < 6) {
      const normalUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny.speciesId}.png`;
      markPokedexCaught(shiny.speciesId, shiny.name, shiny.types, normalUrl);
      markShinyDexCaught(shiny.speciesId, shiny.name, shiny.types, shiny.spriteUrl);
      checkDexAchievements();
      state.team.push(shiny);
      if (state.team.length > state.maxTeamSize) state.maxTeamSize = state.team.length;
      advanceFromNode(state.map, node.id);
      showMapScreen();
    } else {
      showSwapScreen(shiny, node);
    }
  };
}

function doMegaNode(node) {
  doItemNode(node);
}

// ---- Battle Screen ----

function runBattleScreen(enemyTeam, isBoss, onWin, onLose, enemyName = null, enemyItems = []) {
  return new Promise(async resolve => {
    showScreen('battle-screen');
    renderTrainerIcons(state.trainer, isBoss ? enemyName : null);

    const pTeamCopy = state.team.map(p => ({ ...p }));
    // enemyTeam HP init (runBattle will deep-copy, but we need initial state for animation)
    const eTeamInit = enemyTeam.map(p => ({
      ...p,
      currentHp: p.currentHp !== undefined ? p.currentHp : calcHp(p.baseStats.hp, p.level),
      maxHp: p.maxHp !== undefined ? p.maxHp : calcHp(p.baseStats.hp, p.level),
    }));

    renderBattleField(pTeamCopy, eTeamInit);

    // Pre-compute the full battle result
    const { playerWon, detailedLog, pTeam: resultP, eTeam: resultE, playerParticipants } = runBattle(
      pTeamCopy, enemyTeam, state.items, enemyItems, null
    );

    // Set up Skip button
    const skipBtn = document.getElementById('btn-auto-battle');
    skipBtn.disabled = false;
    skipBtn.textContent = 'Skip';
    skipBtn.onclick = () => { skipBattleAnimation = true; };

    document.getElementById('btn-continue-battle').style.display = 'none';
    document.getElementById('btn-continue-battle').textContent = 'Continue';

    // Auto-start visual animation
    skipBattleAnimation = false;
    await animateBattleVisually(detailedLog, pTeamCopy, eTeamInit);

    // Show final HP state after animation
    renderBattleField(resultP, resultE);

    if (playerWon) {
      // Sync battle-result HP onto state team, then apply level gains
      for (let i = 0; i < state.team.length; i++) {
        if (resultP[i]) state.team[i].currentHp = resultP[i].currentHp;
      }
      const maxEnemyLevel = Math.max(...resultE.map(p => p.level));
      const levelUps = applyLevelGain(state.team, state.hardMode ? [] : state.items, playerParticipants, maxEnemyLevel, state.hardMode);
      // Keep Skip active for level-up animation too
      skipBtn.disabled = false;
      skipBtn.textContent = 'Skip';
      skipBtn.onclick = () => { skipBattleAnimation = true; };
      await animateLevelUp(levelUps);
      skipBtn.disabled = true;
      await checkAndEvolveTeam();
      document.getElementById('btn-continue-battle').style.display = 'block';
      document.getElementById('btn-continue-battle').onclick = () => {
        if (onWin) onWin();
        resolve(true);
      };
    } else {
      document.getElementById('btn-continue-battle').style.display = 'block';
      document.getElementById('btn-continue-battle').textContent = 'Continue...';
      document.getElementById('btn-continue-battle').onclick = () => {
        if (onLose) onLose();
        resolve(false);
      };
    }
  });
}

// ---- End Screens ----

function showBadgeScreen(leader) {
  showScreen('badge-screen');
  document.getElementById('badge-msg').textContent = `You earned the ${leader.badge}!`;
  document.getElementById('badge-leader').textContent = `Defeated ${leader.name}!`;
  document.getElementById('badge-count-display').textContent = `Badges: ${state.badges}/8`;

  document.getElementById('btn-next-map').onclick = () => {
    if (state.currentMap >= 7) {
      state.eliteIndex = 0;
      startMap(8);
    } else {
      startMap(state.currentMap + 1);
    }
  };
}

function showGameOver() {
  initGame();
}

function showWinScreen() {
  showScreen('win-screen');
  document.getElementById('win-team').innerHTML = state.team.map(p =>
    renderPokemonCard(p, false, false)).join('');
  document.getElementById('btn-play-again').onclick = startNewRun;

  // Track elite four wins
  const wins = incrementEliteWins();
  const winsEl = document.getElementById('win-run-count');
  if (winsEl) winsEl.textContent = `Championship #${wins}`;
  if (wins === 10) {
    const ach = unlockAchievement('elite_10');
    if (ach) setTimeout(() => showAchievementToast(ach), 3000);
  }
  if (wins === 100) {
    const ach = unlockAchievement('elite_100');
    if (ach) setTimeout(() => showAchievementToast(ach), 3000);
  }

  // Starter line achievement
  const sid = state.starterSpeciesId;
  const starterAchId = [1,2,3].includes(sid) ? 'starter_1'
    : [4,5,6].includes(sid) ? 'starter_4'
    : [7,8,9].includes(sid) ? 'starter_7' : null;
  if (starterAchId) {
    const ach = unlockAchievement(starterAchId);
    if (ach) setTimeout(() => showAchievementToast(ach), 600);
  }

  // Solo run achievement
  if (state.maxTeamSize === 1) {
    const ach = unlockAchievement('solo_run');
    if (ach) setTimeout(() => showAchievementToast(ach), 1400);
  }

  // Hard mode win achievement
  if (state.hardMode) {
    const ach = unlockAchievement('hard_mode_win');
    if (ach) setTimeout(() => showAchievementToast(ach), 2200);
  }
}

// ---- Boot ----
window.addEventListener('DOMContentLoaded', initGame);
