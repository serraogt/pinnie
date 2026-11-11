// Tüm pinleri (veya seçilenleri) tek, salt okunur bir .html dosyasına
// gömer. MapLibre GL JS ve supercluster sabit sürümlü CDN adreslerinden
// yüklenir; harita/küme/foto-görüntüleyici mantığı (router.js,
// cluster.js, ui/toast.js, ui/photo-viewer.js, ui/photo-grid-panel.js)
// kaynak metni olarak okunup çıktı dosyasına gömülür — kod tekrarı yok.

import { getPinsWithPhotos } from './pins.js';
import { reencodeBlob } from './images.js';
import { shareOrDownload } from './file-save.js';
import { slugify } from './text-utils.js';

/** @type {Record<string, {maxEdge: number, quality: number}>} */
export const QUALITY_PRESETS = {
  low: { maxEdge: 800, quality: 0.6 },
  medium: { maxEdge: 1024, quality: 0.7 },
  high: { maxEdge: 1600, quality: 0.8 },
};

const SHARED_MODULE_PATHS = [
  'src/router.js',
  'src/ui/toast.js',
  'src/ui/photo-viewer.js',
  'src/ui/photo-grid-panel.js',
  'src/cluster.js',
  'src/viewer-bootstrap.js',
];

/** @param {Blob} blob @returns {Promise<string>} */
function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Seçime göre tüm fotoğrafları işlemeden, birkaç örnek üzerinden
 * yaklaşık dosya boyutu tahmini üretir (büyük kütüphanelerde tüm
 * fotoğrafları yeniden kodlamak yavaş olurdu).
 * @param {{pinIds: string[]|null, quality: keyof typeof QUALITY_PRESETS}} options
 * @returns {Promise<number>} tahmini bayt
 */
export async function estimateExportSize({ pinIds, quality }) {
  const data = await getPinsWithPhotos(pinIds);
  const allPhotos = data.flatMap((d) => d.photos);
  if (allPhotos.length === 0) return 0;

  const preset = QUALITY_PRESETS[quality];
  const sampleCount = Math.min(3, allPhotos.length);
  const step = Math.floor(allPhotos.length / sampleCount) || 1;
  let sampleBytes = 0;
  let sampled = 0;

  for (let i = 0; i < allPhotos.length && sampled < sampleCount; i += step) {
    const { blob } = await reencodeBlob(allPhotos[i].full, preset);
    sampleBytes += blob.size;
    sampled++;
  }

  const avgBytes = sampleBytes / sampled;
  // base64 şişmesi ~4/3; data.json iskeleti ve bundle edilen JS ~birkaç
  // yüz KB — fotoğraf yükünün yanında ihmal edilebilir.
  return Math.round(avgBytes * allPhotos.length * (4 / 3));
}

/** @param {string} source */
function stripModuleSyntax(source) {
  return source
    .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+(function|const|class|let|var)\b/gm, '$1');
}

async function buildBundledScript() {
  const sources = await Promise.all(SHARED_MODULE_PATHS.map((p) => fetch(p).then((r) => r.text())));
  return sources.map(stripModuleSyntax).join('\n\n');
}

/** @param {string} str */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** @param {string} [title] */
export function shareableFileName(title) {
  const slug = title ? slugify(title) : '';
  return `${slug || 'harita-pin'}.html`;
}

/**
 * @param {{pinIds: string[]|null, quality: keyof typeof QUALITY_PRESETS, title?: string, onProgress?: (done: number, total: number) => void}} options
 * @returns {Promise<{html: string, pinCount: number, photoCount: number}>}
 */
export async function buildShareableHtml({ pinIds, quality, title, onProgress }) {
  const data = await getPinsWithPhotos(pinIds);
  const preset = QUALITY_PRESETS[quality];
  const totalPhotos = data.reduce((sum, d) => sum + d.photos.length, 0);
  let done = 0;

  const manifestPins = [];
  for (const { pin, photos } of data) {
    const manifestPhotos = [];
    for (const photo of photos) {
      const { blob: fullBlob, width, height } = await reencodeBlob(photo.full, preset);
      const [thumbDataUri, fullDataUri] = await Promise.all([
        blobToDataUri(photo.thumb),
        blobToDataUri(fullBlob),
      ]);
      manifestPhotos.push({ id: photo.id, thumb: thumbDataUri, full: fullDataUri, width, height });
      onProgress?.(++done, totalPhotos);
    }
    manifestPins.push({
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      title: pin.title,
      note: pin.note,
      photos: manifestPhotos,
    });
  }

  const manifest = { title: title || undefined, pins: manifestPins };
  // </script> enjeksiyonunu önlemek için '<' karakterlerini kaçır (başlık/not kullanıcı metni içerir).
  const manifestJson = JSON.stringify(manifest).replace(/</g, '\\u003c');

  const [bundledScript, appCss] = await Promise.all([buildBundledScript(), fetch('styles.css').then((r) => r.text())]);

  const htmlTitle = title ? `${title} – Harita Pin` : 'Harita Pin – Paylaşılan Harita';

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
<title>${escapeHtml(htmlTitle)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<style>
${appCss}

.viewer-title-banner {
  position: absolute;
  top: calc(12px + var(--safe-top));
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  color: var(--color-text);
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 10px var(--color-shadow);
  z-index: 10;
  max-width: 80vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
</head>
<body>
<div id="map"></div>
<div id="toast-root" aria-live="polite"></div>
<script type="application/json" id="map-data">${manifestJson}</script>
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script src="https://cdn.jsdelivr.net/npm/supercluster@8.0.1/dist/supercluster.js"></script>
<script type="module">
${bundledScript}
</script>
</body>
</html>
`;

  return { html, pinCount: manifestPins.length, photoCount: totalPhotos };
}

/**
 * @param {string} html
 * @param {string} fileName
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export function shareShareableHtml(html, fileName) {
  const blob = new Blob([html], { type: 'text/html' });
  return shareOrDownload(blob, fileName, 'text/html');
}
