// ---- Endless Mode — clean separation ----
// All endless-specific logic: traits, strategies, wave management.

// ---- Artifacts ----
const ENDLESS_ARTIFACTS = [
  { id: 'lunar_wing',      name: 'Lunar Wing',       icon: '🌙', desc: 'Your status damage is increased by 50%.' },
  { id: 'sparkling_stone', name: 'Sparkling Stone',  icon: '✨', desc: 'Your Shiny Pokémon deal 20% more damage.' },
  { id: 'enigma_stone',    name: 'Enigma Stone',     icon: '🔮', desc: 'All percent-based Trait chances are increased by 5%.' },
  { id: 'mach_bike',       name: 'Mach Bike',        icon: '🚲', desc: 'If a Ground Pokémon has more Speed than the opponent, it deals 20% more damage.' },
  { id: 'acro_bike',       name: 'Acro Bike',        icon: '🔄', desc: 'Your Pokémon switch out after they attack.' },
  { id: 'prison_bottle',   name: 'Prison Bottle',    icon: '⛓️', desc: 'If you only have a single Trait active, it is 50% stronger.' },
  { id: 'wardens_teeth',   name: "Warden's Teeth",   icon: '🦷', desc: 'Your Pokémon deal 10% more damage for each defeated enemy.' },
  { id: 'red_chain',       name: 'Red Chain',        icon: '🔴', desc: 'You no longer heal after boss fights. Your Pokémon gain +20% Speed, +30% Atk and +30% Sp. Atk.' },
  { id: 'silph_scope',     name: 'Silph Scope',      icon: '🔭', desc: 'Enemies below 5% HP are instantly defeated.' },
  { id: 'devon_parts',     name: 'Devon Parts',      icon: '⚙️', desc: 'Your Pokémon deal 50% damage but attack twice.' },
  { id: 'sacred_ash',      name: 'Sacred Ash',       icon: '🕊️', desc: 'One-use. At a non-boss fight, heal your team instead of losing.', oneUse: true },
  { id: 'eon_ticket',      name: 'Eon Ticket',       icon: '🎫', desc: 'Doubles your Shiny encounter chance. Quadruples with Shiny Charm.' },
  { id: 'lustrous_orb',    name: 'Lustrous Orb',     icon: '💎', desc: 'Your Pokémon deal double damage when below 30% HP.' },
  { id: 'go_goggles',      name: 'Go-Goggles',       icon: '🥽', desc: 'Your Pokémon have −20% Speed but cannot be knocked out in a single hit.' },
  { id: 'town_map',        name: 'Town Map',         icon: '🗺️', desc: 'Your team deals 5% more damage for each unique active Trait.' },
  { id: 'magma_emblem',    name: 'Magma Emblem',     icon: '🌋', desc: 'Your team deals 30% more damage but takes 20% more damage.' },
  { id: 'gracidea',        name: 'Gracidea',         icon: '🌸', desc: 'Each time a Pokémon heals, it gains +1 Def and +1 Sp. Def (max +6 each).' },
  { id: 'reveal_glass',    name: 'Reveal Glass',     icon: '🪞', desc: "When an enemy is knocked out, its status condition has a 50% chance to carry over to the next enemy." },
];

function hasArtifact(id) {
  return typeof state !== 'undefined' && (state.artifacts || []).some(a => a.id === id);
}

