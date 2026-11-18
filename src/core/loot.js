/**
 * loot.js — Motor de botín, Treasure Classes (TC), objetos exclusivos de las 7 clases y afijos estilo Diablo II.
 */
import { createRng } from './rng.js';

export const RARITY = {
  common: { id: 'common', label: 'Común', color: '#d6d3d1', affixes: [0, 0] },
  magic: { id: 'magic', label: 'Mágico', color: '#60a5fa', affixes: [1, 2] },
  rare: { id: 'rare', label: 'Raro', color: '#facc15', affixes: [3, 4] },
  unique: { id: 'unique', label: 'Reliquia Única', color: '#f97316', affixes: [0, 0] },
};

/** Treasure Classes (TC) al estilo Diablo II según rango de enemigo y acto. */
export const TREASURE_CLASSES = {
  normal: { id: 'TC_Styx_Normal', dropChance: 0.36, itemCount: 1, classItemChance: 0.22 },
  champion: { id: 'TC_Styx_Champion', dropChance: 0.75, itemCount: 1, classItemChance: 0.38 },
  boss: { id: 'TC_Styx_Boss', dropChance: 1.0, itemCount: 2, classItemChance: 0.55 },
};

export const BASE_ITEMS = [
  { key: 'xiphos', name: 'Xiphos de Bronce', slot: 'weapon', baseDamage: [6, 10], baseArmor: 0 },
  { key: 'dory', name: 'Lanza Dory', slot: 'weapon', baseDamage: [8, 12], baseArmor: 0 },
  { key: 'bow', name: 'Arco de Tejo', slot: 'weapon', baseDamage: [7, 11], baseArmor: 0 },
  { key: 'staff', name: 'Báculo de Laurel', slot: 'weapon', baseDamage: [5, 9], baseArmor: 0, bonusSpirit: 3 },
  { key: 'cuirass', name: 'Coraza Hoplita', slot: 'armor', baseDamage: [0, 0], baseArmor: 14 },
  { key: 'chlamys', name: 'Clámide Tejida', slot: 'armor', baseDamage: [0, 0], baseArmor: 9, bonusSpirit: 2 },
  { key: 'hoplon', name: 'Escudo Hoplón', slot: 'charm', baseDamage: [0, 0], baseArmor: 10 },
  { key: 'sandals', name: 'Grebas de Maratón', slot: 'charm', baseDamage: [0, 0], baseArmor: 6, speedBonus: 0.25 },
];

/** Objetos exclusivos de las 7 clases griegas (con +Talentos implícito estilo D2 class-specific items). */
export const CLASS_BASE_ITEMS = {
  campeon: {
    key: 'helm_thrace',
    forClass: 'campeon',
    name: 'Yelmo Tracio de Ares',
    slot: 'charm',
    baseDamage: [0, 0],
    baseArmor: 12,
    implicitMods: { strength: 3, skillBonus: 1 },
  },
  hoplita: {
    key: 'aspis_sparta',
    forClass: 'hoplita',
    name: 'Aspis Lacedemonio',
    slot: 'charm',
    baseDamage: [0, 0],
    baseArmor: 16,
    implicitMods: { armor: 6, skillBonus: 1 },
  },
  arquera: {
    key: 'bow_ortygia',
    forClass: 'arquera',
    name: 'Arco Reflex de Ortigia',
    slot: 'weapon',
    baseDamage: [9, 14],
    baseArmor: 0,
    implicitMods: { dexterity: 3, critChance: 0.04, skillBonus: 1 },
  },
  oraculo: {
    key: 'orb_pythia',
    forClass: 'oraculo',
    name: 'Orbe Pitio de Delfos',
    slot: 'weapon',
    baseDamage: [6, 11],
    baseArmor: 0,
    implicitMods: { spirit: 4, maxMana: 14, skillBonus: 1 },
  },
  necromante: {
    key: 'obol_styx',
    forClass: 'necromante',
    name: 'Óbolo Órfico del Estigia',
    slot: 'charm',
    baseDamage: [0, 0],
    baseArmor: 9,
    implicitMods: { spirit: 3, lifeOnHit: 3, skillBonus: 1 },
  },
  sombra: {
    key: 'katar_erinyes',
    forClass: 'sombra',
    name: 'Katar de las Erinias',
    slot: 'weapon',
    baseDamage: [8, 13],
    baseArmor: 0,
    implicitMods: { dexterity: 3, speedBonus: 0.2, skillBonus: 1 },
  },
  coribante: {
    key: 'pelt_lycaon',
    forClass: 'coribante',
    name: 'Máscara de Licaón',
    slot: 'charm',
    baseDamage: [0, 0],
    baseArmor: 11,
    implicitMods: { vitality: 4, spirit: 2, skillBonus: 1 },
  },
};

