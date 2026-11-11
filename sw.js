// Uygulama dosyalarını ve vendor/ kütüphanelerini önbelleğe alır;
// uygulama internetsiz açılabilir (harita karoları hariç — onlar
// kendi ağ isteğiyle yüklenir, internetsizken boş kalabilir).
// Yeni sürüm yayınlandığında cache adını (CACHE_VERSION) artır.

const CACHE_VERSION = 'v8';
const CACHE_NAME = `harita-pin-lite-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',

  './src/app.js',
  './src/backup.js',
  './src/cluster.js',
  './src/db.js',
  './src/exif.js',
  './src/file-save.js',
  './src/images.js',
  './src/kmz-export.js',
  './src/long-press.js',
  './src/pins.js',
  './src/pwa-register.js',
  './src/router.js',
  './src/share-export.js',
  './src/storage-info.js',
  './src/text-utils.js',
  './src/viewer-bootstrap.js',
  './src/ui/crosshair-picker.js',
  './src/ui/dialog.js',
  './src/ui/export-dialog.js',
  './src/ui/export-form-fields.js',
  './src/ui/kmz-export-dialog.js',
  './src/ui/menu.js',
  './src/ui/photo-grid-panel.js',
  './src/ui/photo-viewer.js',
  './src/ui/pin-edit-dialog.js',
  './src/ui/progress-overlay.js',
  './src/ui/toast.js',
  './src/ui/update-banner.js',

  './vendor/maplibre-gl/maplibre-gl.js',
  './vendor/maplibre-gl/maplibre-gl.css',
  './vendor/supercluster/supercluster.js',
  './vendor/exifr/exifr.esm.js',
  './vendor/fflate/fflate.esm.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // harita karoları vb. — dokunma, doğrudan ağa gitsin

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