const ENDLESS_TRAITS = {
  Grass:    { name: 'Overgrowth',    icon: '🌿', tiers: [2,4,6],
    descs: ['Heal 10% of damage dealt', 'Heal 20% of damage dealt', 'Heal 40% of damage dealt'],
    values: { lifestealPct: [0.10, 0.20, 0.40] } },
  Fire:     { name: 'Blaze',         icon: '🔥', tiers: [2,4,6],
    descs: ['+20% Damage', '+40% Damage', '+60% Damage'],
    values: { fireDmgBonus: [0.20, 0.40, 0.60] } },
  Water:    { name: 'Torrent',       icon: '💧', tiers: [2,4,6],
    descs: ['Reduce incoming damage by 10%', 'Reduce incoming damage by 20%', 'Reduce incoming damage by 30%'],
    values: { waterDmgReduce: [0.10, 0.20, 0.30] } },
  Electric: { name: 'Static',        icon: '⚡', tiers: [2,4,6],
    descs: ['20% chance to strike twice', '40% chance to strike twice', '60% chance to strike twice'],
    values: { electricDoubleStrike: [0.20, 0.40, 0.60] } },
  Ice:      { name: 'Deep Freeze',   icon: '❄️', tiers: [2,4,6],
    descs: ['10% freeze on hit', '20% freeze on hit', '40% freeze on hit'],
    values: { freezeChance: [0.10, 0.20, 0.40] } },
  Fighting: { name: 'Brawler',       icon: '🥊', tiers: [2,4,6],
    descs: ['+50% damage on first attack each battle', '+100% damage on first attack', '+200% damage on first attack'],
    values: { fightingFirstBonus: [0.50, 1.00, 2.00] } },
  Poison:   { name: 'Toxin',         icon: '☠️', tiers: [2,4,6],
    descs: ['25% chance to Poison on hit (standard DOT)', '25% chance to Toxic on hit (2× DOT)', '25% chance to Toxic on hit (4× DOT)'],
    values: { poisonTier: [1, 2, 3] } },
  Ground:   { name: 'Tremor',        icon: '🌍', tiers: [2,4,6],
    descs: ['+20% Defense', '+40% Defense', '+60% Defense'],
    values: { groundDefBonus: [0.20, 0.40, 0.60] } },
  Flying:   { name: 'Tailwind',      icon: '🦅', tiers: [2,4,6],
    descs: ['20% dodge chance', '40% dodge chance', '60% dodge chance'],
    values: { dodgeChance: [0.20, 0.40, 0.60] } },
  Psychic:  { name: 'Mindscape',     icon: '🔮', tiers: [2,4,6],
    descs: ['10% splash dmg + hit effects to enemy team', '20% splash dmg + hit effects', '30% splash dmg + hit effects'],
    values: { splashPct: [0.10, 0.20, 0.30] } },
  Bug:      { name: 'Swarm',         icon: '🐛', tiers: [2,4,6],
    descs: ['10% chance +1 Level after fight', '20% chance +1 Level after fight', '30% chance +1 Level after fight'],
    values: { bonusLevelChance: [0.10, 0.20, 0.30] } },
  Rock:     { name: 'Fortify',       icon: '🪨', tiers: [2,4,6],
    descs: ['Each Pokémon survives one lethal hit at 1 HP', 'Sturdy + reflect 25% damage back', 'Sturdy + reflect 50% damage back'],
    values: { rockSturdy: [true, true, true], rockReflectPct: [0, 0.25, 0.50] } },
  Ghost:    { name: 'Phantom',       icon: '👻', tiers: [2,4,6],
    descs: ['Enemies below 10% HP are instantly defeated', 'Enemies below 20% HP are instantly defeated', 'Enemies below 40% HP are instantly defeated'],
    values: { ghostExecuteThreshold: [0.10, 0.20, 0.40] } },
  Dragon:   { name: 'Ascendant',     icon: '🐉', tiers: [2,4,6],
    descs: ['+10% dmg after each KO', '+20% dmg after each KO', '+40% dmg after each KO'],
    values: { dragonKoBonus: [0.10, 0.20, 0.40] } },
  Normal:   { name: 'Pack Tactics',  icon: '⚔️', tiers: [2,4,6],
    descs: ['+20% max HP for your team', '+50% max HP for your team', '+100% max HP for your team'],
    values: { normalMaxHpBonus: [0.20, 0.50, 1.00] } },
};

