// Google Earth'te açılabilen .kmz dışa aktarma: zip içinde doc.kml +
// files/ altında fotoğraflar. Her pin bir Placemark; description
// içinde fotoğraflar <img> ile gösterilir. Kalite kademeleri
// share-export.js ile aynıdır (QUALITY_PRESETS).

import { getPinsWithPhotos } from './pins.js';
import { reencodeBlob } from './images.js';
import { QUALITY_PRESETS } from './share-export.js';
import { zip } from '../vendor/fflate/fflate.esm.js';
import { shareOrDownload } from './file-save.js';
import { slugify } from './text-utils.js';

/** @param {string} str */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** @param {string} [title] */
export function kmzFileName(title) {
  const slug = title ? slugify(title) : '';
  return `${slug || 'harita-pin'}.kmz`;
}

/**
 * @param {{pinIds: string[]|null, quality: keyof typeof QUALITY_PRESETS, title?: string, onProgress?: (done: number, total: number) => void}} options
 * @returns {Promise<{bytes: Uint8Array, pinCount: number, photoCount: number}>}
 */
export async function buildKmz({ pinIds, quality, title, onProgress }) {
  const data = await getPinsWithPhotos(pinIds);
  const preset = QUALITY_PRESETS[quality];
  const totalPhotos = data.reduce((sum, d) => sum + d.photos.length, 0);
  let done = 0;

  /** @type {Record<string, Uint8Array>} */
  const photoFiles = {};
  const placemarks = [];

  for (const { pin, photos } of data) {
    const imgTags = [];
    for (const photo of photos) {
      const { blob } = await reencodeBlob(photo.full, preset);
      const fileName = `${photo.id}.jpg`;
      photoFiles[fileName] = new Uint8Array(await blob.arrayBuffer());
      imgTags.push(`<img src="files/${fileName}" width="400"><br/>`);
      onProgress?.(++done, totalPhotos);
    }

    const descriptionParts = [];
    if (pin.note) descriptionParts.push(`<p>${escapeXml(pin.note)}</p>`);
    descriptionParts.push(...imgTags);

    placemarks.push(
      `<Placemark>` +
        `<name>${escapeXml(pin.title || 'Pin')}</name>` +
        `<description><![CDATA[${descriptionParts.join('')}]]></description>` +
        `<Point><coordinates>${pin.lng},${pin.lat},0</coordinates></Point>` +
        `</Placemark>`
    );
  }

  const kml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>` +
    `<name>${escapeXml(title || 'Harita Pin')}</name>` +
    placemarks.join('') +
    `</Document></kml>`;

  const fileTree = {
    'doc.kml': new TextEncoder().encode(kml),
    files: photoFiles,
  };

  const bytes = await new Promise((resolve, reject) => {
    zip(fileTree, { level: 0 }, (err, out) => (err ? reject(err) : resolve(out)));
  });

  return { bytes, pinCount: data.length, photoCount: totalPhotos };
}

/**
 * @param {Uint8Array} bytes
 * @param {string} fileName
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export function shareKmz(bytes, fileName) {
  const blob = new Blob([bytes], { type: 'application/vnd.google-earth.kmz' });
  return shareOrDownload(blob, fileName, 'application/vnd.google-earth.kmz');
}
