import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateDungeon, isWalkable, TILE_STAIRS, updateVisibility } from '../src/core/dungeon.js';
import {
  CLASS_BASE_ITEMS,
  TREASURE_CLASSES,
  compareItems,
  generateItem,
  getItemPowerScore,
  getItemSalvageValue,
  getItemStatEntries,
  rollEnemyDrop,
} from '../src/core/loot.js';
import {
  HERO_CLASSES,
  allocateSkillPoint,
  createHero,
  computeHeroDerived,
  grantHeroXp,
  resolveStrike,
} from '../src/core/combat.js';

test('las 7 clases griegas (1:1 Diablo II) existen con sus 3 ramas, prólogo, reliquia inicial y 3 Hazañas', () => {
  const ids = Object.keys(HERO_CLASSES);
  assert.equal(ids.length, 7);
  assert.deepEqual(ids, ['campeon', 'hoplita', 'arquera', 'oraculo', 'necromante', 'sombra', 'coribante']);

  for (const id of ids) {
    const hero = createHero(id, 'Aquiles');
    const derived = computeHeroDerived(hero);
    assert.equal(HERO_CLASSES[id].trees.length, 3);
    assert.ok(hero.prologue && hero.prologue.length > 15);
    assert.equal(hero.quests.length, 3);
    assert.equal(hero.skillPoints, 1);
    assert.ok(derived.allSkillBonus >= 1); // Reliquia de iniciado otorga +1 a Talentos
    assert.ok(HERO_CLASSES[id].skills.q.name.length > 0);
    assert.ok(HERO_CLASSES[id].skills.e.name.length > 0);
    assert.ok(derived.maxHp >= 80);
    assert.ok(derived.maxMana >= 30);
    assert.ok(derived.maxDamage > derived.minDamage);
  }
});

test('árbol de talentos aplica sinergias solo por puntos base y suma +skillBonus de equipo', () => {
  const hero = createHero('necromante');
  const d0 = computeHeroDerived(hero);
  assert.equal(d0.synergyBonusPct, 0);
  assert.equal(d0.effectiveTrees[0], 1); // 0 base + 1 de Óbolo Órfico inicial

  const ok = allocateSkillPoint(hero, 1);
  assert.equal(ok, true);
  assert.equal(hero.skillPoints, 0);
  const d1 = computeHeroDerived(hero);
  assert.equal(d1.baseTrees[1], 1);
  assert.equal(d1.effectiveTrees[1], 2);
  assert.equal(d1.synergyBonusPct, 8);
  assert.ok(d1.skillPowerMult > d0.skillPowerMult);
});

test('PRNG es determinista para una misma semilla', () => {
  const a = createRng('atenas-42');
  const b = createRng('atenas-42');
  for (let i = 0; i < 10; i++) {
    assert.equal(a.int(1, 1000), b.int(1, 1000));
  }
});

