// Harita sürükleme/pinch hareketleriyle çakışmayan, genel amaçlı
// uzun basma algılayıcı (dokunma + fare). Masaüstünde sağ tık da
// aynı eylemi anında tetikler.

/**
 * @param {HTMLElement} element
 * @param {{onLongPress: (e: PointerEvent|MouseEvent) => void, duration?: number, moveTolerance?: number}} options
 * @returns {{detach: () => void, setEnabled: (enabled: boolean) => void}}
 */
export function attachLongPress(element, options) {
  const { onLongPress, duration = 500, moveTolerance = 10 } = options;

  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;
  let startX = 0;
  let startY = 0;
  /** @type {PointerEvent|null} */
  let startEvent = null;
  let enabled = true;

  function clear() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    startEvent = null;
  }

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    if (!enabled) return; // ör. pin taşıma/nişangah modu aktifken devre dışı
    if (e.button !== 0) return; // yalnızca sol tık / dokunma; sağ tık contextmenu ile ele alınır
    clear();
    startX = e.clientX;
    startY = e.clientY;
    startEvent = e;
    timer = setTimeout(() => {
      timer = null;
      const ev = startEvent;
      startEvent = null;
      if (ev) onLongPress(ev);
    }, duration);
  }

  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    if (!timer) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) > moveTolerance) clear();
  }

  /** @param {MouseEvent} e */
  function onContextMenu(e) {
    if (!enabled) return;
    e.preventDefault();
    clear();
    onLongPress(e);
  }

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', clear);
  element.addEventListener('pointercancel', clear);
  element.addEventListener('contextmenu', onContextMenu);

  return {
    detach() {
      clear();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', clear);
      element.removeEventListener('pointercancel', clear);
      element.removeEventListener('contextmenu', onContextMenu);
    },
    setEnabled(value) {
      enabled = value;
      if (!value) clear();
    },
  };
}
