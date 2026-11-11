const ROOT_ID = 'toast-root';
const DEFAULT_DURATION = 3500;

/**
 * Ekranın altında kısa süreli bir bildirim gösterir.
 * @param {string} message
 * @param {{type?: 'info'|'error'|'success', duration?: number}} [options]
 */
export function showToast(message, options = {}) {
  const root = document.getElementById(ROOT_ID);
  if (!root) {
    console.warn('Toast kökü bulunamadı:', message);
    return;
  }

  const { type = 'info', duration = DEFAULT_DURATION } = options;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  root.appendChild(el);

  requestAnimationFrame(() => el.classList.add('toast-visible'));

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500);
  }, duration);
}
