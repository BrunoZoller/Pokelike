// data.js - Pokemon data, gym leaders, items, type chart

const TYPE_CHART = {
  Normal:   { Normal:1, Fire:1, Water:1, Electric:1, Grass:1, Ice:1, Fighting:1, Poison:1, Ground:1, Flying:1, Psychic:1, Bug:1, Rock:0.5, Ghost:0, Dragon:1 },
  Fire:     { Normal:1, Fire:0.5, Water:0.5, Electric:1, Grass:2, Ice:2, Fighting:1, Poison:1, Ground:1, Flying:1, Psychic:1, Bug:2, Rock:0.5, Ghost:1, Dragon:0.5 },
  Water:    { Normal:1, Fire:2, Water:0.5, Electric:1, Grass:0.5, Ice:1, Fighting:1, Poison:1, Ground:2, Flying:1, Psychic:1, Bug:1, Rock:2, Ghost:1, Dragon:0.5 },
  Electric: { Normal:1, Fire:1, Water:2, Electric:0.5, Grass:0.5, Ice:1, Fighting:1, Poison:1, Ground:0, Flying:2, Psychic:1, Bug:1, Rock:1, Ghost:1, Dragon:0.5 },
  Grass:    { Normal:1, Fire:0.5, Water:2, Electric:1, Grass:0.5, Ice:1, Fighting:1, Poison:0.5, Ground:2, Flying:0.5, Psychic:1, Bug:0.5, Rock:2, Ghost:1, Dragon:0.5 },
  Ice:      { Normal:1, Fire:0.5, Water:0.5, Electric:1, Grass:2, Ice:0.5, Fighting:1, Poison:1, Ground:2, Flying:2, Psychic:1, Bug:1, Rock:1, Ghost:1, Dragon:2 },
  Fighting: { Normal:2, Fire:1, Water:1, Electric:1, Grass:1, Ice:2, Fighting:1, Poison:0.5, Ground:1, Flying:0.5, Psychic:0.5, Bug:0.5, Rock:2, Ghost:0, Dragon:1 },
  Poison:   { Normal:1, Fire:1, Water:1, Electric:1, Grass:2, Ice:1, Fighting:1, Poison:0.5, Ground:0.5, Flying:1, Psychic:1, Bug:2, Rock:0.5, Ghost:0.5, Dragon:1 },
  Ground:   { Normal:1, Fire:2, Water:1, Electric:2, Grass:0.5, Ice:1, Fighting:1, Poison:2, Ground:1, Flying:0, Psychic:1, Bug:0.5, Rock:2, Ghost:1, Dragon:1 },
  Flying:   { Normal:1, Fire:1, Water:1, Electric:0.5, Grass:2, Ice:1, Fighting:2, Poison:1, Ground:1, Flying:1, Psychic:1, Bug:2, Rock:0.5, Ghost:1, Dragon:1 },
  Psychic:  { Normal:1, Fire:1, Water:1, Electric:1, Grass:1, Ice:1, Fighting:2, Poison:2, Ground:1, Flying:1, Psychic:0.5, Bug:1, Rock:1, Ghost:0, Dragon:1 },
  Bug:      { Normal:1, Fire:0.5, Water:1, Electric:1, Grass:2, Ice:1, Fighting:0.5, Poison:0.5, Ground:1, Flying:0.5, Psychic:2, Bug:1, Rock:1, Ghost:0.5, Dragon:1 },
  Rock:     { Normal:1, Fire:2, Water:1, Electric:1, Grass:1, Ice:2, Fighting:0.5, Poison:1, Ground:0.5, Flying:2, Psychic:1, Bug:2, Rock:1, Ghost:1, Dragon:1 },
  Ghost:    { Normal:0, Fire:1, Water:1, Electric:1, Grass:1, Ice:1, Fighting:0, Poison:1, Ground:1, Flying:1, Psychic:0, Bug:1, Rock:1, Ghost:2, Dragon:1 },
  Dragon:   { Normal:1, Fire:1, Water:1, Electric:1, Grass:1, Ice:1, Fighting:1, Poison:1, Ground:1, Flying:1, Psychic:1, Bug:1, Rock:1, Ghost:1, Dragon:2 },
};

function getTypeEffectiveness(attackType, defenderTypes) {
  let mult = 1;
  for (const dt of defenderTypes) {
    const cap = dt.charAt(0).toUpperCase() + dt.slice(1).toLowerCase();
    const atCap = attackType.charAt(0).toUpperCase() + attackType.slice(1).toLowerCase();
    if (TYPE_CHART[atCap] && TYPE_CHART[atCap][cap] !== undefined) {
      mult *= TYPE_CHART[atCap][cap];
    }
  }
  return mult;
}