// Strategy pool — shuffled per run
const ENDLESS_STRATEGIES = [
  {
    name: 'Brawler Rex',    sprite: 'blackbelt-gen9',
    desc: 'Physical powerhouses — high Attack, hits hard.',
    pool: [56,57,66,67,68,74,75,76,95,104,105,106,107,111,112,128],
  },
  {
    name: 'Sage Vera',      sprite: 'miku-psychic',
    desc: 'Special attackers — overwhelming Sp.Atk.',
    pool: [63,64,65,79,80,81,82,96,97,100,101,102,103,120,121,124,125,126,131,137],
  },
  {
    name: 'Iron Shield',    sprite: 'worker-gen9',
    desc: 'Defensive core — bulky team chips you down slowly.',
    pool: [27,28,74,75,76,95,108,111,112,113,114,143],
  },
  {
    name: 'Venom Queen',    sprite: 'roxie-masters',
    desc: 'Poison types — constant DoT pressure every round.',
    pool: [23,24,29,30,31,32,33,34,41,42,43,44,45,48,49,72,73,88,89,109,110],
  },
  {
    name: 'Storm Caller',   sprite: 'wallace-masters',
    desc: 'Electric and Water — relentless offensive pressure.',
    pool: [25,26,54,55,60,61,62,79,80,81,82,86,87,90,91,98,99,100,101,116,117,118,119,120,121,129,130,131,134,135],
  },
  {
    name: 'Shadow Guild',   sprite: 'acerola-masters2',
    desc: 'Ghost and Psychic types — hard to hit, hard to stop.',
    pool: [63,64,65,79,80,92,93,94,96,97,102,103,121,122,124],
  },
  {
    name: 'Dragon Lord',    sprite: 'clair-masters',
    desc: 'Dragon-type powerhouses and pseudo-legendaries.',
    pool: [6,58,59,130,142,147,148,149],
  },
  {
    name: 'Speed Demon',    sprite: 'iono',
    desc: 'Always goes first — no time to react.',
    pool: [19,20,21,22,52,53,83,84,85,100,101,123,125,135,136,137],
  },
  {
    name: 'Plague Doctor',  sprite: 'piers-masters',
    desc: 'Status and attrition — every hit wears you down.',
    pool: [23,24,35,36,39,40,41,42,88,89,92,93,94,109,110,113,122],
  },
  {
    name: 'Champion X',     sprite: 'blue-masters2',
    desc: 'Perfectly balanced — no exploitable weaknesses.',
    pool: null,
  },
  {
    name: 'Flame Corps',    sprite: 'miku-fire',    easy: true,
    desc: 'Fire types — raw power and burn pressure.',
    pool: [4,5,6,37,38,58,59,77,78,126,136],
  },
  {
    name: 'Bug Brigade',    sprite: 'viola-masters', easy: true,
    desc: 'Bug types — underestimated and relentless.',
    pool: [12,15,46,47,48,49,123,127],
  },
  {
    name: 'Sky Force',      sprite: 'miku-flying',  easy: true,
    desc: 'Flying types — fast and hard to ground.',
    pool: [16,17,18,21,22,83,84,85,123,142],
  },
  {
    name: "Nature's Wrath", sprite: 'brassius',     easy: true,
    desc: 'Grass types — sustain and overwhelming numbers.',
    pool: [1,2,3,43,44,45,69,70,71,102,103,114],
  },
  {
    name: 'Route Wanderer', sprite: 'backpacker-gen9', easy: true,
    desc: 'Common route Pokemon — nothing too scary.',
    pool: [16,17,18,19,20,21,22,35,36,39,40,52,53,98,99,118,119,129],
  },
  {
    name: 'Muddy Waters',   sprite: 'miku-water',      easy: true,
    desc: 'Basic Water types — splashing around.',
    pool: [54,55,60,61,72,79,86,90,98,116,118,120,129],
  },
  {
    name: 'Tiny Sparks',    sprite: 'kris',             easy: true,
    desc: 'Basic Electric types — more buzz than bite.',
    pool: [25,26,81,82,100,101],
  },
  {
    name: 'Rocky Start',    sprite: 'hiker-gen9',       easy: true,
    desc: 'Rock and Ground basics — slow and stony.',
    pool: [27,28,74,75,95,111,138,140],
  },
  {
    name: 'Pup Squad',      sprite: 'caretaker',        easy: true,
    desc: 'Cute Normal types — friendly but harmless.',
    pool: [35,36,39,40,52,53,113,133],
  },
  {
    name: 'Sand Patrol',    sprite: 'ruffian',          easy: true,
    desc: 'Ground types kicking up dust.',
    pool: [27,28,50,51,95,104,105],
  },
  {
    name: 'Rock Solid',     sprite: 'roxanne-masters',
    desc: 'Rock and fossil types — unbreakable defence.',
    pool: [74,75,76,95,111,112,138,139,140,141,142],
  },
  {
    name: 'Frozen Tundra',  sprite: 'gloria-tundra',
    desc: 'Ice types — freeze everything in their path.',
    pool: [86,87,90,91,124,131],
  },
  {
    name: 'Ground Zero',    sprite: 'miku-ground',
    desc: 'Ground types — earthquake and raw power.',
    pool: [27,28,50,51,95,104,105,111,112],
  },
];

