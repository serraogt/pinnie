// Ekranın ortasında sabit bir nişangah gösterip kullanıcının haritayı
// kaydırarak bir konum seçmesini sağlayan yeniden kullanılabilir
// bileşen. Hem "pini taşı" hem de GPS'siz fotoğraflar için konum
// seçiminde (7. adım) kullanılır.

import { openPanel, closePanel, nextZIndex } from '../router.js';

/**
 * @param {import('maplibre-gl').Map} map
 * @param {{title?: string, confirmLabel?: string}} [options]
 * @returns {Promise<{lat: number, lng: number}|null>} onaylanırsa konum, vazgeçilirse null
 */
export function pickLocationOnMap(map, options = {}) {
  const { title = 'Konum seç', confirmLabel = 'Buraya koy' } = options;

  return new Promise((resolve) => {
    let settled = false;
    let overlayEl = null;
    // closePanel()'in tetiklediği history.back() -> popstate, router'ın
    // onClose(null) çağrısını closePanel()'in kendi promise'ini çözmesinden
    // ÖNCE yapar. Bu yüzden "await closePanel(); finish(gerçekDeğer)" sırası
    // yarışı kaybeder (panel zaten null ile kapanmış olur). Çözüm: gerçek
    // değeri closePanel() çağrılmadan ÖNCE pendingResult'a yazıp onClose'un
    // bunu okumasını sağlamak.
    let pendingResult = null;

    function finish(result) {
      if (settled) return;
      settled = true;
      overlayEl?.remove();
      overlayEl = null;
      resolve(result);
    }

    overlayEl = document.createElement('div');
    overlayEl.className = 'crosshair-overlay';
    overlayEl.style.zIndex = String(nextZIndex());
    overlayEl.innerHTML = `
      <div class="crosshair-header">${title}</div>
      <div class="crosshair-mark" aria-hidden="true"></div>
      <div class="crosshair-actions">
        <button type="button" class="btn btn-secondary crosshair-cancel">Vazgeç</button>
        <button type="button" class="btn btn-primary crosshair-confirm">${confirmLabel}</button>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('.crosshair-confirm').addEventListener('click', async () => {
      const center = map.getCenter();
      pendingResult = { lat: center.lat, lng: center.lng };
      await closePanel();
      finish(pendingResult);
    });

    overlayEl.querySelector('.crosshair-cancel').addEventListener('click', () => {
      closePanel();
    });

    openPanel(() => finish(pendingResult));
  });
}
