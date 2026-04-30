// engine/data.js — pure game data for server-side battle replay.
// Extracted from client data.js; no browser APIs or localStorage.

const TYPE_CHART = {
  Normal:   { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:1,   Rock:0.5, Ghost:0,   Dragon:1,   Dark:1,   Steel:0.5 },
  Fire:     { Normal:1,   Fire:0.5, Water:0.5, Electric:1,   Grass:2,   Ice:2,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:2,   Rock:0.5, Ghost:1,   Dragon:0.5, Dark:1,   Steel:2   },
  Water:    { Normal:1,   Fire:2,   Water:0.5, Electric:1,   Grass:0.5, Ice:1,   Fighting:1,   Poison:1,   Ground:2, Flying:1,   Psychic:1,   Bug:1,   Rock:2,   Ghost:1,   Dragon:0.5, Dark:1,   Steel:1   },
  Electric: { Normal:1,   Fire:1,   Water:2,   Electric:0.5, Grass:0.5, Ice:1,   Fighting:1,   Poison:1,   Ground:0, Flying:2,   Psychic:1,   Bug:1,   Rock:1,   Ghost:1,   Dragon:0.5, Dark:1,   Steel:1   },
  Grass:    { Normal:1,   Fire:0.5, Water:2,   Electric:1,   Grass:0.5, Ice:1,   Fighting:1,   Poison:0.5, Ground:2, Flying:0.5, Psychic:1,   Bug:0.5, Rock:2,   Ghost:1,   Dragon:0.5, Dark:1,   Steel:0.5 },
  Ice:      { Normal:1,   Fire:0.5, Water:0.5, Electric:1,   Grass:2,   Ice:0.5, Fighting:1,   Poison:1,   Ground:2, Flying:2,   Psychic:1,   Bug:1,   Rock:1,   Ghost:1,   Dragon:2,   Dark:1,   Steel:0.5 },
  Fighting: { Normal:2,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:2,   Fighting:1,   Poison:0.5, Ground:1, Flying:0.5, Psychic:0.5, Bug:0.5, Rock:2,   Ghost:0,   Dragon:1,   Dark:2,   Steel:2   },
  Poison:   { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:2,   Ice:1,   Fighting:1,   Poison:0.5, Ground:0.5, Flying:1, Psychic:1,   Bug:1,   Rock:0.5, Ghost:0.5, Dragon:1,   Dark:1,   Steel:0   },
  Ground:   { Normal:1,   Fire:2,   Water:1,   Electric:2,   Grass:0.5, Ice:1,   Fighting:1,   Poison:2,   Ground:1, Flying:0,   Psychic:1,   Bug:0.5, Rock:2,   Ghost:1,   Dragon:1,   Dark:1,   Steel:2   },
  Flying:   { Normal:1,   Fire:1,   Water:1,   Electric:0.5, Grass:2,   Ice:1,   Fighting:2,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:2,   Rock:0.5, Ghost:1,   Dragon:1,   Dark:1,   Steel:0.5 },
  Psychic:  { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:2,   Poison:2,   Ground:1, Flying:1,   Psychic:0.5, Bug:1,   Rock:1,   Ghost:1,   Dragon:1,   Dark:0,   Steel:0.5 },
  Bug:      { Normal:1,   Fire:0.5, Water:1,   Electric:1,   Grass:2,   Ice:1,   Fighting:0.5, Poison:0.5, Ground:1, Flying:0.5, Psychic:2,   Bug:1,   Rock:1,   Ghost:0.5, Dragon:1,   Dark:2,   Steel:0.5 },
  Rock:     { Normal:1,   Fire:2,   Water:1,   Electric:1,   Grass:1,   Ice:2,   Fighting:0.5, Poison:1,   Ground:0.5, Flying:2, Psychic:1,   Bug:2,   Rock:1,   Ghost:1,   Dragon:1,   Dark:1,   Steel:0.5 },
  Ghost:    { Normal:0,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:2,   Bug:1,   Rock:1,   Ghost:2,   Dragon:1,   Dark:0.5, Steel:0.5 },
  Dragon:   { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:1,   Rock:1,   Ghost:1,   Dragon:2,   Dark:1,   Steel:0.5 },
  Dark:     { Normal:1,   Fire:1,   Water:1,   Electric:1,   Grass:1,   Ice:1,   Fighting:0.5, Poison:1,   Ground:1, Flying:1,   Psychic:2,   Bug:1,   Rock:1,   Ghost:2,   Dragon:1,   Dark:0.5, Steel:0.5 },
  Steel:    { Normal:1,   Fire:0.5, Water:0.5, Electric:0.5, Grass:1,   Ice:2,   Fighting:1,   Poison:1,   Ground:1, Flying:1,   Psychic:1,   Bug:1,   Rock:2,   Ghost:1,   Dragon:1,   Dark:1,   Steel:0.5 },
};