// Returns list of { type, tier (0-2), def } for currently active traits
function getActiveTraits(team) {
  const counts = {};
  for (const p of team) {
    const weight = p.isShiny ? 2 : 1;
    for (const t of (p.types || [])) {
      const type = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      counts[type] = (counts[type] || 0) + weight;
    }
  }
  const active = [];
  for (const [type, def] of Object.entries(ENDLESS_TRAITS)) {
    const count = counts[type] || 0;
    let tier = -1;
    for (let i = def.tiers.length - 1; i >= 0; i--) {
      if (count >= def.tiers[i]) { tier = i; break; }
    }
    if (tier >= 0) active.push({ type, tier, def });
  }
  return active.sort((a, b) => a.type.localeCompare(b.type));
}

// Returns a merged effect object for use in battle
function getEndlessTraitEffects(team) {
  const fx = {
    lifestealPct: 0,
    fireDmgBonus: 0,
    waterDmgReduce: 0,
    electricDoubleStrike: 0,
    freezeChance: 0,
    fightingFirstBonus: 0,
    poisonTier: 0,
    groundDefBonus: 0,
    dodgeChance: 0,
    splashPct: 0,
    bonusLevelChance: 0,
    rockSturdy: false,
    rockReflectPct: 0,
    ghostExecuteThreshold: 0,
    dragonKoBonus: 0,
    normalMaxHpBonus: 0,
  };
  const activeTraitList = getActiveTraits(team);
  for (const { tier, def } of activeTraitList) {
    const v = def.values;
    if (v.lifestealPct)           fx.lifestealPct          += v.lifestealPct[tier];
    if (v.fireDmgBonus)           fx.fireDmgBonus          += v.fireDmgBonus[tier];
    if (v.waterDmgReduce)         fx.waterDmgReduce         = Math.min(0.90, fx.waterDmgReduce + v.waterDmgReduce[tier]);
    if (v.electricDoubleStrike)   fx.electricDoubleStrike   = Math.min(0.90, fx.electricDoubleStrike + v.electricDoubleStrike[tier]);
    if (v.freezeChance)           fx.freezeChance           = Math.min(0.80, fx.freezeChance + v.freezeChance[tier]);
    if (v.fightingFirstBonus)     fx.fightingFirstBonus     = Math.max(fx.fightingFirstBonus, v.fightingFirstBonus[tier]);
    if (v.poisonTier)             fx.poisonTier             = Math.max(fx.poisonTier, v.poisonTier[tier]);
    if (v.groundDefBonus)         fx.groundDefBonus        += v.groundDefBonus[tier];
    if (v.dodgeChance)            fx.dodgeChance            = Math.min(0.80, fx.dodgeChance + v.dodgeChance[tier]);
    if (v.splashPct)              fx.splashPct             += v.splashPct[tier];
    if (v.bonusLevelChance)       fx.bonusLevelChance       = Math.max(fx.bonusLevelChance, v.bonusLevelChance[tier]);
    if (v.rockSturdy)             fx.rockSturdy             = fx.rockSturdy || v.rockSturdy[tier];
    if (v.rockReflectPct)         fx.rockReflectPct         = Math.max(fx.rockReflectPct, v.rockReflectPct[tier]);
    if (v.ghostExecuteThreshold)  fx.ghostExecuteThreshold  = Math.max(fx.ghostExecuteThreshold, v.ghostExecuteThreshold[tier]);
    if (v.dragonKoBonus)          fx.dragonKoBonus          = Math.max(fx.dragonKoBonus, v.dragonKoBonus[tier]);
    if (v.normalMaxHpBonus)       fx.normalMaxHpBonus       = Math.max(fx.normalMaxHpBonus, v.normalMaxHpBonus[tier]);
  }

  // Enigma Stone: all percent-based chances +5%
  if (hasArtifact('enigma_stone')) {
    fx.freezeChance            = Math.min(0.80, fx.freezeChance          + 0.05);
    fx.dodgeChance             = Math.min(0.80, fx.dodgeChance           + 0.05);
    fx.electricDoubleStrike    = Math.min(0.90, fx.electricDoubleStrike  + 0.05);
    fx.bonusLevelChance        = Math.min(1.0,  fx.bonusLevelChance      + 0.05);
    fx.splashPct              += 0.05;
    fx.lifestealPct           += 0.05;
    fx.ghostExecuteThreshold  += 0.05;
  }

  // Prison Bottle: single active trait is 50% stronger
  if (hasArtifact('prison_bottle') && activeTraitList.length === 1) {
    fx.lifestealPct          *= 1.5;
    fx.fireDmgBonus          *= 1.5;
    fx.waterDmgReduce         = Math.min(0.90, fx.waterDmgReduce        * 1.5);
    fx.electricDoubleStrike   = Math.min(0.90, fx.electricDoubleStrike  * 1.5);
    fx.freezeChance           = Math.min(0.80, fx.freezeChance          * 1.5);
    fx.fightingFirstBonus    *= 1.5;
    fx.groundDefBonus        *= 1.5;
    fx.dodgeChance            = Math.min(0.80, fx.dodgeChance           * 1.5);
    fx.splashPct             *= 1.5;
    fx.ghostExecuteThreshold *= 1.5;
    fx.dragonKoBonus         *= 1.5;
    fx.normalMaxHpBonus      *= 1.5;
    fx.rockReflectPct        *= 1.5;
  }

  return fx;
}