const PREFIXES = [
  { name: 'Ígneo', stat: 'damageFlat', min: 2, max: 6, slots: ['weapon'] },
  { name: 'Olímpico', stat: 'maxHp', min: 14, max: 32, slots: ['armor', 'charm'] },
  { name: 'De Bronce Templado', stat: 'armor', min: 6, max: 16, slots: ['armor', 'charm'] },
  { name: 'Fulgurante', stat: 'spirit', min: 2, max: 6, slots: ['weapon', 'charm', 'armor'] },
  { name: 'Implacable', stat: 'strength', min: 2, max: 5, slots: ['weapon', 'armor'] },
  { name: 'Hierofántico', stat: 'skillBonus', min: 1, max: 2, noScale: true, slots: ['weapon', 'charm'] },
];

const SUFFIXES = [
  { name: 'del Halcón', stat: 'dexterity', min: 2, max: 6 },
  { name: 'de la Égida', stat: 'armor', min: 5, max: 14 },
  { name: 'del Titán', stat: 'vitality', min: 2, max: 6 },
  { name: 'del Relámpago', stat: 'critChance', min: 0.03, max: 0.09, float: true },
  { name: 'del Sanguinario', stat: 'lifeOnHit', min: 2, max: 6 },
  { name: 'del Arconte', stat: 'skillBonus', min: 1, max: 1, noScale: true },
];

const RARE_TITLES = [
  'Voto de Leónidas',
  'Destello de Delfos',
  'Ira del Olimpo',
  'Manto de la Esfinge',
  'Sello de Creta',
  'Filo de Teseo',
  'Pacto del Aqueronte',
  'Corona de las Moiras',
];

export const UNIQUE_RELICS = [
  {
    name: 'Lanza de Aquiles',
    slot: 'weapon',
    forClass: 'campeon',
    baseDamage: [14, 21],
    mods: { strength: 6, critChance: 0.1, lifeOnHit: 5, skillBonus: 1 },
    lore: 'Forjada para atravesar murallas en Troya.',
  },
  {
    name: 'Égida de Atenea',
    slot: 'armor',
    forClass: 'hoplita',
    baseArmor: 28,
    mods: { armor: 18, maxHp: 45, vitality: 5, skillBonus: 1 },
    lore: 'Resiste incluso el aliento de la Gorgona.',
  },
  {
    name: 'Arco de Apolo y Artemisa',
    slot: 'weapon',
    forClass: 'arquera',
    baseDamage: [13, 20],
    mods: { dexterity: 7, critChance: 0.12, speedBonus: 0.35, skillBonus: 2 },
    lore: 'Sus flechas plateadas jamás yerran en la penumbra.',
  },
  {
    name: 'Caduceo de Delfos',
    slot: 'weapon',
    forClass: 'oraculo',
    baseDamage: [10, 16],
    mods: { spirit: 8, maxMana: 35, critChance: 0.08, skillBonus: 2 },
    lore: 'Canaliza los presagios y el rayo de Zeus.',
  },
  {
    name: 'Cetro de Hades y Perséfone',
    slot: 'weapon',
    forClass: 'necromante',
    baseDamage: [11, 17],
    mods: { spirit: 7, lifeOnHit: 6, maxMana: 28, skillBonus: 2 },
    lore: 'Las sombras del Estigia obedecen a su portador.',
  },
  {
    name: 'Colmillo de Tisífone',
    slot: 'weapon',
    forClass: 'sombra',
    baseDamage: [12, 19],
    mods: { dexterity: 6, critChance: 0.14, speedBonus: 0.45, skillBonus: 2 },
    lore: 'Templado en las lágrimas de los culpables en el Érebo.',
  },
  {
    name: 'Piel Sagrada de Calisto',
    slot: 'armor',
    forClass: 'coribante',
    baseArmor: 24,
    mods: { vitality: 7, spirit: 5, maxHp: 50, skillBonus: 2 },
    lore: 'Quien la viste escucha el latido primordial de Gea.',
  },
  {
    name: 'Sandalias de Hermes',
    slot: 'charm',
    baseArmor: 10,
    mods: { dexterity: 7, speedBonus: 0.65, critChance: 0.06, skillBonus: 1 },
    lore: 'Quien las calza cruza el Estigia antes que la sombra.',
  },
];

let nextItemId = 1;

