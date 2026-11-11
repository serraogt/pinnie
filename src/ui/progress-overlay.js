let overlayEl = null;

/**
 * @param {number} done
 * @param {number} total
 * @param {string} [label]
 */
export function showProgress(done, total, label = 'Fotoğraflar işleniyor') {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.className = 'progress-overlay';
    overlayEl.innerHTML =
      '<div class="progress-card"><div class="spinner" aria-hidden="true"></div><div class="progress-text"></div></div>';
    document.body.appendChild(overlayEl);
  }
  overlayEl.querySelector('.progress-text').textContent = `${label}… ${done}/${total}`;
}

export function hideProgress() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
