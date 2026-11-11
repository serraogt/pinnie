// db.js (ham veri) üzerine pin/fotoğraf iş mantığı: oluşturma, kapak
// fotoğrafı seçimi ve haritada gösterim için pin özetleri üretme.

import * as db from './db.js';
import { processPhotoFiles } from './images.js';
import { readPhotoLocation, readTakenAt, groupByProximity } from './exif.js';

/** @param {number} epochMs */
function formatDate(epochMs) {
  return new Date(epochMs).toLocaleDateString('tr-TR');
}

/**
 * Yeni bir pin oluşturur ve seçilen fotoğrafları sırayla işleyip kaydeder.
 * Hiçbir fotoğraf başarıyla işlenemezse pin oluşturulmaz. Not verilmediyse,
 * fotoğrafların EXIF çekim tarihinin en erkeni (varsa) nota varsayılan
 * olarak yazılır — düz metin olduğu için kullanıcı dilediği gibi düzenler.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {FileList|File[]} files
 * @param {{title?: string, note?: string, onProgress?: (done: number, total: number) => void, onError?: (file: File, error: Error) => void}} [options]
 * @returns {Promise<import('./db.js').Pin|null>}
 */
export async function createPinWithPhotos(lat, lng, files, options = {}) {
  const { title, note, onProgress, onError } = options;

  const processed = await processPhotoFiles(files, { onProgress, onError });
  if (processed.length === 0) return null;

  const now = Date.now();
  const pinId = db.newId();

  let sortOrder = 0;
  let earliestTakenAt;
  for (const { file, result } of processed) {
    const takenAt = await readTakenAt(file);
    if (takenAt != null && (earliestTakenAt == null || takenAt < earliestTakenAt)) {
      earliestTakenAt = takenAt;
    }
    await db.putPhoto({
      id: db.newId(),
      pinId,
      thumb: result.thumbBlob,
      full: result.fullBlob,
      width: result.width,
      height: result.height,
      takenAt,
      sortOrder: sortOrder++,
      createdAt: now,
    });
  }

  /** @type {import('./db.js').Pin} */
  const pin = {
    id: pinId,
    lat,
    lng,
    title: title || undefined,
    note: note || (earliestTakenAt != null ? formatDate(earliestTakenAt) : undefined),
    createdAt: now,
    updatedAt: now,
  };
  await db.putPin(pin);

  return pin;
}

/**
 * Mevcut bir pine yeni fotoğraflar ekler (mevcut sıralamanın devamına).
 * @param {string} pinId
 * @param {FileList|File[]} files
 * @param {{onProgress?: (done: number, total: number) => void, onError?: (file: File, error: Error) => void}} [options]
 * @returns {Promise<number>} eklenen fotoğraf sayısı
 */
export async function addPhotosToExistingPin(pinId, files, options = {}) {
  const { onProgress, onError } = options;
  const processed = await processPhotoFiles(files, { onProgress, onError });
  if (processed.length === 0) return 0;

  const existing = await db.getPhotosByPin(pinId);
  let sortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((p) => p.sortOrder)) + 1;
  const now = Date.now();

  for (const { file, result } of processed) {
    const takenAt = await readTakenAt(file);
    await db.putPhoto({
      id: db.newId(),
      pinId,
      thumb: result.thumbBlob,
      full: result.fullBlob,
      width: result.width,
      height: result.height,
      takenAt,
      sortOrder: sortOrder++,
      createdAt: now,
    });
  }

  const pin = await db.getPin(pinId);
  if (pin) await db.putPin({ ...pin, updatedAt: now });

  return processed.length;
}

/**
 * Seçilen dosyaları EXIF GPS'ine göre ~50m yakınlıkla gruplar. GPS'i
 * olan fotoğraflar otomatik konumlu gruplara ayrılır (grubun konumu,
 * içindeki fotoğrafların GPS noktalarının ortalamasıdır); GPS'i
 * olmayanlar tek bir listede döner (çağıran taraf bunlar için manuel
 * konum sorar).
 * @param {FileList|File[]} files
 * @param {{onProgress?: (done: number, total: number) => void}} [options]
 * @returns {Promise<{locatedGroups: Array<{lat: number, lng: number, files: File[]}>, unlocatedFiles: File[]}>}
 */