// Move pools by type (simplified moves with power and type)
const MOVE_POOL = {
  Normal:   [{name:'Tackle',power:40},{name:'Body Slam',power:85},{name:'Hyper Beam',power:150},{name:'Quick Attack',power:40}],
  Fire:     [{name:'Ember',power:40},{name:'Flamethrower',power:90},{name:'Fire Blast',power:110}],
  Water:    [{name:'Water Gun',power:40},{name:'Surf',power:90},{name:'Hydro Pump',power:110}],
  Electric: [{name:'Thunder Shock',power:40},{name:'Thunderbolt',power:90},{name:'Thunder',power:110}],
  Grass:    [{name:'Vine Whip',power:45},{name:'Razor Leaf',power:55},{name:'Solar Beam',power:120}],
  Ice:      [{name:'Ice Beam',power:90},{name:'Blizzard',power:110}],
  Fighting: [{name:'Low Kick',power:50},{name:'Karate Chop',power:50},{name:'High Jump Kick',power:100}],
  Poison:   [{name:'Poison Sting',power:15},{name:'Sludge',power:65},{name:'Sludge Bomb',power:90}],
  Ground:   [{name:'Sand Attack',power:0},{name:'Earthquake',power:100},{name:'Earth Power',power:90}],
  Flying:   [{name:'Gust',power:40},{name:'Wing Attack',power:60},{name:'Fly',power:90}],
  Psychic:  [{name:'Confusion',power:50},{name:'Psybeam',power:65},{name:'Psychic',power:90}],
  Bug:      [{name:'String Shot',power:0},{name:'Bug Bite',power:60},{name:'X-Scissor',power:80}],
  Rock:     [{name:'Rock Throw',power:50},{name:'Rock Slide',power:75},{name:'Stone Edge',power:100}],
  Ghost:    [{name:'Lick',power:30},{name:'Shadow Ball',power:80}],
  Dragon:   [{name:'Dragon Rage',power:40},{name:'Dragon Pulse',power:85},{name:'Draco Meteor',power:130}],
};

function getBestMove(types) {
  for (const t of types) {
    const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    if (MOVE_POOL[cap] && MOVE_POOL[cap].length) {
      const moves = MOVE_POOL[cap].filter(m => m.power > 0);
      if (moves.length) return { ...moves[moves.length - 1], type: cap };
    }
  }
  return { name: 'Tackle', power: 40, type: 'Normal' };
}

// Gym leader teams (hardcoded)
const GYM_LEADERS = [
  {
    name: 'Brock', badge: 'Boulder Badge', type: 'Rock',
    team: [
      { speciesId: 74, name: 'Geodude', types: ['Rock','Ground'], baseStats: { hp:40,atk:80,def:100,speed:20,special:30 }, level: 12 },
      { speciesId: 95, name: 'Onix',    types: ['Rock','Ground'], baseStats: { hp:35,atk:45,def:160,speed:70,special:30 }, level: 14 },
    ]
  },
  {
    name: 'Misty', badge: 'Cascade Badge', type: 'Water',
    team: [
      { speciesId: 120, name: 'Staryu',  types: ['Water'], baseStats: { hp:30,atk:45,def:55,speed:85,special:70 }, level: 18 },
      { speciesId: 121, name: 'Starmie', types: ['Water','Psychic'], baseStats: { hp:60,atk:75,def:85,speed:115,special:100 }, level: 21 },
    ]
  },
  {
    name: 'Lt. Surge', badge: 'Thunder Badge', type: 'Electric',
    team: [
      { speciesId: 25,  name: 'Pikachu',  types: ['Electric'], baseStats: { hp:35,atk:55,def:40,speed:90,special:50 }, level: 18 },
      { speciesId: 100, name: 'Voltorb',  types: ['Electric'], baseStats: { hp:40,atk:30,def:50,speed:100,special:55 }, level: 21 },
      { speciesId: 26,  name: 'Raichu',   types: ['Electric'], baseStats: { hp:60,atk:90,def:55,speed:110,special:90 }, level: 24 },
    ]
  },
  {
    name: 'Erika', badge: 'Rainbow Badge', type: 'Grass',
    team: [
      { speciesId: 114, name: 'Tangela',     types: ['Grass'], baseStats: { hp:65,atk:55,def:115,speed:60,special:100 }, level: 24 },
      { speciesId: 71,  name: 'Victreebel',  types: ['Grass','Poison'], baseStats: { hp:80,atk:105,def:65,speed:70,special:100 }, level: 29 },
      { speciesId: 45,  name: 'Vileplume',   types: ['Grass','Poison'], baseStats: { hp:75,atk:80,def:85,speed:50,special:110 }, level: 29 },
    ]
  },
  {
    name: 'Koga', badge: 'Soul Badge', type: 'Poison',
    team: [
      { speciesId: 109, name: 'Koffing',  types: ['Poison'], baseStats: { hp:40,atk:65,def:95,speed:35,special:60 }, level: 37 },
      { speciesId: 109, name: 'Koffing',  types: ['Poison'], baseStats: { hp:40,atk:65,def:95,speed:35,special:60 }, level: 37 },
      { speciesId: 89,  name: 'Muk',      types: ['Poison'], baseStats: { hp:105,atk:105,def:75,speed:50,special:65 }, level: 39 },
      { speciesId: 110, name: 'Weezing',  types: ['Poison'], baseStats: { hp:65,atk:90,def:120,speed:60,special:85 }, level: 43 },
    ]
  },
  {
    name: 'Sabrina', badge: 'Marsh Badge', type: 'Psychic',
    items: [{ id: 'twisted_spoon', name: 'Twisted Spoon' }],
    team: [
      { speciesId: 122, name: 'Mr. Mime', types: ['Psychic'], baseStats: { hp:40,atk:45,def:65,speed:90,special:100 }, level: 37 },
      { speciesId: 49,  name: 'Venomoth', types: ['Bug','Poison'], baseStats: { hp:70,atk:65,def:60,speed:90,special:90 }, level: 38 },
      { speciesId: 64,  name: 'Kadabra',  types: ['Psychic'], baseStats: { hp:40,atk:35,def:30,speed:105,special:120 }, level: 38 },
      { speciesId: 65,  name: 'Alakazam', types: ['Psychic'], baseStats: { hp:55,atk:50,def:45,speed:120,special:135 }, level: 43 },
    ]
  },
  {
    name: 'Blaine', badge: 'Volcano Badge', type: 'Fire',
    items: [{ id: 'charcoal', name: 'Charcoal' }],
    team: [
      { speciesId: 77,  name: 'Ponyta',   types: ['Fire'], baseStats: { hp:50,atk:85,def:55,speed:90,special:65 }, level: 40 },
      { speciesId: 58,  name: 'Growlithe',types: ['Fire'], baseStats: { hp:55,atk:70,def:45,speed:60,special:50 }, level: 42 },
      { speciesId: 78,  name: 'Rapidash', types: ['Fire'], baseStats: { hp:65,atk:100,def:70,speed:105,special:80 }, level: 42 },
      { speciesId: 59,  name: 'Arcanine', types: ['Fire'], baseStats: { hp:90,atk:110,def:80,speed:95,special:100 }, level: 47 },
    ]
  },
  {
    name: 'Giovanni', badge: 'Earth Badge', type: 'Ground',
    items: [{ id: 'soft_sand', name: 'Soft Sand' }],
    team: [
      { speciesId: 51,  name: 'Dugtrio',  types: ['Ground'], baseStats: { hp:35,atk:100,def:50,speed:120,special:50 }, level: 42 },
      { speciesId: 31,  name: 'Nidoqueen',types: ['Poison','Ground'], baseStats: { hp:90,atk:82,def:87,speed:76,special:75 }, level: 44 },
      { speciesId: 34,  name: 'Nidoking', types: ['Poison','Ground'], baseStats: { hp:81,atk:92,def:77,speed:85,special:75 }, level: 45 },
      { speciesId: 111, name: 'Rhyhorn',  types: ['Ground','Rock'], baseStats: { hp:80,atk:85,def:95,speed:25,special:30 }, level: 45 },
      { speciesId: 112, name: 'Rhydon',   types: ['Ground','Rock'], baseStats: { hp:105,atk:130,def:120,speed:40,special:45 }, level: 50 },
    ]
  },
];

