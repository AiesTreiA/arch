/**
 * loot.js — Motor de botín, rarezas y afijos estilo Diablo II adaptado a mitos griegos.
 */
import { createRng } from './rng.js';

export const RARITY = {
  common: { id: 'common', label: 'Común', color: '#d6d3d1', affixes: [0, 0] },
  magic: { id: 'magic', label: 'Mágico', color: '#60a5fa', affixes: [1, 2] },
  rare: { id: 'rare', label: 'Raro', color: '#facc15', affixes: [3, 4] },
  unique: { id: 'unique', label: 'Reliquia Única', color: '#f97316', affixes: [0, 0] },
};

const BASE_ITEMS = [
  { key: 'xiphos', name: 'Xiphos de Bronce', slot: 'weapon', baseDamage: [6, 10], baseArmor: 0 },
  { key: 'dory', name: 'Lanza Dory', slot: 'weapon', baseDamage: [8, 12], baseArmor: 0 },
  { key: 'bow', name: 'Arco de Tejo', slot: 'weapon', baseDamage: [7, 11], baseArmor: 0 },
  { key: 'staff', name: 'Báculo de Laurel', slot: 'weapon', baseDamage: [5, 9], baseArmor: 0, bonusSpirit: 3 },
  { key: 'cuirass', name: 'Coraza Hoplita', slot: 'armor', baseDamage: [0, 0], baseArmor: 14 },
  { key: 'chlamys', name: 'Clámide Tejida', slot: 'armor', baseDamage: [0, 0], baseArmor: 9, bonusSpirit: 2 },
  { key: 'hoplon', name: 'Escudo Hoplón', slot: 'charm', baseDamage: [0, 0], baseArmor: 10 },
  { key: 'sandals', name: 'Grebas de Maratón', slot: 'charm', baseDamage: [0, 0], baseArmor: 6, speedBonus: 0.25 },
];

const PREFIXES = [
  { name: 'Ígneo', stat: 'damageFlat', min: 2, max: 6, slots: ['weapon'] },
  { name: 'Olímpico', stat: 'maxHp', min: 14, max: 32, slots: ['armor', 'charm'] },
  { name: 'De Bronce Templado', stat: 'armor', min: 6, max: 16, slots: ['armor', 'charm'] },
  { name: 'Fulgurante', stat: 'spirit', min: 2, max: 6, slots: ['weapon', 'charm', 'armor'] },
  { name: 'Implacable', stat: 'strength', min: 2, max: 5, slots: ['weapon', 'armor'] },
];

const SUFFIXES = [
  { name: 'del Halcón', stat: 'dexterity', min: 2, max: 6 },
  { name: 'de la Égida', stat: 'armor', min: 5, max: 14 },
  { name: 'del Titán', stat: 'vitality', min: 2, max: 6 },
  { name: 'del Relámpago', stat: 'critChance', min: 0.03, max: 0.09, float: true },
  { name: 'del Sanguinario', stat: 'lifeOnHit', min: 2, max: 6 },
];

const RARE_TITLES = [
  'Voto de Leónidas',
  'Destello de Delfos',
  'Ira del Olimpo',
  'Manto de la Esfinge',
  'Sello de Creta',
  'Filo de Teseo',
];

const UNIQUE_RELICS = [
  {
    name: 'Lanza de Aquiles',
    slot: 'weapon',
    baseDamage: [14, 21],
    mods: { strength: 6, critChance: 0.1, lifeOnHit: 5 },
    lore: 'Forjada para atravesar murallas en Troya.',
  },
  {
    name: 'Égida de Atenea',
    slot: 'armor',
    baseArmor: 28,
    mods: { armor: 18, maxHp: 45, vitality: 5 },
    lore: 'Resiste incluso el aliento de la Gorgona.',
  },
  {
    name: 'Sandalias de Hermes',
    slot: 'charm',
    baseArmor: 10,
    mods: { dexterity: 7, speedBonus: 0.65, critChance: 0.06 },
    lore: 'Quien las calza cruza el Estigia antes que la sombra.',
  },
  {
    name: 'Caduceo de Delfos',
    slot: 'weapon',
    baseDamage: [10, 16],
    mods: { spirit: 8, maxMana: 35, critChance: 0.08 },
    lore: 'Canaliza los presagios y el rayo de Zeus.',
  },
];

let nextItemId = 1;

function rollRange(rng, min, max, isFloat = false, ilvl = 1) {
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

/**
 * Genera un objeto equipable estilo Diablo II con rareza, afijos escalados y stats derivados.
 */
export function generateItem({ level = 1, tier = 'normal', seed = null, forceRarity = null } = {}) {
  const rng = createRng(seed ?? `item:${level}:${tier}:${nextItemId}`);
  const ilvl = Math.max(1, Number(level) || 1);
  const rarityKey = forceRarity && RARITY[forceRarity] ? forceRarity : rollRarity(rng, tier, ilvl);
  const rarity = RARITY[rarityKey];

  if (rarityKey === 'unique') {
    const relic = rng.pick(UNIQUE_RELICS);
    return {
      id: `itm-${nextItemId++}`,
      name: relic.name,
      slot: relic.slot,
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

  const base = rng.pick(BASE_ITEMS);
  const mods = {};
  if (base.bonusSpirit) mods.spirit = base.bonusSpirit;
  if (base.speedBonus) mods.speedBonus = base.speedBonus;

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
    mods[affix.stat] = (mods[affix.stat] || 0) + rollRange(rng, affix.min, affix.max, affix.float, ilvl);
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

/** Decide qué botín (oro, poción o ítem) suelta un enemigo derrotado. */
export function rollEnemyDrop({ level = 1, tier = 'normal', seed = null } = {}) {
  const rng = createRng(seed ?? `drop:${level}:${tier}:${nextItemId}`);
  const drops = [];
  const gold = rng.int(5, 16) * level * (tier === 'boss' ? 5 : tier === 'champion' ? 2 : 1);
  drops.push({ kind: 'gold', amount: gold });

  const dropChance = tier === 'boss' ? 1 : tier === 'champion' ? 0.72 : 0.34;
  if (rng.chance(dropChance)) {
    const itemCount = tier === 'boss' ? 2 : 1;
    for (let i = 0; i < itemCount; i++) {
      drops.push({
        kind: 'item',
        item: generateItem({ level, tier, seed: `${seed || 'd'}:${i}:${nextItemId}` }),
      });
    }
  }
  if (rng.chance(tier === 'boss' ? 0.85 : 0.22)) {
    drops.push({ kind: 'potion', amount: 1 });
  }
  return drops;
}
