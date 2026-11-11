// Pin başlığı/notu için küçük düzenleme ekranı. Yalnızca ana
// uygulamada kullanılır (paylaşılabilir HTML dışa aktarımına
// gömülmez — salt okunur görüntüleyici düzenleme içermemeli).

import { openPanel, closePanel, nextZIndex } from '../router.js';
import * as pins from '../pins.js';

/**
 * @param {string} pinId
 * @returns {Promise<{title: string, note: string}|null>} kaydedilirse yeni değerler, vazgeçilirse null
 */
export async function openPinEditDialog(pinId) {
  const pin = await pins.getPin(pinId);
  if (!pin) return null;

  return new Promise((resolve) => {
    let settled = false;
    // closePanel()'in history.back() -> popstate akışı, router'ın
    // onClose(null) çağrısını buradaki "await closePanel(); finish(result)"
    // sırasından ÖNCE tetikler; bu yüzden gerçek değer, closePanel()
    // çağrılmadan önce pendingResult'a yazılıp onClose'a oradan aktarılır.
    let pendingResult = null;
    function finish(result) {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(result);
    }

    const overlay = document.createElement('div');
    overlay.className = 'pin-detail-overlay';
    overlay.style.zIndex = String(nextZIndex());

    const header = document.createElement('div');
    header.className = 'pin-detail-header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'pin-detail-back';
    backBtn.setAttribute('aria-label', 'Geri');
    backBtn.textContent = '‹';
    backBtn.addEventListener('click', () => closePanel());

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'pin-detail-title';
    titleInput.placeholder = 'Başlık ekle';
    titleInput.value = pin.title ?? '';

    header.append(backBtn, titleInput);

    const noteInput = document.createElement('textarea');
    noteInput.className = 'pin-detail-note';
    noteInput.placeholder = 'Not ekle';
    noteInput.rows = 4;
    noteInput.value = pin.note ?? '';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary pin-edit-save';
    saveBtn.textContent = 'Kaydet';
    saveBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const note = noteInput.value.trim();
      await pins.updatePinMeta(pinId, { title, note });
      pendingResult = { title, note };
      await closePanel();
      finish(pendingResult);
    });

    overlay.append(header, noteInput, saveBtn);
    document.body.appendChild(overlay);

    openPanel(() => finish(pendingResult));
  });
}
