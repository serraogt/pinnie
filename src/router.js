// Panelleri (detay sayfası, tam ekran görüntüleyici, nişangah vb.)
// tarayıcı geçmişiyle eşitler: her panel açılışında bir history
// state'i itilir; tarayıcı geri tuşu (popstate) en üstteki paneli
// kapatır. Panelin kendi kapatma düğmesi de closePanel() çağırarak
// aynı yoldan (history.back) geçer, böylece durum hep senkron kalır.

/** @type {Array<(info: {fromPopState: boolean}) => void>} */
const stack = [];

/** @type {Array<(depth: number) => void>} */
const depthListeners = [];

function notifyDepthChange() {
  for (const listener of depthListeners) listener(stack.length);
}

window.addEventListener('popstate', () => {
  const closeFn = stack.pop();
  if (closeFn) closeFn({ fromPopState: true });
  notifyDepthChange();
});

/**
 * Yeni bir panel açar ve geçmişe bir state iter.
 * @param {(info: {fromPopState: boolean}) => void} onClose Panel kapanırken (geri tuşu ya da closePanel()) çağrılır; burada panelin DOM'dan kaldırılması gerekir.
 */
export function openPanel(onClose) {
  stack.push(onClose);
  history.pushState({ panel: stack.length }, '');
  notifyDepthChange();
}

const PANEL_Z_BASE = 1100;
const PANEL_Z_STEP = 10;

/**
 * Bir sonraki açılacak panel için kullanılacak z-index'i döndürür.
 * Paneller artık birbirinin üzerine farklı özelliklerden (menü, düzenleme,
 * nişangah...) açılabildiğinden, sabit sınıf bazlı z-index yerine yığın
 * derinliğine göre hesaplanan bir değer kullanmak her kombinasyonda
 * doğru sıralamayı garanti eder. Panel oluşturulurken overlay
 * elemanına `openPanel()` çağrılmadan hemen önce uygulanmalıdır:
 * `overlay.style.zIndex = String(nextZIndex());`
 * @returns {number}
 */
export function nextZIndex() {
  return PANEL_Z_BASE + stack.length * PANEL_Z_STEP;
}

/**
 * Açık panel sayısı değiştiğinde çağrılır (0 -> hiç panel açık değil).
 * Örn. herhangi bir panel açıkken haritada uzun basmayı devre dışı bırakmak için.
 * @param {(depth: number) => void} listener
 */
export function onDepthChange(listener) {
  depthListeners.push(listener);
}

/**
 * En üstteki paneli kapatır (UI'daki kapatma/geri butonları bunu çağırmalı).
 * Gerçek kapatma, history.back() sonucu tetiklenen popstate üzerinden olur
 * — bu da ASENKRON'dur. Dönen Promise, popstate gerçekten işlenip (stack
 * pop edilip onClose çağrılana) kadar resolve olmaz. Bir panel kapatılır
 * kapatılmaz hemen başka bir panel açacaksan (ör. menüden bir nişangah
 * akışı tetiklemek) bunu `await` etmeden yapma — yoksa history.back() ile
 * yeni panelin history.pushState()'i yarışa girer ve yığın bozulur.
 * @returns {Promise<void>}
 */
export function closePanel() {
  if (stack.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener(
      'popstate',
      () => resolve(),
      { once: true }
    );
    history.back();
  });
}
