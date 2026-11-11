// IndexedDB üzerine ince bir sarmalayıcı: pins / photos / meta object store'ları
// ve sürüm bazlı şema göçü (migration) burada yönetilir.

/**
 * @typedef {Object} Pin
 * @property {string} id
 * @property {number} lat
 * @property {number} lng
 * @property {string} [title]
 * @property {string} [note]
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} Photo
 * @property {string} id
 * @property {string} pinId
 * @property {Blob} thumb
 * @property {Blob} full
 * @property {number} width
 * @property {number} height
 * @property {number} [takenAt] EXIF çekim tarihi (epoch ms), yoksa undefined
 * @property {number} sortOrder
 * @property {number} createdAt
 */

const DB_NAME = 'harita-pin-lite';
const DB_VERSION = 1;

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

/** @returns {string} */
export function newId() {
  if ('randomUUID' in crypto) return crypto.randomUUID();
  // Çok eski tarayıcılar için basit geri dönüş (yalnızca yerel benzersizlik yeterli).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function reqp(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @param {IDBDatabase} db
 * @param {number} oldVersion
 */
function runMigrations(db, oldVersion) {
  if (oldVersion < 1) {
    const pins = db.createObjectStore('pins', { keyPath: 'id' });
    pins.createIndex('updatedAt', 'updatedAt');

    const photos = db.createObjectStore('photos', { keyPath: 'id' });
    photos.createIndex('pinId', 'pinId');

    db.createObjectStore('meta', { keyPath: 'key' });
  }
  // Gelecekteki şema değişiklikleri buraya eklenir: if (oldVersion < 2) { ... }
}

/** @returns {Promise<IDBDatabase>} */
export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => runMigrations(request.result, event.oldVersion);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('IndexedDB yükseltmesi başka bir sekme tarafından engellendi.');
    };
  });
  return dbPromise;
}

/**
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => Promise<any>} callback
 */
async function withStore(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    callback(store)
      .then((r) => { result = r; })
      .catch((err) => {
        try { tx.abort(); } catch { /* zaten kapanmış olabilir */ }
        reject(err);
      });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('İşlem iptal edildi.'));
  });
}

// --- Pins ---------------------------------------------------------------

/** @param {Pin} pin */
export function putPin(pin) {
  return withStore('pins', 'readwrite', (store) => reqp(store.put(pin)));
}

/** @param {string} id @returns {Promise<Pin|undefined>} */
export function getPin(id) {
  return withStore('pins', 'readonly', (store) => reqp(store.get(id)));
}

/** @returns {Promise<Pin[]>} */
export function getAllPins() {
  return withStore('pins', 'readonly', (store) => reqp(store.getAll()));
}

/**
 * Pini ve ona ait tüm fotoğrafları tek işlemde siler.
 * @param {string} pinId
 */
export async function deletePinWithPhotos(pinId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['pins', 'photos'], 'readwrite');
    tx.objectStore('pins').delete(pinId);
    const cursorReq = tx.objectStore('photos').index('pinId').openCursor(IDBKeyRange.only(pinId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('İşlem iptal edildi.'));
  });
}

// --- Photos ---------------------------------------------------------------

/** @param {Photo} photo */
export function putPhoto(photo) {
  return withStore('photos', 'readwrite', (store) => reqp(store.put(photo)));
}

/** @param {string} id @returns {Promise<Photo|undefined>} */
export function getPhoto(id) {
  return withStore('photos', 'readonly', (store) => reqp(store.get(id)));
}

/** @param {string} pinId @returns {Promise<Photo[]>} */
export function getPhotosByPin(pinId) {
  return withStore('photos', 'readonly', (store) => reqp(store.index('pinId').getAll(pinId)));
}

/** @returns {Promise<Photo[]>} */
export function getAllPhotos() {
  return withStore('photos', 'readonly', (store) => reqp(store.getAll()));
}

/** @param {string} id */
export function deletePhoto(id) {
  return withStore('photos', 'readwrite', (store) => reqp(store.delete(id)));
}

/**
 * Tüm pin ve fotoğrafları siler (geri yükleme "değiştir" modu için).
 * meta store'una (ör. lastBackupAt) dokunmaz.
 */
export async function clearAllData() {
  const dbInstance = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(['pins', 'photos'], 'readwrite');
    tx.objectStore('pins').clear();
    tx.objectStore('photos').clear();
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('İşlem iptal edildi.'));
  });
}

// --- Meta (tekil ayarlar: lastBackupAt vb.) --------------------------------

/** @param {string} key @returns {Promise<any>} */
export async function getMetaValue(key) {
  const record = await withStore('meta', 'readonly', (store) => reqp(store.get(key)));
  return record?.value;
}

/** @param {string} key @param {any} value */
export function setMetaValue(key, value) {
  return withStore('meta', 'readwrite', (store) => reqp(store.put({ key, value })));
}
