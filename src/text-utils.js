// Dosya adı üretimi için küçük ortak metin yardımcıları
// (share-export.js, kmz-export.js tarafından kullanılır).

const TR_MAP = { ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', İ: 'i', Ğ: 'g', Ü: 'u', Ş: 's', Ö: 'o', Ç: 'c' };

/** @param {string} text */
export function slugify(text) {
  const replaced = text.replace(/[ğüşıöçİĞÜŞÖÇ]/g, (c) => TR_MAP[c] ?? c);
  return replaced
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