// Level range for any map index — smooth curve, baseline rises by 1 per stage
function getEndlessLevelRange(mapIndex, stage = 0) {
  const min = Math.min(100, (stage + 1) + Math.floor(mapIndex * (4.5 + stage * 0.5)));
  const max = Math.min(100, min + 10);
  return [min, max];
}

function getEndlessStrategy(mapIndex) {
  if (typeof state !== 'undefined' && state.endlessEasy) {
    const easy = state.endlessEasy;
    if (mapIndex < easy.length) return easy[mapIndex];
    const hard = state.endlessHard;
    return hard[(mapIndex - easy.length) % hard.length];
  }
  return ENDLESS_STRATEGIES[mapIndex % ENDLESS_STRATEGIES.length];
}

// Build the enemy team for an endless boss node
async function buildEndlessBossTeam(mapIndex) {
  const strategy = getEndlessStrategy(mapIndex);
  const [minLvl, maxLvl] = getEndlessLevelRange(mapIndex, typeof state !== 'undefined' ? (state.endlessStage || 0) : 0);
  const level = maxLvl + 3;
  const teamSize = Math.min(6, 2 + Math.floor(mapIndex / 3));
  const moveTier = mapIndex <= 2 ? 0 : 1;

  const isRegionBoss = mapIndex % 5 === 4;

  let speciesList;
  if (isRegionBoss) {
    const aceId = strategy.aceId || (strategy.pool ? strategy.pool[0] : 130);
    const ace = await fetchPokemonById(aceId);
    speciesList = ace ? [ace] : [];
  } else if (strategy.pool) {
    const shuffled = [...strategy.pool].sort(() => rng() - 0.5);
    const ids = Array.from({ length: teamSize }, (_, i) => shuffled[i % shuffled.length]);
    const fetched = await Promise.all(ids.map(id => fetchPokemonById(id)));
    speciesList = fetched.filter(Boolean);
  } else {
    const choices = await getCatchChoices(Math.min(mapIndex, 8));
    speciesList = choices.slice(0, teamSize);
  }
  const team = speciesList.map(sp => createInstance(sp, level, false, moveTier));
  if (isRegionBoss) {
    for (const p of team) {
      const bs = p.baseStats;
      p.baseStats = {
        hp:      Math.round(bs.hp      * 1.5),
        atk:     Math.round(bs.atk     * 1.5),
        def:     Math.round(bs.def     * 1.5),
        speed:   Math.round(bs.speed   * 1.5),
        special: bs.special  != null ? Math.round(bs.special  * 1.5) : bs.special,
        spdef:   bs.spdef    != null ? Math.round(bs.spdef    * 1.5) : bs.spdef,
      };
      const newHp = calcHp(p.baseStats.hp, p.level);
      p.maxHp = newHp;
      p.currentHp = newHp;
    }
  }
  return team;
}

