/**
 * main.js — Orquestador de interfaz de ARCH:
 * Hoguera (selección 3D), HUD flotante, controles Mobile Legends / Desktop,
 * pantalla completa, cajón con pestañas (Ítems, Héroe, Oráculos) y alertas no bloqueantes.
 */
import { HERO_CLASSES } from '../core/combat.js';
import { CLASS_BASE_ITEMS } from '../core/loot.js';
import {
  DEFAULT_THEME_ID,
  applyThemeToDocument,
  getMetaverseTheme,
  listMetaverseThemes,
} from '../core/themes.js';
import { archAudio } from '../game/audio.js';
import { ArchGame } from '../game/engine.js';
import { HeroPreview3D } from '../game/models3d.js';
import {
  bindActionButton,
  createFullscreenController,
  createVirtualJoystick,
  getSavedTouchMode,
  resolveTouchControlsVisible,
  saveTouchMode,
} from './controls.js';
import { getAttackIcon, getInteractIcon, getSkillIcon, UI_ICONS } from './icons.js';
import { createItemsPanelController } from './itemsPanel.js';
import { createSideEvolvePanelController } from './sidePanel.js';

const $ = (id) => document.getElementById(id);

export function initArchUi() {
  let selectedClass = 'hoplita';
  let selectedTheme = DEFAULT_THEME_ID;
  let touchMode = getSavedTouchMode();
  let lastUiState = null;
  let toastTimer = null;
  let portraitHintDismissed = false;
  let wasGameOver = false;

  const classGrid = $('classGrid');
  const previewBox = $('classPreviewBox');
  const themePillsEl = $('themePills');
  const startModal = $('startModal');
  const gameDrawer = $('gameDrawer');
  const drawerSheet = gameDrawer.querySelector('.drawer-sheet');
  const gameOverModal = $('gameOverModal');
  const victoryModal = $('victoryModal');
  const storyModal = $('storyModal');
  const toastEl = $('hudToast');

  const heroPreview3d = new HeroPreview3D($('heroPreviewCanvas'));

  function renderThemePills() {
    const theme = getMetaverseTheme(selectedTheme);
    applyThemeToDocument(theme);
    heroPreview3d.setThemeColor(theme.ui?.accent || '#e5b869');
    if ($('startTitle')) $('startTitle').textContent = `🔥 ${theme.title}`;
    if ($('startIntroText')) $('startIntroText').textContent = theme.intro;
    if ($('startActTag')) $('startActTag').textContent = theme.badge;

    if (!themePillsEl) return;
    themePillsEl.innerHTML = '';
    for (const t of listMetaverseThemes()) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `theme-pill ${t.id === selectedTheme ? 'is-active' : ''}`;
      pill.textContent = t.name;
      pill.title = t.badge || t.name;
      pill.onclick = () => {
        selectedTheme = t.id;
        renderThemePills();
      };
      themePillsEl.appendChild(pill);
    }
  }

  function showToast({ title = '', message = '', color = '#e5b869', actionLabel = '', onAction = null, duration = 3800 }) {
    clearTimeout(toastTimer);
    toastEl.innerHTML = '';
    toastEl.style.setProperty('--toast-accent', color);

    const body = document.createElement('div');
    body.className = 'toast-body';
    if (title) {
      const t = document.createElement('strong');
      t.className = 'toast-title';
      t.style.color = color;
      t.textContent = title;
      body.appendChild(t);
    }
    if (message) {
      const m = document.createElement('span');
      m.className = 'toast-msg';
      m.textContent = message;
      body.appendChild(m);
    }
    toastEl.appendChild(body);

    if (actionLabel && onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'primary btn-mini';
      btn.textContent = actionLabel;
      btn.onclick = () => {
        onAction();
        toastEl.classList.remove('is-visible');
      };
      toastEl.appendChild(btn);
    }

    toastEl.classList.add('is-visible');
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), duration);
  }

  // Aplicar modo de controles táctiles (auto | on | off)
  function applyTouchMode() {
    const visible = resolveTouchControlsVisible(touchMode);
    document.documentElement.dataset.touchControls = visible ? 'on' : 'off';
    const modeLabel =
      touchMode === 'auto' ? 'Auto' : touchMode === 'on' ? 'Táctil' : 'PC';
    const btn = $('btnToggleTouch');
    if (btn) {
      btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
      btn.title = `Controles en pantalla: ${modeLabel} (clic para cambiar)`;
      const lbl = btn.querySelector('.hud-btn-tag');
      if (lbl) lbl.textContent = modeLabel;
    }
  }

  const fullscreenCtrl = createFullscreenController({
    onStateChange(active) {
      const fsBtn = $('btnFullscreen');
      if (fsBtn) {
        fsBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        fsBtn.title = active ? 'Salir de pantalla completa' : 'Pantalla completa';
        const iconSlot = fsBtn.querySelector('.hud-btn-icon');
        if (iconSlot) iconSlot.innerHTML = active ? UI_ICONS.fullscreenExit : UI_ICONS.fullscreenEnter;
        const lbl = fsBtn.querySelector('.hud-btn-label');
        if (lbl) lbl.textContent = active ? 'Salir' : 'Pantalla completa';
      }
      game._resize();
    },
    onNotice(msg) {
      showToast({ title: 'Vista inmersiva', message: msg, color: '#38bdf8', duration: 4200 });
    },
  });

  // Renderizado de tarjetas de clase en la Hoguera
  function renderClassCards() {
    classGrid.innerHTML = '';
    for (const cls of Object.values(HERO_CLASSES)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `class-card ${cls.id === selectedClass ? 'selected' : ''}`;

      const top = document.createElement('div');
      top.className = 'class-card-top';
      const nameEl = document.createElement('strong');
      nameEl.style.color = cls.color;
      nameEl.textContent = cls.name;
      const d2Tag = document.createElement('span');
      d2Tag.className = 'd2-tag';
      d2Tag.textContent = cls.d2Class || '';
      top.append(nameEl, d2Tag);

      const sub = document.createElement('div');
      sub.className = 'class-card-sub';
      sub.textContent = cls.subtitle;

      const trees = document.createElement('div');
      trees.className = 'class-card-trees';
      trees.textContent = (cls.trees || []).join(' · ');

      btn.append(top, sub, trees);
      btn.onclick = () => {
        selectedClass = cls.id;
        renderClassCards();
      };
      classGrid.appendChild(btn);
    }

    heroPreview3d.setClass(selectedClass);
    const sel = HERO_CLASSES[selectedClass];
    const starter = CLASS_BASE_ITEMS[selectedClass];

    previewBox.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'preview-head';
    const titleWrap = document.createElement('div');
    const titleStrong = document.createElement('strong');
    titleStrong.style.color = sel.color;
    titleStrong.style.fontSize = '15px';
    titleStrong.textContent = sel.name;
    const originSpan = document.createElement('span');
    originSpan.className = 'preview-origin';
    originSpan.textContent = ` · ${sel.origin}`;
    titleWrap.append(titleStrong, originSpan);

    const relicBadge = document.createElement('span');
    relicBadge.className = 'preview-relic';
    relicBadge.textContent = `Reliquia: ${starter.name} (+1 Talento)`;
    head.append(titleWrap, relicBadge);

    const prologue = document.createElement('p');
    prologue.className = 'preview-prologue';
    prologue.textContent = `«${sel.prologue}»`;

    const skillRow = document.createElement('div');
    skillRow.className = 'preview-skills';
    for (const [key, skill] of [
      ['Q', sel.skills.q],
      ['E', sel.skills.e],
    ]) {
      const chip = document.createElement('div');
      chip.className = 'preview-skill-chip';
      const k = document.createElement('strong');
      k.textContent = `[${key}] ${skill.name}: `;
      const desc = document.createElement('span');
      desc.textContent = skill.desc;
      chip.append(k, desc);
      skillRow.appendChild(chip);
    }

    previewBox.append(head, prologue, skillRow);
  }

  let itemsPanel = null;
  let sidePanel = null;

  // Actualización rápida de HUD (barras, cooldowns, buffs, botón contextual, panel lateral)
  function updateHudTick(tick) {
    const { hero, derived, classDef, skills, attackCdLeft, skillQCd, skillECd, furyLeftSec, shieldLeftSec, nearby, gameOver } = tick;
    sidePanel?.update(tick);

    $('hpBar').style.width = `${Math.max(0, Math.min(100, (hero.hp / derived.maxHp) * 100))}%`;
    $('manaBar').style.width = `${Math.max(0, Math.min(100, (hero.mana / derived.maxMana) * 100))}%`;
    $('xpBar').style.width = `${Math.max(0, Math.min(100, (hero.xp / hero.xpNext) * 100))}%`;
    $('hpText').textContent = `${Math.ceil(hero.hp)}/${derived.maxHp}`;
    $('manaText').textContent = `${Math.floor(hero.mana)}/${derived.maxMana}`;
    $('xpText').textContent = `${hero.xp}/${hero.xpNext}`;

    // Buffs activos en el HUD superior
    const buffBox = $('hudBuffs');
    buffBox.innerHTML = '';
    if (shieldLeftSec > 0.1) {
      const b = document.createElement('span');
      b.className = 'buff-pill buff-shield';
      b.textContent = `☀ Escudo ${shieldLeftSec.toFixed(1)}s`;
      buffBox.appendChild(b);
    }
    if (furyLeftSec > 0.1) {
      const b = document.createElement('span');
      b.className = 'buff-pill buff-fury';
      b.textContent = `🔥 Furia ${furyLeftSec.toFixed(1)}s`;
      buffBox.appendChild(b);
    }

    // Actualizar botones de habilidades (Desktop + Mobile Legends)
    const updateSkillBtn = (btnId, slot, cdLeft, skillDef) => {
      const btn = $(btnId);
      if (!btn || !skillDef) return;
      const ratio = skillDef.cd > 0 ? Math.max(0, Math.min(1, cdLeft / skillDef.cd)) : 0;
      const noMana = hero.mana < skillDef.cost;
      btn.style.setProperty('--cd-deg', `${(ratio * 360).toFixed(1)}deg`);
      btn.classList.toggle('is-cooldown', cdLeft > 0.05);
      btn.classList.toggle('is-no-mana', cdLeft <= 0.05 && noMana);
      const cdEl = btn.querySelector('.skill-cd-text');
      if (cdEl) cdEl.textContent = cdLeft > 0.05 ? `${cdLeft.toFixed(1)}` : '';
      const costEl = btn.querySelector('.skill-cost');
      if (costEl) costEl.textContent = `${skillDef.cost}`;
      const nameEl = btn.querySelector('.skill-short-name');
      if (nameEl) nameEl.textContent = skillDef.name;
      const iconEl = btn.querySelector('.skill-icon');
      if (iconEl && iconEl.dataset.classId !== `${classDef.id}-${slot}`) {
        iconEl.dataset.classId = `${classDef.id}-${slot}`;
        iconEl.innerHTML = getSkillIcon(classDef.id, slot);
      }
      btn.title = `[${slot.toUpperCase()}] ${skillDef.name} (${skillDef.cost} fervor) — ${skillDef.desc}`;
    };

    updateSkillBtn('btnTouchSkillQ', 'q', skillQCd, skills.q);
    updateSkillBtn('btnTouchSkillE', 'e', skillECd, skills.e);
    updateSkillBtn('btnDeskSkillQ', 'q', skillQCd, skills.q);
    updateSkillBtn('btnDeskSkillE', 'e', skillECd, skills.e);

    // Botón Ataque Básico
    const atkRatio = derived.attackCd > 0 ? Math.max(0, Math.min(1, attackCdLeft / derived.attackCd)) : 0;
    for (const id of ['btnTouchAttack', 'btnDeskAttack']) {
      const btn = $(id);
      if (!btn) continue;
      btn.style.setProperty('--cd-deg', `${(atkRatio * 360).toFixed(1)}deg`);
      btn.style.setProperty('--class-color', classDef.color);
      const iconEl = btn.querySelector('.skill-icon');
      if (iconEl && iconEl.dataset.classId !== classDef.id) {
        iconEl.dataset.classId = classDef.id;
        iconEl.innerHTML = getAttackIcon(classDef.id);
      }
    }

    // Pociones (Ambrosía)
    const potDisabled = hero.potions <= 0 || (hero.hp >= derived.maxHp && hero.mana >= derived.maxMana);
    for (const id of ['btnTouchPotion', 'btnDeskPotion', 'btnPotion']) {
      const btn = $(id);
      if (!btn) continue;
      btn.classList.toggle('is-muted', potDisabled);
      const countEl = btn.querySelector('.pot-count');
      if (countEl) countEl.textContent = String(hero.potions);
    }

    // Botón contextual Interactuar [F]
    for (const id of ['btnTouchInteract', 'btnDeskInteract']) {
      const btn = $(id);
      if (!btn) continue;
      btn.classList.toggle('has-target', Boolean(nearby));
      btn.dataset.interactKind = nearby?.kind || 'none';
      const iconEl = btn.querySelector('.skill-icon');
      const nextKind = nearby?.kind || 'default';
      if (iconEl && iconEl.dataset.kind !== nextKind) {
        iconEl.dataset.kind = nextKind;
        iconEl.innerHTML = getInteractIcon(nextKind);
      }
      const lblEl = btn.querySelector('.interact-label');
      if (lblEl) {
        lblEl.textContent = nearby ? nearby.label : 'Explorar';
      }
      btn.title = nearby ? `[F] ${nearby.hint}` : '[F] Interactuar (Sibila, cofre, altar o escaleras)';
    }

    if (gameOver && !wasGameOver) {
      wasGameOver = true;
      openGameOverDialog(tick);
    } else if (!gameOver) {
      wasGameOver = false;
    }
  }

  function openGameOverDialog(state) {
    if (gameDrawer.open) gameDrawer.close();
    const { hero } = state;
    const completed = (hero.quests || []).filter((q) => q.completed).length;
    $('gameOverSummary').textContent =
      `${hero.name} cayó en el Piso ${game.floor} (Nivel ${hero.level} · ${completed}/3 Hazañas cumplidas · ${hero.gold} dracmas).`;
    if (!gameOverModal.open) gameOverModal.showModal();
  }

  const STORY_CHAPTERS = [
    {
      badge: 'Capítulo I de IV',
      heading: 'El Ocaso del Soberano de los Muertos',
      art: '💀 ⚔ 👑',
      text: 'Hades, el Inconquistable Señor del Tártaro, cae de rodillas sobre las losas agrietadas de obsidiana. Su corona forjada en los albores del tiempo rueda por el suelo y las cadenas estigias que aprisionaban a los difuntos se pulverizan en una nube de ascuas.',
      quote: '«Mortal audaz... quebraste mi trono. Pero la muerte era el único cerrojo que contenía los horrores del Vacío Cósmico. Las estrellas ya reclaman tu sangre.»',
      btnText: 'Continuar la Visión →',
    },
    {
      badge: 'Capítulo II de IV',
      heading: 'El Despertar de los Titanes Primordiales',
      art: '🌋 ⚡ 🪐',
      text: 'Un rugido sísmico sacude la estructura misma de la realidad. El techo pétreo del Inframundo se fragmenta en millones de prismas luminosos. A través de la fisura dimensional, el oráculo de la Sibila resuena con fulgor divino:',
      quote: '«¡Héroe de la Hélade! Has purgado el abismo, pero la caída de Hades ha quebrado los Sellos Primigenios. El Firmamento de los Titanes despierta más allá de la tierra de los hombres.»',
      btnText: 'Ascender a las Alturas →',
    },
    {
      badge: 'Capítulo III de IV',
      heading: 'Trascendencia al Éter Astral',
      art: '✨ 🌌 🌀',
      text: 'Una columna de luz celestial turquesa y dorada desciende desde la bóveda hendida. Tu cuerpo mortal se desmaterializa en partículas estelares puras, elevándote a través de nebulosas infinitas, dejando atrás para siempre el polvo del Tártaro.',
      quote: '«Deja atrás las sombras de los muertos. Tu destino aguarda en las islas suspendidas del cosmos.»',
      btnText: 'Cruzar el Umbral Cósmico →',
    },
    {
      badge: 'Capítulo IV de IV',
      heading: 'Llegada al Nuevo Mundo: El Firmamento de los Titanes',
      art: '🏛 🌟 🪽',
      text: 'Abres los ojos sobre terrazas de mármol flotante que orbitan en el cosmos. Ríos de starlight turquesa fluyen entre obeliscos celestiales y santuarios de dioses antiguos que precedieron al Olimpo. Has conquistado el Inframundo terrenal y ahora te alzas en un Reino Superior.',
      quote: '«¡Tu gesta inmortal recomienza! Bienvenido a Mundo II: El Firmamento de los Titanes.»',
      btnText: '✦ Entrar al Nuevo Mundo (Mundo II) ✦',
    },
  ];

  let currentStoryStep = 0;

  function renderStoryStep(stepIndex) {
    currentStoryStep = Math.max(0, Math.min(STORY_CHAPTERS.length - 1, stepIndex));
    const ch = STORY_CHAPTERS[currentStoryStep];
    if ($('storyBadge')) $('storyBadge').textContent = ch.badge;
    if ($('storyTitle')) $('storyTitle').textContent = ch.heading;
    if ($('storyIllustration')) $('storyIllustration').textContent = ch.art;
    if ($('storyParagraph')) $('storyParagraph').textContent = ch.text;
    if ($('storyQuote')) $('storyQuote').textContent = ch.quote;
    if ($('btnStoryNext')) $('btnStoryNext').textContent = ch.btnText;

    const dots = document.querySelectorAll('#storyDots .story-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('is-active', idx === currentStoryStep);
    });
  }

  function openStoryDialog() {
    if (gameDrawer.open) gameDrawer.close();
    renderStoryStep(0);
    if (storyModal && !storyModal.open) storyModal.showModal();
  }

  function openVictoryDialog() {
    if (gameDrawer.open) gameDrawer.close();
    const hero = game.hero;
    if (!hero) return;
    const completed = (hero.quests || []).filter((q) => q.completed).length;
    $('victorySummary').textContent =
      `${hero.name} derrotó a Hades, Soberano del Tártaro, en el Piso ${game.floor} (Nivel ${hero.level} · ${completed}/3 Hazañas · ${hero.gold} dracmas). El Nuevo Mundo y el Abismo Infinito han quedado abiertos.`;
    if (victoryModal && !victoryModal.open) victoryModal.showModal();
  }

  const game = new ArchGame({
    canvas: $('gameCanvas'),
    onHudTick: updateHudTick,
    onEvent(ev) {
      if (ev.type === 'story_sequence') {
        openStoryDialog();
        return;
      }
      if (ev.type === 'victory') {
        // If story dialog is already open or scheduled, let story proceed; also allow opening victory dialog
        if (!storyModal || !storyModal.open) {
          openStoryDialog();
        }
        return;
      }
      if (ev.type === 'companion') {
        showToast({
          title: `⚔️ ${ev.title}`,
          message: ev.message,
          color: '#4ade80',
          duration: 4600,
        });
        return;
      }
      if (ev.type === 'loot' && ev.item) {
        showToast({
          title: `✦ ${ev.title}`,
          message: ev.message,
          color: ev.color || '#facc15',
          actionLabel: 'Equipar',
          onAction: () => game.equipItem(ev.item.id),
          duration: 4600,
        });
      } else {
        const color =
          ev.color ||
          (ev.type === 'levelup'
            ? '#facc15'
            : ev.type === 'quest'
            ? '#4ade80'
            : ev.type === 'shrine'
            ? '#38bdf8'
            : '#e5b869');
        showToast({ title: ev.title, message: ev.message, color, duration: 4000 });
      }
    },
    onUiUpdate(state) {
      lastUiState = state;
      const { hero, derived, classDef, floor, finalFloor = 22, isOverworld, currentZone, biome, log, skills } = state;

      if (isOverworld) {
        $('floorLabel').textContent = `Tierra 1/${finalFloor} · ${currentZone || biome}`;
      } else if (floor <= finalFloor) {
        $('floorLabel').textContent = `Piso ${floor}/${finalFloor} · ${biome}`;
      } else {
        $('floorLabel').textContent = `Abismo ${floor} · ${biome}`;
      }
      $('heroTitle').textContent = `${hero.name}`;
      $('heroLevelBadge').textContent = `Nv.${hero.level}`;
      $('heroCrest').style.background = classDef.color;
      $('goldText').textContent = String(hero.gold);

      // Badges en botones del HUD superior
      const bagBadge = $('bagBadge');
      bagBadge.textContent = `${hero.inventory.length}/16`;
      bagBadge.classList.toggle('is-full', hero.inventory.length >= 16);

      const pendingPts = (hero.statPoints || 0) + (hero.skillPoints || 0);
      const heroBadge = $('heroPtsBadge');
      heroBadge.hidden = pendingPts <= 0;
      heroBadge.textContent = `+${pendingPts}`;

      const completedQuests = (hero.quests || []).filter((q) => q.completed).length;
      $('questsBadge').textContent = `${completedQuests}/${(hero.quests || []).length}`;

      // Resumen en el cajón
      $('drawerHeroName').textContent = `${hero.name} · Nv.${hero.level}`;
      $('drawerGoldText').textContent = `${hero.gold} Dracmas`;

      // Pestaña Héroe: resumen de poder y habilidades
      $('heroPowerSummary').innerHTML = '';
      for (const [lbl, val] of [
        ['Daño', `${derived.minDamage}–${derived.maxDamage}`],
        ['Armadura', `${derived.armor}`],
        ['Crítico', `${Math.round(derived.critChance * 100)}%`],
        ['Velocidad', `${derived.speed.toFixed(1)}`],
        ['Salud/golpe', `${derived.lifeOnHit}`],
        ['Poder Hab.', `×${derived.skillPowerMult}`],
      ]) {
        const cell = document.createElement('div');
        cell.className = 'summary-stat';
        const l = document.createElement('span');
        l.textContent = lbl;
        const v = document.createElement('strong');
        v.textContent = val;
        cell.append(l, v);
        $('heroPowerSummary').appendChild(cell);
      }

      $('synergyBadge').textContent = `Poder ×${derived.skillPowerMult} (Sinergia +${derived.synergyBonusPct}%)`;
      $('btnSkillQ').textContent = `[Q] ${skills.q.name} (${skills.q.cost} fervor) — ${skills.q.desc}`;
      $('btnSkillE').textContent = `[E] ${skills.e.name} (${skills.e.cost} fervor) — ${skills.e.desc}`;
      $('ptsText').textContent = hero.statPoints > 0 ? `+${hero.statPoints} disp.` : '';
      $('skillPtsText').textContent = hero.skillPoints > 0 ? `+${hero.skillPoints} disp.` : '';

      // Árbol de Talentos (3 ramas)
      const treesBox = $('treesBox');
      treesBox.innerHTML = '';
      (classDef.trees || []).forEach((treeName, idx) => {
        const baseLv = derived.baseTrees[idx] || 0;
        const effLv = derived.effectiveTrees[idx] || 0;
        const row = document.createElement('div');
        row.className = 'tree-row';
        const top = document.createElement('div');
        top.className = 'stat-row';

        const label = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = treeName;
        label.append(strong, ` · Nv.${effLv} `);
        const baseInfo = document.createElement('small');
        baseInfo.className = 'muted-small';
        baseInfo.textContent = derived.allSkillBonus > 0 ? `[base ${baseLv} + ${derived.allSkillBonus} eq.]` : `[base ${baseLv}]`;
        label.appendChild(baseInfo);
        top.appendChild(label);

        if (hero.skillPoints > 0) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = '+ Talento';
          b.className = 'primary btn-mini';
          b.onclick = () => game.allocateSkill(idx);
          top.appendChild(b);
        }

        const desc = document.createElement('div');
        desc.className = 'tree-desc';
        desc.textContent = classDef.treeDesc?.[idx] || '';
        row.append(top, desc);
        treesBox.appendChild(row);
      });

      // Atributos
      const statsBox = $('statsBox');
      statsBox.innerHTML = '';
      const labels = { strength: 'Fuerza', dexterity: 'Destreza', spirit: 'Espíritu', vitality: 'Vitalidad' };
      for (const [k, lbl] of Object.entries(labels)) {
        const row = document.createElement('div');
        row.className = 'stat-row';
        const label = document.createElement('span');
        label.textContent = `${lbl}: `;
        const val = document.createElement('strong');
        val.textContent = String(derived.stats[k]);
        label.appendChild(val);
        row.appendChild(label);

        if (hero.statPoints > 0) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'primary btn-mini';
          b.textContent = '+1';
          b.onclick = () => game.allocateStat(k);
          row.appendChild(b);
        }
        statsBox.appendChild(row);
      }

      // Pestaña Oráculos y Crónica
      const questsBox = $('questsBox');
      questsBox.innerHTML = '';
      const appendQuestCard = ({ title, completed, progressText, desc, rewardText }) => {
        const qDiv = document.createElement('div');
        qDiv.className = `quest-card ${completed ? 'is-done' : ''}`;
        const qTop = document.createElement('div');
        qTop.className = 'quest-top';
        const qTitle = document.createElement('strong');
        qTitle.textContent = title;
        const qBadge = document.createElement('span');
        qBadge.className = 'quest-badge';
        qBadge.textContent = completed ? '✔ Cumplida' : progressText;
        qTop.append(qTitle, qBadge);

        const qDesc = document.createElement('div');
        qDesc.className = 'quest-desc';
        qDesc.textContent = desc;

        const qReward = document.createElement('div');
        qReward.className = 'quest-reward';
        qReward.textContent = rewardText;

        qDiv.append(qTop, qDesc, qReward);
        questsBox.appendChild(qDiv);
      };

      for (const q of hero.quests || []) {
        appendQuestCard({
          title: q.title,
          completed: q.completed,
          progressText: `${q.progress}/${q.targetCount}`,
          desc: q.desc,
          rewardText: `Don: ${q.rewardText}`,
        });
      }

      appendQuestCard({
        title: `IV. Trono del Tártaro (Piso ${finalFloor})`,
        completed: Boolean(state.finalBossDefeated),
        progressText: `Piso ${Math.min(floor, finalFloor)}/${finalFloor}`,
        desc: 'Desciende desde la Tierra (Piso 1) hasta el Piso 22 y derrota a Hades, Soberano del Tártaro.',
        rewardText: 'Don: Victoria Olímpica + Reliquia Única Divina + Modo Abismo Infinito',
      });

      const logBox = $('logBox');
      logBox.innerHTML = '';
      for (const entry of log) {
        const li = document.createElement('li');
        li.textContent = entry;
        logBox.appendChild(li);
      }

      // Pestaña Ítems (Equipo + Comparador + Mochila)
      itemsPanel?.render(state);
      sidePanel?.update(state);
    },
  });

  itemsPanel = createItemsPanelController({
    equipRoot: $('equipBox'),
    invRoot: $('invBox'),
    game,
  });

  sidePanel = createSideEvolvePanelController({
    game,
    openDrawer,
  });

  // Pestañas del cajón (ARIA Tabs + navegación por teclado)
  const tabs = Array.from(gameDrawer.querySelectorAll('[role="tab"]'));
  const panels = Array.from(gameDrawer.querySelectorAll('[role="tabpanel"]'));

  function selectTab(tabId) {
    for (const tab of tabs) {
      const selected = tab.id === tabId;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
      tab.toggleAttribute('focusgroupstart', selected);
      if (selected) {
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    for (const panel of panels) {
      const match = panel.getAttribute('aria-labelledby') === tabId;
      panel.hidden = !match;
      if (match) panel.setAttribute('tabindex', '0');
      else panel.removeAttribute('tabindex');
    }
  }

  const hasNativeFocusGroup = 'focusGroup' in HTMLElement.prototype;
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.id));
    if (hasNativeFocusGroup) {
      tab.addEventListener('focusin', () => selectTab(tab.id));
    } else {
      tab.addEventListener('keydown', (e) => {
        const idx = tabs.indexOf(tab);
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = tabs[(idx + 1) % tabs.length];
          selectTab(next.id);
          next.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
          selectTab(prev.id);
          prev.focus();
        }
      });
    }
  }

  function openDrawer(tabId = 'tabBtnItems') {
    selectTab(tabId);
    if (!gameDrawer.open) {
      gameDrawer.showModal();
    }
  }

  function closeDrawer() {
    if (gameDrawer.open) {
      gameDrawer.close();
    }
  }

  let drawerPressStartedOutside = false;
  gameDrawer.addEventListener('pointerdown', (e) => {
    drawerPressStartedOutside = !drawerSheet.contains(e.target);
  });
  gameDrawer.addEventListener('click', (e) => {
    if (drawerPressStartedOutside && !drawerSheet.contains(e.target)) closeDrawer();
    drawerPressStartedOutside = false;
  });

  $('btnCloseDrawer').onclick = closeDrawer;
  $('btnOpenItems').onclick = () => openDrawer('tabBtnItems');
  $('btnOpenHero').onclick = () => openDrawer('tabBtnHero');
  $('btnOpenQuests').onclick = () => openDrawer('tabBtnQuests');

  // Selector de modo táctil dentro del cajón y botón rápido en HUD
  const touchSelect = $('touchModeSelect');
  if (touchSelect) {
    touchSelect.value = touchMode;
    touchSelect.onchange = () => {
      touchMode = touchSelect.value;
      saveTouchMode(touchMode);
      applyTouchMode();
    };
  }

  $('btnToggleTouch').onclick = () => {
    const order = ['auto', 'on', 'off'];
    touchMode = order[(order.indexOf(touchMode) + 1) % order.length];
    saveTouchMode(touchMode);
    if (touchSelect) touchSelect.value = touchMode;
    applyTouchMode();
    const labelMap = {
      auto: 'Automático (táctil en móvil)',
      on: 'Controles Mobile Legends activados',
      off: 'Barra de escritorio (teclado/ratón)',
    };
    showToast({ title: 'Controles', message: labelMap[touchMode], color: '#38bdf8', duration: 2400 });
  };

  // Botones Zoom, Audio Acústico y Pantalla Completa
  $('btnZoomIn').onclick = () => game.adjustZoom(0.15);
  $('btnZoomOut').onclick = () => game.adjustZoom(-0.15);
  $('btnFullscreen').onclick = () => fullscreenCtrl.toggle();

  function syncAudioUi() {
    const isMuted = archAudio.muted;
    const btnSound = $('btnToggleSound');
    if (btnSound) {
      btnSound.setAttribute('aria-pressed', isMuted ? 'false' : 'true');
      btnSound.title = isMuted ? 'Audio silenciado (clic o [M] para activar)' : 'Audio Acústico activo (clic o [M] para silenciar)';
    }
    const iconSound = $('iconSound');
    if (iconSound) {
      iconSound.innerHTML = isMuted ? UI_ICONS.soundOff : UI_ICONS.soundOn;
    }
    const soundTag = $('soundTag');
    if (soundTag) {
      soundTag.textContent = isMuted ? 'Mudo' : 'Audio';
    }
    const mSlider = $('musicVolSlider');
    if (mSlider) mSlider.value = String(Math.round(archAudio.musicVolume * 100));
    const sSlider = $('sfxVolSlider');
    if (sSlider) sSlider.value = String(Math.round(archAudio.sfxVolume * 100));
  }

  if ($('btnToggleSound')) {
    $('btnToggleSound').onclick = () => {
      const muted = archAudio.toggleMute();
      syncAudioUi();
      showToast({
        title: muted ? '🔇 Audio Silenciado' : '🔊 Audio Acústico Activado',
        message: muted ? 'Música y efectos desactivados' : 'Kithara griega (Karplus-Strong) y efectos físicos activos',
        color: muted ? '#94a3b8' : '#4ade80',
        duration: 2400,
      });
    };
  }

  if ($('musicVolSlider')) {
    $('musicVolSlider').oninput = (e) => {
      archAudio.init();
      archAudio.setVolumes({ music: Number(e.target.value) / 100 });
    };
  }
  if ($('sfxVolSlider')) {
    $('sfxVolSlider').oninput = (e) => {
      archAudio.init();
      archAudio.setVolumes({ sfx: Number(e.target.value) / 100 });
    };
  }

  // Controles Mobile Legends (Joystick Izquierdo + Botones Derechos)
  createVirtualJoystick({
    padEl: $('joystickPad'),
    baseEl: $('joystickBase'),
    knobEl: $('joystickKnob'),
    onChange: (jx, jy) => game.setJoystick(jx, jy),
  });

  bindActionButton($('btnTouchAttack'), {
    onHoldChange: (held) => game.setAttackHeld(held),
    onPress: () => game.basicAttackNearest({ allowInteract: false }),
  });
  bindActionButton($('btnTouchSkillQ'), { onPress: () => game.castSkill('q') });
  bindActionButton($('btnTouchSkillE'), { onPress: () => game.castSkill('e') });
  bindActionButton($('btnTouchPotion'), { onPress: () => game.usePotion() });
  bindActionButton($('btnTouchInteract'), { onPress: () => game.interactNearby() });

  // Barra de acción Desktop
  $('btnDeskAttack').onclick = () => game.basicAttackNearest({ allowInteract: false });
  $('btnDeskSkillQ').onclick = () => game.castSkill('q');
  $('btnDeskSkillE').onclick = () => game.castSkill('e');
  $('btnDeskPotion').onclick = () => game.usePotion();
  $('btnDeskInteract').onclick = () => game.interactNearby();

  // Botones dentro del cajón
  $('btnPotion').onclick = () => game.usePotion();
  $('btnSkillQ').onclick = () => game.castSkill('q');
  $('btnSkillE').onclick = () => game.castSkill('e');

  // Atajos de teclado para abrir cajón (I, C, K) y silenciar audio (M)
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (startModal.open) return;
    const k = e.key.toLowerCase();
    if (k === 'i') {
      e.preventDefault();
      if (gameDrawer.open && $('tabBtnItems').getAttribute('aria-selected') === 'true') closeDrawer();
      else openDrawer('tabBtnItems');
    } else if (k === 'c') {
      e.preventDefault();
      if (gameDrawer.open && $('tabBtnHero').getAttribute('aria-selected') === 'true') closeDrawer();
      else openDrawer('tabBtnHero');
    } else if (k === 'k') {
      e.preventDefault();
      if (gameDrawer.open && $('tabBtnQuests').getAttribute('aria-selected') === 'true') closeDrawer();
      else openDrawer('tabBtnQuests');
    } else if (k === 'm') {
      e.preventDefault();
      archAudio.toggleMute();
      syncAudioUi();
    }
  });

  // Hoguera / Inicio de partida
  function launchRun({ withFullscreen = false } = {}) {
    archAudio.init();
    archAudio.playFanfare('shrine');
    if (startModal.open) startModal.close();
    if (gameOverModal.open) gameOverModal.close();
    if (victoryModal?.open) victoryModal.close();
    if (withFullscreen) {
      fullscreenCtrl.enter({ lockLandscape: true });
    }
    game.startNewGame({
      classId: selectedClass,
      heroName: $('heroNameInput').value,
      seed: $('seedInput').value,
      themeId: selectedTheme,
    });
  }

  $('btnStart').onclick = () => launchRun({ withFullscreen: false });
  $('btnStartFullscreen').onclick = () => launchRun({ withFullscreen: true });

  $('btnNewRun').onclick = () => {
    if (gameDrawer.open) closeDrawer();
    $('btnCancelStart').hidden = !game.running;
    if (!startModal.open) startModal.showModal();
    requestAnimationFrame(() => heroPreview3d.resize());
  };
  $('btnCancelStart').onclick = () => {
    if (game.running && startModal.open) startModal.close();
  };
  startModal.addEventListener('cancel', (e) => {
    if (!game.running) e.preventDefault();
  });

  $('btnGameOverBonfire').onclick = () => {
    if (gameOverModal.open) gameOverModal.close();
    $('btnCancelStart').hidden = true;
    if (!startModal.open) startModal.showModal();
    requestAnimationFrame(() => heroPreview3d.resize());
  };
  $('btnGameOverRetry').onclick = () => launchRun({ withFullscreen: fullscreenCtrl.isActive() });

  if ($('btnVictoryBonfire')) {
    $('btnVictoryBonfire').onclick = () => {
      if (victoryModal?.open) victoryModal.close();
      $('btnCancelStart').hidden = true;
      if (!startModal.open) startModal.showModal();
    };
  }
  if ($('btnVictoryStory')) {
    $('btnVictoryStory').onclick = () => {
      if (victoryModal?.open) victoryModal.close();
      openStoryDialog();
    };
  }
  if ($('btnVictoryEndless')) {
    $('btnVictoryEndless').onclick = () => {
      if (victoryModal?.open) victoryModal.close();
      game.transitionToNewWorld();
    };
  }

  if ($('btnStoryNext')) {
    $('btnStoryNext').onclick = () => {
      if (currentStoryStep < STORY_CHAPTERS.length - 1) {
        renderStoryStep(currentStoryStep + 1);
      } else {
        if (storyModal?.open) storyModal.close();
        game.transitionToNewWorld();
        showToast({
          title: '🌌 ¡Mundo II Desbloqueado!',
          message: 'Bienvenido al Firmamento de los Titanes. Explora las islas cósmicas.',
          color: '#38bdf8',
          duration: 5500,
        });
      }
    };
  }

  // Aviso de orientación vertical en móvil
  const dismissPortraitHint = $('btnDismissRotateHint');
  if (dismissPortraitHint) {
    dismissPortraitHint.onclick = () => {
      portraitHintDismissed = true;
      $('portraitHint')?.classList.add('is-dismissed');
    };
  }
  const syncMediaChanges = () => {
    applyTouchMode();
    if (!portraitHintDismissed && window.matchMedia?.('(orientation: landscape)').matches) {
      $('portraitHint')?.classList.remove('is-dismissed');
    }
  };
  window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', syncMediaChanges);
  window.matchMedia?.('(orientation: landscape)').addEventListener?.('change', syncMediaChanges);

  // Inyectar iconos iniciales en botones de HUD
  $('iconBag').innerHTML = UI_ICONS.bag;
  $('iconHero').innerHTML = UI_ICONS.hero;
  $('iconQuests').innerHTML = UI_ICONS.quests;
  $('iconZoomOut').innerHTML = UI_ICONS.zoomOut;
  $('iconZoomIn').innerHTML = UI_ICONS.zoomIn;
  $('iconTouch').innerHTML = UI_ICONS.gamepad;
  $('iconFullscreen').innerHTML = UI_ICONS.fullscreenEnter;
  $('iconBonfire').innerHTML = UI_ICONS.bonfire;
  $('iconCloseDrawer').innerHTML = UI_ICONS.close;
  for (const id of ['btnTouchPotion', 'btnDeskPotion']) {
    const icon = $(id)?.querySelector('.skill-icon');
    if (icon) icon.innerHTML = UI_ICONS.potion;
  }

  syncAudioUi();
  applyTouchMode();
  renderThemePills();
  renderClassCards();
  startModal.showModal();
  requestAnimationFrame(() => heroPreview3d.resize());

  // Exponer utilidades para depuración / pruebas si hace falta
  return { game, openDrawer, closeDrawer, fullscreenCtrl, lastState: () => lastUiState };
}

initArchUi();
