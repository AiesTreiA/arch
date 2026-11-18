/**
 * rng.js — Generador pseudoaleatorio determinista (Mulberry32) para mapas y loot reproducibles.
 */

/** Convierte una semilla numérica o de texto en un entero sin signo de 32 bits. */
export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return (seed >>> 0) || 0x9e3779b9;
  }
  const text = String(seed ?? 'arch-greco-01');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 0x9e3779b9;
}

/** Crea un PRNG determinista con utilidades para rangos enteros y selección ponderada. */
export function createRng(seed) {
  let state = hashSeed(seed);

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    chance(probability) {
      return next() < probability;
    },
    pick(list) {
      if (!list || list.length === 0) return null;
      return list[Math.floor(next() * list.length)];
    },
    weightedPick(entries) {
      if (!entries || entries.length === 0) return null;
      let total = 0;
      for (const e of entries) total += Math.max(0, Number(e.weight) || 0);
      if (total <= 0) return entries[0].value ?? entries[0];
      let roll = next() * total;
      for (const e of entries) {
        roll -= Math.max(0, Number(e.weight) || 0);
        if (roll <= 0) return e.value ?? e;
      }
      return entries[entries.length - 1].value ?? entries[entries.length - 1];
    },
  };
}
