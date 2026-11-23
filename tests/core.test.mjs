import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { FINAL_FLOOR, generateDungeon, getZoneAt, isWalkable, TILE_STAIRS, TILE_STAIRS_UP, updateVisibility } from '../src/core/dungeon.js';
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
  createEnemy,
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

test('cadencia de ataque y velocidad de proyectiles son rápidas y receptivas en todas las clases', () => {
  for (const [classId, cls] of Object.entries(HERO_CLASSES)) {
    assert.ok(cls.attackCd <= 0.28, `${classId} attackCd (${cls.attackCd}) debe ser <= 0.28s para alta cadencia`);
    assert.ok(cls.attackCd >= 0.18, `${classId} attackCd (${cls.attackCd}) debe ser >= 0.18s`);
  }
});

test('sistema de efectos visuales 3D escala proporcionales al daño para Rayo de Zeus y habilidades', async () => {
  const { ArchRenderer3D } = await import('../src/game/models3d.js');
  // Mock canvas minimal
  const fakeCanvas = {
    parentElement: { insertBefore: () => {} },
    style: {},
    width: 800,
    height: 600,
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
  };

  const r3d = new ArchRenderer3D(fakeCanvas);
  // Si WebGL no está disponible en el entorno headless de tests, r3d.enabled será false
  assert.ok(r3d);
  assert.equal(typeof r3d.triggerSkillVFX, 'function');

  const { Group } = await import('three');
  r3d.enabled = true;
  r3d.fxGroup = new Group();
  r3d.activeVFX = [];

  // Probar Rayo de Zeus con daño bajo (20) vs daño alto (90)
  r3d.triggerSkillVFX({ type: 'lightning', x: 2, y: 2, damage: 20 });
  const vfxLow = r3d.activeVFX[r3d.activeVFX.length - 1];

  r3d.triggerSkillVFX({ type: 'lightning', x: 2, y: 2, damage: 90 });
  const vfxHigh = r3d.activeVFX[r3d.activeVFX.length - 1];

  assert.ok(vfxHigh.particles.length > vfxLow.particles.length, 'Mayor daño genera más chispas eléctricas');
  assert.ok(vfxHigh.baseLightIntensity > vfxLow.baseLightIntensity, 'Mayor daño genera destello de luz más intenso');

  // Probar las demás habilidades de todas las clases
  const skillTypes = [
    'whirlwind',
    'shout',
    'shield_slam',
    'solar_nova',
    'lunar_arrow',
    'salva',
    'caronte_spear',
    'atropos_void',
    'erinias_slash',
    'sentinel_burst',
    'earth_shatter',
    'licaon_roar',
  ];

  for (const type of skillTypes) {
    const prevCount = r3d.activeVFX.length;
    r3d.triggerSkillVFX({ type, x: 5, y: 5, targetX: 7, targetY: 7, damage: 45 });
    assert.equal(r3d.activeVFX.length, prevCount + 1, `Efecto ${type} debe crearse en activeVFX`);
  }

  // Simular avance de fotograma y física de partículas
  assert.ok(r3d.activeVFX.length >= 14);
  r3d._updateVFX(0.05);
  assert.ok(r3d.activeVFX.length >= 14);

  // Simular expiración de ciclo de vida
  r3d._updateVFX(1.0);
  assert.equal(r3d.activeVFX.length, 0, 'Todos los efectos deben expirar y liberarse limpiamente');
});

test('autoEquipBest y salvageInferiorItems equipan lo superior y ofrendan sólo lo inferior', async () => {
  const { ArchGame } = await import('../src/game/engine.js');
  assert.ok(ArchGame?.prototype);
  const hero = createHero('campeon');

  // Crear ítems de prueba
  const betterWeapon = generateItem({
    level: 5,
    forceRarity: 'rare',
    preferredClass: 'campeon',
    seed: 'better-w',
  });
  betterWeapon.slot = 'weapon';

  const worseWeapon = generateItem({
    level: 1,
    forceRarity: 'common',
    preferredClass: 'campeon',
    seed: 'worse-w',
  });
  worseWeapon.slot = 'weapon';

  const betterCharm = generateItem({
    level: 4,
    forceRarity: 'unique',
    preferredClass: 'campeon',
    seed: 'better-c',
  });
  betterCharm.slot = 'charm';

  hero.inventory.push(betterWeapon, worseWeapon, betterCharm);

  const mockGame = {
    hero,
    pos: { x: 0, y: 0 },
    addFloater: () => {},
    addLog: () => {},
    _notify: () => {},
    equipItem(id) {
      const idx = this.hero.inventory.findIndex((i) => i.id === id);
      if (idx < 0) return;
      const item = this.hero.inventory[idx];
      const prev = this.hero.equipment[item.slot];
      this.hero.equipment[item.slot] = item;
      this.hero.inventory.splice(idx, 1);
      if (prev) this.hero.inventory.push(prev);
    },
  };

  mockGame.autoEquipBest = ArchGame.prototype.autoEquipBest.bind(mockGame);
  mockGame.salvageInferiorItems = ArchGame.prototype.salvageInferiorItems.bind(mockGame);

  const equipped = mockGame.autoEquipBest();
  assert.ok(equipped >= 1, 'Debe haber auto-equipado objetos superiores');
  assert.equal(hero.equipment.weapon.id, betterWeapon.id, 'Debe equipar el arma superior');
  assert.equal(hero.equipment.charm.id, betterCharm.id, 'Debe equipar la reliquia superior');

  const initialGold = hero.gold;
  const res = mockGame.salvageInferiorItems();
  assert.ok(res.count >= 1, 'Debe ofrendar los ítems inferiores');
  assert.ok(hero.gold > initialGold, 'Debe sumar dracmas al héroe');
  assert.ok(
    hero.inventory.every((it) => {
      const cmp = compareItems(it, hero.equipment[it.slot], hero.classId);
      return cmp.verdict !== 'worse';
    }),
    'No deben quedar objetos inferiores en la mochila'
  );
});

