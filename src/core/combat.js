/**
 * combat.js — Las 7 Clases griegas (1:1 Diablo II), Árboles de Talentos con Sinergias,
 * Hazañas del Acto I (El Umbral del Estigia) y fórmulas matemáticas de combate.
 */
import { createStarterItem } from './loot.js';

export const HERO_CLASSES = {
  campeon: {
    id: 'campeon',
    d2Class: 'Bárbaro',
    name: 'Campeón de Ares',
    origin: 'Montes Ródope, Tracia',
    subtitle: 'Tracio berserker · Gritos y Torbellino',
    prologue:
      'Sobreviviste a la masacre de las nueve tribus tracias. Desciendes al Aqueronte para reclamar tu juramento de sangre ante Ares.',
    color: '#dc2626',
    primaryAttr: 'strength',
    range: 1.65,
    attackCd: 0.25,
    speed: 4.45,
    baseStats: { strength: 16, dexterity: 10, spirit: 5, vitality: 15 },
    scaling: { hpPerVit: 6.0, hpPerLvl: 16, manaPerSpi: 2.0, manaPerLvl: 4 },
    trees: ['Clamor de Fobos', 'Maestría Marcial', 'Furia Sangrienta'],
    treeDesc: [
      'Potencia Grito de Fobos [E] y el radio de intimidación (+sinergia a Torbellino)',
      'Piel de Bronce y Maestría en Armas (+daño físico, crítico y armadura pasiva)',
      'Potencia Torbellino Tracio [Q] y el drenaje sangriento (+sinergia a Gritos)',
    ],
    skills: {
      q: { name: 'Torbellino Tracio', cost: 14, cd: 3.0, desc: 'Giro sangriento 360° con robo de vida' },
      e: { name: 'Grito de Fobos', cost: 16, cd: 7.5, desc: 'Empuja enemigos y da +45% daño/velocidad' },
    },
  },
  hoplita: {
    id: 'hoplita',
    d2Class: 'Paladín',
    name: 'Hoplita de Esparta',
    origin: 'Lacedemonia, Templo de Atenea Calcieco',
    subtitle: 'Guerrero sagrado · Égida y Auras Olímpicas',
    prologue:
      'Enviado por los Éforos de Esparta con un escudo consagrado en Delfos, juraste sellar las grietas del Tártaro o volver sobre tu escudo.',
    color: '#f59e0b',
    primaryAttr: 'strength',
    range: 1.55,
    attackCd: 0.26,
    speed: 4.3,
    baseStats: { strength: 14, dexterity: 11, spirit: 8, vitality: 13 },
    scaling: { hpPerVit: 5.0, hpPerLvl: 14, manaPerSpi: 3.0, manaPerLvl: 5 },
    trees: ['Auras Olímpicas', 'Auras de Falange', 'Artes de Égida'],
    treeDesc: [
      'Potencia Aura de Apolo [E] y el daño solar consagrado (+sinergia a Égida)',
      'Muro de Bronce de Falange (+defensa pasiva, vida y mitigación de escudo)',
      'Potencia Golpe de Égida [Q] y la onda de choque sagrada (+sinergia a Auras)',
    ],
    skills: {
      q: { name: 'Golpe de Égida', cost: 14, cd: 3.4, desc: 'Impacto de escudo que aturde y empuja' },
      e: { name: 'Aura de Apolo', cost: 18, cd: 7.5, desc: 'Pulso solar abrasador + escudo y fervor' },
    },
  },
  arquera: {
    id: 'arquera',
    d2Class: 'Amazona',
    name: 'Cazadora de Artemisa',
    origin: 'Bosques Sagrados de Arcadia y Ortigia',
    subtitle: 'Arquera de Arcadia · Perforación y Crítico',
    prologue:
      'Las bestias del Estigia profanaron los claros de Artemisa. Con tu arco lunar sigues el rastro de la corrupción hasta su raíz subterránea.',
    color: '#22c55e',
    primaryAttr: 'dexterity',
    range: 5.7,
    attackCd: 0.20,
    speed: 4.85,
    baseStats: { strength: 9, dexterity: 16, spirit: 9, vitality: 11 },
    scaling: { hpPerVit: 4.5, hpPerLvl: 12, manaPerSpi: 3.0, manaPerLvl: 5 },
    trees: ['Arco Lunar', 'Venablo y Relámpago', 'Instinto Silvestre'],
    treeDesc: [
      'Potencia Flecha Lunar [Q] y su daño perforante (+sinergia a Salva)',
      'Potencia Salva de Ortigia [E] y la cadencia de proyectiles (+sinergia a Arco Lunar)',
      'Ojo de Halcón y Reflejos de Cierva (+probabilidad crítica, esquive y daño base)',
    ],
    skills: {
      q: { name: 'Flecha Lunar', cost: 13, cd: 2.6, desc: 'Disparo perforante de alto crítico' },
      e: { name: 'Salva de Ortigia', cost: 16, cd: 5.5, desc: 'Abanico de 3 flechas + Paso de Cierva' },
    },
  },
  oraculo: {
    id: 'oraculo',
    d2Class: 'Hechicera',
    name: 'Oráculo de Delfos',
    origin: 'Santuario de Apolo en el Monte Parnaso',
    subtitle: 'Pitia elemental · Rayo de Zeus, Fuego y Hielo',
    prologue:
      'El trípode de Delfos enmudeció cuando un vapor negro brotó de la grieta de Gea. Portas el fuego de Prometeo y el rayo de Zeus hacia el abismo.',
    color: '#38bdf8',
    primaryAttr: 'spirit',
    range: 5.2,
    attackCd: 0.24,
    speed: 4.35,
    baseStats: { strength: 6, dexterity: 10, spirit: 17, vitality: 9 },
    scaling: { hpPerVit: 3.5, hpPerLvl: 10, manaPerSpi: 5.0, manaPerLvl: 8 },
    trees: ['Ira de Zeus', 'Fuego de Prometeo', 'Hielo de Bóreas'],
    treeDesc: [
      'Potencia Rayo de Zeus [Q] y su radio eléctrico (+sinergia elemental)',
      'Dominio Ígneo de Prometeo (+daño arcano base, fervor y crítico mágico)',
      'Potencia Égida Etérea [E] y la armadura glacial de Bóreas',
    ],
    skills: {
      q: { name: 'Rayo de Zeus', cost: 17, cd: 3.0, desc: 'Descarga celestial en área de alto voltaje' },
      e: { name: 'Égida Etérea', cost: 16, cd: 6.5, desc: 'Paso astral corto y escudo arcano' },
    },
  },
  necromante: {
    id: 'necromante',
    d2Class: 'Nigromante',
    name: 'Necromante del Estigia',
    origin: 'Necromanteion de Éphyra, Río Aqueronte',
    subtitle: 'Sacerdote de Hades · Hueso, Peste y Moiras',
    prologue:
      'Los muertos se niegan a pagar el óbolo de Caronte y regresan quebrando el orden de Hades. Desciendes para restaurar la ley de las Sombras.',
    color: '#a855f7',
    primaryAttr: 'spirit',
    range: 5.0,
    attackCd: 0.24,
    speed: 4.3,
    baseStats: { strength: 7, dexterity: 10, spirit: 15, vitality: 10 },
    scaling: { hpPerVit: 4.0, hpPerLvl: 11, manaPerSpi: 4.5, manaPerLvl: 7 },
    trees: ['Legión de Sombras', 'Peste y Hueso', 'Maldiciones de las Moiras'],
    treeDesc: [
      'Dominio de las Sombras (+robo de vida, armadura ósea y vitalidad espectral)',
      'Potencia Lanza de Caronte [Q] y su perforación ósea (+sinergia a Moiras)',
      'Potencia Condena de Átropos [E] y la fractura de armadura enemiga',
    ],
    skills: {
      q: { name: 'Lanza de Caronte', cost: 15, cd: 2.7, desc: 'Lanza ósea perforante que drena vida' },
      e: { name: 'Condena de Átropos', cost: 18, cd: 6.8, desc: 'Detonación estigia en área + quiebra armadura' },
    },
  },
  sombra: {
    id: 'sombra',
    d2Class: 'Asesina',
    name: 'Sombra de Némesis',
    origin: 'Templo Nocturno de Ramnunte',
    subtitle: 'Ejecutora de Nix · Garras y Trampas de Hefesto',
    prologue:
      'Ungida por las Erinias para castigar la hybris de los reyes caídos, acechas en la penumbra con hojas gemelas y centinelas de bronce.',
    color: '#ec4899',
    primaryAttr: 'dexterity',
    range: 1.75,
    attackCd: 0.19,
    speed: 5.0,
    baseStats: { strength: 10, dexterity: 15, spirit: 10, vitality: 11 },
    scaling: { hpPerVit: 4.5, hpPerLvl: 12, manaPerSpi: 3.2, manaPerLvl: 5 },
    trees: ['Artes de Castigo', 'Trampas de Hefesto', 'Velo de Nix'],
    treeDesc: [
      'Potencia Filo de las Erinias [Q] y el multiplicador de remate crítico',
      'Potencia Centinela de Hefesto [E] y las saetas eléctricas automáticas',
      'Velo del Érebo (+velocidad de movimiento, crítico y reducción de daño)',
    ],
    skills: {
      q: { name: 'Filo de las Erinias', cost: 13, cd: 3.0, desc: 'Paso sombrío al objetivo con golpe crítico' },
      e: { name: 'Centinela de Hefesto', cost: 17, cd: 6.0, desc: 'Descarga eléctrica múltiple + Velo veloz' },
    },
  },
  coribante: {
    id: 'coribante',
    d2Class: 'Druida',
    name: 'Coribante de Pan',
    origin: 'Cumbres del Monte Liceo, Arcadia',
    subtitle: 'Místico salvaje · Forma de Licaón y Cataclismo',
    prologue:
      'El aullido del Monte Liceo anunció que las raíces del mundo arden. Invocas la furia del Lobo de Licaón y la cólera sísmica de Gea.',
    color: '#84cc16',
    primaryAttr: 'vitality',
    range: 1.85,
    attackCd: 0.25,
    speed: 4.55,
    baseStats: { strength: 11, dexterity: 9, spirit: 12, vitality: 14 },
    scaling: { hpPerVit: 5.5, hpPerLvl: 14, manaPerSpi: 3.8, manaPerLvl: 6 },
    trees: ['Metamorfosis', 'Cataclismo de Gea', 'Llamado del Bosque'],
    treeDesc: [
      'Potencia Forma de Licaón [E], regeneración salvaje y velocidad de ataque',
      'Potencia Cólera de Gea [Q] y el radio de erupción telúrica',
      'Espíritu de la Encina Sagrada (+vida máxima, defensa y vigor natural)',
    ],
    skills: {
      q: { name: 'Cólera de Gea', cost: 15, cd: 3.4, desc: 'Erupción sísmica radial que aplasta y empuja' },
      e: { name: 'Forma de Licaón', cost: 17, cd: 7.0, desc: 'Trance licántropo: regenera vida + furia veloz' },
    },
  },
};