function getTypeEffectiveness(attackType, defenderTypes) {
  let mult = 1;
  for (const dt of defenderTypes) {
    const cap = dt.charAt(0).toUpperCase() + dt.slice(1).toLowerCase();
    const atCap = attackType.charAt(0).toUpperCase() + attackType.slice(1).toLowerCase();
    if (TYPE_CHART[atCap] && TYPE_CHART[atCap][cap] !== undefined) mult *= TYPE_CHART[atCap][cap];
  }
  return mult;
}

const TYPE_ITEM_MAP = {
  Flying: 'sharp_beak', Fire: 'charcoal', Water: 'mystic_water', Electric: 'magnet',
  Grass: 'miracle_seed', Psychic: 'twisted_spoon', Fighting: 'black_belt',
  Ground: 'soft_sand', Bug: 'silver_powder', Rock: 'hard_stone', Dragon: 'dragon_fang',
  Poison: 'poison_barb', Ghost: 'spell_tag', Normal: 'silk_scarf',
};

const MOVE_POOL = {
  Normal:   { physical: [{name:'Tackle',power:40},{name:'Body Slam',power:85},{name:'Giga Impact',power:150}],
              special:  [{name:'Swift',power:60},{name:'Hyper Voice',power:90},{name:'Boomburst',power:140}] },
  Fire:     { physical: [{name:'Ember',power:60},{name:'Fire Punch',power:75},{name:'Flare Blitz',power:120}],
              special:  [{name:'Incinerate',power:60},{name:'Flamethrower',power:90},{name:'Fire Blast',power:110}] },
  Water:    { physical: [{name:'Water Gun',power:50},{name:'Waterfall',power:80},{name:'Aqua Tail',power:110}],
              special:  [{name:'Bubble',power:50},{name:'Surf',power:80},{name:'Hydro Pump',power:110}] },
  Electric: { physical: [{name:'Spark',power:40},{name:'Thunder Punch',power:75},{name:'Bolt Strike',power:130}],
              special:  [{name:'Thunder Shock',power:40},{name:'Thunderbolt',power:90},{name:'Thunder',power:110}] },
  Grass:    { physical: [{name:'Vine Whip',power:40},{name:'Razor Leaf',power:65},{name:'Power Whip',power:120}],
              special:  [{name:'Magical Leaf',power:40},{name:'Energy Ball',power:90},{name:'Solar Beam',power:120}] },
  Ice:      { physical: [{name:'Powder Snow',power:40},{name:'Ice Punch',power:75},{name:'Icicle Crash',power:110}],
              special:  [{name:'Icy Wind',power:40},{name:'Ice Beam',power:90},{name:'Blizzard',power:110}] },
  Fighting: { physical: [{name:'Karate Chop',power:50},{name:'Cross Chop',power:100},{name:'Close Combat',power:120}],
              special:  [{name:'Force Palm',power:60},{name:'Aura Sphere',power:80},{name:'Focus Blast',power:120}] },
  Poison:   { physical: [{name:'Poison Sting',power:40},{name:'Poison Jab',power:90},{name:'Gunk Shot',power:130}],
              special:  [{name:'Acid',power:40},{name:'Sludge Bomb',power:100},{name:'Acid Spray',power:120}] },
  Ground:   { physical: [{name:'Mud Shot',power:55},{name:'Earthquake',power:100},{name:'Precipice Blades',power:120}],
              special:  [{name:'Bulldoze',power:60},{name:'Earth Power',power:90},{name:"Land's Wrath",power:110}] },
  Flying:   { physical: [{name:'Peck',power:50},{name:'Aerial Ace',power:60},{name:'Sky Attack',power:140}],
              special:  [{name:'Gust',power:40},{name:'Air Slash',power:75},{name:'Hurricane',power:110}] },
  Psychic:  { physical: [{name:'Confusion',power:50},{name:'Zen Headbutt',power:80},{name:'Psycho Boost',power:140}],
              special:  [{name:'Psybeam',power:65},{name:'Psychic',power:90},{name:'Psystrike',power:100}] },
  Bug:      { physical: [{name:'Bug Bite',power:60},{name:'X-Scissor',power:80},{name:'Megahorn',power:120}],
              special:  [{name:'Struggle Bug',power:50},{name:'Bug Buzz',power:90},{name:'Pollen Puff',power:110}] },
  Rock:     { physical: [{name:'Rock Throw',power:50},{name:'Rock Slide',power:75},{name:'Stone Edge',power:100}],
              special:  [{name:'Smack Down',power:50},{name:'Power Gem',power:80},{name:'Rock Wrecker',power:150}] },
  Ghost:    { physical: [{name:'Astonish',power:40},{name:'Shadow Claw',power:70},{name:'Phantom Force',power:90}],
              special:  [{name:'Lick',power:40},{name:'Shadow Ball',power:80},{name:'Shadow Force',power:120}] },
  Dragon:   { physical: [{name:'Twister',power:40},{name:'Dragon Claw',power:80},{name:'Outrage',power:120}],
              special:  [{name:'Dragon Breath',power:60},{name:'Dragon Pulse',power:85},{name:'Draco Meteor',power:130}] },
  Dark:     { physical: [{name:'Bite',power:60},{name:'Crunch',power:80},{name:'Knock Off',power:120}],
              special:  [{name:'Snarl',power:55},{name:'Dark Pulse',power:80},{name:'Night Daze',power:110}] },
  Steel:    { physical: [{name:'Metal Claw',power:50},{name:'Iron Tail',power:100},{name:'Heavy Slam',power:130}],
              special:  [{name:'Steel Wing',power:60},{name:'Flash Cannon',power:90},{name:'Doom Desire',power:140}] },
  Fairy:    { physical: [{name:'Fairy Wind',power:40},{name:'Play Rough',power:90},{name:'Spirit Break',power:130}],
              special:  [{name:'Disarming Voice',power:40},{name:'Dazzling Gleam',power:80},{name:'Moonblast',power:130}] },
};