// Shows next trait the player is closest to unlocking
function getNextTraitProgress(team) {
  const counts = {};
  for (const p of team) {
    for (const t of (p.types || [])) {
      const type = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      counts[type] = (counts[type] || 0) + 1;
    }
  }
  let best = null;
  for (const [type, def] of Object.entries(ENDLESS_TRAITS)) {
    const count = counts[type] || 0;
    for (let i = 0; i < def.tiers.length; i++) {
      if (count < def.tiers[i]) {
        const remaining = def.tiers[i] - count;
        if (!best || remaining < best.remaining) {
          best = { type, def, remaining, nextTier: i };
        }
        break;
      }
    }
  }
  return best;
}

function renderTraitsPanel() {
  const el = document.getElementById('traits-panel');
  if (!el) return;
  if (!state.isEndless) { el.style.display = 'none'; return; }
  el.style.display = '';

  const counts = {};
  for (const p of state.team) {
    const weight = p.isShiny ? 2 : 1;
    for (const t of (p.types || [])) {
      const type = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      counts[type] = (counts[type] || 0) + weight;
    }
  }

  const rows = [];
  for (const [type, def] of Object.entries(ENDLESS_TRAITS)) {
    const count = counts[type] || 0;
    if (count === 0) continue;
    let tier = -1;
    for (let i = def.tiers.length - 1; i >= 0; i--) {
      if (count >= def.tiers[i]) { tier = i; break; }
    }
    let nextCheckpoint = def.tiers.find(t => count < t) ?? def.tiers[def.tiers.length - 1];
    rows.push({ type, def, count, tier, nextCheckpoint });
  }
  rows.sort((a, b) => b.count - a.count || b.tier - a.tier);

  let html = '<div class="traits-header">TRAITS</div>';
  if (rows.length === 0) {
    html += '<div class="traits-empty">No traits active yet</div>';
  } else {
    html += rows.map(({ type, def, count, tier, nextCheckpoint }) => {
      const active = tier >= 0;
      const cls = `type-${type.toLowerCase()}`;
      const desc = active ? def.descs[tier] : def.descs[0];
      return `<div class="trait-chart-row${active ? '' : ' trait-chart-inactive'}">
        <div class="trait-chart-top">
          <span class="type-badge ${cls}">${type}</span>
          <span class="trait-chart-count">${count}/${nextCheckpoint}</span>
        </div>
        <div class="trait-chart-desc">${desc}</div>
      </div>`;
    }).join('');
  }

  el.innerHTML = html;
}

// Returns trait changes if the given pokemon were added to currentTeam (defaults to state.team)
function getTraitChangesForPokemon(pokemon, currentTeam) {
  const base = currentTeam ?? state.team;
  const current = getActiveTraits(base);
  const after   = getActiveTraits([...base, pokemon]);
  const changes = [];
  for (const t of after) {
    const existing = current.find(c => c.type === t.type);
    if (!existing) {
      changes.push({ type: t.type, def: t.def, tier: t.tier, isNew: true });
    } else if (t.tier > existing.tier) {
      changes.push({ type: t.type, def: t.def, tier: t.tier, prevTier: existing.tier, isNew: false });
    }
  }
  return changes;
}

