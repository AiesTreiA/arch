/**
 * combat.js — Clases griegas, cálculo de stats derivados y fórmulas de combate estilo Diablo II.
 */

export const HERO_CLASSES = {
  hoplita: {
    id: 'hoplita',
    name: 'Hoplita de Esparta',
    subtitle: 'Guerrero de lanza y escudo · cuerpo a cuerpo',
    color: '#ef4444',
    range: 1.55,
    attackCd: 0.42,
    speed: 4.3,
    baseStats: { strength: 14, dexterity: 9, spirit: 6, vitality: 14 },
    skills: {
      q: { name: 'Golpe de Égida', cost: 14, cd: 3.5, desc: 'Impacto en arco que empuja enemigos' },
      e: { name: 'Furia de Ares', cost: 18, cd: 8.0, desc: '+45% daño y velocidad por 5s' },
    },
  },
  arquera: {
    id: 'arquera',
    name: 'Arquera de Artemisa',
    subtitle: 'Precisión lunar a distancia · crítica y ágil',
    color: '#22c55e',
    range: 5.6,
    attackCd: 0.38,
    speed: 4.8,
    baseStats: { strength: 8, dexterity: 15, spirit: 9, vitality: 10 },
    skills: {
      q: { name: 'Flecha Lunar', cost: 14, cd: 2.8, desc: 'Disparo veloz de alto crítico' },
      e: { name: 'Paso de Cierva', cost: 14, cd: 5.5, desc: 'Acelerón y curación leve' },
    },
  },
  oraculo: {
    id: 'oraculo',
    name: 'Oráculo de Delfos',
    subtitle: 'Rayo de Zeus y protección etérea · elemental',
    color: '#38bdf8',
    range: 5.0,
    attackCd: 0.48,
    speed: 4.35,
    baseStats: { strength: 6, dexterity: 9, spirit: 16, vitality: 10 },
    skills: {
      q: { name: 'Rayo de Zeus', cost: 18, cd: 3.2, desc: 'Descarga eléctrica en área' },
      e: { name: 'Égida Etérea', cost: 16, cd: 7.5, desc: 'Escudo arcano temporal (+armadura)' },
    },
  },
};

export const ENEMY_TEMPLATES = {
  skeleton: { name: 'Hoplita Caído', hp: 34, damage: [5, 8], armor: 6, speed: 2.35, range: 1.2, xp: 24, color: '#cbd5e1' },
  harpy: { name: 'Arpía del Estigia', hp: 26, damage: [6, 10], armor: 3, speed: 3.25, range: 1.25, xp: 28, color: '#c084fc' },
  satyr: { name: 'Sátiro Arquero', hp: 28, damage: [6, 9], armor: 4, speed: 2.2, range: 4.6, xp: 30, color: '#fbbf24' },
  minotaur: { name: 'Minotauro Guardián', hp: 115, damage: [12, 18], armor: 18, speed: 2.55, range: 1.5, xp: 130, color: '#f97316' },
};

/** XP requerida para subir al siguiente nivel (curva cuadrática suave). */
export function xpForNextLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  return Math.round(75 * lv + 25 * lv * lv);
}

/** Crea el estado inicial de un héroe según su clase griega. */
export function createHero(classId = 'hoplita') {
  const cls = HERO_CLASSES[classId] || HERO_CLASSES.hoplita;
  return {
    classId: cls.id,
    name: cls.name,
    level: 1,
    xp: 0,
    xpNext: xpForNextLevel(1),
    statPoints: 0,
    gold: 0,
    potions: 3,
    baseStats: { ...cls.baseStats },
    equipment: { weapon: null, armor: null, charm: null },
    inventory: [],
    buffs: { furyUntil: 0, shieldUntil: 0 },
    hp: 100,
    mana: 60,
  };
}

