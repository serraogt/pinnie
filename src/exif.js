// EXIF'ten GPS konumu ve çekim tarihini okur; GPS'i olan fotoğrafları
// ~50 metre yakınlığa göre gruplar (aynı pine gidecekler).

import { gps, parse } from '../vendor/exifr/exifr.esm.js';

const EARTH_RADIUS_M = 6371000;

/**
 * @param {File} file
 * @returns {Promise<number|undefined>} epoch ms, EXIF'te yoksa undefined
 */
export async function readTakenAt(file) {
  try {
    const meta = await parse(file);
    if (meta?.DateTimeOriginal instanceof Date) {
      return meta.DateTimeOriginal.getTime();
    }
  } catch {
    // Tarih bilgisi olmadan devam edilir.
  }
  return undefined;
}

/**
 * @param {File} file
 * @returns {Promise<{lat: number|null, lng: number|null, takenAt: number|undefined}>}
 */
export async function readPhotoLocation(file) {
  let lat = null;
  let lng = null;

  try {
    const coords = await gps(file);
    if (coords) {
      lat = coords.latitude;
      lng = coords.longitude;
    }
  } catch {
    // EXIF okunamadı/yok sayılır; konum olmadan devam edilir.
  }

  const takenAt = await readTakenAt(file);
  return { lat, lng, takenAt };
}

/**
 * İki nokta arası mesafe (metre), haversine formülü.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * Konumlu noktaları birbirine yakınlığa göre gruplar (basit, sıralamaya
 * bağlı açgözlü kümeleme — her nokta, eşik mesafesindeki ilk mevcut
 * gruba eklenir, yoksa yeni grup açılır).
 * @template {{lat: number, lng: number}} T
 * @param {T[]} points
 * @param {number} [thresholdMeters]
 * @returns {T[][]}
 */
export function groupByProximity(points, thresholdMeters = 50) {
  /** @type {Array<{lat: number, lng: number, items: T[]}>} */
  const groups = [];

  for (const point of points) {
    const target = groups.find(
      (g) => haversineMeters(g.lat, g.lng, point.lat, point.lng) <= thresholdMeters
    );
    if (target) {
      target.items.push(point);
    } else {
      groups.push({ lat: point.lat, lng: point.lng, items: [point] });
    }
  }

  return groups.map((g) => g.items);
}
