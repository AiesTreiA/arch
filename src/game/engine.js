/**
 * engine.js — Motor isométrico 2:1 en Canvas 2D para ARCH (Vertical Slice v0.1).
 * Integra generación procedural, niebla de guerra, IA de enemigos, combate, habilidades y botín.
 */
import {
  FINAL_FLOOR,
  generateDungeon,
  getZoneAt,
  isWalkable,
  TILE_FLOOR,
  TILE_SHRINE,
  TILE_STAIRS,
  TILE_STAIRS_UP,
  TILE_WALL,
  updateVisibility,
} from '../core/dungeon.js';
import {
  allocateSkillPoint,
  computeHeroDerived,
  createEnemy,
  createHero,
  grantHeroXp,
  HERO_CLASSES,
  resolveStrike,
} from '../core/combat.js';
import { compareItems, generateItem, getItemPowerScore, getItemSalvageValue, rollEnemyDrop } from '../core/loot.js';
import { ArchRenderer3D } from './models3d.js';

const TILE_W = 56;
const TILE_H = 28;
const WALL_H = 22;

function toIso(gx, gy) {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2),
  };
}

function toGrid(isoX, isoY) {
  return {
    x: (isoX / (TILE_W / 2) + isoY / (TILE_H / 2)) / 2,
    y: (isoY / (TILE_H / 2) - isoX / (TILE_W / 2)) / 2,
  };
}