function getBestMove(types, baseStats, speciesId, moveTier = 1) {
  if (speciesId === 129) return { name: 'Splash',   power: 0, type: 'Normal', isSpecial: false, noDamage: true };
  if (speciesId === 63)  return { name: 'Teleport', power: 0, type: 'Normal', isSpecial: false, noDamage: true };
  const isSpecial = (baseStats?.special || 0) >= (baseStats?.atk || 0);
  const tier = Math.max(0, Math.min(2, moveTier ?? 1));
  if ([74, 75, 76, 95].includes(speciesId)) {
    const move = MOVE_POOL['Rock'][isSpecial ? 'special' : 'physical'][tier];
    return { ...move, type: 'Rock', isSpecial };
  }
  for (const t of types) {
    if (t.toLowerCase() === 'normal' && types.length > 1) continue;
    const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    if (MOVE_POOL[cap]) {
      const move = isSpecial ? MOVE_POOL[cap].special[tier] : MOVE_POOL[cap].physical[tier];
      return { ...move, type: cap, isSpecial };
    }
  }
  return { name: 'Tackle', power: 40, type: 'Normal', isSpecial: false };
}

function calcHp(baseHp, level) {
  return Math.floor((baseHp * 2 * level) / 100) + level + 10;
}

// Species that can evolve (used by eviolite item check).
// Subset of client EVOLUTIONS keys relevant to gym leader / player teams.
const EVOLVABLE_IDS = new Set([
  1,2,4,5,7,8,10,11,13,14,16,17,19,21,23,25,27,29,30,32,33,35,37,39,41,43,44,46,48,
  50,52,54,56,58,60,61,63,64,66,67,69,70,72,74,75,77,79,81,84,86,88,90,92,93,95,96,
  98,100,102,104,108,109,111,112,113,114,116,117,118,120,123,125,126,133,137,138,140,
  147,148,233,
]);