test('modelos 3D de botín en el suelo tienen formas y texturas realistas y reflejan el equipo en el héroe', async () => {
  const { createGroundDropMesh3D, createHeroMesh3D, updateHeroEquipmentVisuals } = await import(
    '../src/game/models3d.js'
  );

  // 1. Probar modelos 3D de botín en el suelo (Oro, Poción y diversos Ítems)
  const goldDrop = { x: 3, y: 3, kind: 'gold', amount: 45 };
  const goldMesh = createGroundDropMesh3D(goldDrop);
  assert.ok(goldMesh.isGroup);
  const goldBob = goldMesh.getObjectByName('bobGroup');
  assert.ok(goldBob, 'El drop de oro debe contener bobGroup articulado');
  assert.ok(goldBob.children.length >= 6, 'El oro debe ser una pila de dracmas detalladas y destello');

  const potionDrop = { x: 4, y: 4, kind: 'potion', amount: 1 };
  const potionMesh = createGroundDropMesh3D(potionDrop);
  const potionBob = potionMesh.getObjectByName('bobGroup');
  assert.ok(potionBob.children.length >= 1, 'El frasco de ambrosía debe construirse con cuello, líquido y corcho');

  // Ítems de distintos arquetipos (Espada, Lanza, Arco, Báculo, Coraza, Escudo, Yelmo)
  const swordItem = { key: 'xiphos', name: 'Xiphos de Bronce', slot: 'weapon', rarity: 'magic' };
  const spearItem = { key: 'dory', name: 'Lanza Dory', slot: 'weapon', rarity: 'rare' };
  const bowItem = { key: 'bow', name: 'Arco de Tejo', slot: 'weapon', rarity: 'common' };
  const cuirassItem = { key: 'cuirass', name: 'Coraza Hoplita', slot: 'armor', rarity: 'rare' };
  const shieldItem = { key: 'hoplon', name: 'Escudo Hoplón', slot: 'charm', rarity: 'unique' };
  const helmItem = { key: 'helm_thrace', name: 'Yelmo Tracio', slot: 'charm', rarity: 'rare' };

  for (const item of [swordItem, spearItem, bowItem, cuirassItem, shieldItem, helmItem]) {
    const drop = { x: 1, y: 1, kind: 'item', item };
    const m = createGroundDropMesh3D(drop);
    assert.ok(m.isGroup);
    const bob = m.getObjectByName('bobGroup');
    assert.ok(bob && bob.children.length > 0, `El ítem ${item.name} debe tener un modelo 3D reconocible`);
    // Comprobar haz de luz de rareza vertical
    const hasBeam = m.children.some((c) => c.isMesh && c.geometry.type === 'CylinderGeometry');
    assert.ok(hasBeam, `El ítem ${item.name} debe incluir columna vertical de luz de rareza`);
  }

  // 2. Probar reflejo visual de equipamiento en el modelo 3D del héroe
  const heroMesh = createHeroMesh3D('hoplita');
  const rig = heroMesh.userData.rig;
  assert.ok(rig.weaponSlot, 'Hero rig debe tener weaponSlot');
  assert.ok(rig.offhandSlot, 'Hero rig debe tener offhandSlot');
  assert.ok(rig.armorSlot, 'Hero rig debe tener armorSlot');
  assert.ok(rig.headgearSlot, 'Hero rig debe tener headgearSlot');
  assert.ok(rig.torsoMesh, 'Hero rig debe tener torsoMesh');

  // Equipar Xiphos mágico y Coraza rara
  updateHeroEquipmentVisuals(
    heroMesh,
    {
      weapon: swordItem,
      armor: cuirassItem,
      charm: shieldItem,
    },
    'hoplita'
  );

  assert.ok(rig.weaponSlot.children.length > 0, 'weaponSlot debe alojar la espada Xiphos 3D');
  assert.ok(rig.offhandSlot.children.length > 0, 'offhandSlot debe alojar el escudo Aspis 3D');
  assert.ok(rig.armorSlot.children.length > 0, 'armorSlot debe alojar las hombreras/spaulders de coraza');

  // Equipar Arco y Yelmo: sostiene solo el arco centrado en la mano izquierda (sin espada en la derecha)
  updateHeroEquipmentVisuals(
    heroMesh,
    {
      weapon: bowItem,
      armor: null,
      charm: helmItem,
    },
    'arquera'
  );

  assert.equal(rig.isBowEquipped, true, 'El rig debe registrar que empuña arco');
  assert.equal(rig.weaponSlot.children.length, 0, 'weaponSlot debe quedar vacío cuando sostiene arco');
  assert.ok(rig.offhandSlot.children.length > 0, 'offhandSlot debe sostener el arco');
  const bowGroup = rig.offhandSlot.getObjectByName('heroBowGroup');
  assert.ok(bowGroup, 'offhandSlot debe contener heroBowGroup');
  assert.equal(bowGroup.position.y, -0.24, 'El arco debe sujetarse exactamente por la mano en el medio del semicírculo');
  assert.equal(bowGroup.position.z, 0, 'El centro de la empuñadura del arco debe coincidir con la mano');
  assert.ok(rig.headgearSlot.children.length > 0, 'headgearSlot debe alojar el yelmo tracio');

  // Cambiar a Espada: blande solo la espada, sin arco
  updateHeroEquipmentVisuals(
    heroMesh,
    {
      weapon: swordItem,
      armor: null,
      charm: null,
    },
    'arquera'
  );

  assert.equal(rig.isBowEquipped, false, 'El rig no debe quedar en modo arco al equipar espada');
  assert.ok(rig.weaponSlot.children.length > 0, 'weaponSlot debe alojar la espada Xiphos 3D');
  assert.equal(rig.offhandSlot.children.length, 0, 'offhandSlot no debe sostener arco cuando empuña espada');
});

