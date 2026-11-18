/**
 * itemsPanel.js — Panel organizado de Equipo, Comparador de Estadísticas y Mochila.
 */
import { HERO_CLASSES } from '../core/combat.js';
import {
  compareItems,
  getItemSalvageValue,
  getItemStatEntries,
  SLOT_LABELS,
} from '../core/loot.js';
import { SLOT_ICONS, UI_ICONS } from './icons.js';

const RARITY_CLASS = {
  common: 'rarity-common',
  magic: 'rarity-magic',
  rare: 'rarity-rare',
  unique: 'rarity-unique',
};

const VERDICT_META = {
  empty: { label: 'Ranura vacía', cls: 'verdict-empty' },
  better: { label: 'Mejora', cls: 'verdict-better' },
  worse: { label: 'Inferior', cls: 'verdict-worse' },
  even: { label: 'Equivalente', cls: 'verdict-even' },
};

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function renderStatChips(container, entries) {
  for (const stat of entries) {
    const chip = el('span', `stat-chip stat-chip-${stat.kind}`, stat.label);
    container.appendChild(chip);
  }
}

export function createItemsPanelController({ equipRoot, invRoot, game }) {
  let activeFilter = 'all';
  let selectedItemId = null;
  let lastState = null;

  function render(state) {
    lastState = state;
    const { hero } = state;

    // 1. Equipo Actual (3 ranuras)
    equipRoot.innerHTML = '';
    const equipGrid = el('div', 'equip-grid');

    for (const [slot, slotLabel] of [
      ['weapon', 'Arma'],
      ['armor', 'Armadura'],
      ['charm', 'Reliquia'],
    ]) {
      const item = hero.equipment[slot];
      const card = el('div', `equip-slot-card ${item ? RARITY_CLASS[item.rarity] || '' : 'is-empty'}`);

      const head = el('div', 'equip-slot-head');
      const titleWrap = el('div', 'equip-slot-title-wrap');
      const iconBox = el('span', 'slot-icon');
      iconBox.innerHTML = SLOT_ICONS[slot] || '';
      const slotTag = el('span', 'slot-tag', slotLabel);
      titleWrap.append(iconBox, slotTag);

      head.appendChild(titleWrap);
      if (item) {
        const unequipBtn = el('button', 'btn-mini', 'Guardar');
        unequipBtn.type = 'button';
        unequipBtn.title = 'Mover a la mochila';
        unequipBtn.onclick = () => game.unequipItem(slot);
        head.appendChild(unequipBtn);
      }
      card.appendChild(head);

      if (!item) {
        card.appendChild(el('div', 'equip-empty-label', 'Ranura vacía'));
      } else {
        const nameRow = el('div', 'item-name-row');
        const nameEl = el('strong', 'item-name', item.name);
        nameEl.style.color = item.color;
        const metaEl = el('span', 'item-meta', `${item.rarityLabel} · Nv.${item.ilvl || 1}`);
        nameRow.append(nameEl, metaEl);
        card.appendChild(nameRow);

        if (item.forClass) {
          const clsName = HERO_CLASSES[item.forClass]?.name || item.forClass;
          const match = item.forClass === hero.classId;
          card.appendChild(
            el('div', `class-affinity ${match ? 'is-match' : 'is-other'}`, `${match ? '★ ' : ''}Afinidad: ${clsName}`)
          );
        }

        const chips = el('div', 'stat-chips');
        renderStatChips(chips, getItemStatEntries(item));
        card.appendChild(chips);

        if (item.lore) {
          card.appendChild(el('div', 'item-lore', `«${item.lore}»`));
        }
      }
      equipGrid.appendChild(card);
    }
    equipRoot.appendChild(equipGrid);

    // 2. Mochila: Filtros + Ordenar + Inspector + Lista
    invRoot.innerHTML = '';
    const inventory = hero.inventory || [];

    const toolbar = el('div', 'inv-toolbar');
    const filterGroup = el('div', 'inv-filters');
    const counts = {
      all: inventory.length,
      weapon: inventory.filter((i) => i.slot === 'weapon').length,
      armor: inventory.filter((i) => i.slot === 'armor').length,
      charm: inventory.filter((i) => i.slot === 'charm').length,
    };

    for (const [key, label] of [
      ['all', `Todo (${counts.all})`],
      ['weapon', `Armas (${counts.weapon})`],
      ['armor', `Armad. (${counts.armor})`],
      ['charm', `Reliq. (${counts.charm})`],
    ]) {
      const btn = el('button', `filter-pill ${activeFilter === key ? 'is-active' : ''}`, label);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', activeFilter === key ? 'true' : 'false');
      btn.onclick = () => {
        activeFilter = key;
        if (lastState) render(lastState);
      };
      filterGroup.appendChild(btn);
    }

    const sortBtn = el('button', 'btn-sort');
    sortBtn.type = 'button';
    sortBtn.title = 'Ordenar mochila por rareza y poder';
    sortBtn.innerHTML = `${UI_ICONS.sort}<span>Ordenar</span>`;
    sortBtn.onclick = () => game.sortInventory();

    toolbar.append(filterGroup, sortBtn);
    invRoot.appendChild(toolbar);

    const visibleItems =
      activeFilter === 'all' ? inventory : inventory.filter((i) => i.slot === activeFilter);

    if (visibleItems.length === 0) {
      invRoot.appendChild(
        el(
          'div',
          'inv-empty',
          inventory.length === 0
            ? 'Mochila vacía. Abre cofres o derrota enemigos para conseguir reliquias.'
            : 'No hay objetos en esta categoría.'
        )
      );
      return;
    }

    if (!selectedItemId || !visibleItems.some((i) => i.id === selectedItemId)) {
      selectedItemId = visibleItems[0].id;
    }

    // Inspector / Comparador del ítem seleccionado
    const selectedItem = visibleItems.find((i) => i.id === selectedItemId);
    if (selectedItem) {
      const equipped = hero.equipment[selectedItem.slot];
      const cmp = compareItems(selectedItem, equipped, hero.classId);
      const verdictInfo = VERDICT_META[cmp.verdict] || VERDICT_META.even;
      const salvageGold = getItemSalvageValue(selectedItem);

      const inspector = el('div', `item-inspector ${RARITY_CLASS[selectedItem.rarity] || ''}`);
      const inspHead = el('div', 'inspector-head');
      const inspTitle = el('div', 'inspector-title-col');
      const nameEl = el('strong', 'item-name', selectedItem.name);
      nameEl.style.color = selectedItem.color;
      inspTitle.append(
        nameEl,
        el(
          'div',
          'item-meta',
          `${SLOT_LABELS[selectedItem.slot] || selectedItem.slot} · ${selectedItem.rarityLabel} · Nv.${selectedItem.ilvl || 1}`
        )
      );

      const badge = el('span', `verdict-badge ${verdictInfo.cls}`, verdictInfo.label);
      inspHead.append(inspTitle, badge);
      inspector.appendChild(inspHead);

      if (selectedItem.forClass) {
        const clsName = HERO_CLASSES[selectedItem.forClass]?.name || selectedItem.forClass;
        const match = selectedItem.forClass === hero.classId;
        inspector.appendChild(
          el('div', `class-affinity ${match ? 'is-match' : 'is-other'}`, `${match ? '★ ' : ''}Exclusivo sugerido: ${clsName}`)
        );
      }

      const statChips = el('div', 'stat-chips');
      renderStatChips(statChips, getItemStatEntries(selectedItem));
      inspector.appendChild(statChips);

      if (selectedItem.lore) {
        inspector.appendChild(el('div', 'item-lore', `«${selectedItem.lore}»`));
      }

      if (cmp.diffs.length > 0) {
        const cmpBox = el('div', 'cmp-box');
        cmpBox.appendChild(
          el('div', 'cmp-label', equipped ? `Vs. ${equipped.name}:` : 'Sin objeto equipado en esta ranura:')
        );
        const diffChips = el('div', 'diff-chips');
        for (const d of cmp.diffs) {
          diffChips.appendChild(el('span', `diff-chip ${d.positive ? 'is-pos' : 'is-neg'}`, d.label));
        }
        cmpBox.appendChild(diffChips);
        inspector.appendChild(cmpBox);
      }

      const actions = el('div', 'inspector-actions');
      const equipBtn = el('button', 'primary btn-action', 'Equipar');
      equipBtn.type = 'button';
      equipBtn.onclick = () => game.equipItem(selectedItem.id);

      const salvageBtn = el('button', 'btn-salvage btn-action', `Ofrendar (+${salvageGold} Dr.)`);
      salvageBtn.type = 'button';
      salvageBtn.onclick = () => game.salvageItem(selectedItem.id);

      const dropBtn = el('button', 'btn-drop btn-action', 'Soltar');
      dropBtn.type = 'button';
      dropBtn.onclick = () => game.dropInventoryItem(selectedItem.id);

      actions.append(equipBtn, salvageBtn, dropBtn);
      inspector.appendChild(actions);
      invRoot.appendChild(inspector);
    }

    // Lista compacta de ítems en mochila
    const list = el('div', 'inv-list');
    for (const item of visibleItems) {
      const equipped = hero.equipment[item.slot];
      const cmp = compareItems(item, equipped, hero.classId);
      const isSelected = item.id === selectedItemId;

      const row = el('div', `inv-item-card ${RARITY_CLASS[item.rarity] || ''} ${isSelected ? 'is-selected' : ''}`);
      row.onclick = () => {
        selectedItemId = item.id;
        render(state);
      };

      const mainBtn = el('button', 'inv-item-select');
      mainBtn.type = 'button';
      const topLine = el('div', 'inv-item-top');
      const slotIcon = el('span', 'slot-icon');
      slotIcon.innerHTML = SLOT_ICONS[item.slot] || '';
      const title = el('span', 'inv-item-name', item.name);
      title.style.color = item.color;
      const cmpPill = el(
        'span',
        `cmp-mini ${cmp.verdict === 'better' || cmp.verdict === 'empty' ? 'is-up' : cmp.verdict === 'worse' ? 'is-down' : 'is-eq'}`,
        cmp.verdict === 'better' || cmp.verdict === 'empty' ? '▲' : cmp.verdict === 'worse' ? '▼' : '≈'
      );
      topLine.append(slotIcon, title, cmpPill);

      const summaryLine = el('div', 'inv-item-summary');
      const entries = getItemStatEntries(item).slice(0, 3);
      summaryLine.textContent = entries.length > 0 ? entries.map((s) => s.label).join(' · ') : `Nv.${item.ilvl || 1}`;
      mainBtn.append(topLine, summaryLine);

      const quickEquip = el('button', 'btn-quick-equip', 'Equipar');
      quickEquip.type = 'button';
      quickEquip.onclick = (e) => {
        e.stopPropagation();
        game.equipItem(item.id);
      };

      row.append(mainBtn, quickEquip);
      list.appendChild(row);
    }
    invRoot.appendChild(list);
  }

  return { render };
}