// Shows per-type contribution for a draft choice, including in-progress types
function _draftBadgeHtml(pokemon, currentTeam) {
  const rows = [];
  for (const t of (pokemon.types || [])) {
    const type = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    const def = ENDLESS_TRAITS[type];
    if (!def) continue;

    const baseCount = currentTeam.reduce((sum, p) => {
      if (!(p.types || []).some(pt => pt.charAt(0).toUpperCase() + pt.slice(1).toLowerCase() === type)) return sum;
      return sum + (p.isShiny ? 2 : 1);
    }, 0);
    const newCount = baseCount + (pokemon.isShiny ? 2 : 1);

    let baseTier = -1;
    for (let i = def.tiers.length - 1; i >= 0; i--) {
      if (baseCount >= def.tiers[i]) { baseTier = i; break; }
    }
    let newTier = -1;
    for (let i = def.tiers.length - 1; i >= 0; i--) {
      if (newCount >= def.tiers[i]) { newTier = i; break; }
    }
    const nextCheckpoint = def.tiers.find(t => newCount < t) ?? def.tiers[def.tiers.length - 1];

    const active = newTier >= 0;
    const cls  = `type-${type.toLowerCase()}`;
    const desc = active ? def.descs[newTier] : def.descs[0];

    rows.push({ cls, type, newCount, nextCheckpoint, active, desc });
  }
  if (!rows.length) return '';
  return `<div class="draft-trait-badge">${rows.map(r =>
    `<div class="draft-trait-row${r.active ? '' : ' draft-trait-inactive'}">
      <div class="draft-trait-top">
        <span class="type-badge ${r.cls}">${r.type}</span>
        <span class="draft-trait-count">${r.newCount}/${r.nextCheckpoint}</span>
      </div>
      <span class="draft-trait-desc">${r.desc}</span>
    </div>`
  ).join('')}</div>`;
}