test('generateDungeon crea mapa conectado con Sibila de Cumas, cofre garantizado y escalera', () => {
  const d = generateDungeon({ width: 40, height: 40, level: 1, seed: 'teseo' });
  assert.ok(d.rooms.length >= 2);
  assert.equal(d.npc.name, 'Sibila de Cumas');
  assert.ok(d.chests.length >= 1);
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

test('loot genera objetos exclusivos de las 7 clases, Treasure Classes y reliquias únicas', () => {
  assert.equal(Object.keys(CLASS_BASE_ITEMS).length, 7);
  assert.ok(TREASURE_CLASSES.boss.classItemChance > TREASURE_CLASSES.normal.classItemChance);

  const classRare = generateItem({
    level: 3,
    forceRarity: 'rare',
    forceClassItem: true,
    preferredClass: 'sombra',
    seed: 'erinias-1',
  });
  assert.equal(classRare.forClass, 'sombra');
  assert.ok(classRare.mods.skillBonus >= 1);

  const unique = generateItem({ level: 4, forceRarity: 'unique', preferredClass: 'arquera', seed: 'u1' });
  assert.equal(unique.rarity, 'unique');
  assert.ok(unique.lore && unique.lore.length > 5);

  const bossDrops = rollEnemyDrop({ level: 2, tier: 'boss', preferredClass: 'coribante', seed: 'b1' });
  assert.ok(bossDrops.some((d) => d.kind === 'gold'));
  assert.ok(bossDrops.some((d) => d.kind === 'item'));
});

test('combate y progresión de héroe calculan equipo y subida de nivel (+3 stats y +1 talento)', () => {
  const hero = createHero('oraculo');
  const relic = generateItem({ level: 2, forceRarity: 'unique', preferredClass: 'oraculo', seed: 'caduceo' });
  hero.equipment[relic.slot] = relic;
  const after = computeHeroDerived(hero);
  assert.ok(after.allSkillBonus >= 1);

  const lvUps = grantHeroXp(hero, 250);
  assert.ok(lvUps >= 1);
  assert.ok(hero.statPoints >= 3);
  assert.ok(hero.skillPoints >= 2);

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

test('modelos 3D (Three.js) construyen rigs articulados para las 7 clases griegas, enemigos y Sibila', async () => {
  const { createHeroMesh3D, createEnemyMesh3D, createSibylAndCampfire3D, updateActorRig3D } = await import(
    '../src/game/models3d.js'
  );

  for (const classId of Object.keys(HERO_CLASSES)) {
    const mesh = createHeroMesh3D(classId);
    assert.ok(mesh.isGroup);
    assert.equal(mesh.userData.rig.classId, classId);
    assert.ok(mesh.userData.rig.leftLegPivot);
    assert.ok(mesh.userData.rig.rightArmPivot);

    // Simular paso de marcha y ataque
    mesh.userData.rig.attackTimer = 0.25;
    updateActorRig3D(mesh, { dt: 0.05, moving: true, targetFacing: Math.PI / 2, furyActive: true, shieldActive: true });
    assert.equal(mesh.userData.rig.furyAura.visible, true);
    assert.equal(mesh.userData.rig.shieldAura.visible, true);
  }

  for (const kind of ['skeleton', 'harpy', 'satyr', 'minotaur']) {
    const eMesh = createEnemyMesh3D({ id: `test-${kind}`, kind, tier: kind === 'minotaur' ? 'boss' : 'normal', hp: 50 });
    assert.ok(eMesh.isGroup);
    assert.equal(eMesh.userData.rig.kind, kind);
    updateActorRig3D(eMesh, { dt: 0.05, moving: true, targetFacing: 1.0 });
  }

  const sibyl = createSibylAndCampfire3D();
  assert.ok(sibyl.isGroup);
  assert.ok(sibyl.userData.oracleRing);
});

test('helpers de inspección, comparación y ofrenda de ítems funcionan correctamente', () => {
  const hero = createHero('hoplita');
  const starter = hero.equipment.charm;
  const rare = generateItem({
    level: 4,
    forceRarity: 'unique',
    preferredClass: 'hoplita',
    seed: 'aegis-cmp',
  });

  const stats = getItemStatEntries(rare);
  assert.ok(stats.length >= 2);
  assert.ok(getItemSalvageValue(rare) > getItemSalvageValue(starter));
  assert.ok(getItemPowerScore(rare, 'hoplita') > 0);

  const emptyCmp = compareItems(rare, null, 'hoplita');
  assert.equal(emptyCmp.verdict, 'empty');

  const cmpStarter = compareItems(rare, starter, 'hoplita');
  assert.ok(['better', 'worse', 'even'].includes(cmpStarter.verdict));
  assert.ok(Array.isArray(cmpStarter.diffs));
});

test('sistema de floaters anti-superposición maneja múltiples elementos simultáneos', () => {
  const floaters = [];
  const addFloater = (x, y, text, color, opts = {}) => {
    const isLoot = opts.kind === 'loot' || String(text).startsWith('+');
    floaters.push({
      x,
      y,
      text: String(text),
      color,
      life: isLoot ? 1.45 : 1.15,
      createdAt: performance.now(),
    });
  };

  // Simular agarrar oro, poción e ítem en el mismo instante y coordenada
  addFloater(4.0, 4.0, '+25 dracmas', '#facc15', { kind: 'loot' });
  addFloater(4.0, 4.0, '+1 Ambrosía', '#f87171', { kind: 'loot' });
  addFloater(4.0, 4.0, 'Espada de Ares', '#38bdf8', { kind: 'loot' });

  assert.equal(floaters.length, 3);
  assert.ok(floaters.every((f) => f.life >= 1.4));

  // Resolver colisiones verticales simuladas
  const items = floaters.map((f) => ({ ...f, renderY: -34, width: 80, height: 19 }));
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < i; j++) {
      if (Math.abs(items[i].x - items[j].x) < 80 && Math.abs(items[i].renderY - items[j].renderY) < 20) {
        items[i].renderY = items[j].renderY - 21;
      }
    }
  }

  // Verificar que cada texto tiene una posición vertical única separada al menos 20px
  assert.equal(items[0].renderY, -34);
  assert.equal(items[1].renderY, -55);
  assert.equal(items[2].renderY, -76);
  assert.ok(items[0].renderY > items[1].renderY);
  assert.ok(items[1].renderY > items[2].renderY);
});



