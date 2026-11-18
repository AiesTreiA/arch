/**
 * icons.js — Iconos SVG limpios y estilizados (temática mitológica / ARPG) para HUD y controles.
 */

function svgWrap(paths, viewBox = '0 0 24 24') {
  return `<svg viewBox="${viewBox}" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export const UI_ICONS = {
  bag: svgWrap('<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  hero: svgWrap('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="m12 2 1.2 2.2M4.5 6l2 1.2M19.5 6l-2 1.2"/>'),
  quests: svgWrap('<path d="M6 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Z"/><path d="M9 9h6M9 13h6M9 17h4"/>'),
  potion: svgWrap('<path d="M10 3h4"/><path d="M11 3v3l-4.5 6.8A3 3 0 0 0 9 17.5h6a3 3 0 0 0 2.5-4.7L13 6V3"/><path d="M8.5 13.5h7" opacity="0.65"/>'),
  bonfire: svgWrap('<path d="M12 3c2 2.5 3.5 4.3 3.5 6.8a3.5 3.5 0 0 1-7 0C8.5 8 10 5.7 12 3Z"/><path d="m5 20 14-3M5 17l14 3"/>'),
  fullscreenEnter: svgWrap('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  fullscreenExit: svgWrap('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  zoomIn: svgWrap('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4M11 8v6M8 11h6"/>'),
  zoomOut: svgWrap('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4M8 11h6"/>'),
  gamepad: svgWrap('<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M8 10v4M6 12h4"/><circle cx="15.5" cy="11" r="0.9" fill="currentColor"/><circle cx="17.5" cy="13" r="0.9" fill="currentColor"/>'),
  close: svgWrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  sort: svgWrap('<path d="M4 7h11M4 12h8M4 17h5"/><path d="m17 7 3 3-3 3M20 10h-5"/>'),
  autoEquip: svgWrap('<path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5L12 15.6l-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z"/>'),
  salvage: svgWrap('<path d="M12 2c2 3 4 5.5 4 8.5a4 4 0 1 1-8 0c0-3 2-5.5 4-8.5Z"/><circle cx="12" cy="14" r="1.5"/>'),
};

export const SLOT_ICONS = {
  weapon: svgWrap('<path d="M14.5 4.5 19.5 9.5l-9.8 9.8-5.2.7.7-5.2 9.3-10.3Z"/><path d="m12.5 6.5 5 5"/>'),
  armor: svgWrap('<path d="M12 3 5 6v6c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z"/>'),
  charm: svgWrap('<path d="m12 3 3.5 6.5L22 12l-6.5 2.5L12 21l-3.5-6.5L2 12l6.5-2.5L12 3Z"/>'),
};

export const INTERACT_ICONS = {
  npc: svgWrap('<circle cx="12" cy="12" r="4"/><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/>'),
  chest: svgWrap('<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M4 12h16M12 10v4"/>'),
  shrine: svgWrap('<path d="m12 3 5 9-5 9-5-9 5-9Z"/><path d="M7 12h10"/>'),
  stairs: svgWrap('<path d="M4 18h4v-4h4v-4h4V6h4"/>'),
  default: svgWrap('<circle cx="12" cy="12" r="7"/><path d="M12 9v6M9 12h6"/>'),
};

const CLASS_ATTACK_ICONS = {
  campeon: svgWrap('<path d="m4 20 7-7M14 4l6 6-4 4-6-6 4-4Z"/><path d="m8 12 4 4"/>'),
  hoplita: svgWrap('<path d="m4 20 15-15M15 4h5v5"/><path d="M7 13l4 4"/>'),
  arquera: svgWrap('<path d="M5 19 19 5M14 5h5v5"/><path d="M5 9a10 10 0 0 0 10 10"/>'),
  oraculo: svgWrap('<path d="M13 3 6 14h6l-1 7 7-11h-6l1-7Z"/>'),
  necromante: svgWrap('<circle cx="12" cy="8" r="4"/><path d="M9 12v4l3 5 3-5v-4"/>'),
  sombra: svgWrap('<path d="m4 20 9-9M10 4l10 10M15 4l5 5-9 9"/>'),
  coribante: svgWrap('<path d="M12 3v18M7 8l5-5 5 5M6 15l6 6 6-6"/>'),
};

const SKILL_ICONS = {
  campeon: {
    q: svgWrap('<path d="M12 3a9 9 0 1 1-8.5 6"/><path d="M12 7a5 5 0 1 1-4.5 3M3 4v5h5"/>'),
    e: svgWrap('<path d="M12 4v6M8 6l1 4M16 6l-1 4"/><path d="M6 16a6 6 0 0 1 12 0"/><path d="M9 19h6"/>'),
  },
  hoplita: {
    q: svgWrap('<path d="M12 3 5 6v6c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z"/><path d="M9 12h6M12 9v6"/>'),
    e: svgWrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2"/>'),
  },
  arquera: {
    q: svgWrap('<path d="M4 12h16M15 7l5 5-5 5"/><path d="M8 7a6 6 0 0 0 0 10"/>'),
    e: svgWrap('<path d="m4 12 14-6M4 12h16M4 12l14 6"/>'),
  },
  oraculo: {
    q: svgWrap('<path d="M13 2 5 13h6l-1 9 9-12h-6l0-8Z"/>'),
    e: svgWrap('<circle cx="12" cy="12" r="7"/><path d="m12 7 3 5-3 5-3-5 3-5Z"/>'),
  },
  necromante: {
    q: svgWrap('<path d="m4 20 15-15M13 5h6v6"/><circle cx="9" cy="15" r="2.2"/>'),
    e: svgWrap('<circle cx="12" cy="12" r="7"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  },
  sombra: {
    q: svgWrap('<path d="m5 19 6-6 3 3 5-11-11 5 3 3-6 6Z"/>'),
    e: svgWrap('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1"/>'),
  },
  coribante: {
    q: svgWrap('<path d="M4 19h16M7 19l3-9 2 4 3-7 3 12"/>'),
    e: svgWrap('<path d="M6 17c0-5 2.5-9 6-11 3.5 2 6 6 6 11"/><path d="M8 8l-2-4 4 2M16 8l2-4-4 2"/>'),
  },
};

export function getAttackIcon(classId) {
  return CLASS_ATTACK_ICONS[classId] || CLASS_ATTACK_ICONS.hoplita;
}

export function getSkillIcon(classId, slot) {
  return SKILL_ICONS[classId]?.[slot] || UI_ICONS.hero;
}

export function getInteractIcon(kind) {
  return INTERACT_ICONS[kind] || INTERACT_ICONS.default;
}
