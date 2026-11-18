/**
 * controls.js — Controles táctiles estilo Mobile Legends (joystick analógico izquierdo + botones derechos),
 * gestión de Fullscreen API con bloqueo horizontal opcional en móviles y detección de modo táctil.
 */

const TOUCH_MODE_KEY = 'arch_touch_mode_v1';

export function isCoarseTouchDevice() {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const noHover = window.matchMedia?.('(hover: none)').matches;
  return Boolean(coarse || (noHover && navigator.maxTouchPoints > 0));
}

export function getSavedTouchMode() {
  try {
    const val = localStorage.getItem(TOUCH_MODE_KEY);
    if (val === 'on' || val === 'off' || val === 'auto') return val;
  } catch {
    // Ignorar almacenamiento bloqueado
  }
  return 'auto';
}

export function saveTouchMode(mode) {
  try {
    localStorage.setItem(TOUCH_MODE_KEY, mode);
  } catch {
    // Ignorar almacenamiento bloqueado
  }
}

export function resolveTouchControlsVisible(mode) {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return isCoarseTouchDevice();
}

/**
 * Joystick analógico multitáctil estilo Mobile Legends.
 * Acepta toque directo sobre el anillo o captura dinámica en la zona inferior izquierda.
 */
export function createVirtualJoystick({ padEl, baseEl, knobEl, onChange }) {
  let activePointerId = null;
  let originX = 0;
  let originY = 0;

  const getRestCenter = () => {
    const padRect = padEl.getBoundingClientRect();
    return {
      x: padRect.left + padRect.width / 2,
      y: padRect.top + padRect.height / 2,
      padRect,
    };
  };

  const resetVisual = () => {
    activePointerId = null;
    padEl.classList.remove('is-active');
    baseEl.style.transform = '';
    knobEl.style.transform = '';
    onChange(0, 0);
  };

  const updateFromClient = (clientX, clientY) => {
    const baseSize = baseEl.offsetWidth || 116;
    const maxRadius = baseSize * 0.39;
    const dx = clientX - originX;
    const dy = clientY - originY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    knobEl.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;

    const norm = maxRadius > 0 ? clamped / maxRadius : 0;
    if (norm < 0.08) {
      onChange(0, 0);
    } else {
      onChange(Math.cos(angle) * norm, Math.sin(angle) * norm);
    }
  };

  padEl.addEventListener('contextmenu', (e) => e.preventDefault());

  padEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (activePointerId !== null) return;

    activePointerId = e.pointerId;
    try {
      padEl.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar si el navegador no soporta capture en este target
    }

    const { x: restX, y: restY, padRect } = getRestCenter();
    const baseRadius = (baseEl.offsetWidth || 116) / 2;
    const distFromRest = Math.hypot(e.clientX - restX, e.clientY - restY);

    if (distFromRest > baseRadius * 0.92) {
      const margin = Math.min(baseRadius * 0.55, 28);
      const cx = Math.max(padRect.left + margin, Math.min(padRect.right - margin, e.clientX));
      const cy = Math.max(padRect.top + margin, Math.min(padRect.bottom - margin, e.clientY));
      originX = cx;
      originY = cy;
      baseEl.style.transform = `translate3d(${(cx - restX).toFixed(1)}px, ${(cy - restY).toFixed(1)}px, 0)`;
    } else {
      originX = restX;
      originY = restY;
      baseEl.style.transform = '';
    }

    padEl.classList.add('is-active');
    updateFromClient(e.clientX, e.clientY);
  });

  padEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    e.stopPropagation();
    updateFromClient(e.clientX, e.clientY);
  });

  const endHandler = (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    e.stopPropagation();
    resetVisual();
  };

  padEl.addEventListener('pointerup', endHandler);
  padEl.addEventListener('pointercancel', endHandler);
  padEl.addEventListener('lostpointercapture', () => {
    if (activePointerId !== null) resetVisual();
  });

  window.addEventListener('blur', () => {
    if (activePointerId !== null) resetVisual();
  });

  return { reset: resetVisual };
}

/**
 * Enlaza un botón de combate multitáctil con respuesta inmediata en pointerdown y soporte mantener-pulsado.
 */
export function bindActionButton(el, { onPress, onHoldChange = null }) {
  if (!el) return;
  let activePointer = null;

  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // noop
    }
    el.classList.add('is-pressed');
    if (onHoldChange) onHoldChange(true);
    else if (onPress) onPress();
  });

  const release = (e) => {
    if (activePointer === null || e.pointerId !== activePointer) return;
    e.preventDefault();
    e.stopPropagation();
    activePointer = null;
    el.classList.remove('is-pressed');
    if (onHoldChange) onHoldChange(false);
  };

  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', () => {
    if (activePointer !== null) {
      activePointer = null;
      el.classList.remove('is-pressed');
      if (onHoldChange) onHoldChange(false);
    }
  });

  // Accesibilidad por teclado (Enter / Space) cuando se enfoca el botón
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.detail === 0 && onPress) {
      onPress();
    }
  });
}

/**
 * Controla la API nativa Fullscreen + bloqueo horizontal opcional en dispositivos móviles,
 * con degradación elegante a modo inmersivo CSS cuando iOS/Safari restringe requestFullscreen.
 */
export function createFullscreenController({ onStateChange, onNotice }) {
  const root = document.documentElement;

  const isNativeFullscreen = () =>
    Boolean(document.fullscreenElement || document.webkitFullscreenElement);

  const isActive = () => isNativeFullscreen() || root.classList.contains('immersive-mode');

  const sync = () => {
    if (isNativeFullscreen()) {
      root.classList.add('immersive-mode');
    }
    onStateChange?.(isActive(), isNativeFullscreen());
  };

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  async function enter({ lockLandscape = true } = {}) {
    let nativeOk = false;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (typeof req === 'function') {
      try {
        await req.call(root, { navigationUI: 'hide' });
        nativeOk = true;
      } catch {
        try {
          await req.call(root);
          nativeOk = true;
        } catch {
          nativeOk = false;
        }
      }
    }

    root.classList.add('immersive-mode');

    if (lockLandscape && isCoarseTouchDevice() && screen.orientation?.lock) {
      try {
        await screen.orientation.lock('landscape');
      } catch {
        // Algunos navegadores bloquean orientation.lock sin fullscreen nativo o en desktop
      }
    }

    if (!nativeOk) {
      onNotice?.(
        'Modo inmersivo activo. Si usas Safari/iOS, gira el teléfono a horizontal para los controles tipo MOBA.'
      );
    }
    sync();
    return nativeOk;
  }

  async function exit() {
    root.classList.remove('immersive-mode');
    if (isNativeFullscreen()) {
      const exitFn = document.exitFullscreen || document.webkitExitFullscreen;
      if (typeof exitFn === 'function') {
        try {
          await exitFn.call(document);
        } catch {
          // noop
        }
      }
    }
    try {
      screen.orientation?.unlock?.();
    } catch {
      // noop
    }
    sync();
  }

  async function toggle() {
    if (isActive()) {
      await exit();
    } else {
      await enter({ lockLandscape: true });
    }
  }

  return { enter, exit, toggle, isActive, isNativeFullscreen };
}
