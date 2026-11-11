// Seçilen fotoğraflardan küçültülmüş thumb/full kopyaları üretir.
// EXIF yönü createImageBitmap'in 'from-image' seçeneğiyle doğrudan
// uygulanır; ayrıca bir döndürme adımına gerek kalmaz.

const PREFERRED_FORMAT = detectPreferredFormat();

function detectPreferredFormat() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    return supportsWebp ? { mimeType: 'image/webp', extension: 'webp' } : { mimeType: 'image/jpeg', extension: 'jpg' };
  } catch {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
}

/** @returns {{mimeType: string, extension: string}} */
export function getPreferredImageFormat() {
  return PREFERRED_FORMAT;
}

/** @param {File} file */
async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${file.name}" açılamadı: bu fotoğraf formatı tarayıcıda desteklenmiyor.`);
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} mimeType
 * @param {number} quality
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Görsel kodlanamadı.'));
    }, mimeType, quality);
  });
}

/**
 * @param {ImageBitmap} bitmap
 * @param {number} maxEdge
 * @param {number} quality
 * @param {string} [mimeType]
 */
async function resizeAndEncode(bitmap, maxEdge, quality, mimeType = PREFERRED_FORMAT.mimeType) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  return { blob, width, height };
}

/**
 * Zaten saklanan bir fotoğrafı (full Blob) farklı bir boyut/kalitede
 * yeniden kodlar. Paylaşılabilir HTML / KMZ dışa aktarımında kullanılır.
 * Alıcının tarayıcısı bilinmediğinden her zaman JPEG üretir (en geniş uyumluluk).
 * @param {Blob} blob
 * @param {{maxEdge: number, quality: number}} options
 * @returns {Promise<{blob: Blob, width: number, height: number}>}
 */
export async function reencodeBlob(blob, { maxEdge, quality }) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    return await resizeAndEncode(bitmap, maxEdge, quality, 'image/jpeg');
  } finally {
    bitmap.close();
  }
}

/**
 * @param {File} file
 * @param {{thumbMaxEdge?: number, thumbQuality?: number, fullMaxEdge?: number, fullQuality?: number}} [options]
 * @returns {Promise<{thumbBlob: Blob, fullBlob: Blob, width: number, height: number}>}
 */
export async function processPhotoFile(file, options = {}) {
  const {
    thumbMaxEdge = 256,
    thumbQuality = 0.8,
    fullMaxEdge = 1600,
    fullQuality = 0.85,
  } = options;

  const bitmap = await loadBitmap(file);
  try {
    const full = await resizeAndEncode(bitmap, fullMaxEdge, fullQuality);
    const thumb = await resizeAndEncode(bitmap, thumbMaxEdge, thumbQuality);
    return {
      thumbBlob: thumb.blob,
      fullBlob: full.blob,
      width: full.width,
      height: full.height,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * Birden çok dosyayı sırayla işler; biri başarısız olursa diğerleriyle devam eder.
 * @param {FileList|File[]} files
 * @param {{onProgress?: (done: number, total: number) => void, onError?: (file: File, error: Error) => void}} [callbacks]
 * @returns {Promise<Array<{file: File, result: {thumbBlob: Blob, fullBlob: Blob, width: number, height: number}}>>}
 */
export async function processPhotoFiles(files, callbacks = {}) {
  const { onProgress, onError } = callbacks;
  const fileArray = Array.from(files);
  const results = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    try {
      const result = await processPhotoFile(file);
      results.push({ file, result });
    } catch (err) {
      onError?.(file, /** @type {Error} */ (err));
    }
    onProgress?.(i + 1, fileArray.length);
  }

  return results;
}