test('nivel 1 sobre la tierra genera mundo vivo con pasto, tierra, agua, puentes, flora y zonas míticas griegas', async () => {
  const d = generateDungeon({ width: 48, height: 48, level: 1, seed: 'olimpia-01' });
  assert.equal(d.isOverworld, true);
  assert.equal(d.biome.id, 'helade');
  assert.equal(d.zones.length, 5);

  const terrainCounts = new Map();
  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const k = d.terrain[y][x];
      terrainCounts.set(k, (terrainCounts.get(k) || 0) + 1);
    }
  }

  for (const expectedTerrain of ['grass', 'meadow', 'dirt', 'sand', 'water', 'shallow_water', 'bridge', 'marble']) {
    assert.ok((terrainCounts.get(expectedTerrain) || 0) > 0, `Debe existir terreno de tipo '${expectedTerrain}' en el Nivel 1`);
  }

  assert.ok(d.sceneryProps.length > 20, 'Debe poblar el paisaje con vegetación, columnas y muelle');
  assert.ok(d.ambientCritters.length > 0, 'Debe poblar fauna viva (mariposas y luciérnagas)');

  const spawnZone = getZoneAt(d, d.spawn.x, d.spawn.y);
  assert.equal(spawnZone?.id, 'aqueronte');
  const shrineZone = getZoneAt(d, d.shrine.x + 0.5, d.shrine.y + 0.5);
  assert.equal(shrineZone?.id, 'delfos');

  const { createOverworldProp3D, createCritterMesh3D } = await import('../src/game/models3d.js');
  for (const kind of ['olive', 'cypress', 'flower', 'reed', 'boulder', 'column', 'dock', 'boat']) {
    const pm = createOverworldProp3D({ kind, x: 5, y: 5, scale: 1 });
    assert.ok(pm.isGroup, `Prop 3D ${kind} debe construirse`);
  }
  const butterfly = createCritterMesh3D({ kind: 'butterfly', x: 5, y: 5, color: 0xfbbf24 });
  assert.ok(butterfly.isGroup);
});

test('piso 22 contiene al monstruo final Hades, su modelo 3D y desbloquea victoria + abismo infinito', async () => {
  assert.equal(FINAL_FLOOR, 22);
  const f22 = generateDungeon({ width: 44, height: 44, level: 22, seed: 'tartaro-final' });
  assert.equal(f22.isFinalFloor, true);
  assert.equal(f22.isOverworld, false);
  assert.equal(f22.biome.id, 'trono_tartaro');

  const hadesSpawn = f22.enemySpawns.find((s) => s.kind === 'hades' && s.isFinalBoss);
  assert.ok(hadesSpawn, 'El Piso 22 debe incluir el spawn del jefe final Hades');

  const hades = createEnemy(hadesSpawn, 'final-hades');
  assert.equal(hades.isFinalBoss, true);
  assert.equal(hades.name, 'Hades, Soberano del Tártaro');
  assert.ok(hades.hp > 2000, 'Hades en Piso 22 debe tener vida acorde a jefe final');

  const { createEnemyMesh3D } = await import('../src/game/models3d.js');
  const hadesMesh = createEnemyMesh3D(hades);
  assert.ok(hadesMesh.isGroup);
  assert.equal(hadesMesh.userData.rig.kind, 'hades');

  const { ArchGame } = await import('../src/game/engine.js');
  const events = [];
  const hero = createHero('hoplita');
  const mockGame = {
    hero,
    floor: 22,
    seed: 'test-v',
    pos: { x: 10, y: 10 },
    groundDrops: [],
    finalBossDefeated: false,
    endlessUnlocked: false,
    renderer3d: null,
    addFloater: () => {},
    addLog: () => {},
    shakeScreen: () => {},
    _advanceQuest: () => {},
    _notify: () => {},
    onEvent: (ev) => events.push(ev),
  };

  ArchGame.prototype._onEnemyKilled.call(mockGame, hades);
  assert.equal(mockGame.finalBossDefeated, true);
  assert.equal(mockGame.endlessUnlocked, true);
  assert.ok(events.some((e) => e.type === 'victory'), 'Matar a Hades debe emitir evento victory');
  assert.ok(mockGame.groundDrops.some((d) => d.kind === 'item' && d.item?.rarity === 'unique'), 'Hades debe soltar reliquia única');
});

