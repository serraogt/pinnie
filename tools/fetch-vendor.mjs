// Tek seferlik geliştirme aracı: CDN'den sabit sürümlü kütüphaneleri indirip
// vendor/ klasörüne gömer (uygulamanın kendisi çalışma zamanında CDN'e gitmez).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CDN = 'https://cdn.jsdelivr.net/npm';

const FILES = [
  { url: `${CDN}/maplibre-gl@4.7.1/dist/maplibre-gl.js`, dest: 'vendor/maplibre-gl/maplibre-gl.js' },
  { url: `${CDN}/maplibre-gl@4.7.1/dist/maplibre-gl.css`, dest: 'vendor/maplibre-gl/maplibre-gl.css' },
  { url: `${CDN}/maplibre-gl@4.7.1/LICENSE.txt`, dest: 'vendor/maplibre-gl/LICENSE.txt' },
  { url: `${CDN}/supercluster@8.0.1/dist/supercluster.js`, dest: 'vendor/supercluster/supercluster.js' },
  { url: `${CDN}/supercluster@8.0.1/LICENSE`, dest: 'vendor/supercluster/LICENSE' },
  { url: `${CDN}/exifr@7.1.3/dist/lite.esm.js`, dest: 'vendor/exifr/exifr.esm.js' },
  { url: `${CDN}/exifr@7.1.3/LICENSE`, dest: 'vendor/exifr/LICENSE' },
  { url: `${CDN}/fflate@0.8.2/esm/browser.js`, dest: 'vendor/fflate/fflate.esm.js' },
  { url: `${CDN}/fflate@0.8.2/LICENSE`, dest: 'vendor/fflate/LICENSE' },
];

async function fetchOne({ url, dest }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const destPath = join(ROOT, dest);
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, buf);
  console.log(`✓ ${dest} (${buf.length} bayt)`);
}

try {
  for (const file of FILES) {
    await fetchOne(file);
  }
  console.log('\nTüm vendor dosyaları indirildi.');
} catch (err) {
  console.error('\nVendor indirme hatası:', err.message);
  if (String(err.message).includes('certificate') || String(err.cause?.code) === 'SELF_SIGNED_CERT_IN_CHAIN') {
    console.error(
      'Kurumsal ağ TLS inceleme (MITM) proxy kullanıyor olabilir. Şununla tekrar deneyin:\n' +
      '  node --use-system-ca tools/fetch-vendor.mjs'
    );
  }
  process.exit(1);
}
