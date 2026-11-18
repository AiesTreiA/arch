import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateDungeon, isWalkable, TILE_STAIRS, updateVisibility } from '../src/core/dungeon.js';
import { generateItem, rollEnemyDrop } from '../src/core/loot.js';
import { createHero, computeHeroDerived, grantHeroXp, resolveStrike } from '../src/core/combat.js';

test('PRNG es determinista para una misma semilla', () => {
  const a = createRng('atenas-42');
  const b = createRng('atenas-42');
  for (let i = 0; i < 10; i++) {
    assert.equal(a.int(1, 1000), b.int(1, 1000));
  }
});

test('generateDungeon crea mapa conectado de inicio a escalera', () => {
  const d = generateDungeon({ width: 40, height: 40, level: 2, seed: 'teseo' });
  assert.ok(d.rooms.length >= 2);
  assert.equal(d.grid[d.stairs.y][d.stairs.x], TILE_STAIRS);
  assert.equal(isWalkable(d, d.spawn.x, d.spawn.y), true);

  // BFS desde spawn hasta escalera
  const start = `${Math.floor(d.spawn.x)},${Math.floor(d.spawn.y)}`;
  const goal = `${d.stairs.x},${d.stairs.y}`;
  const queue = [[Math.floor(d.spawn.x), Math.floor(d.spawn.y)]];
  const visited = new Set([start]);
  let reached = false;
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (`${x},${y}` === goal) {
      reached = true;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (!visited.has(key) && isWalkable(d, nx + 0.5, ny + 0.5)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  assert.equal(reached, true);

  updateVisibility(d, d.spawn.x, d.spawn.y, 7);
  assert.equal(d.explored[Math.floor(d.spawn.y)][Math.floor(d.spawn.x)], 2);
});

test('loot genera rarezas y reliquias únicas válidas', () => {
  const magic = generateItem({ level: 3, forceRarity: 'magic', seed: 'm1' });
  assert.equal(magic.rarity, 'magic');
  assert.ok(Object.keys(magic.mods).length >= 1);

  const unique = generateItem({ level: 4, forceRarity: 'unique', seed: 'u1' });
  assert.equal(unique.rarity, 'unique');
  assert.ok(unique.lore && unique.lore.length > 5);

  const bossDrops = rollEnemyDrop({ level: 2, tier: 'boss', seed: 'b1' });
  assert.ok(bossDrops.some((d) => d.kind === 'gold'));
  assert.ok(bossDrops.some((d) => d.kind === 'item'));
});

test('combate y progresión de héroe calculan equipo y subida de nivel', () => {
  const hero = createHero('oraculo');
  const before = computeHeroDerived(hero);
  const relic = generateItem({ level: 2, forceRarity: 'unique', seed: 'caduceo' });
  hero.equipment[relic.slot] = relic;
  const after = computeHeroDerived(hero);
  assert.ok(after.maxDamage >= before.maxDamage || after.armor > before.armor || after.speed > before.speed);

  const lvUps = grantHeroXp(hero, 250);
  assert.ok(lvUps >= 1);
  assert.ok(hero.statPoints >= 3);

  const strike = resolveStrike({
    minDamage: 15,
    maxDamage: 20,
    attackerDex: 15,
    targetArmor: 10,
    rng: () => 0.25,
  });
  assert.equal(strike.hit, true);
  assert.ok(strike.damage >= 10);
});