const ELITE_4 = [
  {
    name: 'Lorelei', title: 'Elite Four', type: 'Ice',
    items: [{ id: 'never_melt_ice', name: 'NeverMeltIce' }, { id: 'shell_bell', name: 'Shell Bell' }],
    team: [
      { speciesId: 87,  name: 'Dewgong',   types: ['Water','Ice'], baseStats: { hp:90,atk:70,def:80,speed:70,special:95 }, level: 54 },
      { speciesId: 91,  name: 'Cloyster',  types: ['Water','Ice'], baseStats: { hp:50,atk:95,def:180,speed:70,special:85 }, level: 53 },
      { speciesId: 80,  name: 'Slowbro',   types: ['Water','Psychic'], baseStats: { hp:95,atk:75,def:110,speed:30,special:100 }, level: 54 },
      { speciesId: 124, name: 'Jynx',      types: ['Ice','Psychic'], baseStats: { hp:65,atk:50,def:35,speed:95,special:95 }, level: 56 },
      { speciesId: 131, name: 'Lapras',    types: ['Water','Ice'], baseStats: { hp:130,atk:85,def:80,speed:60,special:95 }, level: 56 },
    ]
  },
  {
    name: 'Bruno', title: 'Elite Four', type: 'Fighting',
    items: [{ id: 'black_belt', name: 'Black Belt' }, { id: 'choice_band', name: 'Choice Band' }],
    team: [
      { speciesId: 95,  name: 'Onix',      types: ['Rock','Ground'], baseStats: { hp:35,atk:45,def:160,speed:70,special:30 }, level: 53 },
      { speciesId: 107, name: 'Hitmonchan',types: ['Fighting'], baseStats: { hp:50,atk:105,def:79,speed:76,special:35 }, level: 55 },
      { speciesId: 106, name: 'Hitmonlee', types: ['Fighting'], baseStats: { hp:50,atk:120,def:53,speed:87,special:35 }, level: 55 },
      { speciesId: 95,  name: 'Onix',      types: ['Rock','Ground'], baseStats: { hp:35,atk:45,def:160,speed:70,special:30 }, level: 54 },
      { speciesId: 68,  name: 'Machamp',   types: ['Fighting'], baseStats: { hp:90,atk:130,def:80,speed:55,special:65 }, level: 58 },
    ]
  },
  {
    name: 'Agatha', title: 'Elite Four', type: 'Ghost',
    items: [{ id: 'spell_tag', name: 'Spell Tag' }, { id: 'life_orb', name: 'Life Orb' }],
    team: [
      { speciesId: 94,  name: 'Gengar',    types: ['Ghost','Poison'], baseStats: { hp:60,atk:65,def:60,speed:110,special:130 }, level: 54 },
      { speciesId: 42,  name: 'Golbat',    types: ['Poison','Flying'], baseStats: { hp:75,atk:80,def:70,speed:90,special:75 }, level: 54 },
      { speciesId: 93,  name: 'Haunter',   types: ['Ghost','Poison'], baseStats: { hp:45,atk:50,def:45,speed:95,special:115 }, level: 56 },
      { speciesId: 42,  name: 'Golbat',    types: ['Poison','Flying'], baseStats: { hp:75,atk:80,def:70,speed:90,special:75 }, level: 56 },
      { speciesId: 94,  name: 'Gengar',    types: ['Ghost','Poison'], baseStats: { hp:60,atk:65,def:60,speed:110,special:130 }, level: 58 },
    ]
  },
  {
    name: 'Lance', title: 'Elite Four', type: 'Dragon',
    items: [{ id: 'dragon_fang', name: 'Dragon Fang' }, { id: 'scope_lens', name: 'Scope Lens' }],
    team: [
      { speciesId: 130, name: 'Gyarados',  types: ['Water','Flying'], baseStats: { hp:95,atk:125,def:79,speed:81,special:100 }, level: 56 },
      { speciesId: 149, name: 'Dragonite', types: ['Dragon','Flying'], baseStats: { hp:91,atk:134,def:95,speed:80,special:100 }, level: 56 },
      { speciesId: 148, name: 'Dragonair', types: ['Dragon'], baseStats: { hp:61,atk:84,def:65,speed:70,special:70 }, level: 58 },
      { speciesId: 148, name: 'Dragonair', types: ['Dragon'], baseStats: { hp:61,atk:84,def:65,speed:70,special:70 }, level: 60 },
      { speciesId: 149, name: 'Dragonite', types: ['Dragon','Flying'], baseStats: { hp:91,atk:134,def:95,speed:80,special:100 }, level: 62 },
    ]
  },
  {
    name: 'Gary', title: 'Champion', type: 'Mixed',
    items: [{ id: 'life_orb', name: 'Life Orb' }, { id: 'choice_scarf', name: 'Choice Scarf' }, { id: 'expert_belt', name: 'Expert Belt' }, { id: 'scope_lens', name: 'Scope Lens' }],
    team: [
      { speciesId: 18,  name: 'Pidgeot',   types: ['Normal','Flying'], baseStats: { hp:83,atk:80,def:75,speed:101,special:70 }, level: 61 },
      { speciesId: 65,  name: 'Alakazam',  types: ['Psychic'], baseStats: { hp:55,atk:50,def:45,speed:120,special:135 }, level: 59 },
      { speciesId: 112, name: 'Rhydon',    types: ['Ground','Rock'], baseStats: { hp:105,atk:130,def:120,speed:40,special:45 }, level: 61 },
      { speciesId: 103, name: 'Exeggutor', types: ['Grass','Psychic'], baseStats: { hp:95,atk:95,def:85,speed:55,special:125 }, level: 61 },
      { speciesId: 6,   name: 'Charizard', types: ['Fire','Flying'], baseStats: { hp:78,atk:84,def:78,speed:100,special:109 }, level: 65 },
    ]
  },
];