export class ArchGame {
  constructor({ canvas, onUiUpdate, onHudTick = null, onEvent = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onUiUpdate = onUiUpdate;
    this.onHudTick = onHudTick;
    this.onEvent = onEvent;

    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.attackHeld = false;
    this.lastAimDir = { x: 1, y: 0 };
    this._hudTickAcc = 0;
    this.projectiles = [];
    this.floaters = [];
    this.groundDrops = [];
    this.enemies = [];
    this.log = [];
    this.seed = 'olimpia-01';
    this.floor = 1;
    this.running = false;
    this.gameOver = false;
    this.finalBossDefeated = false;
    this.endlessUnlocked = false;
    this.currentZoneId = null;
    this.discoveredZones = new Set();
    this.lastTs = 0;
    this.lastDt = 0.016;
    this.attackCdLeft = 0;
    this.attackQueued = false;
    this.attackBufferTimer = 0;
    this.screenShake = 0;
    this.vfx2d = [];
    this.skillQCd = 0;
    this.skillECd = 0;
    this.moveTarget = null;
    this.attackTargetId = null;
    this.zoom = 1.15;

    this.hero = createHero('hoplita');
    this.pos = { x: 4, y: 4 };
    this.cam = { x: 0, y: 0 };
    this.dungeon = null;
    this.floorCache = new Map();

    this.renderer3d = new ArchRenderer3D(this.canvas);
    this.renderer3d.setZoom(this.zoom);

    this._bindEvents();
    this._resize();
  }

  shakeScreen(amount = 0.3) {
    this.screenShake = Math.min(1.0, (this.screenShake || 0) + amount);
  }

  _bindEvents() {
    const scheduleResize = () => {
      this._resize();
      requestAnimationFrame(() => this._resize());
    };
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', () => setTimeout(scheduleResize, 120));
    document.addEventListener('fullscreenchange', () => setTimeout(scheduleResize, 80));
    window.visualViewport?.addEventListener('resize', scheduleResize);
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this._resizeObserver = new ResizeObserver(() => this._resize());
      this._resizeObserver.observe(this.canvas.parentElement);
    }

    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = (e.key || '').toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        if (this.running) e.preventDefault?.();
      }
      this.keys.add(k);
      if (!this.running || this.gameOver) return;
      if (k === 'q') this.castSkill('q');
      else if (k === 'e') this.castSkill('e');
      else if (k === '1' || k === 'r') this.usePotion();
      else if (k === 'f') {
        e.preventDefault?.();
        if (!e.repeat) this.interactNearby();
      } else if (k === ' ') {
        if (this.attackCdLeft <= 0) {
          this.basicAttackNearest({ allowInteract: !e.repeat });
        } else {
          this.attackQueued = true;
          this.attackBufferTimer = 0.28;
        }
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete((e.key || '').toLowerCase()));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.joystick.x = 0;
      this.joystick.y = 0;
      this.attackHeld = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.running) return;
        e.preventDefault();
        this.adjustZoom(e.deltaY < 0 ? 0.12 : -0.12);
      },
      { passive: false }
    );

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.running || this.gameOver) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = (sx - this.viewW / 2) / this.zoom + this.cam.x;
      const worldY = (sy - this.viewH / 2) / this.zoom + this.cam.y;
      const g = toGrid(worldX, worldY);

      // ¿Clic sobre la Sibila del Campamento?
      if (this.dungeon?.npc && Math.hypot(this.dungeon.npc.x - g.x, this.dungeon.npc.y - g.y) < 1.1) {
        if (Math.hypot(this.dungeon.npc.x - this.pos.x, this.dungeon.npc.y - this.pos.y) <= 2.2) {
          this._interactWithNpc(this.dungeon.npc);
        } else {
          this.moveTarget = { x: this.dungeon.npc.x, y: this.dungeon.npc.y };
        }
        return;
      }

      // ¿Clic sobre un drop cercano?
      const drop = this.groundDrops.find((d) => Math.hypot(d.x - g.x, d.y - g.y) < 0.9);
      if (drop) {
        this.moveTarget = { x: drop.x, y: drop.y };
        this.attackTargetId = null;
        return;
      }

      // ¿Clic sobre un enemigo vivo?
      const target = this.enemies.find((en) => en.hp > 0 && Math.hypot(en.x - g.x, en.y - g.y) < 1.15);
      if (target) {
        this.attackTargetId = target.id;
        this.moveTarget = { x: target.x, y: target.y };
        return;
      }

      this.attackTargetId = null;
      if (isWalkable(this.dungeon, g.x, g.y)) {
        this.moveTarget = { x: g.x, y: g.y };
      }
    });
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = Math.max(200, Math.floor(rect.width));
    this.viewH = Math.max(200, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer3d?.resize(this.viewW, this.viewH);
  }

  setZoom(nextZoom) {
    this.zoom = Math.max(0.75, Math.min(2.1, Number(nextZoom.toFixed(2))));
    this.renderer3d?.setZoom(this.zoom);
    this._emitHudTick();
  }

  adjustZoom(delta) {
    this.setZoom(this.zoom + delta);
  }

  setJoystick(x, y) {
    const mag = Math.hypot(x, y);
    if (mag > 1) {
      this.joystick.x = x / mag;
      this.joystick.y = y / mag;
    } else {
      this.joystick.x = x;
      this.joystick.y = y;
    }
  }

  setAttackHeld(held) {
    this.attackHeld = Boolean(held);
    if (this.attackHeld && this.running && !this.gameOver) {
      this.basicAttackNearest({ allowInteract: false });
    }
  }

  _hasManualMoveInput() {
    if (
      this.keys.has('w') ||
      this.keys.has('s') ||
      this.keys.has('a') ||
      this.keys.has('d') ||
      this.keys.has('arrowup') ||
      this.keys.has('arrowdown') ||
      this.keys.has('arrowleft') ||
      this.keys.has('arrowright')
    ) {
      return true;
    }
    return Math.hypot(this.joystick.x, this.joystick.y) > 0.08;
  }

  startNewGame({ classId = 'hoplita', heroName = '', seed = 'olimpia-01' } = {}) {
    this.seed = (seed || 'olimpia-01').trim();
    this.floor = 1;
    this.dungeon = null;
    this.floorCache = new Map();
    this.hero = createHero(classId, heroName);
    const derived = computeHeroDerived(this.hero);
    this.hero.hp = derived.maxHp;
    this.hero.mana = derived.maxMana;
    this.gameOver = false;
    this.finalBossDefeated = false;
    this.endlessUnlocked = false;
    this.currentZoneId = null;
    this.discoveredZones = new Set();
    this.attackCdLeft = 0;
    this.attackQueued = false;
    this.attackBufferTimer = 0;
    this.screenShake = 0;
    this.vfx2d = [];
    this.skillQCd = 0;
    this.skillECd = 0;
    this.attackHeld = false;
    this.joystick = { x: 0, y: 0 };
    this.lastAimDir = { x: 1, y: 0 };
    this.log = [];
    this._loadFloor(1, { entry: 'spawn', savePrevious: false });
    this.addLog(`Sibila de Cumas: «Bienvenido a la Hélade, ${this.hero.className}. Cruza Arcadia y Delfos hasta las Fauces del Tártaro».`);
    this.addLog(this.hero.prologue);
    if (!this.running) {
      this.running = true;
      this.lastTs = performance.now();
      requestAnimationFrame((ts) => this._loop(ts));
    }
    this._notify();
  }

  /** Elige una casilla caminable adyacente al portal/escalera para aparecer sin solaparse con el arco 3D ni el NPC. */
  _findEntryPosNear(anchor, preferredOffsets = [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    if (!anchor || !this.dungeon) return { ...(this.dungeon?.spawn || { x: 4, y: 4 }) };
    const fallbackOffsets = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
    const seen = new Set();
    for (const [dx, dy] of [...preferredOffsets, ...fallbackOffsets]) {
      const key = `${dx},${dy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tx = anchor.x + dx;
      const ty = anchor.y + dy;
      if (ty < 0 || ty >= this.dungeon.height || tx < 0 || tx >= this.dungeon.width) continue;
      if (this.dungeon.grid[ty]?.[tx] !== TILE_FLOOR) continue;
      if (
        this.dungeon.npc &&
        Math.hypot(this.dungeon.npc.x - (tx + 0.5), this.dungeon.npc.y - (ty + 0.5)) < 0.7
      ) {
        continue;
      }
      return { x: tx + 0.5, y: ty + 0.5 };
    }
    return { x: anchor.x + 0.5, y: anchor.y + 0.5 };
  }

  _loadFloor(floor, { entry = 'spawn', savePrevious = true } = {}) {
    if (savePrevious && this.dungeon && this.floor != null) {
      this.floorCache?.set(this.floor, {
        dungeon: this.dungeon,
        enemies: this.enemies,
        groundDrops: this.groundDrops,
      });
    }

    this.floor = floor;
    const cached = this.floorCache?.get(floor);
    if (cached) {
      this.dungeon = cached.dungeon;
      this.enemies = cached.enemies;
      this.groundDrops = cached.groundDrops;
    } else {
      const size = floor === 1 ? 48 : 44;
      this.dungeon = generateDungeon({ width: size, height: size, level: floor, seed: this.seed });
      this.groundDrops = [];
      this.enemies = this.dungeon.enemySpawns.map((s, idx) => createEnemy(s, `e-${floor}-${idx}`));
    }

    if (entry === 'stairsUp' && this.dungeon.stairsUp) {
      this.pos = this._findEntryPosNear(this.dungeon.stairsUp, [[1, 0], [0, 1], [0, -1], [-1, 0]]);
    } else if (entry === 'stairsDown' && this.dungeon.stairs) {
      this.pos = this._findEntryPosNear(this.dungeon.stairs, [[0, 1], [-1, 0], [1, 0], [0, -1]]);
    } else {
      this.pos = { ...this.dungeon.spawn };
    }

    this.projectiles = [];
    this.floaters = [];
    this.moveTarget = null;
    this.attackTargetId = null;
    this.attackQueued = false;
    this.attackBufferTimer = 0;

    updateVisibility(this.dungeon, this.pos.x, this.pos.y, floor === 1 ? 11 : 8);
    const startZone = getZoneAt(this.dungeon, this.pos.x, this.pos.y);
    this.currentZoneId = startZone?.id || null;
    if (startZone) this.discoveredZones.add(startZone.id);
    const iso = toIso(this.pos.x, this.pos.y);
    this.cam.x = iso.x;
    this.cam.y = iso.y;
    this.renderer3d?.buildDungeon(this.dungeon);
    const prefix = floor === 1 ? 'Superficie' : floor <= FINAL_FLOOR ? `Piso ${floor}/${FINAL_FLOOR}` : `Abismo ${floor}`;
    this.addLog(`${prefix}: ${this.dungeon.biome.name}.`);
    if (!cached && floor === FINAL_FLOOR && !this.finalBossDefeated) {
      this.addLog('¡Has alcanzado el Trono del Tártaro! Derrota a Hades, Soberano de los Muertos.');
    }
  }

  addLog(msg) {
    this.log.unshift(msg);
    if (this.log.length > 10) this.log.length = 10;
  }

  addFloater(x, y, text, color = '#f8fafc', options = {}) {
    const opts = typeof options === 'object' && options !== null ? options : {};
    const str = String(text);
    const isLoot = opts.kind === 'loot' || str.startsWith('+') || str.startsWith('Recog');
    const duration = opts.duration || (isLoot ? 1.45 : 1.15);
    this.floaters.push({
      x,
      y,
      text: str,
      color: color || '#f8fafc',
      kind: opts.kind || (isLoot ? 'loot' : 'default'),
      life: duration,
      maxLife: duration,
      createdAt: performance.now(),
    });
  }

  allocateStat(statKey) {
    if (this.hero.statPoints <= 0) return;
    if (!(statKey in this.hero.baseStats)) return;
    this.hero.baseStats[statKey] += 1;
    this.hero.statPoints -= 1;
    const derived = computeHeroDerived(this.hero);
    this.hero.hp = Math.min(derived.maxHp, this.hero.hp + 5);
    this.hero.mana = Math.min(derived.maxMana, this.hero.mana + 4);
    this._notify();
  }

  allocateSkill(treeIndex) {
    if (!allocateSkillPoint(this.hero, treeIndex)) return;
    const cls = HERO_CLASSES[this.hero.classId];
    const branchName = cls.trees[treeIndex] || `Rama ${treeIndex + 1}`;
    const derived = computeHeroDerived(this.hero);
    this.hero.hp = Math.min(derived.maxHp, this.hero.hp + 6);
    this.hero.mana = Math.min(derived.maxMana, this.hero.mana + 4);
    this.addFloater(this.pos.x, this.pos.y, `+1 ${branchName}`, '#facc15');
    this.addLog(`Talento aprendido: ${branchName} (Sinergia: +${derived.synergyBonusPct}%).`);
    this._notify();
  }

  equipItem(itemId) {
    const idx = this.hero.inventory.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const item = this.hero.inventory[idx];
    const prev = this.hero.equipment[item.slot];
    this.hero.equipment[item.slot] = item;
    this.hero.inventory.splice(idx, 1);
    if (prev) this.hero.inventory.push(prev);
    const d = computeHeroDerived(this.hero);
    this.hero.hp = Math.min(d.maxHp, this.hero.hp);
    this.hero.mana = Math.min(d.maxMana, this.hero.mana);
    this.addLog(`Equipado: ${item.name}.`);
    this._notify();
  }

  unequipItem(slot) {
    const current = this.hero.equipment[slot];
    if (!current) return false;
    if (this.hero.inventory.length >= 16) {
      this.addFloater(this.pos.x, this.pos.y, 'Mochila llena', '#f87171');
      this.addLog('Tu mochila está llena (16/16). Ofrenda o suelta un ítem primero.');
      return false;
    }
    this.hero.equipment[slot] = null;
    this.hero.inventory.push(current);
    const d = computeHeroDerived(this.hero);
    this.hero.hp = Math.min(d.maxHp, this.hero.hp);
    this.hero.mana = Math.min(d.maxMana, this.hero.mana);
    this.addLog(`Guardado en mochila: ${current.name}.`);
    this._notify();
    return true;
  }

  salvageItem(itemId) {
    const idx = this.hero.inventory.findIndex((i) => i.id === itemId);
    if (idx < 0) return 0;
    const [removed] = this.hero.inventory.splice(idx, 1);
    const goldGain = getItemSalvageValue(removed);
    this.hero.gold += goldGain;
    this.addFloater(this.pos.x, this.pos.y, `+${goldGain} dracmas`, '#facc15');
    this.addLog(`Ofrendaste ${removed.name} por ${goldGain} dracmas.`);
    this._notify();
    return goldGain;
  }

  sortInventory() {
    const rank = { unique: 4, rare: 3, magic: 2, common: 1 };
    this.hero.inventory.sort((a, b) => {
      const rDiff = (rank[b.rarity] || 0) - (rank[a.rarity] || 0);
      if (rDiff !== 0) return rDiff;
      const pDiff = getItemPowerScore(b, this.hero.classId) - getItemPowerScore(a, this.hero.classId);
      if (pDiff !== 0) return pDiff;
      return (b.ilvl || 1) - (a.ilvl || 1);
    });
    this._notify();
  }

  autoEquipBest() {
    if (!this.hero || !this.hero.inventory || this.hero.inventory.length === 0) {
      this.addFloater(this.pos.x, this.pos.y, 'Mochila vacía', '#94a3b8');
      return 0;
    }

    const slots = ['weapon', 'armor', 'charm'];
    let equippedCount = 0;

    for (const slot of slots) {
      const currentEquipped = this.hero.equipment[slot];
      const curScore = currentEquipped ? getItemPowerScore(currentEquipped, this.hero.classId) : -Infinity;

      let bestScore = curScore;
      let bestItem = null;

      for (const item of this.hero.inventory) {
        if (item.slot !== slot) continue;
        const score = getItemPowerScore(item, this.hero.classId);
        if (score > bestScore) {
          bestScore = score;
          bestItem = item;
        }
      }

      if (bestItem) {
        this.equipItem(bestItem.id);
        equippedCount++;
      }
    }

    if (equippedCount > 0) {
      this.addFloater(this.pos.x, this.pos.y, `¡Equipado lo superior! (+${equippedCount})`, '#4ade80');
      this.addLog(`Auto-equipado: se equiparon ${equippedCount} objeto(s) superior(es).`);
    } else {
      this.addFloater(this.pos.x, this.pos.y, 'Ya tienes tu mejor equipo', '#94a3b8');
      this.addLog('Ya tienes equipado el mejor equipo disponible en tu mochila.');
    }
    this._notify();
    return equippedCount;
  }

  salvageInferiorItems() {
    if (!this.hero || !this.hero.inventory || this.hero.inventory.length === 0) {
      this.addFloater(this.pos.x, this.pos.y, 'Mochila vacía', '#94a3b8');
      return { count: 0, goldGain: 0 };
    }

    const toSalvage = [];
    for (const item of this.hero.inventory) {
      const equipped = this.hero.equipment[item.slot];
      const cmp = compareItems(item, equipped, this.hero.classId);
      if (cmp.verdict === 'worse') {
        toSalvage.push(item);
      }
    }

    if (toSalvage.length === 0) {
      this.addFloater(this.pos.x, this.pos.y, 'Sin objetos inferiores', '#94a3b8');
      this.addLog('No tienes objetos inferiores para ofrendar.');
      return { count: 0, goldGain: 0 };
    }

    let totalGold = 0;
    const inferiorIds = new Set(toSalvage.map((i) => i.id));
    this.hero.inventory = this.hero.inventory.filter((item) => {
      if (inferiorIds.has(item.id)) {
        totalGold += getItemSalvageValue(item);
        return false;
      }
      return true;
    });

    this.hero.gold += totalGold;
    this.addFloater(this.pos.x, this.pos.y, `+${totalGold} dracmas`, '#facc15');
    this.addLog(`Ofrendaste ${toSalvage.length} objeto(s) inferior(es) por ${totalGold} dracmas.`);
    this._notify();
    return { count: toSalvage.length, goldGain: totalGold };
  }

  dropInventoryItem(itemId) {
    const idx = this.hero.inventory.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const [removed] = this.hero.inventory.splice(idx, 1);
    this.groundDrops.push({
      x: this.pos.x,
      y: this.pos.y,
      kind: 'item',
      item: removed,
      dropCooldown: 2.5,
    });
    this.addLog(`Soltaste al suelo: ${removed.name}.`);
    this._notify();
  }

  usePotion() {
    if (this.hero.potions <= 0 || this.gameOver) return;
    const derived = computeHeroDerived(this.hero);
    if (this.hero.hp >= derived.maxHp && this.hero.mana >= derived.maxMana) return;
    this.hero.potions -= 1;
    const heal = Math.round(derived.maxHp * 0.45);
    const manaGain = Math.round(derived.maxMana * 0.35);
    this.hero.hp = Math.min(derived.maxHp, this.hero.hp + heal);
    this.hero.mana = Math.min(derived.maxMana, this.hero.mana + manaGain);
    this.addFloater(this.pos.x, this.pos.y, `+${heal} HP`, '#4ade80');
    this._notify();
  }

  /** Devuelve el objeto interactuable cercano de mayor prioridad para el botón contextual [F]. */
  getNearbyInteractable() {
    if (!this.dungeon) return null;

    for (const c of this.dungeon.chests) {
      if (!c.opened && Math.hypot(c.x - this.pos.x, c.y - this.pos.y) <= 1.7) {
        return { kind: 'chest', label: 'Cofre', hint: 'Abrir Cofre Antiguo', target: c };
      }
    }

    if (this.dungeon.shrine && !this.dungeon.shrine.used) {
      const ds = Math.hypot(this.dungeon.shrine.x + 0.5 - this.pos.x, this.dungeon.shrine.y + 0.5 - this.pos.y);
      if (ds <= 1.7) {
        return { kind: 'shrine', label: 'Altar', hint: 'Bendición de Asclepio', target: this.dungeon.shrine };
      }
    }

    const tx = Math.floor(this.pos.x);
    const ty = Math.floor(this.pos.y);
    const curTile = this.dungeon.grid[ty]?.[tx];
    const distDown = this.dungeon.stairs
      ? Math.hypot(this.dungeon.stairs.x + 0.5 - this.pos.x, this.dungeon.stairs.y + 0.5 - this.pos.y)
      : Infinity;
    const distUp = this.dungeon.stairsUp
      ? Math.hypot(this.dungeon.stairsUp.x + 0.5 - this.pos.x, this.dungeon.stairsUp.y + 0.5 - this.pos.y)
      : Infinity;
    const canDown = Boolean(this.dungeon.stairs) && (curTile === TILE_STAIRS || distDown <= 1.35);
    const canUp = this.floor > 1 && Boolean(this.dungeon.stairsUp) && (curTile === TILE_STAIRS_UP || distUp <= 1.35);

    if (canDown || canUp) {
      const preferUp =
        canUp && (!canDown || curTile === TILE_STAIRS_UP || (curTile !== TILE_STAIRS && distUp < distDown));
      if (preferUp) {
        const prevFloor = this.floor - 1;
        return {
          kind: 'stairsUp',
          label: prevFloor === 1 ? '▲ Tierra 1' : `▲ Piso ${prevFloor}`,
          hint: prevFloor === 1 ? 'Subir a la Superficie (Tierra 1)' : `Subir al Piso ${prevFloor}`,
          target: this.dungeon.stairsUp,
        };
      }
      if (this.floor === FINAL_FLOOR && !this.finalBossDefeated) {
        return {
          kind: 'stairs',
          locked: true,
          label: 'Sellado',
          hint: 'Derrota a Hades antes de continuar',
          target: this.dungeon.stairs,
        };
      }
      if (this.floor === 1) {
        return {
          kind: 'stairs',
          label: 'Inframundo',
          hint: 'Entrar al Inframundo (Piso 2)',
          target: this.dungeon.stairs,
        };
      }
      if (this.floor === FINAL_FLOOR && this.finalBossDefeated) {
        return {
          kind: 'stairs',
          label: 'Abismo 23',
          hint: 'Entrar al Modo Abismo Infinito (Piso 23)',
          target: this.dungeon.stairs,
        };
      }
      return {
        kind: 'stairs',
        label: `▼ Piso ${this.floor + 1}`,
        hint: `Descender al Piso ${this.floor + 1}`,
        target: this.dungeon.stairs,
      };
    }

    if (this.dungeon.npc) {
      const dn = Math.hypot(this.dungeon.npc.x - this.pos.x, this.dungeon.npc.y - this.pos.y);
      if (dn <= 2.2) {
        return { kind: 'npc', label: 'Sibila', hint: 'Hablar con la Sibila', target: this.dungeon.npc };
      }
    }

    return null;
  }

  _interactWithNpc(npc = this.dungeon?.npc) {
    if (!npc) return false;
    npc.talked = true;
    const derived = computeHeroDerived(this.hero);
    this.hero.hp = derived.maxHp;
    this.hero.mana = derived.maxMana;
    const pending = this.hero.quests.find((q) => !q.completed);
    const quote = pending
      ? `${pending.desc} (${pending.progress}/${pending.targetCount})`
      : 'Has cumplido los 3 Oráculos del Estigia, héroe inmortal.';
    this.addLog(`${npc.name}: «${quote}».`);
    const label = this.dungeon?.isOverworld ? 'Oráculo de la Sibila' : npc.name;
    this.addFloater(npc.x, npc.y, `${label} (Salud restaurada)`, '#facc15');
    this.onEvent?.({
      type: 'oracle',
      title: npc.name,
      message: `${quote} (Salud y fervor restaurados)`,
    });
    this._notify();
    return true;
  }

  _changeFloor(targetFloor, entry, logMessage) {
    this.addLog(logMessage);
    this._loadFloor(targetFloor, { entry });
    const title =
      this.floor === 1
        ? `Tierra 1/${FINAL_FLOOR}`
        : this.floor <= FINAL_FLOOR
        ? `Piso ${this.floor}/${FINAL_FLOOR}`
        : `Abismo · Piso ${this.floor}`;
    this.onEvent?.({
      type: 'floor',
      title,
      message: this.dungeon?.biome?.name || (entry === 'stairsDown' ? 'Ascenso' : 'Nuevo descenso'),
    });
    this._notify();
    return true;
  }

  interactNearby() {
    const near = this.getNearbyInteractable();
    if (!near) return false;

    if (near.kind === 'chest') {
      const c = near.target;
      c.opened = true;
      const item = generateItem({
        level: this.floor,
        tier: 'champion',
        preferredClass: this.hero.classId,
        seed: `${this.seed}:chest:${this.floor}:${c.x}`,
      });
      this.groundDrops.push({ x: c.x, y: c.y, kind: 'item', item });
      this.groundDrops.push({ x: c.x + 0.25, y: c.y, kind: 'gold', amount: 22 * this.floor });
      this.addFloater(c.x, c.y, 'Cofre Antiguo abierto', '#facc15');
      this._advanceQuest('obolo_caronte', 1, c.x, c.y);
      this._notify();
      return true;
    }

    if (near.kind === 'shrine') {
      this.dungeon.shrine.used = true;
      const derived = computeHeroDerived(this.hero);
      this.hero.hp = derived.maxHp;
      this.hero.mana = derived.maxMana;
      this.addFloater(this.pos.x, this.pos.y, 'Bendición de Asclepio', '#38bdf8');
      this.addLog('El altar restauró toda tu salud y fervor.');
      this.onEvent?.({ type: 'shrine', title: 'Altar de Asclepio', message: 'Salud y fervor restaurados por completo.' });
      this._notify();
      return true;
    }

    if (near.kind === 'stairsUp') {
      if (this.floor <= 1) return false;
      const targetFloor = this.floor - 1;
      const msg =
        targetFloor === 1 ? 'Subes a la Superficie (Hélade)...' : `Subes al piso ${targetFloor}...`;
      return this._changeFloor(targetFloor, 'stairsDown', msg);
    }

    if (near.kind === 'stairs') {
      if (near.locked) {
        this.addFloater(this.pos.x, this.pos.y, '¡Derrota a Hades primero!', '#f97316');
        this.addLog('El portal del Tártaro está sellado mientras Hades viva en el Piso 22.');
        return false;
      }
      const targetFloor = this.floor + 1;
      return this._changeFloor(targetFloor, 'stairsUp', `Desciendes al piso ${targetFloor}...`);
    }

    if (near.kind === 'npc') {
      return this._interactWithNpc(near.target);
    }

    return false;
  }

  _nearestEnemy(maxDist = 9) {
    let best = null;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  _aimFallbackTarget() {
    return {
      x: this.pos.x + (this.lastAimDir?.x ?? 1),
      y: this.pos.y + (this.lastAimDir?.y ?? 0),
    };
  }

  basicAttackNearest({ allowInteract = true } = {}) {
    if (this.gameOver) return;
    if (this.attackCdLeft > 0) {
      this.attackQueued = true;
      this.attackBufferTimer = 0.28;
      return;
    }
    const derived = computeHeroDerived(this.hero);
    const inRangeTarget =
      (this.attackTargetId && this.enemies.find((e) => e.id === this.attackTargetId && e.hp > 0)) ||
      this._nearestEnemy(derived.range + 0.8);

    if (!inRangeTarget && allowInteract && this.interactNearby()) {
      return;
    }

    const visibleChaseTarget =
      !inRangeTarget && !this._hasManualMoveInput()
        ? (() => {
            const candidate = this._nearestEnemy(6.0);
            if (!candidate) return null;
            const vis = this.dungeon?.explored[Math.floor(candidate.y)]?.[Math.floor(candidate.x)] === 2;
            return vis ? candidate : null;
          })()
        : null;

    if (visibleChaseTarget) {
      this.attackTargetId = visibleChaseTarget.id;
      this.moveTarget = { x: visibleChaseTarget.x, y: visibleChaseTarget.y };
      return;
    }

    const target = inRangeTarget;
    if (target) {
      const dist = Math.hypot(target.x - this.pos.x, target.y - this.pos.y);
      if (dist > derived.range + 0.4) {
        if (!this._hasManualMoveInput()) {
          this.moveTarget = { x: target.x, y: target.y };
          return;
        }
      } else {
        const ang = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
        this.lastAimDir = { x: Math.cos(ang), y: Math.sin(ang) };
        this.attackCdLeft = derived.attackCd;
        this.renderer3d?.triggerHeroAttack({ whirlwind: false });
        if (derived.range > 2.2) {
          this.projectiles.push({
            fromHero: true,
            x: this.pos.x,
            y: this.pos.y,
            vx: Math.cos(ang) * 22,
            vy: Math.sin(ang) * 22,
            life: 0.85,
            minDmg: derived.minDamage,
            maxDmg: derived.maxDamage,
            critChance: derived.critChance,
            color: HERO_CLASSES[this.hero.classId].color,
          });
        } else {
          this._strikeEnemy(target, derived);
        }
        return;
      }
    }

    // Respuesta inmediata al tocar Atacar (incluso en movimiento / sin blanco cercano)
    this.attackCdLeft = derived.attackCd;
    this.renderer3d?.triggerHeroAttack({ whirlwind: false });
    if (derived.range > 2.2) {
      const aim = this._aimFallbackTarget();
      const ang = Math.atan2(aim.y - this.pos.y, aim.x - this.pos.x);
      this.projectiles.push({
        fromHero: true,
        x: this.pos.x,
        y: this.pos.y,
        vx: Math.cos(ang) * 22,
        vy: Math.sin(ang) * 22,
        life: 0.85,
        minDmg: derived.minDamage,
        maxDmg: derived.maxDamage,
        critChance: derived.critChance,
        color: HERO_CLASSES[this.hero.classId].color,
      });
    }
  }

  castSkill(slot) {
    const cls = HERO_CLASSES[this.hero.classId];
    const skill = cls.skills[slot];
    if (!skill) return;
    if (slot === 'q' && this.skillQCd > 0) return;
    if (slot === 'e' && this.skillECd > 0) return;
    if (this.hero.mana < skill.cost) {
      this.addFloater(this.pos.x, this.pos.y, 'Sin fervor', '#94a3b8');
      return;
    }

    this.hero.mana -= skill.cost;
    if (slot === 'q') this.skillQCd = skill.cd;
    else this.skillECd = skill.cd;
    this.renderer3d?.triggerHeroAttack({ whirlwind: this.hero.classId === 'campeon' && slot === 'q' });

    const rawDerived = computeHeroDerived(this.hero);
    const pMult = rawDerived.skillPowerMult || 1;
    const derived = {
      ...rawDerived,
      minDamage: Math.round(rawDerived.minDamage * pMult),
      maxDamage: Math.round(rawDerived.maxDamage * pMult),
    };
    const now = Date.now();

    if (this.hero.classId === 'campeon') {
      if (slot === 'q') {
        let hits = 0;
        let totalDmg = 0;
        let isCrit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.pos.x, e.y - this.pos.y) <= 2.8) {
            const res = this._strikeEnemy(e, {
              ...derived,
              minDamage: derived.minDamage * 1.45,
              maxDamage: derived.maxDamage * 1.65,
              lifeOnHit: derived.lifeOnHit + 4,
            });
            if (res?.hit) {
              hits++;
              totalDmg += res.damage;
              if (res.crit) isCrit = true;
            }
          }
        }
        const effectDmg = totalDmg > 0 ? totalDmg : Math.round(derived.maxDamage * 1.55);
        this.shakeScreen(Math.min(0.65, 0.25 + (effectDmg / 60) * 0.25));
        this.renderer3d?.triggerSkillVFX({
          type: 'whirlwind',
          x: this.pos.x,
          y: this.pos.y,
          damage: effectDmg,
          isCrit,
        });
        this.addFloater(this.pos.x, this.pos.y, hits ? '¡Torbellino Tracio!' : 'Torbellino', '#ef4444');
      } else {
        this.hero.buffs.furyUntil = now + 5500;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
          if (d <= 3.2) {
            const nx = e.x + ((e.x - this.pos.x) / Math.max(0.2, d)) * 1.2;
            const ny = e.y + ((e.y - this.pos.y) / Math.max(0.2, d)) * 1.2;
            if (isWalkable(this.dungeon, nx, ny)) { e.x = nx; e.y = ny; }
          }
        }
        const shoutDmg = Math.round(derived.maxDamage * 1.45);
        this.shakeScreen(0.35);
        this.renderer3d?.triggerSkillVFX({
          type: 'shout',
          x: this.pos.x,
          y: this.pos.y,
          damage: shoutDmg,
          color: '#fb923c',
        });
        this.addFloater(this.pos.x, this.pos.y, '¡Grito de Fobos!', '#fb923c');
      }
    } else if (this.hero.classId === 'hoplita') {
      if (slot === 'q') {
        let hitCount = 0;
        let totalDmg = 0;
        let isCrit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
          if (d <= 2.6) {
            const res = this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.4, maxDamage: derived.maxDamage * 1.5 });
            if (res?.hit) {
              hitCount++;
              totalDmg += res.damage;
              if (res.crit) isCrit = true;
            }
            const nx = e.x + ((e.x - this.pos.x) / Math.max(0.2, d)) * 0.95;
            const ny = e.y + ((e.y - this.pos.y) / Math.max(0.2, d)) * 0.95;
            if (isWalkable(this.dungeon, nx, ny)) { e.x = nx; e.y = ny; }
          }
        }
        const bashDmg = totalDmg > 0 ? totalDmg : Math.round(derived.maxDamage * 1.45);
        this.shakeScreen(Math.min(0.65, 0.3 + (bashDmg / 55) * 0.25));
        this.renderer3d?.triggerSkillVFX({
          type: 'shield_slam',
          x: this.pos.x,
          y: this.pos.y,
          dirX: this.lastAimDir?.x || 1,
          dirY: this.lastAimDir?.y || 0,
          damage: bashDmg,
          isCrit,
        });
        this.addFloater(this.pos.x, this.pos.y, hitCount ? '¡Golpe de Égida!' : 'Égida al aire', '#f59e0b');
      } else {
        this.hero.buffs.shieldUntil = now + 6000;
        this.hero.buffs.furyUntil = now + 4500;
        let auraDmg = 0;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.pos.x, e.y - this.pos.y) <= 3.0) {
            const res = this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 0.95, maxDamage: derived.maxDamage * 1.15 });
            if (res?.hit) auraDmg += res.damage;
          }
        }
        const effDmg = auraDmg > 0 ? auraDmg : Math.round(derived.maxDamage * 1.1);
        this.shakeScreen(0.38);
        this.renderer3d?.triggerSkillVFX({
          type: 'solar_nova',
          x: this.pos.x,
          y: this.pos.y,
          damage: effDmg,
          color: '#facc15',
        });
        this.addFloater(this.pos.x, this.pos.y, '☀ Aura de Apolo', '#facc15');
      }
    } else if (this.hero.classId === 'arquera') {
      if (slot === 'q') {
        const t = this._nearestEnemy(9) || this._aimFallbackTarget();
        const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
        const lunarDmg = Math.round(derived.maxDamage * 1.75);
        this.projectiles.push({
          fromHero: true,
          pierce: true,
          x: this.pos.x,
          y: this.pos.y,
          vx: Math.cos(ang) * 26,
          vy: Math.sin(ang) * 26,
          life: 0.9,
          minDmg: derived.minDamage * 1.6,
          maxDmg: derived.maxDamage * 1.85,
          critChance: Math.min(0.85, derived.critChance + 0.25),
          color: '#4ade80',
        });
        this.shakeScreen(0.24);
        this.renderer3d?.triggerSkillVFX({
          type: 'lunar_arrow',
          x: this.pos.x,
          y: this.pos.y,
          targetX: t.x,
          targetY: t.y,
          damage: lunarDmg,
        });
        this.addFloater(this.pos.x, this.pos.y, '🏹 Flecha Lunar', '#4ade80');
      } else {
        const t = this._nearestEnemy(9) || this._aimFallbackTarget();
        for (const offset of [-0.22, 0, 0.22]) {
          const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x) + offset;
          this.projectiles.push({
            fromHero: true,
            pierce: true,
            x: this.pos.x,
            y: this.pos.y,
            vx: Math.cos(ang) * 24,
            vy: Math.sin(ang) * 24,
            life: 0.75,
            minDmg: derived.minDamage * 1.15,
            maxDmg: derived.maxDamage * 1.35,
            critChance: derived.critChance,
            color: '#86efac',
          });
        }
        const heal = Math.round(derived.maxHp * 0.14);
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + heal);
        this.hero.buffs.furyUntil = now + 3500;
        this.renderer3d?.triggerSkillVFX({
          type: 'salva',
          x: this.pos.x,
          y: this.pos.y,
          damage: heal * 2,
        });
        this.addFloater(this.pos.x, this.pos.y, `🌿 Salva de Ortigia +${heal}`, '#4ade80');
      }
    } else if (this.hero.classId === 'necromante') {
      if (slot === 'q') {
        const t = this._nearestEnemy(9) || this._aimFallbackTarget();
        const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
        const spearDmg = Math.round(derived.maxDamage * 1.65);
        this.projectiles.push({
          fromHero: true,
          pierce: true,
          x: this.pos.x,
          y: this.pos.y,
          vx: Math.cos(ang) * 25,
          vy: Math.sin(ang) * 25,
          life: 0.9,
          minDmg: derived.minDamage * 1.55,
          maxDmg: derived.maxDamage * 1.75,
          critChance: derived.critChance + 0.12,
          color: '#c084fc',
        });
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + 5);
        this.shakeScreen(0.24);
        this.renderer3d?.triggerSkillVFX({
          type: 'caronte_spear',
          x: this.pos.x,
          y: this.pos.y,
          targetX: t.x,
          targetY: t.y,
          damage: spearDmg,
        });
        this.addFloater(this.pos.x, this.pos.y, '💀 Lanza de Caronte', '#c084fc');
      } else {
        const target = this._nearestEnemy(8) || { x: this.pos.x, y: this.pos.y };
        let voidDmg = 0;
        let isCrit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - target.x, e.y - target.y) <= 2.9) {
            e.armor = Math.max(0, Math.round(e.armor * 0.6));
            const res = this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.45, maxDamage: derived.maxDamage * 1.65 });
            if (res?.hit) {
              voidDmg += res.damage;
              if (res.crit) isCrit = true;
            }
          }
        }
        const effVoidDmg = voidDmg > 0 ? voidDmg : Math.round(derived.maxDamage * 1.55);
        const drain = Math.round(derived.maxHp * 0.16);
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + drain);
        this.shakeScreen(Math.min(0.75, 0.35 + (effVoidDmg / 60) * 0.3));
        this.renderer3d?.triggerSkillVFX({
          type: 'atropos_void',
          x: this.pos.x,
          y: this.pos.y,
          targetX: target.x,
          targetY: target.y,
          damage: effVoidDmg,
          isCrit,
        });
        this.addFloater(target.x, target.y, '☠ Condena de Átropos', '#a855f7');
      }
    } else if (this.hero.classId === 'sombra') {
      if (slot === 'q') {
        const target = this._nearestEnemy(5.5);
        if (target) {
          const ang = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
          const nx = target.x - Math.cos(ang) * 0.85;
          const ny = target.y - Math.sin(ang) * 0.85;
          if (isWalkable(this.dungeon, nx, ny)) {
            this.pos.x = nx;
            this.pos.y = ny;
            updateVisibility(this.dungeon, this.pos.x, this.pos.y, 8);
          }
          const res = this._strikeEnemy(target, {
            ...derived,
            minDamage: derived.minDamage * 1.75,
            maxDamage: derived.maxDamage * 2.0,
            critChance: Math.min(0.95, derived.critChance + 0.35),
          });
          const d = res?.hit ? res.damage : Math.round(derived.maxDamage * 1.85);
          this.shakeScreen(Math.min(0.75, 0.35 + (d / 50) * 0.3));
          this.renderer3d?.triggerSkillVFX({
            type: 'erinias_slash',
            x: this.pos.x,
            y: this.pos.y,
            targetX: target.x,
            targetY: target.y,
            damage: d,
            isCrit: res?.crit || false,
          });
          this.addFloater(target.x, target.y, '🗡 Filo de las Erinias', '#f472b6');
        } else {
          this.addFloater(this.pos.x, this.pos.y, 'Sin blanco cercano', '#94a3b8');
        }
      } else {
        this.hero.buffs.furyUntil = now + 4500;
        const targets = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - this.pos.x, e.y - this.pos.y) <= 6.5).slice(0, 4);
        for (const t of targets) {
          const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
          this.projectiles.push({
            fromHero: true,
            pierce: false,
            x: this.pos.x,
            y: this.pos.y,
            vx: Math.cos(ang) * 25,
            vy: Math.sin(ang) * 25,
            life: 0.75,
            minDmg: derived.minDamage * 1.35,
            maxDmg: derived.maxDamage * 1.55,
            critChance: derived.critChance + 0.15,
            color: '#f472b6',
          });
        }
        this.shakeScreen(0.3);
        this.renderer3d?.triggerSkillVFX({
          type: 'sentinel_burst',
          x: this.pos.x,
          y: this.pos.y,
          damage: derived.maxDamage * 1.45,
        });
        this.addFloater(this.pos.x, this.pos.y, '⚙ Centinela de Hefesto', '#ec4899');
      }
    } else if (this.hero.classId === 'coribante') {
      if (slot === 'q') {
        let earthHits = 0;
        let totalEarthDmg = 0;
        let isCrit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
          if (d <= 3.0) {
            const res = this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.5, maxDamage: derived.maxDamage * 1.7 });
            if (res?.hit) {
              earthHits++;
              totalEarthDmg += res.damage;
              if (res.crit) isCrit = true;
            }
            const nx = e.x + ((e.x - this.pos.x) / Math.max(0.2, d)) * 0.85;
            const ny = e.y + ((e.y - this.pos.y) / Math.max(0.2, d)) * 0.85;
            if (isWalkable(this.dungeon, nx, ny)) { e.x = nx; e.y = ny; }
          }
        }
        const effEarthDmg = totalEarthDmg > 0 ? totalEarthDmg : Math.round(derived.maxDamage * 1.6);
        this.shakeScreen(Math.min(0.85, 0.4 + (effEarthDmg / 50) * 0.35));
        this.renderer3d?.triggerSkillVFX({
          type: 'earth_shatter',
          x: this.pos.x,
          y: this.pos.y,
          damage: effEarthDmg,
          isCrit,
        });
        this.addFloater(this.pos.x, this.pos.y, '🌋 Cólera de Gea', '#84cc16');
      } else {
        const heal = Math.round(derived.maxHp * 0.24);
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + heal);
        this.hero.buffs.furyUntil = now + 5500;
        this.hero.buffs.shieldUntil = now + 5500;
        this.shakeScreen(0.35);
        this.renderer3d?.triggerSkillVFX({
          type: 'licaon_roar',
          x: this.pos.x,
          y: this.pos.y,
          damage: heal * 2,
        });
        this.addFloater(this.pos.x, this.pos.y, `🐺 Forma de Licaón +${heal}`, '#a3e635');
      }
    } else {
      if (slot === 'q') {
        const target = this._nearestEnemy(8) || this._aimFallbackTarget();
        let totalLightningDmg = 0;
        let lightningHits = 0;
        let isCrit = false;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - target.x, e.y - target.y) <= 2.8) {
            const res = this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.5, maxDamage: derived.maxDamage * 1.7 });
            if (res?.hit) {
              lightningHits++;
              totalLightningDmg += res.damage;
              if (res.crit) isCrit = true;
            }
          }
        }
        const effLightningDmg = totalLightningDmg > 0 ? totalLightningDmg : Math.round(derived.maxDamage * 1.6);
        this.shakeScreen(Math.min(0.85, 0.42 + (effLightningDmg / 50) * 0.35));
        this.renderer3d?.triggerSkillVFX({
          type: 'lightning',
          x: this.pos.x,
          y: this.pos.y,
          targetX: target.x,
          targetY: target.y,
          damage: effLightningDmg,
          isCrit,
          color: '#38bdf8',
        });
        this.addFloater(target.x, target.y, lightningHits ? '⚡ ¡Rayo de Zeus!' : '⚡ Rayo de Zeus', '#38bdf8');
      } else {
        this.hero.buffs.shieldUntil = now + 6000;
        this.shakeScreen(0.25);
        this.renderer3d?.triggerSkillVFX({
          type: 'solar_nova',
          x: this.pos.x,
          y: this.pos.y,
          damage: derived.maxDamage,
          color: '#38bdf8',
        });
        this.addFloater(this.pos.x, this.pos.y, 'Égida Etérea', '#38bdf8');
      }
    }
    this._notify();
  }

  _strikeEnemy(enemy, derived) {
    const res = resolveStrike({
      minDamage: derived.minDamage,
      maxDamage: derived.maxDamage,
      attackerDex: derived.stats.dexterity,
      attackerLevel: this.hero.level,
      targetArmor: enemy.armor,
      critChance: derived.critChance,
    });
    if (!res.hit) {
      this.addFloater(enemy.x, enemy.y, 'Fallo', '#94a3b8');
      return res;
    }
    enemy.hp = Math.max(0, enemy.hp - res.damage);
    this.addFloater(enemy.x, enemy.y, res.crit ? `${res.damage}!` : `${res.damage}`, res.crit ? '#facc15' : '#f8fafc');
    if (derived.lifeOnHit > 0) {
      this.hero.hp = Math.min(derived.maxHp, this.hero.hp + derived.lifeOnHit);
    }
    if (enemy.hp <= 0) {
      this._onEnemyKilled(enemy);
    }
    return res;
  }

  _advanceQuest(questId, amount = 1, gx = this.pos.x, gy = this.pos.y) {
    const q = (this.hero.quests || []).find((item) => item.id === questId);
    if (!q || q.completed) return;
    q.progress = Math.min(q.targetCount, q.progress + amount);
    if (q.progress < q.targetCount) return;

    q.completed = true;
    if (questId === 'antro_perjuros') {
      this.hero.skillPoints += 1;
      this.hero.statPoints += 1;
      this.addFloater(gx, gy, '¡Hazaña I Cumplida! +1 Talento', '#facc15');
      this.addLog('Hazaña cumplida: El Antro de los Perjuros (+1 Punto de Talento y +1 Atributo).');
      this.onEvent?.({ type: 'quest', title: 'Hazaña I Cumplida', message: '+1 Punto de Talento y +1 Atributo' });
    } else if (questId === 'obolo_caronte') {
      this.hero.gold += 80;
      const classRare = generateItem({
        level: this.floor + 1,
        forceRarity: 'rare',
        forceClassItem: true,
        preferredClass: this.hero.classId,
        seed: `${this.seed}:quest2:${this.hero.classId}`,
      });
      this.groundDrops.push({ x: gx + 0.3, y: gy + 0.3, kind: 'item', item: classRare });
      this.addFloater(gx, gy, '¡Hazaña II Cumplida! Reliquia de Clase', '#facc15');
      this.addLog(`Hazaña cumplida: El Óbolo de Caronte (+80 dracmas y ${classRare.name}).`);
      this.onEvent?.({ type: 'quest', title: 'Hazaña II Cumplida', message: `+80 dracmas y ${classRare.name}` });
    } else if (questId === 'sombra_asterion') {
      this.hero.skillPoints += 2;
      const classUnique = generateItem({
        level: this.floor + 1,
        forceRarity: 'unique',
        preferredClass: this.hero.classId,
        seed: `${this.seed}:quest3:${this.hero.classId}`,
      });
      this.groundDrops.push({ x: gx, y: gy, kind: 'item', item: classUnique });
      this.addFloater(gx, gy, '¡Hazaña III Cumplida! Reliquia Única', '#f97316');
      this.addLog(`Hazaña cumplida: El Guardián del Umbral (+2 Talentos y ${classUnique.name}).`);
      this.onEvent?.({ type: 'quest', title: 'Hazaña III Cumplida', message: `+2 Talentos y ${classUnique.name}` });
    }
  }

  _onEnemyKilled(enemy) {
    const levels = grantHeroXp(this.hero, enemy.xp);
    if (levels > 0) {
      const derived = computeHeroDerived(this.hero);
      this.hero.hp = derived.maxHp;
      this.hero.mana = derived.maxMana;
      this.addFloater(this.pos.x, this.pos.y, `¡Nivel ${this.hero.level}!`, '#facc15');
      this.addLog(`Subiste a nivel ${this.hero.level} (+3 Atributos y +1 Punto de Talento).`);
      this.onEvent?.({
        type: 'levelup',
        title: `¡Nivel ${this.hero.level}!`,
        message: '+3 Atributos y +1 Punto de Talento disponibles',
      });
    }
    this._advanceQuest('antro_perjuros', 1, enemy.x, enemy.y);
    if (enemy.tier === 'boss') {
      this._advanceQuest('sombra_asterion', 1, enemy.x, enemy.y);
    }

    const drops = rollEnemyDrop({
      level: this.floor,
      tier: enemy.tier,
      preferredClass: this.hero.classId,
      seed: `${this.seed}:${enemy.id}`,
    });
    for (const d of drops) {
      this.groundDrops.push({
        x: enemy.x + (Math.random() - 0.5) * 0.5,
        y: enemy.y + (Math.random() - 0.5) * 0.5,
        ...d,
      });
    }

    if (enemy.isFinalBoss || enemy.kind === 'hades') {
      this.finalBossDefeated = true;
      this.endlessUnlocked = true;
      const royalRelic = generateItem({
        level: this.floor + 2,
        forceRarity: 'unique',
        preferredClass: this.hero.classId,
        seed: `${this.seed}:hades-victory:${this.hero.classId}`,
      });
      this.groundDrops.push({ x: enemy.x, y: enemy.y, kind: 'item', item: royalRelic });
      this.groundDrops.push({ x: enemy.x + 0.35, y: enemy.y + 0.25, kind: 'gold', amount: 250 });
      this.shakeScreen(0.95);
      this.renderer3d?.triggerSkillVFX({
        type: 'solar_nova',
        x: enemy.x,
        y: enemy.y,
        damage: 180,
        isCrit: true,
        color: '#facc15',
      });
      this.addFloater(enemy.x, enemy.y, '¡HADES HA CAÍDO! VICTORIA', '#facc15');
      this.addLog(`¡Triunfo Olímpico! Has derrotado a ${enemy.name} en el Piso ${this.floor}.`);
      this.onEvent?.({
        type: 'victory',
        title: '¡Triunfo en el Tártaro!',
        message: `Has derrotado a ${enemy.name} en el Piso ${this.floor} y conquistado el Inframundo.`,
        floor: this.floor,
      });
    }
    this._notify();
  }

  _loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    this.lastDt = dt;
    if (!this.gameOver) this._update(dt);
    this._render();
    requestAnimationFrame((nextTs) => this._loop(nextTs));
  }

  _update(dt) {
    const derived = computeHeroDerived(this.hero);
    this.attackCdLeft = Math.max(0, this.attackCdLeft - dt);
    this.skillQCd = Math.max(0, this.skillQCd - dt);
    this.skillECd = Math.max(0, this.skillECd - dt);
    this.hero.mana = Math.min(derived.maxMana, this.hero.mana + dt * 2.2);

    if (this.attackBufferTimer > 0) {
      this.attackBufferTimer -= dt;
      if (this.attackBufferTimer <= 0) {
        this.attackQueued = false;
      }
    }

    const wantsAttack = this.attackHeld || this.attackQueued || this.keys.has(' ');
    if (wantsAttack && this.attackCdLeft <= 0) {
      this.attackQueued = false;
      this.attackBufferTimer = 0;
      this.basicAttackNearest({ allowInteract: false });
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    }

    // Movimiento por teclado + joystick analógico (dirección en pantalla -> grilla isométrica)
    let sx = 0;
    let sy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) sy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) sy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) sx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) sx += 1;

    const kMag = Math.hypot(sx, sy);
    const jMag = Math.hypot(this.joystick.x, this.joystick.y);
    let moveInX = 0;
    let moveInY = 0;
    let throttle = 0;
    if (kMag > 0) {
      moveInX = sx / kMag;
      moveInY = sy / kMag;
      throttle = 1;
    } else if (jMag > 0.08) {
      moveInX = this.joystick.x / jMag;
      moveInY = this.joystick.y / jMag;
      throttle = Math.min(1, Math.max(0.35, jMag));
    }

    let vx = 0;
    let vy = 0;
    if (throttle > 0) {
      this.moveTarget = null;
      this.attackTargetId = null;
      vx = moveInX + moveInY * 2;
      vy = moveInY * 2 - moveInX;
      const len = Math.hypot(vx, vy) || 1;
      const dirX = vx / len;
      const dirY = vy / len;
      this.lastAimDir = { x: dirX, y: dirY };
      vx = dirX * derived.speed * throttle;
      vy = dirY * derived.speed * throttle;
    } else if (this.moveTarget) {
      const dx = this.moveTarget.x - this.pos.x;
      const dy = this.moveTarget.y - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (this.attackTargetId) {
        const target = this.enemies.find((e) => e.id === this.attackTargetId && e.hp > 0);
        if (!target) {
          this.attackTargetId = null;
          this.moveTarget = null;
        } else if (Math.hypot(target.x - this.pos.x, target.y - this.pos.y) <= derived.range) {
          this.basicAttackNearest({ allowInteract: false });
        } else {
          this.moveTarget = { x: target.x, y: target.y };
        }
      }
      if (this.moveTarget && d > 0.16) {
        const dirX = dx / d;
        const dirY = dy / d;
        this.lastAimDir = { x: dirX, y: dirY };
        vx = dirX * derived.speed;
        vy = dirY * derived.speed;
      } else {
        this.moveTarget = null;
      }
    }

    if (vx !== 0 || vy !== 0) {
      const nx = this.pos.x + vx * dt;
      const ny = this.pos.y + vy * dt;
      if (isWalkable(this.dungeon, nx, this.pos.y)) this.pos.x = nx;
      if (isWalkable(this.dungeon, this.pos.x, ny)) this.pos.y = ny;
      updateVisibility(this.dungeon, this.pos.x, this.pos.y, this.dungeon.isOverworld ? 11 : 8);

      if (this.dungeon.isOverworld) {
        const zone = getZoneAt(this.dungeon, this.pos.x, this.pos.y);
        const nextZid = zone?.id || null;
        if (nextZid !== this.currentZoneId) {
          this.currentZoneId = nextZid;
          if (zone && !this.discoveredZones.has(zone.id)) {
            this.discoveredZones.add(zone.id);
            this.addLog(`Zona descubierta: ${zone.name} (${zone.subtitle}).`);
            this.onEvent?.({
              type: 'zone',
              title: zone.name,
              message: zone.subtitle,
              color: zone.color,
            });
          }
          this._notify();
        }
      }
    }

    // Recoger botín cercano automáticamente (oro/pociones) o ítems si hay espacio
    for (let i = this.groundDrops.length - 1; i >= 0; i--) {
      const d = this.groundDrops[i];
      if (d.dropCooldown > 0) {
        d.dropCooldown = Math.max(0, d.dropCooldown - dt);
        continue;
      }
      if (Math.hypot(d.x - this.pos.x, d.y - this.pos.y) > 0.75) continue;
      if (d.kind === 'gold') {
        this.hero.gold += d.amount;
        this.addFloater(d.x, d.y, `+${d.amount} dracmas`, '#facc15', { kind: 'loot' });
        this.groundDrops.splice(i, 1);
        this._notify();
      } else if (d.kind === 'potion') {
        this.hero.potions += d.amount;
        this.addFloater(d.x, d.y, '+1 Ambrosía', '#f87171', { kind: 'loot' });
        this.groundDrops.splice(i, 1);
        this._notify();
      } else if (d.kind === 'item' && this.hero.inventory.length < 16) {
        this.hero.inventory.push(d.item);
        this.addLog(`Recogiste: ${d.item.name}`);
        this.addFloater(d.x, d.y, d.item.name, d.item.color, { kind: 'loot' });
        if (d.item.rarity === 'rare' || d.item.rarity === 'unique') {
          this.onEvent?.({
            type: 'loot',
            title: d.item.rarityLabel,
            message: d.item.name,
            color: d.item.color,
            item: d.item,
          });
        }
        this.groundDrops.splice(i, 1);
        this._notify();
      }
    }

    // Proyectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (!isWalkable(this.dungeon, p.x, p.y) || p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.fromHero) {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 0.65) {
            this._strikeEnemy(e, {
              ...derived,
              minDamage: p.minDmg,
              maxDamage: p.maxDmg,
              critChance: p.critChance,
            });
            if (!p.pierce) {
              this.projectiles.splice(i, 1);
              break;
            }
          }
        }
      } else if (Math.hypot(this.pos.x - p.x, this.pos.y - p.y) < 0.6) {
        const hit = resolveStrike({
          minDamage: p.minDmg,
          maxDamage: p.maxDmg,
          targetArmor: derived.armor,
          targetDex: derived.stats.dexterity,
          critChance: 0.05,
        });
        if (hit.hit) {
          this.hero.hp = Math.max(0, this.hero.hp - hit.damage);
          this.addFloater(this.pos.x, this.pos.y, `-${hit.damage}`, '#ef4444');
          if (this.hero.hp <= 0) {
            this.gameOver = true;
            this.attackHeld = false;
            this.addLog('Has caído en el laberinto. Reinicia para un nuevo descenso.');
          }
          this._notify();
        }
        this.projectiles.splice(i, 1);
      }
    }

    // IA de enemigos
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.cdLeft = Math.max(0, e.cdLeft - dt);
      const dist = Math.hypot(this.pos.x - e.x, this.pos.y - e.y);
      const tileVis = this.dungeon.explored[Math.floor(e.y)]?.[Math.floor(e.x)] === 2;
      if (e.state === 'idle' && dist < 8.5 && tileVis) e.state = 'chase';
      if (e.state !== 'chase') continue;

      if (dist > e.range * 0.92) {
        const ex = e.x + ((this.pos.x - e.x) / dist) * e.speed * dt;
        const ey = e.y + ((this.pos.y - e.y) / dist) * e.speed * dt;
        if (isWalkable(this.dungeon, ex, e.y)) e.x = ex;
        if (isWalkable(this.dungeon, e.x, ey)) e.y = ey;
      } else if (e.cdLeft <= 0) {
        e.cdLeft = e.kind === 'harpy' ? 0.9 : 1.2;
        if (e.range > 2.0) {
          const ang = Math.atan2(this.pos.y - e.y, this.pos.x - e.x);
          this.projectiles.push({
            fromHero: false,
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * 7.5,
            vy: Math.sin(ang) * 7.5,
            life: 1.0,
            minDmg: e.damage[0],
            maxDmg: e.damage[1],
            color: '#fbbf24',
          });
        } else {
          const hit = resolveStrike({
            minDamage: e.damage[0],
            maxDamage: e.damage[1],
            attackerLevel: e.level,
            targetArmor: derived.armor,
            targetDex: derived.stats.dexterity,
            critChance: e.tier === 'boss' ? 0.14 : 0.05,
          });
          if (hit.hit) {
            this.hero.hp = Math.max(0, this.hero.hp - hit.damage);
            this.addFloater(this.pos.x, this.pos.y, `-${hit.damage}`, '#ef4444');
            if (this.hero.hp <= 0) {
              this.gameOver = true;
              this.attackHeld = false;
              this.addLog('Has caído en el laberinto. Reinicia para un nuevo descenso.');
            }
            this._notify();
          } else {
            this.addFloater(this.pos.x, this.pos.y, 'Esquive', '#38bdf8');
          }
        }
      }
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      this.floaters[i].life -= dt;
      if (this.floaters[i].life <= 0) this.floaters.splice(i, 1);
    }

    const targetIso = toIso(this.pos.x, this.pos.y);
    this.cam.x += (targetIso.x - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (targetIso.y - this.cam.y) * Math.min(1, dt * 8);

    if (this.screenShake > 0) {
      const shakeMag = this.screenShake * 14;
      this.cam.x += (Math.random() - 0.5) * shakeMag;
      this.cam.y += (Math.random() - 0.5) * shakeMag;
    }

    this._hudTickAcc += dt;
    if (this._hudTickAcc >= 0.066) {
      this._hudTickAcc = 0;
      this._emitHudTick(derived);
    }
  }

  _render() {
    const ctx = this.ctx;
    const is3D = Boolean(this.renderer3d?.enabled);

    if (is3D) {
      this.renderer3d.render(this, this.lastDt || 0.016);
      ctx.clearRect(0, 0, this.viewW, this.viewH);
    } else {
      ctx.fillStyle = this.dungeon?.isOverworld ? '#0c2438' : '#090b10';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (!this.dungeon) return;

    ctx.save();
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const { width, height, grid, explored, biome, isOverworld, terrain } = this.dungeon;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const overworldColors = {
      grass: '#3d7d36',
      meadow: '#52a346',
      dirt: '#9c7248',
      sand: '#e2c275',
      water: '#0284c7',
      shallow_water: '#38bdf8',
      bridge: '#9a7b56',
      marble: '#e2e8f0',
      rock: '#57534e',
      forest: '#2f632b',
      cliff: '#6b5e50',
    };

    // Pintar suelo (solo en fallback 2D) y etiquetas de hitos visibles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vis = explored[y][x];
        if (vis === 0) continue;
        const t = grid[y][x];
        const tKind = isOverworld ? terrain?.[y]?.[x] : null;
        const iso = toIso(x, y);
        const alpha = vis === 2 ? 1 : isOverworld ? 0.56 : 0.34;
        ctx.globalAlpha = alpha;

        if (!is3D) {
          if (t === TILE_WALL && (!isOverworld || tKind === 'cliff')) {
            ctx.fillStyle = isOverworld ? '#6b5e50' : biome.wall;
            ctx.beginPath();
            ctx.moveTo(iso.x, iso.y - WALL_H);
            ctx.lineTo(iso.x + hw, iso.y + hh - WALL_H);
            ctx.lineTo(iso.x, iso.y + TILE_H - WALL_H);
            ctx.lineTo(iso.x - hw, iso.y + hh - WALL_H);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#111622';
            ctx.beginPath();
            ctx.moveTo(iso.x - hw, iso.y + hh - WALL_H);
            ctx.lineTo(iso.x, iso.y + TILE_H - WALL_H);
            ctx.lineTo(iso.x, iso.y + TILE_H);
            ctx.lineTo(iso.x - hw, iso.y + hh);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillStyle =
              t === TILE_STAIRS
                ? '#3b2e16'
                : t === TILE_STAIRS_UP
                ? '#16354d'
                : t === TILE_SHRINE
                ? '#172d3d'
                : isOverworld
                ? overworldColors[tKind] || biome.floor
                : biome.floor;
            ctx.beginPath();
            ctx.moveTo(iso.x, iso.y);
            ctx.lineTo(iso.x + hw, iso.y + hh);
            ctx.lineTo(iso.x, iso.y + TILE_H);
            ctx.lineTo(iso.x - hw, iso.y + hh);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.stroke();
          }
        }

        if (t === TILE_STAIRS) {
          const isSealedFinal = this.floor === FINAL_FLOOR && !this.finalBossDefeated;
          ctx.fillStyle = isSealedFinal ? '#f97316' : '#facc15';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          const lbl = isSealedFinal
            ? '🔒 HADES'
            : this.floor === 1
            ? '▼ INFRAMUNDO [F]'
            : this.floor === FINAL_FLOOR
            ? '▼ ABISMO [F]'
            : '▼ BAJAR [F]';
          ctx.fillText(lbl, iso.x, iso.y + hh - (is3D ? 18 : -4));
        } else if (t === TILE_STAIRS_UP) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          const lbl = this.floor === 2 ? '▲ SUPERFICIE [F]' : '▲ SUBIR [F]';
          ctx.fillText(lbl, iso.x, iso.y + hh - (is3D ? 18 : -4));
        } else if (t === TILE_SHRINE) {
          ctx.fillStyle = this.dungeon.shrine?.used ? '#64748b' : '#38bdf8';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✦ ALTAR [F]', iso.x, iso.y + hh - (is3D ? 18 : -4));
        }
      }
    }

    ctx.globalAlpha = 1;

    // Indicador de destino / blanco fijado
    if (this.moveTarget && !this.attackTargetId) {
      const mIso = toIso(this.moveTarget.x, this.moveTarget.y);
      ctx.strokeStyle = 'rgba(229, 184, 105, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(mIso.x, mIso.y, 10, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.attackTargetId) {
      const target = this.enemies.find((e) => e.id === this.attackTargetId && e.hp > 0);
      if (target && explored[Math.floor(target.y)]?.[Math.floor(target.x)] === 2) {
        const tIso = toIso(target.x, target.y);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.88)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(tIso.x, tIso.y + 3, 14, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // NPC del Campamento (Sibila de Cumas)
    if (this.dungeon.npc) {
      const n = this.dungeon.npc;
      if (explored[Math.floor(n.y)]?.[Math.floor(n.x)] === 2) {
        const iso = toIso(n.x, n.y);
        if (!is3D) {
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(iso.x - 18, iso.y + 4, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e879f9';
          ctx.beginPath();
          ctx.arc(iso.x, iso.y - 9, 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`✦ ${n.name.toUpperCase()} [F]`, iso.x, iso.y - (is3D ? 36 : 22));
      }
    }

    // Cofres (solo en fallback 2D; en 3D se renderizan con tapa articulada)
    if (!is3D) {
      for (const c of this.dungeon.chests) {
        if (explored[Math.floor(c.y)]?.[Math.floor(c.x)] !== 2) continue;
        const iso = toIso(c.x, c.y);
        ctx.fillStyle = c.opened ? '#475569' : '#d97706';
        ctx.fillRect(iso.x - 8, iso.y - 6, 16, 11);
        ctx.strokeStyle = '#fde68a';
        ctx.strokeRect(iso.x - 8, iso.y - 6, 16, 11);
      }
    }

    // Botín en el suelo (etiquetas de objetos con anti-colisión)
    const groundLabels = [];
    for (const d of this.groundDrops) {
      const iso = toIso(d.x, d.y);
      const color = d.kind === 'gold' ? '#facc15' : d.kind === 'potion' ? '#ef4444' : d.item.color;
      if (!is3D) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(iso.x, iso.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (d.kind === 'item') {
        const text = d.item.name.slice(0, 20);
        groundLabels.push({
          x: iso.x,
          renderY: iso.y - 24,
          text,
          color,
          width: 96,
          height: 15,
        });
      }
    }

    // Resolver colisión entre etiquetas adyacentes en el suelo
    for (let i = 0; i < groundLabels.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = groundLabels[i];
        const b = groundLabels[j];
        if (Math.abs(a.x - b.x) < 80 && Math.abs(a.renderY - b.renderY) < 16) {
          a.renderY = b.renderY - 17;
        }
      }
    }

    for (const lbl of groundLabels) {
      ctx.fillStyle = 'rgba(9, 11, 16, 0.88)';
      ctx.fillRect(lbl.x - lbl.width / 2, lbl.renderY - lbl.height / 2, lbl.width, lbl.height);
      ctx.strokeStyle = lbl.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(lbl.x - lbl.width / 2, lbl.renderY - lbl.height / 2, lbl.width, lbl.height);
      ctx.fillStyle = lbl.color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lbl.text, lbl.x, lbl.renderY);
    }

    // Entidades ordenadas por profundidad (gx + gy)
    const actors = [
      { kind: 'hero', x: this.pos.x, y: this.pos.y, depth: this.pos.x + this.pos.y },
      ...this.enemies
        .filter((e) => e.hp > 0 && explored[Math.floor(e.y)]?.[Math.floor(e.x)] === 2)
        .map((e) => ({ kind: 'enemy', e, depth: e.x + e.y })),
    ].sort((a, b) => a.depth - b.depth);

    for (const a of actors) {
      if (a.kind === 'hero') {
        if (!is3D) {
          const iso = toIso(this.pos.x, this.pos.y);
          const clsColor = HERO_CLASSES[this.hero.classId].color;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(iso.x, iso.y + 4, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = clsColor;
          ctx.beginPath();
          ctx.arc(iso.x, iso.y - 9, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fde68a';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else {
        const e = a.e;
        const iso = toIso(e.x, e.y);
        const rad = e.tier === 'boss' ? 12 : 8;
        if (!is3D) {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(iso.x, iso.y - rad, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        // Barra de vida sobre la cabeza del modelo 3D/2D
        const bw = e.tier === 'boss' ? 42 : 26;
        const barY = is3D ? iso.y - (e.tier === 'boss' ? 46 : 32) : iso.y - rad * 2 - 9;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(iso.x - bw / 2 - 1, barY - 1, bw + 2, 6);
        ctx.fillStyle = e.tier === 'boss' ? '#f97316' : '#ef4444';
        ctx.fillRect(iso.x - bw / 2, barY, bw * (e.hp / e.maxHp), 4);
      }
    }

    // Proyectiles (fallback 2D)
    if (!is3D) {
      for (const p of this.projectiles) {
        const iso = toIso(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(iso.x, iso.y - 6, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Textos flotantes (combate, botín, curación) con resolución anti-superposición
    if (this.floaters.length > 0) {
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 1. Calcular dimensiones y posición base de cada floater
      const floaterItems = this.floaters.map((f) => {
        const iso = toIso(f.x, f.y);
        const maxL = f.maxLife || 1.15;
        const progress = Math.max(0, Math.min(1, 1 - (f.life / maxL)));
        const rise = progress * 28;
        const textWidth = ctx.measureText(f.text).width;
        const width = Math.max(50, Math.round(textWidth + 16));
        const height = 19;
        return {
          floater: f,
          x: iso.x,
          baseY: iso.y - 34 - rise,
          renderY: iso.y - 34 - rise,
          width,
          height,
          createdAt: f.createdAt || 0,
          life: f.life,
        };
      });

      // 2. Resolver colisiones: ordenar por orden de creación para formar una cascada
      // El primero creado mantiene su base y los nuevos se apilan limpiamente hacia arriba con separación garantizada
      floaterItems.sort((a, b) => (a.createdAt - b.createdAt) || (b.baseY - a.baseY));

      for (let i = 0; i < floaterItems.length; i++) {
        const item = floaterItems[i];
        for (let j = 0; j < i; j++) {
          const other = floaterItems[j];
          // Solapamiento horizontal (si la distancia entre centros X es menor al ancho promedio + margen)
          const horizOverlap = Math.abs(item.x - other.x) < ((item.width + other.width) / 2 + 6);
          if (horizOverlap) {
            const vertOverlap = Math.abs(item.renderY - other.renderY) < 20;
            if (vertOverlap) {
              item.renderY = other.renderY - 21;
            }
          }
        }
      }

      // 3. Dibujar cada floater con badge protector
      for (const item of floaterItems) {
        const f = item.floater;
        const alpha = Math.max(0, Math.min(1, f.life * 2.2));
        ctx.globalAlpha = alpha;

        const bx = item.x - item.width / 2;
        const by = item.renderY - item.height / 2;

        // Fondo oscuro estilizado con borde coloreado según rareza/tipo
        ctx.fillStyle = 'rgba(9, 12, 18, 0.90)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(bx, by, item.width, item.height, 4);
        } else {
          ctx.rect(bx, by, item.width, item.height);
        }
        ctx.fill();

        ctx.strokeStyle = f.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = alpha * 0.75;
        ctx.stroke();

        // Texto nítido
        ctx.globalAlpha = alpha;
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, item.x, item.renderY);
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _emitHudTick(precomputedDerived = null) {
    if (!this.onHudTick) return;
    const derived = precomputedDerived || computeHeroDerived(this.hero);
    const classDef = HERO_CLASSES[this.hero.classId];
    const now = Date.now();
    this.onHudTick({
      hero: this.hero,
      derived,
      classDef,
      skills: classDef.skills,
      attackCdLeft: this.attackCdLeft,
      skillQCd: this.skillQCd,
      skillECd: this.skillECd,
      furyLeftSec: Math.max(0, ((this.hero.buffs?.furyUntil || 0) - now) / 1000),
      shieldLeftSec: Math.max(0, ((this.hero.buffs?.shieldUntil || 0) - now) / 1000),
      nearby: this.getNearbyInteractable(),
      zoom: this.zoom,
      gameOver: this.gameOver,
      finalBossDefeated: this.finalBossDefeated,
    });
  }

  _notify() {
    const derived = computeHeroDerived(this.hero);
    const classDef = HERO_CLASSES[this.hero.classId];
    this._emitHudTick(derived);
    if (!this.onUiUpdate) return;
    const currentZone = this.dungeon?.isOverworld ? getZoneAt(this.dungeon, this.pos.x, this.pos.y) : null;
    this.onUiUpdate({
      hero: this.hero,
      derived,
      classDef,
      floor: this.floor,
      finalFloor: FINAL_FLOOR,
      isOverworld: Boolean(this.dungeon?.isOverworld),
      currentZone: currentZone ? currentZone.name : null,
      biome: this.dungeon?.biome?.name || '',
      seed: this.seed,
      log: this.log,
      gameOver: this.gameOver,
      finalBossDefeated: this.finalBossDefeated,
      endlessUnlocked: this.endlessUnlocked,
      skills: classDef.skills,
      nearby: this.getNearbyInteractable(),
    });
  }
}