export async function planPinsFromFiles(files, options = {}) {
  const { onProgress } = options;
  const fileArray = Array.from(files);
  /** @type {Array<{file: File, lat: number, lng: number}>} */
  const withLocation = [];
  /** @type {File[]} */
  const unlocatedFiles = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const { lat, lng } = await readPhotoLocation(file);
    if (lat != null && lng != null) {
      withLocation.push({ file, lat, lng });
    } else {
      unlocatedFiles.push(file);
    }
    onProgress?.(i + 1, fileArray.length);
  }

  const locatedGroups = groupByProximity(withLocation, 50).map((items) => ({
    lat: items.reduce((sum, p) => sum + p.lat, 0) / items.length,
    lng: items.reduce((sum, p) => sum + p.lng, 0) / items.length,
    files: items.map((p) => p.file),
  }));

  return { locatedGroups, unlocatedFiles };
}

/** @param {string} pinId */
export function getPin(pinId) {
  return db.getPin(pinId);
}

/** @param {string} photoId */
export function deletePhoto(photoId) {
  return db.deletePhoto(photoId);
}

/** @param {string} pinId */
export function deletePin(pinId) {
  return db.deletePinWithPhotos(pinId);
}

/**
 * @param {string} pinId
 * @param {{title?: string, note?: string}} fields
 */
export async function updatePinMeta(pinId, fields) {
  const pin = await db.getPin(pinId);
  if (!pin) return;
  await db.putPin({
    ...pin,
    title: fields.title !== undefined ? fields.title || undefined : pin.title,
    note: fields.note !== undefined ? fields.note || undefined : pin.note,
    updatedAt: Date.now(),
  });
}

/**
 * @param {string} pinId
 * @param {number} lat
 * @param {number} lng
 */
export async function updatePinLocation(pinId, lat, lng) {
  const pin = await db.getPin(pinId);
  if (!pin) return;
  await db.putPin({ ...pin, lat, lng, updatedAt: Date.now() });
}

/**
 * @param {string} pinId
 * @returns {Promise<{photos: import('./db.js').Photo[], cover: import('./db.js').Photo|undefined, count: number}>}
 */
export async function getPinSummary(pinId) {
  const photos = await db.getPhotosByPin(pinId);
  photos.sort((a, b) => a.sortOrder - b.sortOrder);
  return { photos, cover: photos[0], count: photos.length };
}

/**
 * @param {string} pinId
 * @returns {Promise<{pin: import('./db.js').Pin|undefined, photos: import('./db.js').Photo[], cover: import('./db.js').Photo|undefined, count: number}>}
 */
export async function getPinWithPhotos(pinId) {
  const [pin, summary] = await Promise.all([db.getPin(pinId), getPinSummary(pinId)]);
  const photos = summary.photos.map((p) => ({ ...p, pinNote: pin?.note }));
  return { pin, photos, cover: photos[0], count: photos.length };
}

/**
 * Birden çok pinin fotoğraflarını (sıralı) tek listede döndürür; her
 * fotoğrafa kendi pininin notu (pinNote) iliştirilir — tam ekran
 * görüntüleyicide altyazı olarak gösterilir. Ayrılamayan bir kümenin
 * tüm fotoğraflarını göstermek için kullanılır.
 * @param {string[]} pinIds
 * @returns {Promise<import('./db.js').Photo[]>}
 */
export async function getPhotosForPins(pinIds) {
  const lists = await Promise.all(
    pinIds.map(async (id) => {
      const [pin, photos] = await Promise.all([db.getPin(id), db.getPhotosByPin(id)]);
      return photos.map((p) => ({ ...p, pinNote: pin?.note }));
    })
  );
  return lists.flat().sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Pinleri (hepsini ya da yalnızca verilen id'leri) fotoğraflarıyla
 * birlikte döndürür. Dışa aktarma (paylaşılabilir HTML, KMZ) için kullanılır.
 * @param {string[]|null} pinIds null ise tüm pinler
 * @returns {Promise<Array<{pin: import('./db.js').Pin, photos: import('./db.js').Photo[]}>>}
 */
export async function getPinsWithPhotos(pinIds) {
  const allPins = await db.getAllPins();
  const selected = pinIds ? allPins.filter((p) => pinIds.includes(p.id)) : allPins;
  const result = [];
  for (const pin of selected) {
    const photos = await db.getPhotosByPin(pin.id);
    photos.sort((a, b) => a.sortOrder - b.sortOrder);
    result.push({ pin, photos });
  }
  return result;
}

/**
 * Haritada gösterim için tüm pinleri kapak fotoğrafı ve foto sayısıyla döndürür.
 * @returns {Promise<Array<{pin: import('./db.js').Pin, cover: import('./db.js').Photo|undefined, count: number}>>}
 */
export async function loadMapPinSummaries() {
  const pins = await db.getAllPins();
  return Promise.all(
    pins.map(async (pin) => {
      const { cover, count } = await getPinSummary(pin.id);
      return { pin, cover, count };
    })
  );
}