/**
 * Las 3 Primeras Hazañas (Áthloi / Quests del Acto I: El Umbral del Estigia),
 * inspiradas en el Acto I de Diablo II (Den of Evil, Blood Raven, Andariel).
 */
export const ACT1_QUESTS = [
  {
    id: 'antro_perjuros',
    title: 'I. El Antro de los Perjuros',
    d2Analogue: 'Den of Evil (Acto I)',
    giver: 'Sibila de Cumas',
    desc: 'Purga a 5 muertos insepultos en la Ribera del Aqueronte (Piso 1).',
    targetCount: 5,
    rewardText: '+1 Punto de Talento y +1 Atributo',
  },
  {
    id: 'obolo_caronte',
    title: 'II. El Óbolo de Caronte',
    d2Analogue: 'Relicario / Blood Raven',
    giver: 'Sibila de Cumas',
    desc: 'Encuentra y abre un Cofre Antiguo [F] para recuperar el tributo del barquero.',
    targetCount: 1,
    rewardText: 'Reliquia Rara de Clase + 80 Dracmas',
  },
  {
    id: 'sombra_asterion',
    title: 'III. El Guardián del Umbral',
    d2Analogue: 'Señor de Acto (Asterión)',
    giver: 'Sibila de Cumas',
    desc: 'Derrota al Señor Minotauro Guardián que custodia las escaleras al Tártaro.',
    targetCount: 1,
    rewardText: 'Reliquia Única de Clase + 2 Puntos de Talento',
  },
];

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