// Item pool
const ITEM_POOL = [
  { id: 'lucky_egg',     name: 'Lucky Egg',     desc: '+3 levels per win (default +2)',         icon: '🥚', minMap: 4 },
  { id: 'life_orb',      name: 'Life Orb',       desc: '×1.3 damage; attacker loses 10% HP/hit', icon: '🔮' },
  { id: 'choice_band',   name: 'Choice Band',    desc: '×1.5 ATK, ×0.75 DEF',                  icon: '🎀' },
  { id: 'scope_lens',    name: 'Scope Lens',     desc: '20% chance crit (×1.5 damage)',          icon: '🔭' },
  { id: 'rocky_helmet',  name: 'Rocky Helmet',   desc: 'Attacker takes 15% maxHP on hit',        icon: '⛑️' },
  { id: 'shell_bell',    name: 'Shell Bell',     desc: 'Heal 25% of damage dealt',              icon: '🐚' },
  { id: 'eviolite',      name: 'Eviolite',       desc: 'NFE Pokemon ×1.5 DEF',                  icon: '💎' },
  { id: 'macho_brace',   name: 'Macho Brace',    desc: '+4 levels per win, ×0.75 Speed',         icon: '💪', minMap: 4 },
  { id: 'sharp_beak',    name: 'Sharp Beak',     desc: 'Flying moves ×1.5',                     icon: '🦅' },
  { id: 'charcoal',      name: 'Charcoal',       desc: 'Fire moves ×1.5',                       icon: '🪨' },
  { id: 'mystic_water',  name: 'Mystic Water',   desc: 'Water moves ×1.5',                      icon: '💧' },
  { id: 'magnet',        name: 'Magnet',         desc: 'Electric moves ×1.5',                   icon: '🧲' },
  { id: 'miracle_seed',  name: 'Miracle Seed',   desc: 'Grass moves ×1.5',                      icon: '🌱' },
  { id: 'never_melt_ice',name: 'NeverMeltIce',   desc: 'Ice moves ×1.5',                        icon: '❄️' },
  { id: 'twisted_spoon', name: 'Twisted Spoon',  desc: 'Psychic moves ×1.5',                    icon: '🥄' },
  { id: 'black_belt',    name: 'Black Belt',     desc: 'Fighting moves ×1.5',                   icon: '🥋' },
  { id: 'soft_sand',     name: 'Soft Sand',      desc: 'Ground moves ×1.5',                     icon: '🏖️' },
  { id: 'silver_powder', name: 'Silver Powder',  desc: 'Bug moves ×1.5',                        icon: '🐛' },
  { id: 'hard_stone',    name: 'Hard Stone',     desc: 'Rock moves ×1.5',                       icon: '🪨' },
  { id: 'dragon_fang',   name: 'Dragon Fang',    desc: 'Dragon moves ×1.5',                     icon: '🐉' },
  { id: 'poison_barb',   name: 'Poison Barb',    desc: 'Poison moves ×1.5',                     icon: '☠️' },
  { id: 'spell_tag',     name: 'Spell Tag',      desc: 'Ghost moves ×1.5',                      icon: '👻' },
  { id: 'black_glasses', name: 'Black Glasses',  desc: 'Dark moves ×1.5',                        icon: '🕶️' },
  { id: 'silk_scarf',    name: 'Silk Scarf',     desc: 'Normal moves ×1.5',                      icon: '🤍' },
  // Stat items
  { id: 'assault_vest',  name: 'Assault Vest',   desc: '×1.5 DEF for all your Pokemon',          icon: '🦺' },
  { id: 'choice_scarf',  name: 'Choice Scarf',   desc: '×1.5 Speed, ×0.75 ATK',                 icon: '🧣' },
  // Battle effect items
  { id: 'leftovers',     name: 'Leftovers',      desc: 'Restore 1/16 maxHP per turn',            icon: '🍃' },
  { id: 'expert_belt',   name: 'Expert Belt',    desc: '×1.2 damage on super effective hits',    icon: '🥊' },
  { id: 'focus_band',    name: 'Focus Band',     desc: '10% chance to survive a KO with 1 HP',  icon: '🎗️' },
  { id: 'razor_claw',    name: 'Razor Claw',     desc: '40% chance to crit (×1.5 damage)',       icon: '🗡️' },
  { id: 'air_balloon',   name: 'Air Balloon',    desc: 'Immune to Ground-type moves',            icon: '🎈' },
];

