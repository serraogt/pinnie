// Service worker kaydı + "Yeni sürüm var — Yenile" akışı.
//
// Önemli: controllerchange olayı yalnızca kullanıcı "Yenile"ye
// bastıktan SONRA sayfayı yenilemeli. İlk kurulumda da (sw.js
// clients.claim() çağırdığı için) bir controllerchange tetiklenir;
// buna genel bir dinleyiciyle tepki vermek istenmeyen bir yenilemeye
// yol açar — bu yüzden dinleyici yalnızca kullanıcı eylemiyle eklenir.

import { showUpdateBanner } from './ui/update-banner.js';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => window.location.reload(),
                { once: true }
              );
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            });
          }
        });
      });
    } catch (err) {
      console.error('Service worker kaydedilemedi:', err);
    }
  });
}
