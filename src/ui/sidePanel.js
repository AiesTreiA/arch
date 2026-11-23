/**
 * sidePanel.js — Panel lateral flotante de Evolución en Vivo y Equipamiento Visual (Paperdoll).
 * Muestra niveles de ataque total, defensa total, silueta ilustrada con ranuras de equipo
 * y estado en tiempo real del Modo Automático.
 */
import { RARITY_CLASS } from './itemsPanel.js';

export function createSideEvolvePanelController({ game, openDrawer }) {
  const panel = document.getElementById('sideEvolvePanel');
  if (!panel) return { update: () => {} };

  const collapseBtn = document.getElementById('btnSideToggleCollapse');
  const autoBtn = document.getElementById('btnSideToggleAuto');
  const autoBtnText = document.getElementById('sideAutoBtnText');
  const miniBadge = document.getElementById('sideMiniBadge');
  const autoStatusLabel = document.getElementById('sideAutoStatusLabel');

  const atkVal = document.getElementById('sideAtkVal');
  const defVal = document.getElementById('sideDefVal');
  const critVal = document.getElementById('sideCritVal');
  const mitigVal = document.getElementById('sideMitigVal');
  const skillMult = document.getElementById('sideSkillMult');
  const speedVal = document.getElementById('sideSpeedVal');

  const slotEls = {
    weapon: document.getElementById('sideSlotWeapon'),
    armor: document.getElementById('sideSlotArmor'),
    charm: document.getElementById('sideSlotCharm'),
  };

  const nameEls = {
    weapon: document.getElementById('sideWeaponName'),
    armor: document.getElementById('sideArmorName'),
    charm: document.getElementById('sideCharmName'),
  };

  const statEls = {
    weapon: document.getElementById('sideWeaponStats'),
    armor: document.getElementById('sideArmorStats'),
    charm: document.getElementById('sideCharmStats'),
  };

  const attrValues = document.getElementById('sideAttrValues');
  const talentBonus = document.getElementById('sideTalentBonus');

  const lastEquippedIds = { weapon: null, armor: null, charm: null };
  let isCollapsed = window.innerWidth < 820;

  if (isCollapsed) {
    panel.classList.add('is-collapsed');
    collapseBtn?.setAttribute('aria-expanded', 'false');
  }

  collapseBtn?.addEventListener('click', () => {
    isCollapsed = !isCollapsed;
    panel.classList.toggle('is-collapsed', isCollapsed);
    collapseBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  });

  autoBtn?.addEventListener('click', () => {
    game.toggleAutoManage();
  });

  // Clic en cualquiera de las ranuras abre la pestaña de ítems para inspeccionar
  for (const slotKey of ['weapon', 'armor', 'charm']) {
    slotEls[slotKey]?.addEventListener('click', () => {
      openDrawer?.('tabBtnItems');
    });
  }

  function update(state) {
    if (!state || !state.hero) return;
    const { hero, derived, autoManageEnabled } = state;
    const isAuto = Boolean(autoManageEnabled ?? game.autoManageEnabled);

    // 1. Botón y badge de Modo Auto
    if (autoBtn) {
      autoBtn.classList.toggle('is-active', isAuto);
      if (autoBtnText) autoBtnText.textContent = isAuto ? 'AUTO ON' : 'AUTO OFF';
    }
    if (miniBadge) {
      miniBadge.hidden = !isAuto;
    }
    if (autoStatusLabel) {
      autoStatusLabel.textContent = isAuto
        ? '⚡ Modo Auto: Auto-equipa mejores y ofrenda'
        : 'Modo Auto: Inactivo (control manual)';
      autoStatusLabel.style.color = isAuto ? '#4ade80' : '#94a3b8';
    }

    // 2. Ataque y Defensa Total
    if (atkVal) {
      atkVal.textContent = `${derived.minDamage}–${derived.maxDamage}`;
      const furyActive = (hero.buffs?.furyUntil || 0) > Date.now();
      atkVal.style.color = furyActive ? '#fb923c' : '#fef08a';
    }
    if (critVal) {
      critVal.textContent = `${Math.round(derived.critChance * 100)}% Crít`;
    }
    if (skillMult) {
      skillMult.textContent = `×${derived.skillPowerMult.toFixed(2)} Hab`;
    }

    if (defVal) {
      defVal.textContent = `${derived.armor} Def`;
      const shieldActive = (hero.buffs?.shieldUntil || 0) > Date.now();
      defVal.style.color = shieldActive ? '#38bdf8' : '#e0f2fe';
    }
    if (mitigVal) {
      const mitigPct = Math.min(75, Math.round((derived.armor / (derived.armor + 50)) * 100));
      mitigVal.textContent = `${mitigPct}% Mitig`;
    }
    if (speedVal) {
      speedVal.textContent = `${derived.speed.toFixed(1)} Vel`;
    }

    // 3. Ranuras del Paperdoll de equipamiento
    const eq = hero.equipment || {};
    for (const slot of ['weapon', 'armor', 'charm']) {
      const item = eq[slot];
      const slotCard = slotEls[slot];
      const nameEl = nameEls[slot];
      const statEl = statEls[slot];
      const prevId = lastEquippedIds[slot];

      if (slotCard) {
        // Quitar clases de rareza anteriores
        slotCard.className = 'side-eq-slot';
        if (item) {
          slotCard.classList.add(RARITY_CLASS[item.rarity] || 'rarity-common');
        } else {
          slotCard.classList.add('is-empty');
        }

        // Efecto visual si acaba de evolucionar / equiparse una pieza nueva
        if (prevId !== undefined && prevId !== null && item && item.id !== prevId) {
          slotCard.classList.add('has-upgraded');
          setTimeout(() => slotCard.classList.remove('has-upgraded'), 1600);
        }
      }

      lastEquippedIds[slot] = item ? item.id : null;

      if (nameEl) {
        nameEl.textContent = item ? item.name : 'Vacío';
        nameEl.style.color = item ? (item.color || '#f8fafc') : '#94a3b8';
      }

      if (statEl) {
        if (!item) {
          statEl.textContent = 'Sin equipar';
          statEl.style.color = '#64748b';
        } else if (slot === 'weapon') {
          const dmg = item.baseDamage ? `${item.baseDamage[0]}–${item.baseDamage[1]}` : '';
          statEl.textContent = dmg ? `+${dmg} Daño` : `${item.rarityLabel || ''}`;
          statEl.style.color = item.color || '#facc15';
        } else if (slot === 'armor') {
          statEl.textContent = item.baseArmor ? `+${item.baseArmor} Armadura` : `${item.rarityLabel || ''}`;
          statEl.style.color = item.color || '#38bdf8';
        } else {
          statEl.textContent = `${item.rarityLabel || 'Reliquia'} · Nv.${item.ilvl || 1}`;
          statEl.style.color = item.color || '#e5b869';
        }
      }
    }

    // 4. Feed de evolución
    if (attrValues && derived.stats) {
      const s = derived.stats;
      attrValues.textContent = `F:${s.strength} D:${s.dexterity} E:${s.spirit} V:${s.vitality}`;
    }

    if (talentBonus) {
      const totalBaseSkillPts = (hero.treePoints || [0, 0, 0]).reduce((a, b) => a + b, 0);
      const synPct = Math.round(totalBaseSkillPts * 8);
      talentBonus.textContent = `+${synPct}% Sinergia (${totalBaseSkillPts} pts)`;
    }
  }

  return { update };
}