const TYPE_ITEM_MAP = {
  Flying: 'sharp_beak', Fire: 'charcoal', Water: 'mystic_water', Electric: 'magnet',
  Grass: 'miracle_seed', Ice: 'never_melt_ice', Psychic: 'twisted_spoon', Fighting: 'black_belt',
  Ground: 'soft_sand', Bug: 'silver_powder', Rock: 'hard_stone', Dragon: 'dragon_fang',
  Poison: 'poison_barb', Ghost: 'spell_tag', Normal: 'silk_scarf',
};

// BST ranges per map
const MAP_BST_RANGES = [
  { min: 200, max: 310 },   // Map 1
  { min: 280, max: 360 },   // Map 2
  { min: 340, max: 420 },   // Map 3
  { min: 340, max: 420 },   // Map 4
  { min: 400, max: 480 },   // Map 5
  { min: 400, max: 480 },   // Map 6
  { min: 460, max: 530 },   // Map 7
  { min: 460, max: 530 },   // Map 8
  { min: 530, max: 999 },   // Final
];

const MAP_LEVEL_RANGES = [
  [2, 6], [8, 15], [15, 22], [22, 30],
  [30, 38], [38, 44], [44, 48], [48, 53], [54, 65]
];

// PokeAPI cache helpers
const CACHE_KEY_SPECIES = 'pkrl_species_list';