/** Inicializa el estado de las Hazañas (Quests) del Acto I. */
export function createInitialQuests() {
  return ACT1_QUESTS.map((q) => ({
    ...q,
    progress: 0,
    completed: false,
  }));
}

/** Crea el estado inicial de un héroe según su clase griega, equipado con su objeto de iniciado. */
export function createHero(classId = 'hoplita', customName = '') {
  const cls = HERO_CLASSES[classId] || HERO_CLASSES.hoplita;
  const starterItem = createStarterItem(cls.id);
  const equipment = { weapon: null, armor: null, charm: null };
  equipment[starterItem.slot] = starterItem;

  return {
    classId: cls.id,
    name: customName && customName.trim() ? `${customName.trim()} (${cls.name})` : cls.name,
    className: cls.name,
    d2Class: cls.d2Class,
    origin: cls.origin,
    prologue: cls.prologue,
    level: 1,
    xp: 0,
    xpNext: xpForNextLevel(1),
    statPoints: 0,
    skillPoints: 1, // 1 punto de talento inicial en la Hoguera del Aqueronte
    treePoints: [0, 0, 0], // Puntos base invertidos en las 3 ramas
    gold: 25,
    potions: 3,
    baseStats: { ...cls.baseStats },
    equipment,
    inventory: [],
    quests: createInitialQuests(),
    buffs: { furyUntil: 0, shieldUntil: 0 },
    hp: 100,
    mana: 60,
  };
}

