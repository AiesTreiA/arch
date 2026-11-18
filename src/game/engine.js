/**
 * engine.js — Motor isométrico 2:1 en Canvas 2D para ARCH (Vertical Slice v0.1).
 * Integra generación procedural, niebla de guerra, IA de enemigos, combate, habilidades y botín.
 */
import {
  generateDungeon,
  isWalkable,
  TILE_SHRINE,
  TILE_STAIRS,
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
import { generateItem, rollEnemyDrop } from '../core/loot.js';
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
  constructor({ canvas, onUiUpdate }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onUiUpdate = onUiUpdate;

    this.keys = new Set();
    this.projectiles = [];
    this.floaters = [];
    this.groundDrops = [];
    this.enemies = [];
    this.log = [];
    this.seed = 'olimpia-01';
    this.floor = 1;
    this.running = false;
    this.gameOver = false;
    this.lastTs = 0;
    this.lastDt = 0.016;
    this.attackCdLeft = 0;
    this.skillQCd = 0;
    this.skillECd = 0;
    this.moveTarget = null;
    this.attackTargetId = null;
    this.zoom = 1.15;

    this.hero = createHero('hoplita');
    this.pos = { x: 4, y: 4 };
    this.cam = { x: 0, y: 0 };
    this.dungeon = null;

    this.renderer3d = new ArchRenderer3D(this.canvas);
    this.renderer3d.setZoom(this.zoom);

    this._bindEvents();
    this._resize();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) {
        if (this.running) e.preventDefault();
      }
      this.keys.add(k);
      if (!this.running || this.gameOver) return;
      if (k === 'q') this.castSkill('q');
      else if (k === 'e') this.castSkill('e');
      else if (k === '1' || k === 'r') this.usePotion();
      else if (k === 'f' || k === 'g') this.interactNearby();
      else if (k === ' ') this.basicAttackNearest();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.running) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        this.zoom = Math.max(0.8, Math.min(2.0, Number((this.zoom + delta).toFixed(2))));
        this.renderer3d?.setZoom(this.zoom);
      },
      { passive: false }
    );

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.running || this.gameOver) return;
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = (sx - this.viewW / 2) / this.zoom + this.cam.x;
      const worldY = (sy - this.viewH / 2) / this.zoom + this.cam.y;
      const g = toGrid(worldX, worldY);

      // ¿Clic sobre la Sibila del Campamento?
      if (this.dungeon?.npc && Math.hypot(this.dungeon.npc.x - g.x, this.dungeon.npc.y - g.y) < 1.1) {
        if (Math.hypot(this.dungeon.npc.x - this.pos.x, this.dungeon.npc.y - this.pos.y) <= 2.2) {
          this.interactNearby();
        } else {
          this.moveTarget = { x: this.dungeon.npc.x, y: this.dungeon.npc.y };
        }
        return;
      }

      // ¿Clic sobre un drop cercano?
      const drop = this.groundDrops.find((d) => Math.hypot(d.x - g.x, d.y - g.y) < 0.85);
      if (drop) {
        this.moveTarget = { x: drop.x, y: drop.y };
        this.attackTargetId = null;
        return;
      }

      // ¿Clic sobre un enemigo vivo?
      const target = this.enemies.find((en) => en.hp > 0 && Math.hypot(en.x - g.x, en.y - g.y) < 1.0);
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
    this.viewW = Math.max(320, Math.floor(rect.width));
    this.viewH = Math.max(320, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer3d?.resize(this.viewW, this.viewH);
  }

  startNewGame({ classId = 'hoplita', heroName = '', seed = 'olimpia-01' } = {}) {
    this.seed = (seed || 'olimpia-01').trim();
    this.floor = 1;
    this.hero = createHero(classId, heroName);
    const derived = computeHeroDerived(this.hero);
    this.hero.hp = derived.maxHp;
    this.hero.mana = derived.maxMana;
    this.gameOver = false;
    this.log = [];
    this._loadFloor(1);
    this.addLog(`Sibila de Cumas: «Bienvenido al Aqueronte, ${this.hero.className}. Purga el Antro [F]».`);
    this.addLog(this.hero.prologue);
    if (!this.running) {
      this.running = true;
      this.lastTs = performance.now();
      requestAnimationFrame((ts) => this._loop(ts));
    }
    this._notify();
  }

  _loadFloor(floor) {
    this.floor = floor;
    this.dungeon = generateDungeon({ width: 44, height: 44, level: floor, seed: this.seed });
    this.pos = { ...this.dungeon.spawn };
    this.projectiles = [];
    this.floaters = [];
    this.groundDrops = [];
    this.moveTarget = null;
    this.attackTargetId = null;
    this.enemies = this.dungeon.enemySpawns.map((s, idx) => createEnemy(s, `e-${floor}-${idx}`));
    updateVisibility(this.dungeon, this.pos.x, this.pos.y, 8);
    const iso = toIso(this.pos.x, this.pos.y);
    this.cam.x = iso.x;
    this.cam.y = iso.y;
    this.renderer3d?.buildDungeon(this.dungeon);
    this.addLog(`Acto I · Piso ${floor}: ${this.dungeon.biome.name}.`);
  }

  addLog(msg) {
    this.log.unshift(msg);
    if (this.log.length > 7) this.log.length = 7;
  }

  addFloater(x, y, text, color = '#f8fafc') {
    this.floaters.push({ x, y, text, color, life: 0.95 });
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

  dropInventoryItem(itemId) {
    const idx = this.hero.inventory.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const [removed] = this.hero.inventory.splice(idx, 1);
    this.groundDrops.push({ x: this.pos.x, y: this.pos.y, kind: 'item', item: removed });
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

  interactNearby() {
    const tx = Math.floor(this.pos.x);
    const ty = Math.floor(this.pos.y);

    // 1. ¿Hablar con la Sibila de Cumas / NPC del Campamento?
    if (this.dungeon.npc) {
      const dn = Math.hypot(this.dungeon.npc.x - this.pos.x, this.dungeon.npc.y - this.pos.y);
      if (dn <= 2.2) {
        this.dungeon.npc.talked = true;
        const derived = computeHeroDerived(this.hero);
        this.hero.hp = derived.maxHp;
        this.hero.mana = derived.maxMana;
        const pending = this.hero.quests.find((q) => !q.completed);
        if (pending) {
          this.addLog(`${this.dungeon.npc.name}: «${pending.desc} (${pending.progress}/${pending.targetCount})».`);
        } else {
          this.addLog(`${this.dungeon.npc.name}: «Has cumplido los 3 Oráculos del Estigia, héroe inmortal».`);
        }
        this.addFloater(this.dungeon.npc.x, this.dungeon.npc.y, 'Oráculo de la Sibila (Salud restaurada)', '#facc15');
        this._notify();
        return true;
      }
    }

    // 2. ¿Bajar por las escaleras?
    if (this.dungeon.grid[ty]?.[tx] === TILE_STAIRS) {
      this.addLog(`Desciendes al piso ${this.floor + 1}...`);
      this._loadFloor(this.floor + 1);
      this._notify();
      return true;
    }

    // 3. ¿Altar curativo de Asclepio?
    if (this.dungeon.shrine && !this.dungeon.shrine.used) {
      const ds = Math.hypot(this.dungeon.shrine.x + 0.5 - this.pos.x, this.dungeon.shrine.y + 0.5 - this.pos.y);
      if (ds <= 1.7) {
        this.dungeon.shrine.used = true;
        const derived = computeHeroDerived(this.hero);
        this.hero.hp = derived.maxHp;
        this.hero.mana = derived.maxMana;
        this.addFloater(this.pos.x, this.pos.y, 'Bendición de Asclepio', '#38bdf8');
        this.addLog('El altar restauró toda tu salud y fervor.');
        this._notify();
        return true;
      }
    }

    // 4. ¿Cofre Antiguo? (Avanza Hazaña II: El Óbolo de Caronte)
    for (const c of this.dungeon.chests) {
      if (!c.opened && Math.hypot(c.x - this.pos.x, c.y - this.pos.y) <= 1.7) {
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

  basicAttackNearest() {
    if (this.attackCdLeft > 0 || this.gameOver) return;
    if (this.interactNearby()) return;
    const derived = computeHeroDerived(this.hero);
    const target =
      (this.attackTargetId && this.enemies.find((e) => e.id === this.attackTargetId && e.hp > 0)) ||
      this._nearestEnemy(derived.range + 0.8);
    if (!target) return;

    const dist = Math.hypot(target.x - this.pos.x, target.y - this.pos.y);
    if (dist > derived.range + 0.4) {
      this.moveTarget = { x: target.x, y: target.y };
      return;
    }

    this.attackCdLeft = derived.attackCd;
    this.renderer3d?.triggerHeroAttack({ whirlwind: false });
    if (derived.range > 2.2) {
      const ang = Math.atan2(target.y - this.pos.y, target.x - this.pos.x);
      this.projectiles.push({
        fromHero: true,
        x: this.pos.x,
        y: this.pos.y,
        vx: Math.cos(ang) * 11,
        vy: Math.sin(ang) * 11,
        life: 0.75,
        minDmg: derived.minDamage,
        maxDmg: derived.maxDamage,
        critChance: derived.critChance,
        color: HERO_CLASSES[this.hero.classId].color,
      });
    } else {
      this._strikeEnemy(target, derived);
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
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.pos.x, e.y - this.pos.y) <= 2.6) {
            this._strikeEnemy(e, {
              ...derived,
              minDamage: derived.minDamage * 1.45,
              maxDamage: derived.maxDamage * 1.65,
              lifeOnHit: derived.lifeOnHit + 4,
            });
            hits++;
          }
        }
        this.addFloater(this.pos.x, this.pos.y, hits ? '¡Torbellino Tracio!' : 'Torbellino', '#ef4444');
      } else {
        this.hero.buffs.furyUntil = now + 5500;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
          if (d <= 3.0) {
            const nx = e.x + ((e.x - this.pos.x) / Math.max(0.2, d)) * 1.1;
            const ny = e.y + ((e.y - this.pos.y) / Math.max(0.2, d)) * 1.1;
            if (isWalkable(this.dungeon, nx, ny)) { e.x = nx; e.y = ny; }
          }
        }
        this.addFloater(this.pos.x, this.pos.y, '¡Grito de Fobos!', '#fb923c');
      }
    } else if (this.hero.classId === 'hoplita') {
      if (slot === 'q') {
        let hitCount = 0;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
          if (d <= 2.4) {
            this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.4, maxDamage: derived.maxDamage * 1.5 });
            const nx = e.x + ((e.x - this.pos.x) / Math.max(0.2, d)) * 0.9;
            const ny = e.y + ((e.y - this.pos.y) / Math.max(0.2, d)) * 0.9;
            if (isWalkable(this.dungeon, nx, ny)) { e.x = nx; e.y = ny; }
            hitCount++;
          }
        }
        this.addFloater(this.pos.x, this.pos.y, hitCount ? '¡Golpe de Égida!' : 'Égida al aire', '#f59e0b');
      } else {
        this.hero.buffs.shieldUntil = now + 6000;
        this.hero.buffs.furyUntil = now + 4500;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - this.pos.x, e.y - this.pos.y) <= 2.8) {
            this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 0.9, maxDamage: derived.maxDamage * 1.1 });
          }
        }
        this.addFloater(this.pos.x, this.pos.y, '☀ Aura de Apolo', '#facc15');
      }
    } else if (this.hero.classId === 'arquera') {
      if (slot === 'q') {
        const t = this._nearestEnemy(9) || { x: this.pos.x + 1, y: this.pos.y };
        const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
        this.projectiles.push({
          fromHero: true,
          pierce: true,
          x: this.pos.x,
          y: this.pos.y,
          vx: Math.cos(ang) * 14,
          vy: Math.sin(ang) * 14,
          life: 0.9,
          minDmg: derived.minDamage * 1.6,
          maxDmg: derived.maxDamage * 1.85,
          critChance: Math.min(0.85, derived.critChance + 0.25),
          color: '#4ade80',
        });
        this.addFloater(this.pos.x, this.pos.y, 'Flecha Lunar', '#4ade80');
      } else {
        const t = this._nearestEnemy(9) || { x: this.pos.x + 1, y: this.pos.y };
        for (const offset of [-0.22, 0, 0.22]) {
          const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x) + offset;
          this.projectiles.push({
            fromHero: true,
            pierce: true,
            x: this.pos.x,
            y: this.pos.y,
            vx: Math.cos(ang) * 13,
            vy: Math.sin(ang) * 13,
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
        this.addFloater(this.pos.x, this.pos.y, `Salva de Ortigia +${heal}`, '#4ade80');
      }
    } else if (this.hero.classId === 'necromante') {
      if (slot === 'q') {
        const t = this._nearestEnemy(9) || { x: this.pos.x + 1, y: this.pos.y };
        const ang = Math.atan2(t.y - this.pos.y, t.x - this.pos.x);
        this.projectiles.push({
          fromHero: true,
          pierce: true,
          x: this.pos.x,
          y: this.pos.y,
          vx: Math.cos(ang) * 12.5,
          vy: Math.sin(ang) * 12.5,
          life: 0.95,
          minDmg: derived.minDamage * 1.55,
          maxDmg: derived.maxDamage * 1.75,
          critChance: derived.critChance + 0.12,
          color: '#c084fc',
        });
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + 5);
        this.addFloater(this.pos.x, this.pos.y, '💀 Lanza de Caronte', '#c084fc');
      } else {
        const target = this._nearestEnemy(8) || { x: this.pos.x, y: this.pos.y };
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - target.x, e.y - target.y) <= 2.8) {
            e.armor = Math.max(0, Math.round(e.armor * 0.6));
            this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.45, maxDamage: derived.maxDamage * 1.65 });
          }
        }
        const drain = Math.round(derived.maxHp * 0.16);
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + drain);
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
          this._strikeEnemy(target, {
            ...derived,
            minDamage: derived.minDamage * 1.75,
            maxDamage: derived.maxDamage * 2.0,
            critChance: Math.min(0.95, derived.critChance + 0.35),
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
            vx: Math.cos(ang) * 13.5,
            vy: Math.sin(ang) * 13.5,
            life: 0.75,
            minDmg: derived.minDamage * 1.35,
            maxDmg: derived.maxDamage * 1.55,
            critChance: derived.critChance + 0.15,
            color: '#f472b6',
          });
        }
        this.addFloater(this.pos.x, this.pos.y, '⚙ Centinela de Hefesto', '#ec4899');
      }
    } else if (this.hero.classId === 'coribante') {
      if (slot === 'q') {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - this.pos.x, e.y - this.pos.y);
          if (d <= 2.9) {
            this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.5, maxDamage: derived.maxDamage * 1.7 });
            const nx = e.x + ((e.x - this.pos.x) / Math.max(0.2, d)) * 0.8;
            const ny = e.y + ((e.y - this.pos.y) / Math.max(0.2, d)) * 0.8;
            if (isWalkable(this.dungeon, nx, ny)) { e.x = nx; e.y = ny; }
          }
        }
        this.addFloater(this.pos.x, this.pos.y, '🌋 Cólera de Gea', '#84cc16');
      } else {
        const heal = Math.round(derived.maxHp * 0.24);
        this.hero.hp = Math.min(derived.maxHp, this.hero.hp + heal);
        this.hero.buffs.furyUntil = now + 5500;
        this.hero.buffs.shieldUntil = now + 5500;
        this.addFloater(this.pos.x, this.pos.y, `🐺 Forma de Licaón +${heal}`, '#a3e635');
      }
    } else {
      if (slot === 'q') {
        const target = this._nearestEnemy(8) || { x: this.pos.x, y: this.pos.y };
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.x - target.x, e.y - target.y) <= 2.5) {
            this._strikeEnemy(e, { ...derived, minDamage: derived.minDamage * 1.5, maxDamage: derived.maxDamage * 1.7 });
          }
        }
        this.addFloater(target.x, target.y, '⚡ Rayo de Zeus', '#38bdf8');
      } else {
        this.hero.buffs.shieldUntil = now + 6000;
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
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - res.damage);
    this.addFloater(enemy.x, enemy.y, res.crit ? `${res.damage}!` : `${res.damage}`, res.crit ? '#facc15' : '#f8fafc');
    if (derived.lifeOnHit > 0) {
      this.hero.hp = Math.min(derived.maxHp, this.hero.hp + derived.lifeOnHit);
    }
    if (enemy.hp <= 0) {
      this._onEnemyKilled(enemy);
    }
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

    // Movimiento por teclado (dirección en pantalla -> grilla isométrica)
    let sx = 0;
    let sy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) sy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) sy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) sx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) sx += 1;

    let vx = 0;
    let vy = 0;
    if (sx !== 0 || sy !== 0) {
      this.moveTarget = null;
      vx = sx + sy * 2;
      vy = sy * 2 - sx;
      const len = Math.hypot(vx, vy) || 1;
      vx = (vx / len) * derived.speed;
      vy = (vy / len) * derived.speed;
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
          this.basicAttackNearest();
        } else {
          this.moveTarget = { x: target.x, y: target.y };
        }
      }
      if (this.moveTarget && d > 0.16) {
        vx = (dx / d) * derived.speed;
        vy = (dy / d) * derived.speed;
      } else {
        this.moveTarget = null;
      }
    }

    if (vx !== 0 || vy !== 0) {
      const nx = this.pos.x + vx * dt;
      const ny = this.pos.y + vy * dt;
      if (isWalkable(this.dungeon, nx, this.pos.y)) this.pos.x = nx;
      if (isWalkable(this.dungeon, this.pos.x, ny)) this.pos.y = ny;
      updateVisibility(this.dungeon, this.pos.x, this.pos.y, 8);
    }

    // Recoger botín cercano automáticamente (oro/pociones) o ítems si hay espacio
    for (let i = this.groundDrops.length - 1; i >= 0; i--) {
      const d = this.groundDrops[i];
      if (Math.hypot(d.x - this.pos.x, d.y - this.pos.y) > 0.75) continue;
      if (d.kind === 'gold') {
        this.hero.gold += d.amount;
        this.addFloater(d.x, d.y, `+${d.amount} dracmas`, '#facc15');
        this.groundDrops.splice(i, 1);
        this._notify();
      } else if (d.kind === 'potion') {
        this.hero.potions += d.amount;
        this.addFloater(d.x, d.y, '+1 Ambrosía', '#f87171');
        this.groundDrops.splice(i, 1);
        this._notify();
      } else if (d.kind === 'item' && this.hero.inventory.length < 16) {
        this.hero.inventory.push(d.item);
        this.addLog(`Recogiste: ${d.item.name}`);
        this.addFloater(d.x, d.y, d.item.name, d.item.color);
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
  }

  _render() {
    const ctx = this.ctx;
    const is3D = Boolean(this.renderer3d?.enabled);

    if (is3D) {
      this.renderer3d.render(this, this.lastDt || 0.016);
      ctx.clearRect(0, 0, this.viewW, this.viewH);
    } else {
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (!this.dungeon) return;

    ctx.save();
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    const { width, height, grid, explored, biome } = this.dungeon;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;

    // Pintar suelo (solo en fallback 2D) y etiquetas de hitos visibles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const vis = explored[y][x];
        if (vis === 0) continue;
        const t = grid[y][x];
        const iso = toIso(x, y);
        const alpha = vis === 2 ? 1 : 0.34;
        ctx.globalAlpha = alpha;

        if (!is3D) {
          if (t === TILE_WALL) {
            ctx.fillStyle = biome.wall;
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
            ctx.fillStyle = t === TILE_STAIRS ? '#3b2e16' : t === TILE_SHRINE ? '#172d3d' : biome.floor;
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
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▼ BAJAR [F]', iso.x, iso.y + hh - (is3D ? 18 : -4));
        } else if (t === TILE_SHRINE) {
          ctx.fillStyle = this.dungeon.shrine?.used ? '#64748b' : '#38bdf8';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✦ ALTAR [F]', iso.x, iso.y + hh - (is3D ? 18 : -4));
        }
      }
    }

    ctx.globalAlpha = 1;

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

    // Botín en el suelo (etiquetas de objetos)
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
        ctx.fillStyle = 'rgba(9,11,16,0.82)';
        ctx.fillRect(iso.x - 48, iso.y - 24, 96, 14);
        ctx.fillStyle = color;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.item.name.slice(0, 18), iso.x, iso.y - 14);
      }
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

    // Textos flotantes de combate
    for (const f of this.floaters) {
      const iso = toIso(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.life * 1.4);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, iso.x, iso.y - 34 - (0.9 - f.life) * 20);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _notify() {
    if (!this.onUiUpdate) return;
    const derived = computeHeroDerived(this.hero);
    const classDef = HERO_CLASSES[this.hero.classId];
    this.onUiUpdate({
      hero: this.hero,
      derived,
      classDef,
      floor: this.floor,
      biome: this.dungeon?.biome?.name || '',
      seed: this.seed,
      log: this.log,
      gameOver: this.gameOver,
      skills: classDef.skills,
    });
  }
}