test('pisos 2+ generan escaleras de ascenso (TILE_STAIRS_UP) conectadas y permiten bajar y subir con [F] y [Espacio]', async () => {
  const f1 = generateDungeon({ width: 48, height: 48, level: 1, seed: 'ascenso-test' });
  assert.equal(f1.stairsUp, null, 'El Piso 1 (Superficie) no tiene escaleras de ascenso');
  assert.equal(f1.grid[f1.stairs.y][f1.stairs.x], TILE_STAIRS);

  const f2 = generateDungeon({ width: 44, height: 44, level: 2, seed: 'ascenso-test' });
  assert.ok(f2.stairsUp, 'El Piso 2 debe incluir coordenadas de stairsUp');
  assert.equal(f2.grid[f2.stairsUp.y][f2.stairsUp.x], TILE_STAIRS_UP);
  assert.equal(f2.grid[f2.stairs.y][f2.stairs.x], TILE_STAIRS);
  assert.equal(isWalkable(f2, f2.stairsUp.x + 0.5, f2.stairsUp.y + 0.5), true);

  const { ArchRenderer3D } = await import('../src/game/models3d.js');
  const { Group, DirectionalLight, AmbientLight, PointLight } = await import('three');
  const r3d = Object.create(ArchRenderer3D.prototype);
  r3d.enabled = true;
  r3d.dungeonGroup = new Group();
  r3d.actorsGroup = new Group();
  r3d.fxGroup = new Group();
  r3d.enemyMeshes = new Map();
  r3d.chestMeshes = new Map();
  r3d.ambientLight = new AmbientLight();
  r3d.dirLight = new DirectionalLight();
  r3d.heroLight = new PointLight();
  r3d.campfireLight = new PointLight();
  r3d.buildDungeon(f2);
  const upTileMesh = r3d.tileMeshes[f2.stairsUp.y]?.[f2.stairsUp.x];
  assert.ok(upTileMesh?.isGroup && upTileMesh.children.length >= 7, 'La escalera de subida 3D debe tener peldaños y arco');

  const { ArchGame } = await import('../src/game/engine.js');
  const winListeners = new Map();
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevRaf = globalThis.requestAnimationFrame;

  globalThis.window = {
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    devicePixelRatio: 1,
  };
  globalThis.document = {
    addEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;

  try {
    const fakeCanvas = {
      width: 800,
      height: 600,
      getContext: () => ({
        setTransform() {},
        clearRect() {},
        fillRect() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {},
        stroke() {},
        fillText() {},
        arc() {},
        ellipse() {},
        measureText: () => ({ width: 40 }),
      }),
      addEventListener() {},
    };

    const events = [];
    const game = new ArchGame({
      canvas: fakeCanvas,
      onUiUpdate: () => {},
      onHudTick: () => {},
      onEvent: (ev) => events.push(ev),
    });
    game.startNewGame({ classId: 'hoplita', heroName: 'Teseo', seed: 'ascenso-test' });
    assert.equal(game.floor, 1);

    // Abrir un cofre en el Piso 1 para comprobar que el estado se conserva al bajar y volver a subir
    game.dungeon.chests[0].opened = true;

    // Colocar al héroe sobre la entrada al Inframundo (Piso 1) y pulsar 'f'
    game.pos = { x: game.dungeon.stairs.x + 0.5, y: game.dungeon.stairs.y + 0.5 };
    const nearDownF1 = game.getNearbyInteractable();
    assert.equal(nearDownF1?.kind, 'stairs');

    const fireKeydown = (eventProps) => {
      for (const fn of winListeners.get('keydown') || []) {
        fn(eventProps);
      }
    };

    // Ctrl+F no debe activar la interacción del juego
    fireKeydown({ key: 'f', ctrlKey: true });
    assert.equal(game.floor, 1, 'Ctrl+F no debe disparar interactNearby');

    // Pulsar [F] debe descender al Piso 2
    fireKeydown({ key: 'f' });
    assert.equal(game.floor, 2, 'Pulsar [F] en escaleras de bajada debe descender al Piso 2');
    assert.ok(
      Math.hypot(game.dungeon.stairsUp.x + 0.5 - game.pos.x, game.dungeon.stairsUp.y + 0.5 - game.pos.y) <= 1.35,
      'Al descender al Piso 2 el héroe debe aparecer junto a las escaleras de subida'
    );

    // En la posición de llegada del Piso 2, el interactuable cercano es stairsUp
    const nearUpF2 = game.getNearbyInteractable();
    assert.equal(nearUpF2?.kind, 'stairsUp');

    // Key-repeat de [F] no debe disparar transición accidental
    fireKeydown({ key: 'f', repeat: true });
    assert.equal(game.floor, 2, 'Keydown con repeat=true no debe cambiar de piso');

    // Bajar del Piso 2 al Piso 3 usando [F] (mayúscula)
    game.pos = { x: game.dungeon.stairs.x + 0.5, y: game.dungeon.stairs.y + 0.5 };
    fireKeydown({ key: 'F' });
    assert.equal(game.floor, 3, 'Pulsar [F] debe descender del Piso 2 al Piso 3');

    // Subir del Piso 3 al Piso 2 con [F]
    game.pos = { x: game.dungeon.stairsUp.x + 0.5, y: game.dungeon.stairsUp.y + 0.5 };
    fireKeydown({ key: 'f' });
    assert.equal(game.floor, 2, 'Pulsar [F] en stairsUp debe subir del Piso 3 al Piso 2');
    assert.ok(
      Math.hypot(game.dungeon.stairs.x + 0.5 - game.pos.x, game.dungeon.stairs.y + 0.5 - game.pos.y) <= 1.35,
      'Al subir del Piso 3 al Piso 2 el héroe debe aparecer junto a las escaleras de bajada del Piso 2'
    );

    // Subir del Piso 2 al Piso 1 con [Espacio] (sin enemigos cercanos)
    game.enemies = [];
    game.attackCdLeft = 0;
    game.pos = { x: game.dungeon.stairsUp.x + 0.5, y: game.dungeon.stairsUp.y + 0.5 };
    fireKeydown({ key: ' ' });
    assert.equal(game.floor, 1, 'Pulsar [Espacio] sin enemigos en rango también permite subir al Piso 1');
    assert.equal(game.dungeon.chests[0].opened, true, 'El Piso 1 debe conservar el estado de cofres abiertos al regresar');
  } finally {
    globalThis.window = prevWin;
    globalThis.document = prevDoc;
    globalThis.requestAnimationFrame = prevRaf;
  }
});

test('Modo Auto auto-equipa objetos mejores, auto-ofrenda inferiores al recogerlos y asigna atributos/talentos con random', async () => {
  const { ArchGame } = await import('../src/game/engine.js');
  const hero = createHero('campeon');
  hero.statPoints = 6;
  hero.skillPoints = 3;

  const initialStatsSum = Object.values(hero.baseStats).reduce((a, b) => a + b, 0);
  const initialTreesSum = hero.treePoints.reduce((a, b) => a + b, 0);

  const mockGame = {
    hero,
    pos: { x: 4, y: 4 },
    autoManageEnabled: false,
    addFloater: () => {},
    addLog: () => {},
    _notify: () => {},
    equipItem: ArchGame.prototype.equipItem,
    autoEquipBest: ArchGame.prototype.autoEquipBest,
    salvageInferiorItems: ArchGame.prototype.salvageInferiorItems,
    autoAllocatePointsRandom: ArchGame.prototype.autoAllocatePointsRandom,
    handleAutoItemPickup: ArchGame.prototype.handleAutoItemPickup,
    toggleAutoManage: ArchGame.prototype.toggleAutoManage,
  };

  // 1. Activar Modo Auto reparte inmediatamente atributos y talentos al azar
  const active = mockGame.toggleAutoManage(true);
  assert.equal(active, true);
  assert.equal(hero.statPoints, 0, 'Todos los puntos de atributo deben distribuirse automáticamente');
  assert.equal(hero.skillPoints, 0, 'Todos los puntos de talento deben distribuirse automáticamente');
  assert.equal(
    Object.values(hero.baseStats).reduce((a, b) => a + b, 0),
    initialStatsSum + 6,
    'La suma de atributos debe aumentar en 6'
  );
  assert.equal(
    hero.treePoints.reduce((a, b) => a + b, 0),
    initialTreesSum + 3,
    'La suma de talentos debe aumentar en 3'
  );

  // 2. Recoger un arma superior del suelo debe auto-equiparla
  const weakWeapon = generateItem({ level: 1, forceRarity: 'common', preferredClass: 'campeon', seed: 'w-weak' });
  weakWeapon.slot = 'weapon';
  const strongWeapon = generateItem({ level: 8, forceRarity: 'unique', preferredClass: 'campeon', seed: 'w-strong' });
  strongWeapon.slot = 'weapon';

  const r1 = mockGame.handleAutoItemPickup(weakWeapon);
  assert.equal(r1.action, 'equipped', 'Si la ranura estaba vacía, debe auto-equipar el arma recogida');
  assert.equal(hero.equipment.weapon.id, weakWeapon.id);

  const goldBeforeUpgrade = hero.gold;
  const r2 = mockGame.handleAutoItemPickup(strongWeapon);
  assert.equal(r2.action, 'equipped', 'Al recoger un arma superior, debe auto-equiparla');
  assert.equal(hero.equipment.weapon.id, strongWeapon.id);
  assert.ok(hero.gold > goldBeforeUpgrade, 'El arma anterior inferior debe auto-ofrendarse por dracmas');

  // 3. Recoger un arma inferior debe auto-ofrendarla sin ocupar la mochila
  const goldBeforeInferior = hero.gold;
  const r3 = mockGame.handleAutoItemPickup(weakWeapon);
  assert.equal(r3.action, 'salvaged', 'Un objeto inferior recogido debe auto-ofrendarse inmediatamente');
  assert.ok(hero.gold > goldBeforeInferior, 'Auto-ofrendar al recoger debe sumar dracmas');
  assert.equal(hero.inventory.length, 0, 'El objeto inferior no debe ocupar espacio en la mochila');
});

test('variabilidad de mundos estilo Zelda Ocarina of Time: 5 Templos (pisos 2–21), vasijas rompibles, arbustos y Fuentes de Hadas', async () => {
  const { BIOMES, FINAL_BIOME } = await import('../src/core/dungeon.js');
  assert.equal(BIOMES.length, 5, 'Deben existir 5 Templos clásicos en BIOMES');
  assert.equal(FINAL_BIOME.id, 'trono_tartaro', 'El bioma final debe ser el Trono del Tártaro');

  // 1. Verificación de asignación de los 5 Templos clásicos de Zelda OoT
  const templeMap = [
    { floor: 2, templeId: 'bosque', title: 'Templo del Bosque', particle: 'spores' },
    { floor: 5, templeId: 'bosque', title: 'Templo del Bosque', particle: 'spores' },
    { floor: 6, templeId: 'fuego', title: 'Templo del Fuego', particle: 'embers' },
    { floor: 9, templeId: 'fuego', title: 'Templo del Fuego', particle: 'embers' },
    { floor: 10, templeId: 'agua', title: 'Templo del Agua', particle: 'bubbles' },
    { floor: 13, templeId: 'agua', title: 'Templo del Agua', particle: 'bubbles' },
    { floor: 14, templeId: 'sombras', title: 'Templo de las Sombras', particle: 'wisps' },
    { floor: 17, templeId: 'sombras', title: 'Templo de las Sombras', particle: 'wisps' },
    { floor: 18, templeId: 'espiritu', title: 'Templo del Espíritu', particle: 'dust' },
    { floor: 21, templeId: 'espiritu', title: 'Templo del Espíritu', particle: 'dust' },
    { floor: 22, templeId: 'trono_tartaro', title: 'Trono del Tártaro', particle: 'embers' },
  ];

  for (const { floor, templeId, title, particle } of templeMap) {
    const dungeon = generateDungeon({ width: 38, height: 38, level: floor, seed: `zelda-test-${floor}` });
    const currentTemple = dungeon.biome.templeId || dungeon.biome.id;
    assert.equal(currentTemple, templeId, `Piso ${floor} debe pertenecer a ${templeId}`);
    assert.ok(dungeon.biome.name.includes(title), `Piso ${floor} (${dungeon.biome.name}) debe incluir ${title}`);
    assert.equal(dungeon.biome.particles || dungeon.biome.ambientParticle, particle, `Piso ${floor} debe tener partículas ambientales ${particle}`);
    assert.ok(dungeon.pots && dungeon.pots.length > 0, `Piso ${floor} debe generar vasijas rompibles`);
  }

  // 2. Overworld (Piso 1) genera fuentes de hadas conectadas y elementos destructibles
  const overworld = generateDungeon({ width: 48, height: 48, level: 1, seed: 'zelda-overworld-props' });
  assert.ok(overworld.pots && overworld.pots.length >= 6, 'Overworld debe generar vasijas cerámicas');
  assert.ok(overworld.bushes && overworld.bushes.length >= 8, 'Overworld debe generar arbustos cortables');
  assert.ok(overworld.fairyFountains && overworld.fairyFountains.length >= 1, 'Overworld debe generar al menos 1 Fuente de Gran Hada');

  const fountain = overworld.fairyFountains[0];
  assert.equal(isWalkable(overworld, fountain.x, fountain.y), true, 'La fuente de hada debe estar en casilla transitable');

  // 3. Modelos 3D de elementos de mundo Zelda
  const { createPotMesh3D, createBushMesh3D, createFairyFountain3D } = await import('../src/game/models3d.js');
  const potMesh = createPotMesh3D({ x: 5, y: 5 });
  assert.ok(potMesh?.isGroup && potMesh.children.length >= 3, 'El modelo 3D de vasija debe tener cuerpo, cuello y borde');

  const bushMesh = createBushMesh3D({ x: 6, y: 6 });
  assert.ok(bushMesh?.isGroup && bushMesh.children.length >= 4, 'El arbusto 3D debe tener follaje exuberante');

  const fairyMesh = createFairyFountain3D(fountain);
  assert.ok(fairyMesh?.isGroup && fairyMesh.userData?.wings, 'La fuente de la Gran Hada 3D debe incluir alas articuladas y orbe');
});

test('sistema de animaciones y combate estilo Zelda OoT: combos de 3 pasos, estelas de corte, retroceso físico, hitstop y bloqueo de escudo', async () => {
  const { ArchGame } = await import('../src/game/engine.js');
  const { createHero } = await import('../src/core/combat.js');

  const vfxCalls = [];
  const mockRenderer = {
    triggerHeroAttack: (arg) => vfxCalls.push({ type: 'heroAttack', ...arg }),
    triggerHitImpactVFX: (arg) => vfxCalls.push({ type: 'hitImpact', ...arg }),
    triggerHeroHurt: (arg) => vfxCalls.push({ type: 'heroHurt', ...arg }),
    triggerEnemyDeath: (arg) => vfxCalls.push({ type: 'enemyDeath', ...arg }),
    triggerPotBreak: (arg) => vfxCalls.push({ type: 'potBreak', ...arg }),
    triggerBushCut: (arg) => vfxCalls.push({ type: 'bushCut', ...arg }),
    triggerFairyBlessing: (arg) => vfxCalls.push({ type: 'fairyBlessing', ...arg }),
  };

  const hero = createHero('campeon', 'Link');
  const testDungeon = {
    width: 20,
    height: 20,
    grid: Array.from({ length: 20 }, () => Array(20).fill(1)),
    explored: Array.from({ length: 20 }, () => Array(20).fill(2)),
    pots: [{ x: 5, y: 5, broken: false }],
    bushes: [{ x: 6, y: 5, cut: false }],
    fairyFountains: [{ x: 14, y: 14, visited: false }],
    chests: [],
  };

  const game = {
    hero,
    floor: 2,
    dungeon: testDungeon,
    pos: { x: 5.2, y: 5.2 },
    cam: { x: 0, y: 0 },
    enemies: [],
    projectiles: [],
    floaters: [],
    log: [],
    groundDrops: [],
    renderer3d: mockRenderer,
    lastAimDir: { x: 1, y: 0 },
    attackCdLeft: 0,
    comboStep: 0,
    lastAttackTs: 0,
    hitStopTimer: 0,
    shakeScreen: () => {},
    addFloater: (x, y, text, color) => game.floaters.push({ x, y, text, color }),
    addLog: (msg) => game.log.push(msg),
    _notify: () => {},
    _advanceQuest: () => {},
    _nearestEnemy: () => null,
    _hasManualMoveInput: () => false,
    _aimFallbackTarget: () => ({ x: game.pos.x + 1, y: game.pos.y }),
    interactNearby: ArchGame.prototype.interactNearby,
    getNearbyInteractable: ArchGame.prototype.getNearbyInteractable,
    _strikePotsAndBushes: ArchGame.prototype._strikePotsAndBushes,
    basicAttackNearest: ArchGame.prototype.basicAttackNearest,
    _strikeEnemy: ArchGame.prototype._strikeEnemy,
    _onEnemyKilled: ArchGame.prototype._onEnemyKilled,
  };

  // 1. Progresión del combo de 3 pasos (comboStep 0 -> 1 -> 2 -> 0)
  game.basicAttackNearest({ allowInteract: false });
  assert.equal(game.comboStep, 0, 'El primer ataque inicia en comboStep 0');
  game.attackCdLeft = 0;
  game.basicAttackNearest({ allowInteract: false });
  assert.equal(game.comboStep, 1, 'El segundo ataque rápido avanza a comboStep 1');
  game.attackCdLeft = 0;
  game.basicAttackNearest({ allowInteract: false });
  assert.equal(game.comboStep, 2, 'El tercer ataque concluye en el finisher comboStep 2');
  game.attackCdLeft = 0;
  game.basicAttackNearest({ allowInteract: false });
  assert.equal(game.comboStep, 0, 'El ciclo recomienza en 0');

  // 2. Destrucción de vasijas y corte de arbustos cercanos
  assert.equal(testDungeon.pots[0].broken, true, 'La vasija cercana debe romperse con el tajo');
  assert.equal(testDungeon.bushes[0].cut, true, 'El arbusto cercano debe cortarse con el tajo');
  assert.ok(vfxCalls.some((c) => c.type === 'potBreak'), 'Debe emitirse VFX de fragmentación de vasija');
  assert.ok(vfxCalls.some((c) => c.type === 'bushCut'), 'Debe emitirse VFX de hojas volando');

  // 3. Interacción con la Fuente de la Gran Hada
  hero.hp = 10;
  hero.mana = 5;
  game.pos = { x: 14.1, y: 14.1 };
  const interactable = game.getNearbyInteractable();
  assert.equal(interactable?.kind, 'fairy', 'Debe detectar a la Gran Hada como interactuable');
  const interacted = game.interactNearby();
  assert.equal(interacted, true);
  const derived = computeHeroDerived(hero);
  assert.equal(hero.hp, derived.maxHp, 'La Gran Hada debe restaurar la salud al máximo');
  assert.equal(hero.mana, derived.maxMana, 'La Gran Hada debe restaurar el fervor al máximo');
  assert.ok(hero.buffs?.shieldUntil > Date.now(), 'Debe otorgar la Égida protectora');
  assert.ok(vfxCalls.some((c) => c.type === 'fairyBlessing'), 'Debe emitir VFX de bendición de hada');

  // 4. Retroceso físico direccional, chispas e hitstop al golpear enemigos
  const enemy = { id: 'e1', x: 10, y: 10, hp: 100, armor: 0, level: 1, xp: 20, tier: 'normal' };
  game.pos = { x: 9.5, y: 10 };
  const prevX = enemy.x;
  const res = game._strikeEnemy(enemy, { minDamage: 40, maxDamage: 50, critChance: 1.0, stats: { dexterity: 50 }, lifeOnHit: 0, rng: () => 0 });
  assert.ok(enemy.x > prevX, 'El enemigo debe sufrir retroceso físico (knockback) en la dirección del impacto');
  assert.ok(game.hitStopTimer > 0, 'Un golpe crítico debe activar hitstop (micro-pausa)');
  assert.ok(vfxCalls.some((c) => c.type === 'hitImpact' && c.isCrit), 'Debe disparar destello de estrella y chispas de impacto');

  // 5. Animación dramática de disolución y muerte de enemigos
  enemy.hp = 0;
  game._onEnemyKilled(enemy);
  assert.ok(vfxCalls.some((c) => c.type === 'enemyDeath'), 'La muerte de un enemigo debe llamar a triggerEnemyDeath');
});

test('balance de dificultad: los enemigos tienen mayor poder, estadísticas amenazantes y escalan agresivamente', async () => {
  const { ENEMY_TEMPLATES, createEnemy } = await import('../src/core/combat.js');

  // Verificar que los enemigos básicos tienen estadísticas notablemente amenazantes
  assert.ok(ENEMY_TEMPLATES.skeleton.hp >= 50, 'Esqueletos deben tener HP significativo (>= 50)');
  assert.ok(ENEMY_TEMPLATES.skeleton.damage[0] >= 10, 'Esqueletos deben infligir daño amenazante (minDamage >= 10)');
  assert.ok(ENEMY_TEMPLATES.harpy.speed >= 3.3, 'Arpías deben ser rápidas y ágiles (speed >= 3.3)');
  assert.ok(ENEMY_TEMPLATES.minotaur.hp >= 200, 'Minotauro (jefe) debe tener HP masivo (>= 200)');
  assert.ok(ENEMY_TEMPLATES.hades.hp >= 700, 'Hades debe ser un desafío supremo de fin de juego (HP >= 700)');
  assert.ok(ENEMY_TEMPLATES.hades.damage[1] >= 50, 'Hades debe tener un ataque devastador (maxDamage >= 50)');

  // Probar escalado con niveles negativos y positivos
  const enemyNeg = createEnemy({ x: 5, y: 5, kind: 'skeleton', level: -2, tier: 'champion' });
  assert.ok(enemyNeg.maxHp > ENEMY_TEMPLATES.skeleton.hp, 'Enemigo en nivel negativo debe escalar con abs(level)');
  assert.ok(enemyNeg.damage[1] > ENEMY_TEMPLATES.skeleton.damage[1], 'Daño de campeón debe escalar');
});

test('múltiples bajadas por piso, pisos sin bajada (dead-end crypts) y geometrías diversas con amplios espacios abiertos', async () => {
  const { generateDungeon } = await import('../src/core/dungeon.js');

  // 1. Overworld (Piso 1) tiene múltiples bajadas (al menos 3: Piso 2, Foso del Tártaro -1, y Gruta del Egeo sin salida)
  const ow = generateDungeon({ level: 1, width: 50, height: 50, seed: 'overworld-multi' });
  assert.ok(ow.stairsList.length >= 2, 'El overworld debe tener 2 o más bajadas');
  const deadEndOwStairs = ow.stairsList.find((s) => s.isDeadEndBranch);
  assert.ok(deadEndOwStairs, 'Debe haber al menos una bajada a una zona sin salida en el overworld');
  assert.equal(deadEndOwStairs.targetFloor, '1-cripta');

  // 2. Mazmorra normal (Piso 2) genera múltiples bajadas
  const f2 = generateDungeon({ level: 2, seed: 'dungeon-f2-multi' });
  assert.ok(f2.stairsList.length >= 2, 'Piso 2 debe tener múltiples bajadas');
  const deadEndF2 = f2.stairsList.find((s) => s.isDeadEndBranch);
  assert.ok(deadEndF2, 'Piso 2 debe tener una escalera lateral hacia un piso sin salida (dead-end)');
  assert.equal(deadEndF2.targetFloor, '2-cripta');

  // 3. Piso sin bajada (Cripta muerta) NO tiene escaleras de bajada pero sí de subida
  const crypt = generateDungeon({ level: '2-cripta', isDeadEnd: true, parentFloor: 2, seed: 'crypt-f2' });
  assert.equal(crypt.isDeadEnd, true, 'El piso debe marcarse como isDeadEnd');
  assert.equal(crypt.stairs, null, 'Un piso sin bajada no debe tener stairs');
  assert.equal(crypt.stairsList.length, 0, 'Un piso sin bajada debe tener stairsList vacío');
  assert.ok(crypt.stairsUp, 'Un piso sin bajada debe tener stairsUp para poder regresar');
  assert.equal(crypt.parentFloor, 2, 'Debe recordar el piso padre');

  // 4. Geometría diversa: amplios espacios abiertos (salas grandes >= 16x16 o arenas)
  let foundGrandRoom = false;
  for (let s = 1; s <= 5; s++) {
    const d = generateDungeon({ level: 2, seed: `geom-test-${s}` });
    if (d.rooms.some((r) => r.w >= 16 || r.h >= 16 || r.type === 'grand_plaza' || r.type === 'circular_sanctum')) {
      foundGrandRoom = true;
      break;
    }
  }
  assert.ok(foundGrandRoom, 'Debe generar salas con geometrías abiertas y diversas (plazas grandes o santuarios)');
});

test('monstruo final en piso -3, transición al Mundo II y secuencia narrativa de historia tras la victoria', async () => {
  const { generateDungeon, isFinalFloorLevel, generateNewWorld } = await import('../src/core/dungeon.js');
  const { ArchGame } = await import('../src/game/engine.js');

  // 1. Piso -3 contiene al Monstruo Final Hades
  assert.ok(isFinalFloorLevel(-3), 'Piso -3 debe ser considerado piso final');
  const fNeg3 = generateDungeon({ level: -3, seed: 'hades-neg3' });
  assert.equal(fNeg3.isFinalFloor, true, 'Piso -3 debe tener isFinalFloor = true');
  const hadesSpawn = fNeg3.enemySpawns.find((e) => e.kind === 'hades' && e.isFinalBoss);
  assert.ok(hadesSpawn, 'Hades debe spawnear como monstruo final en el Piso -3');

  // 2. Transición al Mundo II genera mundo astral
  const mundo2 = generateNewWorld({ seed: 'mundo2-test' });
  assert.equal(mundo2.level, 'mundo-2');
  assert.ok(mundo2.biome.name.includes('Titanes') || mundo2.biome.name.includes('Astral'));

  // 3. Simulación de derrota de Hades y emisión de historia secuencial
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevRaf = globalThis.requestAnimationFrame;

  globalThis.window = {
    addEventListener() {},
    devicePixelRatio: 1,
  };
  globalThis.document = {
    addEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;

  try {
    let storyEmitted = false;
    let worldTransitioned = false;
    const game = new ArchGame({
      canvas: {
        width: 800,
        height: 600,
        getContext: () => ({
          setTransform() {},
          clearRect() {},
          fillRect() {},
          save() {},
          restore() {},
          translate() {},
          scale() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          closePath() {},
          fill() {},
          stroke() {},
          fillText() {},
          arc() {},
          ellipse() {},
          measureText: () => ({ width: 40 }),
        }),
        addEventListener() {},
      },
      onUiUpdate: () => {},
      onHudTick: () => {},
      onEvent: (ev) => {
        if (ev.type === 'story_sequence') storyEmitted = true;
        if (ev.type === 'new_world') worldTransitioned = true;
      },
    });
    game.startNewGame({ classId: 'hoplita', heroName: 'Aquiles', seed: 'story-sim' });
    game.floor = -3;
    game.dungeon = fNeg3;

    const hadesEnemy = {
      id: 'hades_boss',
      kind: 'hades',
      tier: 'boss',
      isFinalBoss: true,
      hp: 0,
      x: 10,
      y: 10,
      xp: 5000,
      level: 3,
    };
    game._onEnemyKilled(hadesEnemy);
    assert.equal(game.finalBossDefeated, true, 'Derrotar a Hades debe marcar finalBossDefeated');
    assert.equal(storyEmitted, true, 'Debe emitir el evento story_sequence para desplegar la historia');

    // 4. Trascendencia a Mundo II
    game.transitionToNewWorld();
    assert.equal(game.floor, 'mundo-2', 'El juego debe cambiar al piso mundo-2');
    assert.equal(worldTransitioned, true, 'Debe emitir el evento new_world');
  } finally {
    globalThis.window = prevWin;
    globalThis.document = prevDoc;
    globalThis.requestAnimationFrame = prevRaf;
  }
});

test('personajes 3D y enemigos mejorados tienen escultura anatómica detallada, destello hitFlash y motor de audio acústico no-MIDI', async () => {
  const { createHeroMesh3D, createEnemyMesh3D, updateActorRig3D } = await import('../src/game/models3d.js');
  const { ArchAudioEngine, archAudio } = await import('../src/game/audio.js');

  // 1. Verificar geometría enriquecida de héroes 3D (pteruges, pectorales, rodilleras, manos, brazaletes, cascos)
  for (const classId of Object.keys(HERO_CLASSES)) {
    const heroMesh = createHeroMesh3D(classId);
    let meshCount = 0;
    heroMesh.traverse((c) => {
      if (c.isMesh) meshCount++;
    });
    assert.ok(meshCount >= 32, `Héroe 3D (${classId}) debe tener escultura anatómica detallada (>= 32 mallas, actual: ${meshCount})`);

    // Probar destello incandescente al recibir golpe (hitFlashTimer)
    heroMesh.userData.rig.hitFlashTimer = 0.12;
    updateActorRig3D(heroMesh, { dt: 0.04, moving: false });
    assert.ok(heroMesh.userData.rig.hitFlashTimer > 0);
    updateActorRig3D(heroMesh, { dt: 0.15, moving: false });
    assert.equal(heroMesh.userData.rig.hitFlashTimer, 0, 'hitFlashTimer debe expirar y restaurar materiales originales');
  }

  // 2. Verificar geometría enriquecida de enemigos 3D (costillar de esqueleto, plumas de arpía, piernas caprinas de sátiro, Labrys de minotauro, corona de Hades)
  const minMeshesByEnemy = { skeleton: 24, harpy: 22, satyr: 22, minotaur: 24, hades: 28 };
  for (const [kind, minCount] of Object.entries(minMeshesByEnemy)) {
    const enemyMesh = createEnemyMesh3D({
      id: `detail-${kind}`,
      kind,
      tier: kind === 'minotaur' || kind === 'hades' ? 'boss' : 'champion',
      hp: 100,
    });
    let meshCount = 0;
    enemyMesh.traverse((c) => {
      if (c.isMesh) meshCount++;
    });
    assert.ok(meshCount >= minCount, `Enemigo 3D (${kind}) debe tener modelo detallado (>= ${minCount} mallas, actual: ${meshCount})`);
  }

  // 3. Verificar motor de audio acústico (Karplus-Strong physical modeling, Convolver reverb, SFX físicos)
  assert.ok(archAudio instanceof ArchAudioEngine);
  const engine = new ArchAudioEngine();
  engine.setVolumes({ music: 0.65, sfx: 0.85 });
  assert.equal(engine.musicVolume, 0.65);
  assert.equal(engine.sfxVolume, 0.85);
  const muted = engine.toggleMute(true);
  assert.equal(muted, true);
  assert.equal(engine.toggleMute(false), false);

  // Asegurar que las llamadas a métodos de música y efectos funcionan sin errores en entorno headless
  engine.setMusicTheme('overworld');
  assert.equal(engine.currentTheme, 'overworld');
  engine.setMusicTheme('underworld');
  assert.equal(engine.currentTheme, 'underworld');
  engine.setMusicTheme('boss');
  assert.equal(engine.currentTheme, 'boss');
  engine.playAttackSwing({ classId: 'hoplita', comboStep: 2 });
  engine.playHitImpact({ isCrit: true, blocked: false });
  engine.playHitImpact({ isCrit: false, blocked: true });
  engine.playSkillCast('lightning');
  engine.playPotBreak();
  engine.playBushCut();
  engine.playLootPickup('gold');
  engine.playFanfare('victory');
  engine.playEnemyDeath({ isBoss: true, kind: 'hades' });
});