function rollRange(rng, min, max, isFloat = false, ilvl = 1, noScale = false) {
  if (noScale) return rng.int(min, max);
  const scale = 1 + (Math.max(1, ilvl) - 1) * 0.14;
  if (isFloat) {
    const val = min + rng.next() * (max - min);
    return Number(Math.min(0.35, val * (1 + (ilvl - 1) * 0.05)).toFixed(3));
  }
  return Math.round(rng.int(min, max) * scale);
}

function rollRarity(rng, tier = 'normal', ilvl = 1) {
  const mfBoost = tier === 'boss' ? 3 : tier === 'champion' ? 1.8 : 1;
  return rng.weightedPick([
    { value: 'common', weight: tier === 'boss' ? 5 : 54 },
    { value: 'magic', weight: 32 * mfBoost },
    { value: 'rare', weight: (11 + ilvl * 1.5) * mfBoost },
    { value: 'unique', weight: (2.5 + ilvl * 0.6) * (tier === 'boss' ? 5.5 : mfBoost) },
  ]);
}

/** Crea el arma/amuleto de iniciado con el que comienza cada clase en el Campamento del Aqueronte. */
export function createStarterItem(classId = 'hoplita') {
  const clsBase = CLASS_BASE_ITEMS[classId] || CLASS_BASE_ITEMS.hoplita;
  return {
    id: `itm-starter-${classId}-${nextItemId++}`,
    name: `${clsBase.name} de Iniciado`,
    slot: clsBase.slot,
    forClass: clsBase.forClass,
    rarity: 'magic',
    rarityLabel: 'Reliquia de Iniciado',
    color: '#60a5fa',
    ilvl: 1,
    baseDamage: [...clsBase.baseDamage],
    baseArmor: clsBase.baseArmor,
    mods: { ...clsBase.implicitMods },
    lore: 'Entregado junto a la hoguera del Aqueronte antes del descenso.',
  };
}

/**
 * Genera un objeto equipable estilo Diablo II con rareza, Treasure Class, objetos de clase y afijos.
 */
export function generateItem({
  level = 1,
  tier = 'normal',
  seed = null,
  forceRarity = null,
  preferredClass = null,
  forceClassItem = false,
} = {}) {
  const rng = createRng(seed ?? `item:${level}:${tier}:${nextItemId}`);
  const ilvl = Math.max(1, Number(level) || 1);
  const rarityKey = forceRarity && RARITY[forceRarity] ? forceRarity : rollRarity(rng, tier, ilvl);
  const rarity = RARITY[rarityKey];
  const tc = TREASURE_CLASSES[tier] || TREASURE_CLASSES.normal;

  if (rarityKey === 'unique') {
    const classPool = preferredClass ? UNIQUE_RELICS.filter((u) => u.forClass === preferredClass) : [];
    const relic = classPool.length > 0 && rng.chance(0.65) ? rng.pick(classPool) : rng.pick(UNIQUE_RELICS);
    return {
      id: `itm-${nextItemId++}`,
      name: relic.name,
      slot: relic.slot,
      forClass: relic.forClass || null,
      treasureClass: tc.id,
      rarity: rarityKey,
      rarityLabel: rarity.label,
      color: rarity.color,
      ilvl,
      baseDamage: relic.baseDamage ? relic.baseDamage.map((d) => Math.round(d * (1 + (ilvl - 1) * 0.12))) : [0, 0],
      baseArmor: relic.baseArmor ? Math.round(relic.baseArmor * (1 + (ilvl - 1) * 0.12)) : 0,
      mods: { ...relic.mods },
      lore: relic.lore,
    };
  }

  const classItemsList = Object.values(CLASS_BASE_ITEMS);
  const useClassBase = forceClassItem || rng.chance(tc.classItemChance);
  let base;
  if (useClassBase) {
    base = (preferredClass && CLASS_BASE_ITEMS[preferredClass]) || rng.pick(classItemsList);
  } else {
    base = rng.pick(BASE_ITEMS);
  }

  const mods = { ...(base.implicitMods || {}) };
  if (base.bonusSpirit) mods.spirit = (mods.spirit || 0) + base.bonusSpirit;
  if (base.speedBonus) mods.speedBonus = (mods.speedBonus || 0) + base.speedBonus;

  const [minAff, maxAff] = rarity.affixes;
  const targetAffixes = maxAff > 0 ? rng.int(minAff, maxAff) : 0;
  const usedStats = new Set();
  let chosenPrefix = null;
  let chosenSuffix = null;

  const validPrefixes = PREFIXES.filter((p) => p.slots.includes(base.slot));
  for (let i = 0; i < targetAffixes; i++) {
    const pickPrefix = i % 2 === 0 && validPrefixes.length > 0;
    const pool = (pickPrefix ? validPrefixes : SUFFIXES).filter((a) => !usedStats.has(a.stat));
    const affix = rng.pick(pool);
    if (!affix) continue;
    usedStats.add(affix.stat);
    mods[affix.stat] =
      (mods[affix.stat] || 0) + rollRange(rng, affix.min, affix.max, affix.float, ilvl, affix.noScale);
    if (pickPrefix && !chosenPrefix) chosenPrefix = affix.name;
    if (!pickPrefix && !chosenSuffix) chosenSuffix = affix.name;
  }

  let name = base.name;
  if (rarityKey === 'magic') {
    name = [chosenPrefix ? `${base.name} ${chosenPrefix}` : base.name, chosenSuffix].filter(Boolean).join(' ');
  } else if (rarityKey === 'rare') {
    name = `${rng.pick(RARE_TITLES)} (${base.name})`;
  }

  const scale = 1 + (ilvl - 1) * 0.14;
  return {
    id: `itm-${nextItemId++}`,
    name,
    slot: base.slot,
    forClass: base.forClass || null,
    treasureClass: tc.id,
    rarity: rarityKey,
    rarityLabel: rarity.label,
    color: rarity.color,
    ilvl,
    baseDamage: base.baseDamage.map((d) => Math.round(d * scale)),
    baseArmor: Math.round(base.baseArmor * scale),
    mods,
    lore: null,
  };
}

