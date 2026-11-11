// Ayrılamayan bir kümenin (birden fazla pine ait) fotoğraflarını salt
// okunur grid olarak gösteren tam ekran panel. Bir fotoğrafa dokununca
// tam ekran görüntüleyici açılır.

import { openPanel, closePanel, nextZIndex } from '../router.js';
import { openPhotoViewer } from './photo-viewer.js';

/**
 * @param {import('../db.js').Photo[]} photos
 */
export function showPhotoGridPanel(photos) {
  const overlayEl = document.createElement('div');
  overlayEl.className = 'photo-grid-overlay';
  overlayEl.style.zIndex = String(nextZIndex());

  /** @type {string[]} */
  const thumbURLs = [];

  function cleanup() {
    for (const url of thumbURLs) URL.revokeObjectURL(url);
    overlayEl.remove();
  }

  const header = document.createElement('div');
  header.className = 'photo-grid-header';

  const title = document.createElement('span');
  title.className = 'photo-grid-title';
  title.textContent = `${photos.length} fotoğraf`;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'photo-grid-close';
  closeBtn.setAttribute('aria-label', 'Kapat');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closePanel());

  header.append(title, closeBtn);

  const grid = document.createElement('div');
  grid.className = 'photo-grid';
  photos.forEach((photo, index) => {
    const url = URL.createObjectURL(photo.thumb);
    thumbURLs.push(url);
    const img = document.createElement('img');
    img.className = 'photo-grid-thumb';
    img.src = url;
    img.loading = 'lazy';
    img.alt = '';
    img.addEventListener('click', () => openPhotoViewer(photos, index));
    grid.appendChild(img);
  });

  overlayEl.append(header, grid);
  document.body.appendChild(overlayEl);

  openPanel(() => cleanup());
}