/** Invierte un punto de talento base en una de las 3 ramas de la clase (0, 1 o 2). */
export function allocateSkillPoint(hero, treeIndex) {
  if (!hero || hero.skillPoints <= 0) return false;
  if (treeIndex < 0 || treeIndex > 2) return false;
  if (!Array.isArray(hero.treePoints)) hero.treePoints = [0, 0, 0];
  hero.treePoints[treeIndex] += 1;
  hero.skillPoints -= 1;
  return true;
}

/**
 * Suma atributos base + equipo + Árbol de Talentos y Sinergias (estilo Diablo II).
 * Nota D2: las sinergias se calculan SOLO con puntos base (hero.treePoints), mientras que
 * el nivel efectivo de cada rama suma los bonos +skillBonus del equipo.
 */
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
  let allSkillBonus = 0;

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
    allSkillBonus += m.skillBonus || 0;
  }

  const baseTrees = Array.isArray(hero.treePoints) ? hero.treePoints : [0, 0, 0];
  const effectiveTrees = baseTrees.map((pts) => pts + allSkillBonus);
  const totalBaseSkillPts = baseTrees[0] + baseTrees[1] + baseTrees[2];

  // Bono pasivo de las ramas + Sinergia cruzada (8% por punto base invertido en ramas hermanas)
  const synergyBonusPct = totalBaseSkillPts * 0.08;
  const skillPowerMult = Number((1 + (effectiveTrees[0] + effectiveTrees[2]) * 0.12 + synergyBonusPct).toFixed(2));
  const passiveMasteryPts = effectiveTrees[1];

  const sc = cls.scaling || { hpPerVit: 5, hpPerLvl: 14, manaPerSpi: 3.5, manaPerLvl: 6 };
  const maxHp = Math.round(
    52 + stats.vitality * sc.hpPerVit + (hero.level - 1) * sc.hpPerLvl + bonusHp + passiveMasteryPts * 6
  );
  const maxMana = Math.round(
    26 + stats.spirit * sc.manaPerSpi + (hero.level - 1) * sc.manaPerLvl + bonusMana + effectiveTrees[0] * 3
  );
  const primaryAttr =
    cls.primaryAttr === 'vitality'
      ? Math.round((stats.vitality + stats.spirit) * 0.58)
      : stats[cls.primaryAttr] ?? stats.strength;

  const furyActive = (hero.buffs?.furyUntil || 0) > nowMs;
  const shieldActive = (hero.buffs?.shieldUntil || 0) > nowMs;
  const furyMult = (furyActive ? 1.45 : 1) * (1 + passiveMasteryPts * 0.05);

  const minDamage = Math.round((weaponMin + primaryAttr * 0.65 + flatDmg) * furyMult);
  const maxDamage = Math.round((weaponMax + primaryAttr * 0.95 + flatDmg) * furyMult);
  const critChance = Math.min(0.75, 0.06 + stats.dexterity * 0.0045 + bonusCrit + passiveMasteryPts * 0.015);
  const effectiveArmor =
    armor + (shieldActive ? 28 : 0) + Math.floor(stats.dexterity * 0.35) + passiveMasteryPts * 4;
  const speed = cls.speed + speedBonus + (furyActive ? 0.65 : 0);

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
    allSkillBonus,
    baseTrees,
    effectiveTrees,
    synergyBonusPct: Math.round(synergyBonusPct * 100),
    skillPowerMult,
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

/** Aplica experiencia al héroe y sube niveles (+3 puntos de atributo y +1 punto de talento por nivel). */
export function grantHeroXp(hero, amount) {
  hero.xp += Math.max(0, Math.round(amount));
  let leveledUp = 0;
  while (hero.xp >= hero.xpNext) {
    hero.xp -= hero.xpNext;
    hero.level += 1;
    hero.statPoints += 3;
    hero.skillPoints = (hero.skillPoints || 0) + 1;
    hero.xpNext = xpForNextLevel(hero.level);
    leveledUp += 1;
  }
  return leveledUp;
}