/** Decide qué botín (oro, poción o ítem) suelta un enemigo derrotado usando su Treasure Class. */
export function rollEnemyDrop({ level = 1, tier = 'normal', seed = null, preferredClass = null } = {}) {
  const rng = createRng(seed ?? `drop:${level}:${tier}:${nextItemId}`);
  const tc = TREASURE_CLASSES[tier] || TREASURE_CLASSES.normal;
  const drops = [];
  const gold = rng.int(5, 16) * level * (tier === 'boss' ? 5 : tier === 'champion' ? 2 : 1);
  drops.push({ kind: 'gold', amount: gold });

  if (rng.chance(tc.dropChance)) {
    for (let i = 0; i < tc.itemCount; i++) {
      drops.push({
        kind: 'item',
        item: generateItem({ level, tier, preferredClass, seed: `${seed || 'd'}:${i}:${nextItemId}` }),
      });
    }
  }
  if (rng.chance(tier === 'boss' ? 0.85 : 0.22)) {
    drops.push({ kind: 'potion', amount: 1 });
  }
  return drops;
}

const RARITY_SALVAGE_BASE = {
  common: 6,
  magic: 14,
  rare: 28,
  unique: 55,
};

export const SLOT_LABELS = {
  weapon: 'Arma',
  armor: 'Armadura',
  charm: 'Reliquia',
};

/** Calcula los dracmas obtenidos al ofrendar un objeto de la mochila. */
export function getItemSalvageValue(item) {
  if (!item) return 0;
  const base = RARITY_SALVAGE_BASE[item.rarity] || 6;
  return base + Math.max(1, Number(item.ilvl) || 1) * 4;
}

/** Devuelve una lista legible de propiedades y bonos del objeto para la UI. */
export function getItemStatEntries(item) {
  if (!item) return [];
  const entries = [];
  const mods = item.mods || {};
  const minD = (item.baseDamage?.[0] || 0) + (mods.damageFlat || 0);
  const maxD = (item.baseDamage?.[1] || 0) + (mods.damageFlat || 0);
  if (maxD > 0) entries.push({ key: 'damage', label: `Daño ${minD}–${maxD}`, kind: 'offense' });

  const totalArmor = (item.baseArmor || 0) + (mods.armor || 0);
  if (totalArmor > 0) entries.push({ key: 'armor', label: `Armadura +${totalArmor}`, kind: 'defense' });

  if (mods.strength) entries.push({ key: 'strength', label: `+${mods.strength} Fuerza`, kind: 'stat' });
  if (mods.dexterity) entries.push({ key: 'dexterity', label: `+${mods.dexterity} Destreza`, kind: 'stat' });
  if (mods.spirit) entries.push({ key: 'spirit', label: `+${mods.spirit} Espíritu`, kind: 'stat' });
  if (mods.vitality) entries.push({ key: 'vitality', label: `+${mods.vitality} Vitalidad`, kind: 'stat' });
  if (mods.maxHp) entries.push({ key: 'maxHp', label: `+${mods.maxHp} Salud`, kind: 'defense' });
  if (mods.maxMana) entries.push({ key: 'maxMana', label: `+${mods.maxMana} Fervor`, kind: 'magic' });
  if (mods.critChance) {
    entries.push({ key: 'critChance', label: `+${Math.round(mods.critChance * 100)}% Crítico`, kind: 'offense' });
  }
  if (mods.lifeOnHit) entries.push({ key: 'lifeOnHit', label: `+${mods.lifeOnHit} Salud/golpe`, kind: 'offense' });
  if (mods.speedBonus) {
    entries.push({ key: 'speedBonus', label: `+${Math.round(mods.speedBonus * 100)}% Velocidad`, kind: 'utility' });
  }
  if (mods.skillBonus) {
    entries.push({ key: 'skillBonus', label: `+${mods.skillBonus} a Talentos`, kind: 'talent' });
  }
  return entries;
}

