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
};

// ---- Initialization ----

async function initGame() {
  showScreen('title-screen');
  document.getElementById('btn-new-run').addEventListener('click', startNewRun);
}

async function startNewRun() {
  state = { currentMap: 0, currentNode: null, team: [], items: [], badges: 0, map: null, eliteIndex: 0, trainer: 'boy', starterSpeciesId: null, maxTeamSize: 1 };
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
    const inst = createInstance(species, startLevel);
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
  markPokedexCaught(pokemon.speciesId);
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
  if (r < 0.9) return 'shiny';
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
  const choices = await getCatchChoices(state.currentMap);
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
  for (const inst of instances) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderPokemonCard(inst, true, false);
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

function catchPokemon(pokemon, node) {
  markPokedexCaught(pokemon.speciesId);
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
  const held = state.items.map(it => it.id);
  const available = ITEM_POOL.filter(it =>
    !held.includes(it.id) && (it.minMap === undefined || state.currentMap >= it.minMap)
  );
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 2);

  const el = document.getElementById('item-choices');
  el.innerHTML = '';
  for (const item of picks) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.innerHTML = `<div class="item-icon">${item.icon}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-desc">${item.desc}</div>`;
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => {
      state.items.push(item);
      advanceFromNode(state.map, node.id);
      showMapScreen();
    });
    el.appendChild(div);
  }

  document.getElementById('btn-skip-item').onclick = () => {
    advanceFromNode(state.map, node.id);
    showMapScreen();
  };
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

  showScreen('shiny-screen');
  document.getElementById('shiny-content').innerHTML = `
    <div class="shiny-title">✨ A Shiny Pokemon appeared!</div>
    ${renderPokemonCard(shiny, false, false)}
    <button id="btn-take-shiny" class="btn-primary">Take ${shiny.name}!</button>
  `;
  document.getElementById('btn-take-shiny').onclick = () => {
    if (state.team.length < 6) {
      markPokedexCaught(shiny.speciesId);
      markShinyDexCaught(shiny.speciesId, shiny.name, shiny.types, shiny.spriteUrl);
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
      const levelUps = applyLevelGain(state.team, state.items, playerParticipants, maxEnemyLevel);
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
  showScreen('gameover-screen');
  document.getElementById('gameover-badges').textContent = `Badges earned: ${state.badges}/8`;
  document.getElementById('gameover-team').innerHTML = state.team.map(p =>
    `<span>${p.nickname||p.name} Lv${p.level}</span>`).join(', ');
  document.getElementById('btn-retry').onclick = startNewRun;
}

function showWinScreen() {
  showScreen('win-screen');
  document.getElementById('win-team').innerHTML = state.team.map(p =>
    renderPokemonCard(p, false, false)).join('');
  document.getElementById('btn-play-again').onclick = startNewRun;

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
}

// ---- Boot ----
window.addEventListener('DOMContentLoaded', initGame);