// Show a region preview screen before the region begins
function showRegionPreview(regionIndex) {
  const baseMap = regionIndex * 5;
  const strategies = Array.from({ length: 5 }, (_, i) => getEndlessStrategy(baseMap + i));

  return new Promise(resolve => {
    showScreen('region-preview-screen');
    const container = document.getElementById('region-preview-content');

    const SD = 'https://play.pokemonshowdown.com/sprites/trainers/';
    const POKE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
    const slots = strategies.map((s, i) => {
      const isBoss = i === 4;
      const aceId = s.aceId || 132;
      if (isBoss) {
        return `
          <div class="region-trainer-slot region-boss-slot">
            <div class="region-map-label">Map 5 — BOSS</div>
            <img src="${POKE}${aceId}.png" class="region-boss-pokemon" alt="Boss" onerror="this.style.opacity='0.3'">
            <div class="region-trainer-name">???</div>
          </div>
        `;
      }
      return `
        <div class="region-trainer-slot">
          <div class="region-map-label">Map ${i + 1}</div>
          <div class="region-sprite-group">
            <img src="${POKE}${aceId}.png" class="region-ace-pokemon" alt="ace" onerror="this.style.display='none'">
            <img src="${SD}${s.sprite}.png" class="region-trainer-sprite" alt="${s.name}" onerror="this.style.opacity='0.3'">
          </div>
          <div class="region-trainer-name">${s.name}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="region-preview-title">Region ${regionIndex + 1}</div>
      <div class="region-preview-subtitle">Complete 5 maps to finish this region</div>
      <div class="region-trainers-row">${slots}</div>
      <button id="btn-region-start" class="btn-primary" style="margin-top:20px;">
        Begin Region ${regionIndex + 1}!
      </button>
    `;

    document.getElementById('btn-region-start').onclick = resolve;
  });
}

// Endless starter select — show artifact choice, then region preview, then pick 1 from 3
async function showEndlessStarterSelect() {
  // Artifact choice before anything else
  const artOpts = [...ENDLESS_ARTIFACTS].sort(() => rng() - 0.5).slice(0, 3);
  if (typeof showArtifactChoice === 'function') {
    const chosen = await showArtifactChoice(artOpts);
    if (chosen) state.artifacts.push(chosen);
  }

  // Show region 1 preview before selecting a starter
  await showRegionPreview(0);

  const pool = typeof getBaseFormIds === 'function' ? getBaseFormIds() : GEN1_BST_APPROX.low.filter(id => !LEGENDARY_IDS.includes(id));
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const speciesArr = await Promise.all(shuffled.slice(0, 3).map(id => fetchPokemonById(id)));
  const valid = speciesArr.filter(Boolean).slice(0, 3);
  const choices = valid.map(sp => createInstance(sp, 5, rng() < (hasShinyCharm() ? 0.02 : 0.01), 0));

  const picked = await new Promise(resolve => {
    showScreen('starter-screen');
    if (typeof renderRegionSidebar === 'function') renderRegionSidebar('starter-region-sidebar', 0);
    const container = document.getElementById('starter-choices');
    container.innerHTML = '';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const header = document.createElement('div');
    header.className = 'draft-header';
    const label = document.createElement('div');
    label.className = 'draft-label';
    label.textContent = 'Choose your Starter!';
    header.appendChild(label);
    container.appendChild(header);

    const choicesRow = document.createElement('div');
    choicesRow.className = 'draft-choices-row';

    for (const inst of choices) {
      const col = document.createElement('div');
      col.className = 'draft-choice-col';

      const wrap = document.createElement('div');
      wrap.innerHTML = renderPokemonCard(inst, true, false);
      const card = wrap.querySelector('.poke-card');
      if (!card) continue;
      card.style.cursor = 'pointer';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      col.appendChild(card);
      col.insertAdjacentHTML('beforeend', _draftBadgeHtml(inst, []));

      const pick = () => resolve(inst);
      col.addEventListener('click', pick);
      col.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') pick(); });
      col.setAttribute('tabindex', '0');
      choicesRow.appendChild(col);
    }

    container.appendChild(choicesRow);
  });

  const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${picked.speciesId}.png`;
  markPokedexCaught(picked.speciesId, picked.name, picked.types, url);
  if (picked.isShiny) markShinyDexCaught(picked.speciesId, picked.name, picked.types, picked.spriteUrl);
  state.team = [picked];
  state.starterSpeciesId = picked.speciesId;
  state.maxTeamSize = 6;
  startMap(0);
}

// Entry point for endless mode
async function startEndlessRun(stage = 0) {
  const savedTrainer = localStorage.getItem('poke_trainer') || null;
  const seed = (Date.now() ^ (Math.random() * 0x100000000 | 0)) >>> 0;
  seedRng(seed);
  const FALLBACK_POOL = [130,149,143,112,68,65,94,131,59,76];
  const withAce = s => { const p = s.pool || FALLBACK_POOL; return { ...s, aceId: p[Math.floor(rng() * p.length)] }; };
  const easyPool = ENDLESS_STRATEGIES.filter(s => s.easy).sort(() => rng() - 0.5).map(withAce);
  const hardPool = ENDLESS_STRATEGIES.filter(s => !s.easy).sort(() => rng() - 0.5).map(withAce);
  state = {
    currentMap: 0, currentNode: null, team: [], items: [], badges: 0, map: null,
    eliteIndex: 0, trainer: savedTrainer || 'boy', starterSpeciesId: null,
    maxTeamSize: 1, nuzlockeMode: false, usedPokecenter: false, pickedUpItem: false,
    runSeed: seed, isEndless: true, endlessStage: stage,
    endlessEasy: easyPool, endlessHard: hardPool,
    artifacts: [],
  };
  if (savedTrainer) {
    await showEndlessStarterSelect();
  } else {
    await showTrainerSelect();
  }
}

function showEndlessWaveClear(mapIndex, strategyName) {
  return new Promise(resolve => {
    const el = document.getElementById('transition-screen');
    if (!el) { resolve(); return; }
    document.getElementById('transition-msg').textContent = `Wave ${mapIndex + 1} Cleared!`;
    document.getElementById('transition-sub').textContent =
      `Defeated ${strategyName} — Wave ${mapIndex + 2} incoming!`;
    showScreen('transition-screen');
    setTimeout(() => resolve(), 2500);
  });
}
