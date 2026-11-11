// Tam ekran fotoğraf görüntüleyici: yatay kaydırma (native scroll-snap),
// iki parmakla pinch-zoom, aşağı kaydırarak kapatma; masaüstü için ok
// tuşları/okçuk butonları ve Escape ile kapatma. Geri tuşu router.js
// üzerinden kapatmayı tetikler.

import { openPanel, closePanel, nextZIndex } from '../router.js';

/**
 * photo-viewer.js düzenleme/aksiyon mantığı içermez (paylaşılabilir
 * HTML dışa aktarımına gömülen, salt okunur paylaşılan bir modüldür).
 * onEdit/onMenu yalnızca ana uygulama tarafından, bir düğmeye
 * tıklandığını bildiren birer geri çağırım olarak verilir; gerçek
 * düzenleme/menü mantığı çağıran tarafta (app.js) yaşar.
 *
 * @param {import('../db.js').Photo[]} photos fotoğrafın ait olduğu pinin notu varsa `pinNote` alanında taşınır.
 * @param {number} [startIndex]
 * @param {{onEdit?: () => void, onMenu?: (currentPhotoId: string) => void}} [options]
 * @returns {{setCaption: (note: string|undefined) => void, hide: () => void, show: () => void}}
 */
export function openPhotoViewer(photos, startIndex = 0, options = {}) {
  if (photos.length === 0) return { setCaption() {}, hide() {}, show() {} };

  const { onEdit, onMenu } = options;

  const overlay = document.createElement('div');
  overlay.className = 'photo-viewer-overlay';
  overlay.style.zIndex = String(nextZIndex());

  const track = document.createElement('div');
  track.className = 'photo-viewer-track';

  const urls = photos.map((p) => URL.createObjectURL(p.full));
  /** @type {Array<{slide: HTMLElement, img: HTMLImageElement, scale: number, caption: HTMLElement|null}>} */
  const slides = photos.map((photo, i) => {
    const slide = document.createElement('div');
    slide.className = 'photo-viewer-slide';
    const img = document.createElement('img');
    img.className = 'photo-viewer-img';
    img.src = urls[i];
    img.alt = '';
    slide.appendChild(img);

    let caption = null;
    if (photo.pinNote) {
      caption = document.createElement('div');
      caption.className = 'photo-viewer-caption';
      caption.textContent = photo.pinNote;
      slide.appendChild(caption);
    }

    track.appendChild(slide);
    return { slide, img, scale: 1, caption };
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'photo-viewer-close';
  closeBtn.setAttribute('aria-label', 'Kapat');
  closeBtn.textContent = '✕';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'photo-viewer-nav photo-viewer-prev';
  prevBtn.setAttribute('aria-label', 'Önceki fotoğraf');
  prevBtn.textContent = '‹';
  prevBtn.hidden = photos.length < 2;

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'photo-viewer-nav photo-viewer-next';
  nextBtn.setAttribute('aria-label', 'Sonraki fotoğraf');
  nextBtn.textContent = '›';
  nextBtn.hidden = photos.length < 2;

  overlay.append(track, closeBtn, prevBtn, nextBtn);

  if (onEdit || onMenu) {
    const toolbar = document.createElement('div');
    toolbar.className = 'photo-viewer-toolbar';

    if (onEdit) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'photo-viewer-toolbar-btn';
      editBtn.textContent = 'Düzenle';
      editBtn.addEventListener('click', () => onEdit());
      toolbar.appendChild(editBtn);
    }

    if (onMenu) {
      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'photo-viewer-toolbar-btn photo-viewer-toolbar-menu';
      menuBtn.setAttribute('aria-label', 'Diğer işlemler');
      menuBtn.textContent = '⋯';
      menuBtn.addEventListener('click', () => onMenu(photos[activeIndex()].id));
      toolbar.appendChild(menuBtn);
    }

    overlay.appendChild(toolbar);
  }

  document.body.appendChild(overlay);

  function cleanup() {
    for (const url of urls) URL.revokeObjectURL(url);
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  }

  closeBtn.addEventListener('click', () => closePanel());
  openPanel(() => cleanup());

  slides[Math.min(startIndex, slides.length - 1)].slide.scrollIntoView({
    behavior: 'instant',
    inline: 'center',
    block: 'nearest',
  });

  function activeIndex() {
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    let closest = 0;
    let minDist = Infinity;
    slides.forEach((entry, i) => {
      const r = entry.slide.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - centerX);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    });
    return closest;
  }

  function goTo(index) {
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    slides[clamped].slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  prevBtn.addEventListener('click', () => goTo(activeIndex() - 1));
  nextBtn.addEventListener('click', () => goTo(activeIndex() + 1));

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (e.key === 'Escape') closePanel();
    else if (e.key === 'ArrowLeft') goTo(activeIndex() - 1);
    else if (e.key === 'ArrowRight') goTo(activeIndex() + 1);
  }
  document.addEventListener('keydown', onKeyDown);

  // --- Pinch-zoom (iki parmak) aktif slide üzerinde -------------------------
  /** @type {{startDist: number, startScale: number, entry: {img: HTMLImageElement, scale: number}}|null} */
  let pinchState = null;

  track.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const entry = slides[activeIndex()];
        pinchState = { startDist: dist, startScale: entry.scale, entry };
      }
    },
    { passive: true }
  );

  track.addEventListener(
    'touchmove',
    (e) => {
      if (pinchState && e.touches.length === 2) {
        const [a, b] = e.touches;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const scale = Math.min(4, Math.max(1, pinchState.startScale * (dist / pinchState.startDist)));
        pinchState.entry.scale = scale;
        pinchState.entry.img.style.transform = `scale(${scale})`;
      }
    },
    { passive: true }
  );

  track.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchState = null;
  });

  // --- Aşağı kaydırarak kapatma (tek parmak, dikey, zoom yokken) ------------
  /** @type {{x: number, y: number}|null} */
  let dragStart = null;

  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    if (slides[activeIndex()].scale > 1.05) return;
    dragStart = { x: e.clientX, y: e.clientY };
  });

  track.addEventListener('pointermove', (e) => {
    if (!dragStart) return;
    const dy = e.clientY - dragStart.y;
    const dx = e.clientX - dragStart.x;
    if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
      overlay.style.opacity = String(Math.max(0.3, 1 - dy / 400));
    }
  });

  function endDrag(e) {
    if (!dragStart) return;
    const dy = e.clientY - dragStart.y;
    const dx = e.clientX - dragStart.x;
    dragStart = null;
    overlay.style.opacity = '';
    if (dy > 100 && Math.abs(dy) > Math.abs(dx)) closePanel();
  }

  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', () => {
    dragStart = null;
    overlay.style.opacity = '';
  });

  return {
    setCaption(note) {
      for (const entry of slides) {
        if (note) {
          if (!entry.caption) {
            entry.caption = document.createElement('div');
            entry.caption.className = 'photo-viewer-caption';
            entry.slide.appendChild(entry.caption);
          }
          entry.caption.textContent = note;
        } else if (entry.caption) {
          entry.caption.remove();
          entry.caption = null;
        }
      }
    },
    hide() {
      overlay.style.display = 'none';
    },
    show() {
      overlay.style.display = '';
    },
  };
}
