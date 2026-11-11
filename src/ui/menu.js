// Sağ üstteki menü: Yedekle, Geri yükle, (ileride) dışa aktarma
// seçenekleri, Depolama bilgisi.

import { openPanel, closePanel, nextZIndex } from '../router.js';

/**
 * @param {Array<{label: string, onSelect: () => void}>} items
 */
export function showAppMenu(items) {
  const overlay = document.createElement('div');
  overlay.className = 'menu-overlay';
  overlay.style.zIndex = String(nextZIndex());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });

  const sheet = document.createElement('div');
  sheet.className = 'menu-sheet';

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item';
    btn.textContent = item.label;
    btn.addEventListener('click', async () => {
      await closePanel();
      item.onSelect();
    });
    sheet.appendChild(btn);
  }

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  openPanel(() => overlay.remove());
}
