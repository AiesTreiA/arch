/*
 * companion.js — Sistema de Companeros Invocables por Nivel (ARCH).
 * Propiedad RAAPAZ Ops. Modulo puro, sin DOM, testeable.
 */
import { HERO_CLASSES, createHero, computeHeroDerived } from './combat.js';

export const COMPANION_UNLOCK_LEVELS = [5, 10, 15, 20];
export const COMPANION_MAX = COMPANION_UNLOCK_LEVELS.length;
export const ENEMY_HP_MULT_BY_COMPANIONS = [1.0, 1.45, 1.9, 2.35, 2.8];
export const ENEMY_DAMAGE_MULT_BY_COMPANIONS = [1.0, 1.35, 1.7, 2.05, 2.4];

export function companionsUnlockedForLevel(level) {
  const lv = Math.max(1, Number(level) || 1);
  let count = 0;
  for (const t of COMPANION_UNLOCK_LEVELS) if (lv >= t) count++;
  return Math.min(COMPANION_MAX, count);
}

export function enemyDifficultyMultiplier(companionCount) {
  const n = Math.max(0, Math.min(COMPANION_MAX, Number(companionCount) || 0));
  return { hp: ENEMY_HP_MULT_BY_COMPANIONS[n], damage: ENEMY_DAMAGE_MULT_BY_COMPANIONS[n] };
}

export function applyCompanionDifficultyToEnemy(enemy, companionCount) {
  if (!enemy) return enemy;
  const mult = enemyDifficultyMultiplier(companionCount);
  if (enemy._baseHp == null) enemy._baseHp = enemy.maxHp;
  if (enemy._baseDamage == null && Array.isArray(enemy.damage)) enemy._baseDamage = [...enemy.damage];
  enemy.maxHp = Math.round(enemy._baseHp * mult.hp);
  enemy.hp = Math.min(enemy.maxHp, Math.max(1, Math.round(enemy.hp * mult.hp)));
  if (Array.isArray(enemy._baseDamage)) {
    enemy.damage = enemy._baseDamage.map((d) => Math.round(d * mult.damage));
  }
  return enemy;
}

export function pickCompanionClass(heroClassId, existing = []) {
  const pool = Object.keys(HERO_CLASSES).filter((id) => id !== heroClassId && !existing.includes(id));
  const src = pool.length ? pool : Object.keys(HERO_CLASSES);
  return src[Math.floor(Math.random() * src.length)];
}

export function createCompanion(classId, level = 1, name = '') {
  const hero = createHero(classId, name);
  hero.level = Math.max(1, Number(level) || 1);
  const d = computeHeroDerived(hero);
  hero.hp = d.maxHp;
  hero.mana = d.maxMana;
  return hero;
}

export function createCompanionState({ classId, level, x, y, id }) {
  const hero = createCompanion(classId, level, HERO_CLASSES[classId].name);
  return {
    id: id || ('comp-' + Date.now() + '-' + Math.floor(Math.random() * 1e6)),
    hero, classId, x, y,
    state: 'follow', attackCdLeft: 0, skillQCd: 0, skillECd: 0,
    lastAimDir: { x: 1, y: 0 },
    followDist: 1.6 + Math.random() * 0.8,
    aggressionRange: 7.5,
  };
}
