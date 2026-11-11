// Basit, yeniden kullanılabilir seçim/bilgi diyaloğu. Geri tuşu
// router.js üzerinden "vazgeç" (null) ile kapatır.

import { openPanel, closePanel, nextZIndex } from '../router.js';

/**
 * @param {{title: string, message?: string, choices: Array<{label: string, value: any, danger?: boolean}>, cancelLabel?: string}} options
 * @returns {Promise<any|null>} seçilen choice.value, vazgeçilirse null
 */
export function showChoiceDialog({ title, message, choices, cancelLabel = 'Vazgeç' }) {
  return new Promise((resolve) => {
    let settled = false;
    // closePanel()'in history.back() -> popstate akışı, router'ın
    // onClose(null) çağrısını buradaki "await closePanel(); finish(value)"
    // sırasından ÖNCE tetikler; bu yüzden gerçek değer, closePanel()
    // çağrılmadan önce pendingValue'ya yazılıp onClose'a oradan aktarılır.
    let pendingValue = null;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.style.zIndex = String(nextZIndex());

    function finish(value) {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(value);
    }

    const card = document.createElement('div');
    card.className = 'dialog-card';

    const h = document.createElement('h3');
    h.className = 'dialog-title';
    h.textContent = title;
    card.appendChild(h);

    if (message) {
      const p = document.createElement('p');
      p.className = 'dialog-message';
      p.textContent = message;
      card.appendChild(p);
    }

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dialog-action ${choice.danger ? 'dialog-action-destructive' : ''}`;
      btn.textContent = choice.label;
      btn.addEventListener('click', async () => {
        pendingValue = choice.value;
        await closePanel();
        finish(pendingValue);
      });
      actions.appendChild(btn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'dialog-action dialog-action-cancel';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.addEventListener('click', () => closePanel());
    actions.appendChild(cancelBtn);

    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    openPanel(() => finish(pendingValue));
  });
}

/**
 * @param {{title: string, message: string}} options
 */
export function showInfoDialog({ title, message }) {
  return showChoiceDialog({ title, message, choices: [{ label: 'Tamam', value: true }], cancelLabel: 'Kapat' });
}