/** Suma atributos base + modificadores de equipo y devuelve estadísticas finales de combate. */
export function computeHeroDerived(hero, nowMs = Date.now()) {
  const cls = HERO_CLASSES[hero.classId] || HERO_CLASSES.hoplita;
  const stats = { ...hero.baseStats };
  let weaponMin = 4;
  let weaponMax = 7;
  let armor = 4;
  let bonusHp = 0;
  let bonusMana = 0;
  let bonusCrit = 0;
  let lifeOnHit = 0;
  let speedBonus = 0;
  let flatDmg = 0;

  for (const item of Object.values(hero.equipment || {})) {
    if (!item) continue;
    if (Array.isArray(item.baseDamage) && item.baseDamage[1] > 0) {
      weaponMin += item.baseDamage[0];
      weaponMax += item.baseDamage[1];
    }
    armor += item.baseArmor || 0;
    const m = item.mods || {};
    stats.strength += m.strength || 0;
    stats.dexterity += m.dexterity || 0;
    stats.spirit += m.spirit || 0;
    stats.vitality += m.vitality || 0;
    armor += m.armor || 0;
    bonusHp += m.maxHp || 0;
    bonusMana += m.maxMana || 0;
    bonusCrit += m.critChance || 0;
    lifeOnHit += m.lifeOnHit || 0;
    speedBonus += m.speedBonus || 0;
    flatDmg += m.damageFlat || 0;
  }

  const maxHp = Math.round(55 + stats.vitality * 5 + (hero.level - 1) * 14 + bonusHp);
  const maxMana = Math.round(28 + stats.spirit * 3.5 + (hero.level - 1) * 6 + bonusMana);
  const primaryAttr =
    cls.id === 'hoplita' ? stats.strength : cls.id === 'arquera' ? stats.dexterity : stats.spirit;

  const furyActive = (hero.buffs?.furyUntil || 0) > nowMs;
  const shieldActive = (hero.buffs?.shieldUntil || 0) > nowMs;
  const furyMult = furyActive ? 1.45 : 1;

  const minDamage = Math.round((weaponMin + primaryAttr * 0.65 + flatDmg) * furyMult);
  const maxDamage = Math.round((weaponMax + primaryAttr * 0.95 + flatDmg) * furyMult);
  const critChance = Math.min(0.65, 0.06 + stats.dexterity * 0.004 + bonusCrit);
  const effectiveArmor = armor + (shieldActive ? 28 : 0) + Math.floor(stats.dexterity * 0.35);
  const speed = cls.speed + speedBonus + (furyActive ? 0.6 : 0);

  return {
    stats,
    maxHp,
    maxMana,
    minDamage,
    maxDamage,
    critChance,
    armor: effectiveArmor,
    lifeOnHit,
    speed,
    range: cls.range,
    attackCd: cls.attackCd,
    furyActive,
    shieldActive,
  };
}

/** Instancia un enemigo escalado por nivel de piso y categoría (normal / champion / boss). */
export function createEnemy(spawn, id) {
  const tpl = ENEMY_TEMPLATES[spawn.kind] || ENEMY_TEMPLATES.skeleton;
  const lv = Math.max(1, Number(spawn.level) || 1);
  const tierMult = spawn.tier === 'boss' ? 2.2 : spawn.tier === 'champion' ? 1.45 : 1;
  const levelMult = 1 + (lv - 1) * 0.24;
  const hp = Math.round(tpl.hp * tierMult * levelMult);
  const prefix = spawn.tier === 'boss' ? 'Señor ' : spawn.tier === 'champion' ? 'Campeón ' : '';

  return {
    id,
    kind: spawn.kind,
    tier: spawn.tier || 'normal',
    name: `${prefix}${tpl.name}`,
    x: spawn.x,
    y: spawn.y,
    level: lv,
    hp,
    maxHp: hp,
    damage: tpl.damage.map((d) => Math.round(d * (1 + (lv - 1) * 0.18) * (spawn.tier === 'boss' ? 1.35 : 1))),
    armor: Math.round(tpl.armor * levelMult),
    speed: tpl.speed * (spawn.tier === 'champion' ? 1.12 : 1),
    range: tpl.range,
    xp: Math.round(tpl.xp * tierMult * (1 + (lv - 1) * 0.15)),
    color: spawn.tier === 'boss' ? '#f97316' : spawn.tier === 'champion' ? '#60a5fa' : tpl.color,
    state: 'idle',
    cdLeft: 0,
  };
}

/** Calcula daño efectivo de un golpe (impacto, armadura y crítico). */
export function resolveStrike({
  minDamage,
  maxDamage,
  attackerDex = 10,
  attackerLevel = 1,
  targetArmor = 0,
  targetDex = 8,
  critChance = 0.08,
  rng = Math.random,
}) {
  const roll = typeof rng === 'function' ? rng : () => rng.next();
  const hitChance = Math.min(0.96, Math.max(0.45, 0.72 + (attackerDex - targetDex) * 0.014));
  if (roll() > hitChance) {
    return { hit: false, crit: false, damage: 0 };
  }
  const raw = minDamage + roll() * Math.max(1, maxDamage - minDamage);
  const crit = roll() < critChance;
  const mitigation = targetArmor / (targetArmor + 55 + attackerLevel * 12);
  const finalDmg = Math.max(1, Math.round(raw * (crit ? 1.75 : 1) * (1 - mitigation)));
  return { hit: true, crit, damage: finalDmg };
}

/** Aplica experiencia al héroe y sube niveles automáticamente. */
export function grantHeroXp(hero, amount) {
  hero.xp += Math.max(0, Math.round(amount));
  let leveledUp = 0;
  while (hero.xp >= hero.xpNext) {
    hero.xp -= hero.xpNext;
    hero.level += 1;
    hero.statPoints += 3;
    hero.xpNext = xpForNextLevel(hero.level);
    leveledUp += 1;
  }
  return leveledUp;
}