/** Puntaje heurístico de poder de un objeto para ordenamiento y comparación rápida. */
export function getItemPowerScore(item, preferredClass = null) {
  if (!item) return 0;
  const mods = item.mods || {};
  const minD = (item.baseDamage?.[0] || 0) + (mods.damageFlat || 0);
  const maxD = (item.baseDamage?.[1] || 0) + (mods.damageFlat || 0);
  const avgDmg = (minD + maxD) / 2;
  const armor = (item.baseArmor || 0) + (mods.armor || 0);
  let score =
    avgDmg * 3.0 +
    armor * 1.1 +
    (mods.strength || 0) * 2.2 +
    (mods.dexterity || 0) * 2.2 +
    (mods.spirit || 0) * 2.2 +
    (mods.vitality || 0) * 2.0 +
    (mods.maxHp || 0) * 0.35 +
    (mods.maxMana || 0) * 0.25 +
    (mods.critChance || 0) * 140 +
    (mods.lifeOnHit || 0) * 3.5 +
    (mods.speedBonus || 0) * 25 +
    (mods.skillBonus || 0) * 18;
  if (preferredClass && item.forClass === preferredClass) {
    score *= 1.08;
  }
  return Math.round(score);
}

/** Compara un objeto candidato contra el equipado en la misma ranura. */
export function compareItems(candidate, equipped, preferredClass = null) {
  if (!candidate) return { verdict: 'even', scoreDiff: 0, diffs: [] };
  if (!equipped) {
    return {
      verdict: 'empty',
      scoreDiff: getItemPowerScore(candidate, preferredClass),
      diffs: [{ label: 'Ranura vacía', positive: true }],
    };
  }
  const candScore = getItemPowerScore(candidate, preferredClass);
  const eqScore = getItemPowerScore(equipped, preferredClass);
  const scoreDiff = candScore - eqScore;

  const metric = (fn) => fn(candidate) - fn(equipped);
  const specs = [
    {
      label: 'Daño prom.',
      diff: metric((it) => (((it.baseDamage?.[0] || 0) + (it.baseDamage?.[1] || 0)) / 2) + (it.mods?.damageFlat || 0)),
      fmt: (v) => `${v > 0 ? '+' : ''}${Number(v.toFixed(1))}`,
    },
    {
      label: 'Armadura',
      diff: metric((it) => (it.baseArmor || 0) + (it.mods?.armor || 0)),
      fmt: (v) => `${v > 0 ? '+' : ''}${v}`,
    },
    { label: 'Talentos', diff: metric((it) => it.mods?.skillBonus || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'Fuerza', diff: metric((it) => it.mods?.strength || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'Destreza', diff: metric((it) => it.mods?.dexterity || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'Espíritu', diff: metric((it) => it.mods?.spirit || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'Vitalidad', diff: metric((it) => it.mods?.vitality || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'Salud', diff: metric((it) => it.mods?.maxHp || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    { label: 'Fervor', diff: metric((it) => it.mods?.maxMana || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
    {
      label: 'Crítico',
      diff: metric((it) => Math.round((it.mods?.critChance || 0) * 100)),
      fmt: (v) => `${v > 0 ? '+' : ''}${v}%`,
    },
    { label: 'Salud/golpe', diff: metric((it) => it.mods?.lifeOnHit || 0), fmt: (v) => `${v > 0 ? '+' : ''}${v}` },
  ];

  const diffs = specs
    .filter((s) => Math.abs(s.diff) >= 0.1)
    .map((s) => ({
      label: `${s.fmt(s.diff)} ${s.label}`,
      positive: s.diff > 0,
    }));

  const verdict = scoreDiff > 2 ? 'better' : scoreDiff < -2 ? 'worse' : 'even';
  return { verdict, scoreDiff, diffs };
}