function canEvolve(speciesId) {
  return EVOLVABLE_IDS.has(speciesId);
}

function createInstance(species, level, moveTier = 1) {
  const lvl = level || 5;
  const id = species.speciesId ?? species.id;
  const maxHp = calcHp(species.baseStats.hp, lvl);
  return {
    speciesId: id,
    name: species.name,
    level: lvl,
    currentHp: maxHp,
    maxHp,
    types: species.types,
    baseStats: species.baseStats,
    heldItem: species.heldItem || null,
    moveTier: Math.max(0, Math.min(2, moveTier ?? 1)),
    statBuffs: {},
  };
}

// Gym leader teams — must stay in sync with client data.js GYM_LEADERS.
const GYM_LEADERS = [
  { name:'Brock',     moveTier:0, team:[
    {speciesId:74,  name:'Geodude',  types:['Rock','Ground'],   baseStats:{hp:40,atk:80,def:100,speed:20,special:30},  level:12},
    {speciesId:95,  name:'Onix',    types:['Rock','Ground'],   baseStats:{hp:35,atk:45,def:160,speed:70,special:30},  level:14},
  ]},
  { name:'Misty',     moveTier:0, team:[
    {speciesId:120, name:'Staryu',  types:['Water'],            baseStats:{hp:30,atk:45,def:55,speed:85,special:70},   level:18},
    {speciesId:121, name:'Starmie', types:['Water','Psychic'],  baseStats:{hp:60,atk:75,def:85,speed:115,special:100}, level:20},
  ]},
  { name:'Lt. Surge', moveTier:1, team:[
    {speciesId:25,  name:'Pikachu', types:['Electric'], baseStats:{hp:35,atk:55,def:40,speed:90,special:50},   level:20, heldItem:{id:'eviolite'}},
    {speciesId:100, name:'Voltorb', types:['Electric'], baseStats:{hp:40,atk:30,def:50,speed:100,special:55},  level:23, heldItem:{id:'magnet'}},
    {speciesId:26,  name:'Raichu',  types:['Electric'], baseStats:{hp:60,atk:90,def:55,speed:110,special:90},  level:25, heldItem:{id:'life_orb'}},
  ]},
  { name:'Erika',     moveTier:1, team:[
    {speciesId:114, name:'Tangela',    types:['Grass'],          baseStats:{hp:65,atk:55,def:115,speed:60,special:100},  level:26, heldItem:{id:'leftovers'}},
    {speciesId:71,  name:'Victreebel', types:['Grass','Poison'], baseStats:{hp:80,atk:105,def:65,speed:70,special:100},  level:31, heldItem:{id:'poison_barb'}},
    {speciesId:45,  name:'Vileplume',  types:['Grass','Poison'], baseStats:{hp:75,atk:80,def:85,speed:50,special:110},   level:32, heldItem:{id:'miracle_seed'}},
  ]},
  { name:'Koga',      moveTier:1, team:[
    {speciesId:109, name:'Koffing',  types:['Poison'], baseStats:{hp:40,atk:65,def:95,speed:35,special:60},    level:38, heldItem:{id:'rocky_helmet'}},
    {speciesId:109, name:'Koffing',  types:['Poison'], baseStats:{hp:40,atk:65,def:95,speed:35,special:60},    level:38, heldItem:{id:'rocky_helmet'}},
    {speciesId:89,  name:'Muk',      types:['Poison'], baseStats:{hp:105,atk:105,def:75,speed:50,special:65},  level:40, heldItem:{id:'poison_barb'}},
    {speciesId:110, name:'Weezing',  types:['Poison'], baseStats:{hp:65,atk:90,def:120,speed:60,special:85},   level:44, heldItem:{id:'leftovers'}},
  ]},
  { name:'Sabrina',   moveTier:1, team:[
    {speciesId:122, name:'Mr. Mime', types:['Psychic'],         baseStats:{hp:40,atk:45,def:65,speed:90,special:100},  level:40, heldItem:{id:'twisted_spoon'}},
    {speciesId:49,  name:'Venomoth', types:['Bug','Poison'],    baseStats:{hp:70,atk:65,def:60,speed:90,special:90},   level:41, heldItem:{id:'silver_powder'}},
    {speciesId:64,  name:'Kadabra',  types:['Psychic'],         baseStats:{hp:40,atk:35,def:30,speed:105,special:120}, level:42, heldItem:{id:'eviolite'}},
    {speciesId:65,  name:'Alakazam', types:['Psychic'],         baseStats:{hp:55,atk:50,def:45,speed:120,special:135}, level:44, heldItem:{id:'scope_lens'}},
  ]},
  { name:'Blaine',    moveTier:2, team:[
    {speciesId:77,  name:'Ponyta',   types:['Fire'], baseStats:{hp:50,atk:85,def:55,speed:90,special:65},  level:47, heldItem:{id:'charcoal'}},
    {speciesId:58,  name:'Growlithe',types:['Fire'], baseStats:{hp:55,atk:70,def:45,speed:60,special:50},  level:47, heldItem:{id:'eviolite'}},
    {speciesId:78,  name:'Rapidash', types:['Fire'], baseStats:{hp:65,atk:100,def:70,speed:105,special:80},level:48, heldItem:{id:'charcoal'}},
    {speciesId:59,  name:'Arcanine', types:['Fire'], baseStats:{hp:90,atk:110,def:80,speed:95,special:100},level:53, heldItem:{id:'life_orb'}},
  ]},
  { name:'Giovanni',  moveTier:2, team:[
    {speciesId:51,  name:'Dugtrio',  types:['Ground'],          baseStats:{hp:35,atk:100,def:50,speed:120,special:50},  level:55, heldItem:{id:'soft_sand'}},
    {speciesId:31,  name:'Nidoqueen',types:['Poison','Ground'], baseStats:{hp:90,atk:82,def:87,speed:76,special:75},    level:53, heldItem:{id:'poison_barb'}},
    {speciesId:34,  name:'Nidoking', types:['Poison','Ground'], baseStats:{hp:81,atk:92,def:77,speed:85,special:75},    level:54, heldItem:{id:'soft_sand'}},
    {speciesId:111, name:'Rhyhorn',  types:['Ground','Rock'],   baseStats:{hp:80,atk:85,def:95,speed:25,special:30},    level:56, heldItem:{id:'hard_stone'}},
    {speciesId:112, name:'Rhydon',   types:['Ground','Rock'],   baseStats:{hp:105,atk:130,def:120,speed:40,special:45}, level:60, heldItem:{id:'rocky_helmet'}},
  ]},
];

