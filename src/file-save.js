// Bir Blob'u indirme olarak tetiklemek için küçük ortak yardımcı
// (backup.js, share-export.js, kmz-export.js tarafından kullanılır).

/**
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Web Share API dosya paylaşımı destekleniyorsa paylaşım menüsünü açar,
 * değilse indirir.
 * @param {Blob} blob
 * @param {string} fileName
 * @param {string} mimeType
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function shareOrDownload(blob, fileName, mimeType) {
  if (navigator.canShare && typeof File !== 'undefined') {
    const file = new File([blob], fileName, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return 'shared';
      } catch (err) {
        if (/** @type {DOMException} */ (err).name === 'AbortError') return 'cancelled';
        // Paylaşım başarısız oldu, indirmeye düş.
      }
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
