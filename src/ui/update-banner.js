// Yeni service worker sürümü hazır olduğunda gösterilen kalıcı
// (kendiliğinden kapanmayan) "Yenile" bandı.

let bannerEl = null;

/** @param {() => void} onRefresh */
export function showUpdateBanner(onRefresh) {
  if (bannerEl) return;

  bannerEl = document.createElement('div');
  bannerEl.className = 'update-banner';

  const text = document.createElement('span');
  text.className = 'update-banner-text';
  text.textContent = 'Yeni sürüm var';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary update-banner-btn';
  btn.textContent = 'Yenile';
  btn.addEventListener('click', onRefresh);

  bannerEl.append(text, btn);
  document.body.appendChild(bannerEl);
}