function getCached(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

function setCached(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

async function fetchSpeciesList() {
  const cached = getCached(CACHE_KEY_SPECIES);
  if (cached) return cached;
  try {
    const r = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
    const d = await r.json();
    const list = d.results.map((p, i) => ({ name: p.name, id: i + 1 }));
    setCached(CACHE_KEY_SPECIES, list);
    return list;
  } catch (e) {
    console.warn('PokeAPI unavailable, using fallback data');
    return null;
  }
}

async function fetchPokemonById(id) {
  const key = `pkrl_poke_${id}`;
  const cached = getCached(key);
  if (cached) return cached;
  try {
    const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const d = await r.json();
    const stats = {};
    for (const s of d.stats) {
      stats[s.stat.name.replace('special-attack','special').replace('special-defense','special').replace('-','_')] = s.base_stat;
    }
    const baseStats = {
      hp: d.stats.find(s=>s.stat.name==='hp')?.base_stat || 45,
      atk: d.stats.find(s=>s.stat.name==='attack')?.base_stat || 50,
      def: d.stats.find(s=>s.stat.name==='defense')?.base_stat || 50,
      speed: d.stats.find(s=>s.stat.name==='speed')?.base_stat || 50,
      special: d.stats.find(s=>s.stat.name==='special-attack')?.base_stat || 50,
    };
    const bst = Object.values(baseStats).reduce((a,b)=>a+b,0);
    const types = d.types.map(t => t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1));
    const poke = {
      id: d.id,
      name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
      types,
      baseStats,
      bst,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${d.id}.png`,
      shinySpriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${d.id}.png`,
    };
    setCached(key, poke);
    return poke;
  } catch (e) {
    console.warn(`Failed to fetch pokemon ${id}`, e);
    return null;
  }
}

let _speciesPool = null;
let _poolByMap = {};

async function getSpeciesPool() {
  if (_speciesPool) return _speciesPool;
  _speciesPool = await fetchSpeciesList();
  return _speciesPool;
}

// Get 3 random pokemon ids from the right BST bucket for a given mapIndex
async function getCatchChoices(mapIndex) {
  const range = MAP_BST_RANGES[Math.min(mapIndex, MAP_BST_RANGES.length - 1)];
  const pool = await getSpeciesPool();

  // We'll sample random IDs from Gen 1 (1-151) and beyond, but use BST filtering on fetched data
  // For efficiency, use a predefined set of Gen 1 pokemon IDs by rough BST
  const GEN1_BST_APPROX = {
    // low BST: 200-310 (unevolved basics)
    low: [10,11,13,14,16,17,19,20,21,23,27,29,32,41,46,48,52,54,56,60,
          69,72,74,79,81,84,86,96,98,100,102,108,111,116,118,120,
          129,133],
    // mid-low: 310-390 (mid-stage / slightly evolved)
    midLow: [25,30,33,35,37,39,43,50,58,61,63,66,73,77,83,92,95,96,104,109,
             113,114,116,120,122,123,126,127,128,138,140],
    // mid: 380-450 (second evolutions, strong basics)
    mid: [26,36,42,49,51,64,67,70,75,82,85,93,97,101,103,105,107,110,119,
          121,124,125,130,137,139,141],
    // mid-high: 440-500 (mostly final evolutions)
    midHigh: [40,44,55,62,76,80,87,88,89,90,91,99,106,115,117,131,
              132,137,142,143,144,145,146],
    // high: 490-530 (powerful fully evolved)
    high: [3,6,9,12,15,18,22,24,28,31,34,38,45,47,53,57,59,
           65,68,71,76,78,80,89,94,112,121,130,142,143,149],
    // very high: 530+ (pseudo-legendaries, legendaries)
    veryHigh: [6,9,65,68,94,112,130,131,143,144,145,146,147,148,149,150,151]
  };

  let bucket;
  if (range.min >= 530) bucket = GEN1_BST_APPROX.veryHigh;
  else if (range.min >= 460) bucket = GEN1_BST_APPROX.high;
  else if (range.min >= 400) bucket = GEN1_BST_APPROX.midHigh;
  else if (range.min >= 340) bucket = GEN1_BST_APPROX.mid;
  else if (range.min >= 280) bucket = GEN1_BST_APPROX.midLow;
  else bucket = GEN1_BST_APPROX.low;

  // Shuffle and pick 3
  const shuffled = [...bucket].sort(() => Math.random() - 0.5);
  const ids = shuffled.slice(0, 3);

  const results = await Promise.all(ids.map(id => fetchPokemonById(id)));
  return results.filter(Boolean);
}

function calcHp(baseHp, level) {
  return Math.floor(baseHp * level / 50) + level + 10;
}

function createInstance(species, level, isShiny = false) {
  const lvl = level || 5;
  const maxHp = calcHp(species.baseStats.hp, lvl);
  const id = species.id ?? species.speciesId;
  const spriteUrl = isShiny
    ? (species.shinySpriteUrl || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`)
    : (species.spriteUrl      || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`);
  return {
    speciesId: id,
    name: species.name,
    nickname: null,
    level: lvl,
    currentHp: maxHp,
    maxHp,
    isShiny,
    types: species.types,
    baseStats: species.baseStats,
    spriteUrl,
    megaStone: null,
  };
}

// Starters
const STARTER_IDS = [1, 4, 7];

// Trainer sprites from Pokemon Showdown CDN
const TRAINER_SVG = {
  boy:  `<img src="https://play.pokemonshowdown.com/sprites/trainers/red.png"  alt="Red"  class="trainer-sprite-img" onerror="this.style.opacity='.3'">`,
  girl: `<img src="https://play.pokemonshowdown.com/sprites/trainers/dawn.png" alt="Dawn" class="trainer-sprite-img" onerror="this.style.opacity='.3'">`,
  npc:  `<img src="https://play.pokemonshowdown.com/sprites/trainers/youngster.png" alt="Trainer" class="trainer-sprite-img" onerror="this.style.opacity='.3'">`,
};

// Name overrides for Pokemon Showdown trainer sprite filenames
const SHOWDOWN_NAME_MAP = { 'gary': 'blue', 'lt. surge': 'lt-surge', 'lorelei': 'lorelei-gen1', 'agatha': 'agatha-gen1' };

function getTrainerImgHtml(trainerName) {
  const key = trainerName.toLowerCase();
  const slug = SHOWDOWN_NAME_MAP[key] || key.replace(/[.']/g, '').replace(/\s+/g, '-');
  return `<img src="https://play.pokemonshowdown.com/sprites/trainers/${slug}.png"
    alt="${trainerName}" class="trainer-sprite-img"
    onerror="this.src='https://play.pokemonshowdown.com/sprites/trainers/youngster.png';this.onerror=null">`;
}

// All Gen 1 evolutions — stone/trade converted to sensible levels
const GEN1_EVOLUTIONS = {
  // Starters
  1:  { into: 2,   level: 16, name: 'Ivysaur' },
  2:  { into: 3,   level: 32, name: 'Venusaur' },
  4:  { into: 5,   level: 16, name: 'Charmeleon' },
  5:  { into: 6,   level: 36, name: 'Charizard' },
  7:  { into: 8,   level: 16, name: 'Wartortle' },
  8:  { into: 9,   level: 36, name: 'Blastoise' },
  // Bugs
  10: { into: 11,  level: 7,  name: 'Metapod' },
  11: { into: 12,  level: 10, name: 'Butterfree' },
  13: { into: 14,  level: 7,  name: 'Kakuna' },
  14: { into: 15,  level: 10, name: 'Beedrill' },
  // Birds / normals
  16: { into: 17,  level: 18, name: 'Pidgeotto' },
  17: { into: 18,  level: 36, name: 'Pidgeot' },
  19: { into: 20,  level: 20, name: 'Raticate' },
  21: { into: 22,  level: 20, name: 'Fearow' },
  // Snakes / ground
  23: { into: 24,  level: 22, name: 'Arbok' },
  27: { into: 28,  level: 22, name: 'Sandslash' },
  // Nidos
  29: { into: 30,  level: 16, name: 'Nidorina' },
  30: { into: 31,  level: 36, name: 'Nidoqueen' },  // stone → lv 36
  32: { into: 33,  level: 16, name: 'Nidorino' },
  33: { into: 34,  level: 36, name: 'Nidoking' },   // stone → lv 36
  // Fairies / grass
  35: { into: 36,  level: 36, name: 'Clefable' },   // moon stone → lv 36
  37: { into: 38,  level: 32, name: 'Ninetales' },  // fire stone → lv 32
  39: { into: 40,  level: 36, name: 'Wigglytuff' }, // moon stone → lv 36
  // Zubat
  41: { into: 42,  level: 22, name: 'Golbat' },
  // Grass
  43: { into: 44,  level: 21, name: 'Gloom' },
  44: { into: 45,  level: 36, name: 'Vileplume' },  // leaf stone → lv 36
  // Parasect / Venomoth
  46: { into: 47,  level: 24, name: 'Parasect' },
  48: { into: 49,  level: 31, name: 'Venomoth' },
  // Diglett / Meowth / Psyduck / Mankey
  50: { into: 51,  level: 26, name: 'Dugtrio' },
  52: { into: 53,  level: 28, name: 'Persian' },
  54: { into: 55,  level: 33, name: 'Golduck' },
  56: { into: 57,  level: 28, name: 'Primeape' },
  // Growlithe
  58: { into: 59,  level: 34, name: 'Arcanine' },   // fire stone → lv 34
  // Poliwag
  60: { into: 61,  level: 25, name: 'Poliwhirl' },
  61: { into: 62,  level: 40, name: 'Poliwrath' },  // water stone → lv 40
  // Abra / Machop / Bellsprout
  63: { into: 64,  level: 16, name: 'Kadabra' },
  64: { into: 65,  level: 36, name: 'Alakazam' },   // trade → lv 36
  66: { into: 67,  level: 28, name: 'Machoke' },
  67: { into: 68,  level: 40, name: 'Machamp' },    // trade → lv 40
  69: { into: 70,  level: 21, name: 'Weepinbell' },
  70: { into: 71,  level: 36, name: 'Victreebel' }, // leaf stone → lv 36
  // Tentacool / Geodude / Ponyta
  72: { into: 73,  level: 30, name: 'Tentacruel' },
  74: { into: 75,  level: 25, name: 'Graveler' },
  75: { into: 76,  level: 40, name: 'Golem' },      // trade → lv 40
  77: { into: 78,  level: 40, name: 'Rapidash' },
  // Slowpoke / Magnemite / Doduo / Seel / Grimer
  79: { into: 80,  level: 37, name: 'Slowbro' },    // water stone in some versions → lv 37
  81: { into: 82,  level: 30, name: 'Magneton' },
  84: { into: 85,  level: 31, name: 'Dodrio' },
  86: { into: 87,  level: 34, name: 'Dewgong' },
  88: { into: 89,  level: 38, name: 'Muk' },
  // Shellder / Gastly / Onix / Drowzee / Krabby / Voltorb
  90: { into: 91,  level: 36, name: 'Cloyster' },   // water stone → lv 36
  92: { into: 93,  level: 25, name: 'Haunter' },
  93: { into: 94,  level: 38, name: 'Gengar' },     // trade → lv 38
  95: { into: 208, level: 40, name: 'Steelix' },    // trade → lv 40 (Steelix #208)
  96: { into: 97,  level: 26, name: 'Hypno' },
  98: { into: 99,  level: 28, name: 'Kingler' },
  100:{ into: 101, level: 30, name: 'Electrode' },
  // Exeggcute / Cubone / Lickitung / Koffing / Rhyhorn
  102:{ into: 103, level: 36, name: 'Exeggutor' },  // leaf stone → lv 36
  104:{ into: 105, level: 28, name: 'Marowak' },
  109:{ into: 110, level: 35, name: 'Weezing' },
  111:{ into: 112, level: 42, name: 'Rhydon' },
  // Horsea / Goldeen / Staryu / Scyther / Electabuzz / Magmar / Pinsir
  116:{ into: 117, level: 32, name: 'Seadra' },
  118:{ into: 119, level: 33, name: 'Seaking' },
  120:{ into: 121, level: 36, name: 'Starmie' },    // water stone → lv 36
  123:{ into: 212, level: 40, name: 'Scizor' },     // trade → lv 40 (Scizor #212)
  // Eevee — branching, handled separately
  // Omanyte / Kabuto / Aerodactyl (fossils — no evolution here)
  138:{ into: 139, level: 40, name: 'Omastar' },
  140:{ into: 141, level: 40, name: 'Kabutops' },
  // Dratini
  129:{ into: 130, level: 20, name: 'Gyarados' },
  147:{ into: 148, level: 30, name: 'Dragonair' },
  148:{ into: 149, level: 55, name: 'Dragonite' },
};

// Eevee branching evolution options (shown as a choice at level 36)
const EEVEE_EVOLUTIONS = [
  { into: 136, level: 36, name: 'Flareon',  types: ['Fire'] },
  { into: 134, level: 36, name: 'Vaporeon', types: ['Water'] },
  { into: 135, level: 36, name: 'Jolteon',  types: ['Electric'] },
];

// ---- Achievements ----

const ACHIEVEMENTS = [
  { id: 'gym_0', name: 'Boulder Basher',    desc: 'Defeat Brock for the first time',          icon: '🪨' },
  { id: 'gym_1', name: 'Cascade Crusher',   desc: 'Defeat Misty for the first time',          icon: '💧' },
  { id: 'gym_2', name: 'Thunder Tamer',     desc: 'Defeat Lt. Surge for the first time',      icon: '⚡' },
  { id: 'gym_3', name: 'Rainbow Ranger',    desc: 'Defeat Erika for the first time',          icon: '🌿' },
  { id: 'gym_4', name: 'Soul Crusher',      desc: 'Defeat Koga for the first time',           icon: '💜' },
  { id: 'gym_5', name: 'Mind Breaker',      desc: 'Defeat Sabrina for the first time',        icon: '🔮' },
  { id: 'gym_6', name: 'Volcano Victor',    desc: 'Defeat Blaine for the first time',         icon: '🌋' },
  { id: 'gym_7', name: 'Earth Shaker',      desc: 'Defeat Giovanni for the first time',       icon: '🌍' },
  { id: 'elite_four', name: 'Pokemon Master', desc: 'Defeat the Elite Four & Champion',       icon: '👑' },
  { id: 'starter_1', name: 'Grass Champion',  desc: 'Beat the game starting with Bulbasaur',  icon: '🌱' },
  { id: 'starter_4', name: 'Fire Champion',   desc: 'Beat the game starting with Charmander', icon: '🔥' },
  { id: 'starter_7', name: 'Water Champion',  desc: 'Beat the game starting with Squirtle',   icon: '🌊' },
  { id: 'solo_run',  name: 'One is Enough',   desc: 'Beat the game with only 1 Pokemon on your team', icon: '⭐' },
];

function getUnlockedAchievements() {
  try { return new Set(JSON.parse(localStorage.getItem('poke_achievements') || '[]')); }
  catch { return new Set(); }
}

function unlockAchievement(id) {
  const unlocked = getUnlockedAchievements();
  if (unlocked.has(id)) return null;
  unlocked.add(id);
  localStorage.setItem('poke_achievements', JSON.stringify([...unlocked]));
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

// ---- Pokedex ----

function getPokedex() {
  try { return JSON.parse(localStorage.getItem('poke_dex') || '{}'); }
  catch { return {}; }
}

function markPokedexSeen(id, name, types, spriteUrl) {
  if (!id) return;
  const dex = getPokedex();
  if (!dex[id]) {
    dex[id] = { id, name, types, spriteUrl, caught: false };
    localStorage.setItem('poke_dex', JSON.stringify(dex));
  }
}

function markPokedexCaught(id) {
  if (!id) return;
  const dex = getPokedex();
  if (!dex[id] || !dex[id].caught) {
    dex[id] = { ...(dex[id] || { id }), caught: true };
    localStorage.setItem('poke_dex', JSON.stringify(dex));
  }
}

function getShinyDex() {
  try { return JSON.parse(localStorage.getItem('poke_shiny_dex') || '{}'); }
  catch { return {}; }
}

function markShinyDexCaught(id, name, types, shinySpriteUrl) {
  if (!id) return;
  const dex = getShinyDex();
  dex[id] = { id, name, types, shinySpriteUrl };
  localStorage.setItem('poke_shiny_dex', JSON.stringify(dex));
}