const ELITE_4 = [
  { name:'Lorelei', team:[
    {speciesId:87,  name:'Dewgong',  types:['Water','Ice'],     baseStats:{hp:90,atk:70,def:80,speed:70,special:95},   level:54, heldItem:{id:'mystic_water'}},
    {speciesId:91,  name:'Cloyster', types:['Water','Ice'],     baseStats:{hp:50,atk:95,def:180,speed:70,special:85},  level:53, heldItem:{id:'rocky_helmet'}},
    {speciesId:80,  name:'Slowbro',  types:['Water','Psychic'], baseStats:{hp:95,atk:75,def:110,speed:30,special:100}, level:54, heldItem:{id:'leftovers'}},
    {speciesId:124, name:'Jynx',     types:['Ice','Psychic'],   baseStats:{hp:65,atk:50,def:35,speed:95,special:95},   level:56, heldItem:{id:'wise_glasses'}},
    {speciesId:131, name:'Lapras',   types:['Water','Ice'],     baseStats:{hp:130,atk:85,def:80,speed:60,special:95},  level:56, heldItem:{id:'shell_bell'}},
  ]},
  { name:'Bruno', team:[
    {speciesId:95,  name:'Onix',    types:['Rock','Ground'],   baseStats:{hp:35,atk:45,def:160,speed:70,special:30},  level:53, heldItem:{id:'eviolite'}},
    {speciesId:57,  name:'Primeape',types:['Fighting'],        baseStats:{hp:65,atk:105,def:60,speed:95,special:60},  level:54, heldItem:{id:'choice_band'}},
    {speciesId:107, name:'Hitmonchan',types:['Fighting'],      baseStats:{hp:50,atk:105,def:79,speed:76,special:35},  level:54, heldItem:{id:'black_belt'}},
    {speciesId:106, name:'Hitmonlee',types:['Fighting'],       baseStats:{hp:50,atk:120,def:53,speed:87,special:35},  level:54, heldItem:{id:'black_belt'}},
    {speciesId:68,  name:'Machamp', types:['Fighting'],        baseStats:{hp:90,atk:130,def:80,speed:55,special:65},  level:58, heldItem:{id:'choice_band'}},
  ]},
  { name:'Agatha', team:[
    {speciesId:92,  name:'Gastly',  types:['Ghost','Poison'],  baseStats:{hp:30,atk:35,def:30,speed:80,special:100},  level:54, heldItem:{id:'eviolite'}},
    {speciesId:93,  name:'Haunter', types:['Ghost','Poison'],  baseStats:{hp:45,atk:50,def:45,speed:95,special:115},  level:54, heldItem:{id:'eviolite'}},
    {speciesId:94,  name:'Gengar',  types:['Ghost','Poison'],  baseStats:{hp:60,atk:65,def:60,speed:110,special:130}, level:56, heldItem:{id:'spell_tag'}},
    {speciesId:93,  name:'Haunter', types:['Ghost','Poison'],  baseStats:{hp:45,atk:50,def:45,speed:95,special:115},  level:56, heldItem:{id:'wise_glasses'}},
    {speciesId:94,  name:'Gengar',  types:['Ghost','Poison'],  baseStats:{hp:60,atk:65,def:60,speed:110,special:130}, level:60, heldItem:{id:'scope_lens'}},
  ]},
  { name:'Lance', team:[
    {speciesId:148, name:'Dragonair',types:['Dragon'],         baseStats:{hp:61,atk:84,def:65,speed:70,special:70},   level:56, heldItem:{id:'eviolite'}},
    {speciesId:148, name:'Dragonair',types:['Dragon'],         baseStats:{hp:61,atk:84,def:65,speed:70,special:70},   level:56, heldItem:{id:'dragon_fang'}},
    {speciesId:142, name:'Aerodactyl',types:['Rock','Flying'], baseStats:{hp:80,atk:105,def:65,speed:130,special:60}, level:58, heldItem:{id:'sharp_beak'}},
    {speciesId:131, name:'Lapras',   types:['Water','Ice'],    baseStats:{hp:130,atk:85,def:80,speed:60,special:95},  level:58, heldItem:{id:'shell_bell'}},
    {speciesId:149, name:'Dragonite',types:['Dragon','Flying'],baseStats:{hp:91,atk:134,def:95,speed:80,special:100}, level:62, heldItem:{id:'life_orb'}},
  ]},
  { name:'Gary', title:'Champion', team:[
    {speciesId:18,  name:'Pidgeot',   types:['Normal','Flying'], baseStats:{hp:83,atk:80,def:75,speed:101,special:70},  level:61, heldItem:{id:'sharp_beak'}},
    {speciesId:103, name:'Exeggutor', types:['Grass','Psychic'], baseStats:{hp:95,atk:95,def:85,speed:55,special:125},  level:61, heldItem:{id:'wise_glasses'}},
    {speciesId:112, name:'Rhydon',    types:['Ground','Rock'],   baseStats:{hp:105,atk:130,def:120,speed:40,special:45},level:61, heldItem:{id:'rocky_helmet'}},
    {speciesId:130, name:'Gyarados',  types:['Water','Flying'],  baseStats:{hp:95,atk:125,def:79,speed:81,special:100}, level:61, heldItem:{id:'choice_band'}},
    {speciesId:65,  name:'Alakazam',  types:['Psychic'],         baseStats:{hp:55,atk:50,def:45,speed:120,special:135}, level:63, heldItem:{id:'scope_lens'}},
    {speciesId:6,   name:'Charizard', types:['Fire','Flying'],   baseStats:{hp:78,atk:84,def:78,speed:100,special:109}, level:65, heldItem:{id:'life_orb'}},
  ]},
];

module.exports = {
  getTypeEffectiveness, TYPE_ITEM_MAP, getBestMove, calcHp, canEvolve, createInstance,
  GYM_LEADERS, ELITE_4,
};
