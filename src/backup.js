// Tüm veriyi tek bir .zip olarak yedekleme (data.json + photos/) ve
// geri yükleme (birleştir/değiştir). fflate ile sıkıştırmasız (store)
// zip kullanılır — fotoğraflar zaten WebP/JPEG ile sıkıştırılmış,
// tekrar deflate etmek CPU'yu boşuna yorar.

import { zip, unzip, strToU8, strFromU8 } from '../vendor/fflate/fflate.esm.js';
import * as db from './db.js';
import { shareOrDownload } from './file-save.js';

const BACKUP_FORMAT_VERSION = 1;
const LAST_BACKUP_META_KEY = 'lastBackupAt';

/** @param {string} mimeType */
function extensionForMimeType(mimeType) {
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg') return 'jpg';
  return 'bin';
}

/** @param {string} filename */
function mimeTypeForFilename(filename) {
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/** @param {Date} [date] */
export function backupFileName(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `harita-yedek-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

/**
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Uint8Array>}
 */
export async function buildBackupZip(onProgress) {
  const pins = await db.getAllPins();
  const photos = await db.getAllPhotos();

  /** @type {any} */
  const manifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    pins,
    photos: [],
  };

  /** @type {Record<string, Uint8Array>} */
  const photoFiles = {};

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const thumbName = `${photo.id}-thumb.${extensionForMimeType(photo.thumb.type)}`;
    const fullName = `${photo.id}-full.${extensionForMimeType(photo.full.type)}`;

    photoFiles[thumbName] = new Uint8Array(await photo.thumb.arrayBuffer());
    photoFiles[fullName] = new Uint8Array(await photo.full.arrayBuffer());

    manifest.photos.push({
      id: photo.id,
      pinId: photo.pinId,
      width: photo.width,
      height: photo.height,
      takenAt: photo.takenAt,
      sortOrder: photo.sortOrder,
      createdAt: photo.createdAt,
      thumbFile: `photos/${thumbName}`,
      fullFile: `photos/${fullName}`,
    });

    onProgress?.(i + 1, photos.length);
  }

  const fileTree = {
    'data.json': strToU8(JSON.stringify(manifest)),
    photos: photoFiles,
  };

  return new Promise((resolve, reject) => {
    zip(fileTree, { level: 0 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

/**
 * Yedeği oluşturur ve paylaşım menüsüyle (mümkünse) ya da indirerek sunar.
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function exportBackup(onProgress) {
  const zipBytes = await buildBackupZip(onProgress);
  const fileName = backupFileName();
  const blob = new Blob([zipBytes], { type: 'application/zip' });

  const result = await shareOrDownload(blob, fileName, 'application/zip');
  if (result !== 'cancelled') {
    await db.setMetaValue(LAST_BACKUP_META_KEY, Date.now());
  }
  return result;
}

/**
 * @param {File} file
 * @param {'merge'|'replace'} mode
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<{pinsAdded: number, photosAdded: number}>}
 */
export async function restoreBackup(file, mode, onProgress) {
  const buf = new Uint8Array(await file.arrayBuffer());
  /** @type {Record<string, Uint8Array>} */
  const entries = await new Promise((resolve, reject) => {
    unzip(buf, (err, data) => (err ? reject(err) : resolve(data)));
  });

  const manifestBytes = entries['data.json'];
  if (!manifestBytes) {
    throw new Error('Geçersiz yedek dosyası: data.json bulunamadı.');
  }
  const manifest = JSON.parse(strFromU8(manifestBytes));

  if (mode === 'replace') {
    await db.clearAllData();
  }

  const existingPinIds = mode === 'merge' ? new Set((await db.getAllPins()).map((p) => p.id)) : new Set();
  const existingPhotoIds =
    mode === 'merge' ? new Set((await db.getAllPhotos()).map((p) => p.id)) : new Set();

  const total = manifest.pins.length + manifest.photos.length;
  let done = 0;
  let pinsAdded = 0;
  let photosAdded = 0;

  for (const pin of manifest.pins) {
    if (!existingPinIds.has(pin.id)) {
      await db.putPin(pin);
      pinsAdded++;
    }
    onProgress?.(++done, total);
  }

  for (const photoMeta of manifest.photos) {
    if (!existingPhotoIds.has(photoMeta.id)) {
      const thumbBytes = entries[photoMeta.thumbFile];
      const fullBytes = entries[photoMeta.fullFile];
      if (thumbBytes && fullBytes) {
        await db.putPhoto({
          id: photoMeta.id,
          pinId: photoMeta.pinId,
          thumb: new Blob([thumbBytes], { type: mimeTypeForFilename(photoMeta.thumbFile) }),
          full: new Blob([fullBytes], { type: mimeTypeForFilename(photoMeta.fullFile) }),
          width: photoMeta.width,
          height: photoMeta.height,
          takenAt: photoMeta.takenAt,
          sortOrder: photoMeta.sortOrder,
          createdAt: photoMeta.createdAt,
        });
        photosAdded++;
      }
    }
    onProgress?.(++done, total);
  }

  return { pinsAdded, photosAdded };
}

/** @returns {Promise<number|undefined>} epoch ms */
export function getLastBackupAt() {
  return db.getMetaValue(LAST_BACKUP_META_KEY);
}
