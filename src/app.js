// maplibregl ve Supercluster, index.html'de klasik <script> etiketleriyle
// (vendor/*.js, UMD derlemeleri) yüklenip global olarak sunuluyor.
/* global maplibregl */
import { showToast } from './ui/toast.js';
import { showProgress, hideProgress } from './ui/progress-overlay.js';
import { showPhotoGridPanel } from './ui/photo-grid-panel.js';
import { openPhotoViewer } from './ui/photo-viewer.js';
import { openPinEditDialog } from './ui/pin-edit-dialog.js';
import { pickLocationOnMap } from './ui/crosshair-picker.js';
import { showAppMenu } from './ui/menu.js';
import { showChoiceDialog, showInfoDialog } from './ui/dialog.js';
import { openExportDialog } from './ui/export-dialog.js';
import { openKmzExportDialog } from './ui/kmz-export-dialog.js';
import { attachLongPress } from './long-press.js';
import { onDepthChange, closePanel } from './router.js';
import {
  createPinWithPhotos,
  planPinsFromFiles,
  loadMapPinSummaries,
  getPhotosForPins,
  getPinWithPhotos,
  getPinSummary,
  addPhotosToExistingPin,
  updatePinLocation,
  deletePhoto,
  deletePin,
} from './pins.js';
import { setPinSummaries, renderClusters, setClusterHandlers } from './cluster.js';
import { exportBackup, restoreBackup, getLastBackupAt } from './backup.js';
import { requestPersistentStorage, getStorageEstimate, formatBytes } from './storage-info.js';
import { registerServiceWorker } from './pwa-register.js';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_CENTER = [35.2433, 38.9637]; // Türkiye yaklaşık merkezi
const DEFAULT_ZOOM = 5.5;

const map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  attributionControl: { compact: true },
});

map.on('error', (e) => {
  console.error('Harita hatası:', e?.error ?? e);
});

function geolocationErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Konum izni verilmedi. Tarayıcı ayarlarından izin verebilirsin.';
    case err.POSITION_UNAVAILABLE:
      return 'Konum şu anda alınamıyor.';
    case err.TIMEOUT:
      return 'Konum alma işlemi zaman aşımına uğradı.';
    default:
      return 'Konum alınamadı.';
  }
}

function goToMyLocation() {
  if (!('geolocation' in navigator)) {
    showToast('Bu tarayıcı konum özelliğini desteklemiyor.', { type: 'error' });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      map.flyTo({
        center: [longitude, latitude],
        zoom: Math.max(map.getZoom(), 15),
        essential: true,
      });
    },
    (err) => showToast(geolocationErrorMessage(err), { type: 'error' }),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

document.getElementById('btn-locate').addEventListener('click', goToMyLocation);

// --- Uzun basma ile pin ekleme ---------------------------------------------

const photoPicker = /** @type {HTMLInputElement} */ (document.getElementById('photo-picker'));
/** @type {{lat: number, lng: number}|null} */
let pendingLatLng = null;

async function refreshMarkers() {
  const summaries = await loadMapPinSummaries();
  setPinSummaries(summaries);
  renderClusters(map);
}

setClusterHandlers({
  onPinTap: async (pinId) => {
    const { photos } = await getPinWithPhotos(pinId);
    if (photos.length === 0) return;
    const viewer = openPhotoViewer(photos, 0, {
      onEdit: async () => {
        const result = await openPinEditDialog(pinId);
        if (result) viewer.setCaption(result.note || undefined);
      },
      onMenu: (currentPhotoId) => openPinActionMenu(pinId, currentPhotoId, viewer),
    });
  },
  onClusterUnexpandable: async (pinIds) => {
    const photos = await getPhotosForPins(pinIds);
    showPhotoGridPanel(photos);
  },
});

/**
 * Tam ekran görüntüleyicideki "⋯" menüsü: fotoğraf ekleme, bu
 * fotoğrafı silme, pini taşıma, pini silme. Bu dört aksiyon da
 * pinin/fotoğraf listesinin değişmesine yol açtığından, işlem
 * tamamlanınca görüntüleyici kapatılır (tekrar açılınca güncel
 * haliyle gelir).
 * @param {string} pinId
 * @param {string} currentPhotoId
 * @param {{hide: () => void, show: () => void}} viewer
 */
function openPinActionMenu(pinId, currentPhotoId, viewer) {
  showAppMenu([
    { label: 'Fotoğraf Ekle', onSelect: () => handleAddPhotoToPin(pinId) },
    { label: 'Bu fotoğrafı sil', onSelect: () => handleDeleteSinglePhoto(pinId, currentPhotoId) },
    { label: 'Pini Taşı', onSelect: () => handleMovePin(pinId, viewer) },
    { label: 'Pini Sil', onSelect: () => handleDeletePinFromViewer(pinId) },
  ]);
}

/** @param {string} pinId */
function handleAddPhotoToPin(pinId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = input.files;
    if (!files || files.length === 0) return;

    showProgress(0, files.length);
    try {
      const added = await addPhotosToExistingPin(pinId, files, {
        onProgress: (done, total) => showProgress(done, total),
        onError: (file, err) => showToast(err.message, { type: 'error' }),
      });
      if (added > 0) {
        await refreshMarkers();
        showToast(`${added} fotoğraf eklendi.`, { type: 'success' });
        closePanel(); // görüntüleyiciyi kapat; tekrar açılınca yeni fotoğraflar dahil gelir
      }
    } finally {
      hideProgress();
    }
  });
  input.click();
}

/**
 * @param {string} pinId
 * @param {string} photoId
 */
async function handleDeleteSinglePhoto(pinId, photoId) {
  const confirmed = await showChoiceDialog({
    title: 'Bu fotoğraf silinsin mi?',
    choices: [{ label: 'Fotoğrafı Sil', value: true, danger: true }],
  });
  if (!confirmed) return;

  await deletePhoto(photoId);
  const remaining = await getPinSummary(pinId);
  if (remaining.count === 0) {
    await deletePin(pinId);
    showToast('Son fotoğraf silindiği için pin de kaldırıldı.', { type: 'info' });
  } else {
    showToast('Fotoğraf silindi.', { type: 'success' });
  }
  await refreshMarkers();
  closePanel();
}

/**
 * @param {string} pinId
 * @param {{hide: () => void, show: () => void}} viewer
 */
async function handleMovePin(pinId, viewer) {
  viewer.hide();
  const result = await pickLocationOnMap(map, { title: 'Pini taşı', confirmLabel: 'Buraya taşı' });
  if (result) {
    await updatePinLocation(pinId, result.lat, result.lng);
    await refreshMarkers();
    showToast('Pin taşındı.', { type: 'success' });
    closePanel();
  } else {
    viewer.show();
  }
}

/** @param {string} pinId */
async function handleDeletePinFromViewer(pinId) {
  const confirmed = await showChoiceDialog({
    title: 'Bu pin ve tüm fotoğrafları silinsin mi?',
    message: 'Bu işlem geri alınamaz.',
    choices: [{ label: 'Pini Sil', value: true, danger: true }],
  });
  if (!confirmed) return;
  await deletePin(pinId);
  await refreshMarkers();
  showToast('Pin silindi.', { type: 'success' });
  closePanel();
}

map.on('moveend', () => renderClusters(map));

const longPress = attachLongPress(map.getContainer(), {
  onLongPress: (e) => {
    const rect = map.getContainer().getBoundingClientRect();
    const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    pendingLatLng = { lat: lngLat.lat, lng: lngLat.lng };
    photoPicker.value = '';
    photoPicker.click();
  },
});

// Herhangi bir panel (detay, görüntüleyici, nişangah...) açıkken
// haritada uzun basmayı devre dışı bırak.
onDepthChange((depth) => longPress.setEnabled(depth === 0));

photoPicker.addEventListener('change', async () => {
  const files = photoPicker.files;
  const latLng = pendingLatLng;
  pendingLatLng = null;

  if (!latLng || !files || files.length === 0) return;

  showProgress(0, files.length);
  try {
    const pin = await createPinWithPhotos(latLng.lat, latLng.lng, files, {
      onProgress: (done, total) => showProgress(done, total),
      onError: (file, err) => showToast(err.message, { type: 'error' }),
    });
    if (!pin) {
      showToast('Hiçbir fotoğraf eklenemediği için pin oluşturulmadı.', { type: 'error' });
    } else {
      await refreshMarkers();
    }
  } catch (err) {
    showToast('Pin oluşturulurken bir hata oluştu: ' + err.message, { type: 'error' });
  } finally {
    hideProgress();
  }
});

// --- "+" ile ekleme: EXIF GPS'e göre otomatik konumlama --------------------

const photoPickerPlus = /** @type {HTMLInputElement} */ (document.getElementById('photo-picker-plus'));

document.getElementById('btn-add').addEventListener('click', () => {
  photoPickerPlus.value = '';
  photoPickerPlus.click();
});

photoPickerPlus.addEventListener('change', async () => {
  const files = photoPickerPlus.files;
  if (!files || files.length === 0) return;

  showProgress(0, files.length, 'Konum bilgisi okunuyor');
  let plan;
  try {
    plan = await planPinsFromFiles(files, {
      onProgress: (done, total) => showProgress(done, total, 'Konum bilgisi okunuyor'),
    });
  } finally {
    hideProgress();
  }

  let createdAny = false;

  for (const group of plan.locatedGroups) {
    showProgress(0, group.files.length);
    try {
      const pin = await createPinWithPhotos(group.lat, group.lng, group.files, {
        onProgress: (done, total) => showProgress(done, total),
        onError: (file, err) => showToast(err.message, { type: 'error' }),
      });
      if (pin) createdAny = true;
    } catch (err) {
      showToast('Pin oluşturulurken bir hata oluştu: ' + err.message, { type: 'error' });
    } finally {
      hideProgress();
    }
  }

  if (plan.unlocatedFiles.length > 0) {
    showToast(
      `${plan.unlocatedFiles.length} fotoğrafta konum bilgisi yok. Haritada bir konum seç.`,
      { type: 'info' }
    );
    const result = await pickLocationOnMap(map, {
      title: 'Konumsuz fotoğraflar için konum seç',
      confirmLabel: 'Buraya koy',
    });

    if (result) {
      showProgress(0, plan.unlocatedFiles.length);
      try {
        const pin = await createPinWithPhotos(result.lat, result.lng, plan.unlocatedFiles, {
          onProgress: (done, total) => showProgress(done, total),
          onError: (file, err) => showToast(err.message, { type: 'error' }),
        });
        if (pin) createdAny = true;
      } catch (err) {
        showToast('Pin oluşturulurken bir hata oluştu: ' + err.message, { type: 'error' });
      } finally {
        hideProgress();
      }
    } else {
      showToast('Konum seçilmediği için o fotoğraflar eklenmedi.', { type: 'info' });
    }
  }

  if (createdAny) await refreshMarkers();
});

// --- Menü: Yedekle / Geri yükle / Depolama bilgisi --------------------------

const restorePicker = /** @type {HTMLInputElement} */ (document.getElementById('restore-picker'));
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

async function handleExportBackup() {
  showProgress(0, 1, 'Yedek hazırlanıyor');
  try {
    const result = await exportBackup((done, total) => showProgress(done, total, 'Yedek hazırlanıyor'));
    if (result === 'shared') showToast('Yedek paylaşıldı.', { type: 'success' });
    else if (result === 'downloaded') showToast('Yedek indirildi.', { type: 'success' });
  } catch (err) {
    showToast('Yedek oluşturulurken bir hata oluştu: ' + err.message, { type: 'error' });
  } finally {
    hideProgress();
  }
}

function handleRestoreBackup() {
  restorePicker.value = '';
  restorePicker.click();
}

restorePicker.addEventListener('change', async () => {
  const file = restorePicker.files?.[0];
  if (!file) return;

  const mode = await showChoiceDialog({
    title: 'Geri yükle',
    message: 'Yedekteki veriler mevcut verilerle nasıl birleştirilsin?',
    choices: [
      { label: 'Mevcut verilerle birleştir', value: 'merge' },
      { label: 'Mevcut verileri silip değiştir', value: 'replace', danger: true },
    ],
  });
  if (!mode) return;

  showProgress(0, 1, 'Geri yükleniyor');
  try {
    const { pinsAdded, photosAdded } = await restoreBackup(file, mode, (done, total) =>
      showProgress(done, total, 'Geri yükleniyor')
    );
    await refreshMarkers();
    showToast(`${pinsAdded} pin, ${photosAdded} fotoğraf eklendi.`, { type: 'success' });
  } catch (err) {
    showToast('Geri yükleme sırasında bir hata oluştu: ' + err.message, { type: 'error' });
  } finally {
    hideProgress();
  }
});

async function handleStorageInfo() {
  const estimate = await getStorageEstimate();
  if (!estimate) {
    await showInfoDialog({ title: 'Depolama bilgisi', message: 'Bu tarayıcıda depolama bilgisi alınamıyor.' });
    return;
  }
  const { usageBytes, quotaBytes, persisted } = estimate;
  const message =
    `Kullanılan alan: ${formatBytes(usageBytes)} / ${formatBytes(quotaBytes)}\n` +
    `Kalıcı depolama: ${persisted ? 'Etkin' : 'Etkin değil'}`;
  await showInfoDialog({ title: 'Depolama bilgisi', message });
}

document.getElementById('btn-menu').addEventListener('click', () => {
  showAppMenu([
    { label: 'Yedekle', onSelect: handleExportBackup },
    { label: 'Geri yükle', onSelect: handleRestoreBackup },
    { label: 'Paylaşılabilir harita olarak dışa aktar', onSelect: openExportDialog },
    { label: 'KMZ olarak dışa aktar', onSelect: openKmzExportDialog },
    { label: 'Depolama bilgisi', onSelect: handleStorageInfo },
  ]);
});

async function checkBackupReminder() {
  const lastBackupAt = await getLastBackupAt();
  if (!lastBackupAt || Date.now() - lastBackupAt > TWO_WEEKS_MS) {
    showToast('İki haftadan uzun süredir yedek almadın. Ara sıra yedeklemeyi unutma.', { type: 'info' });
  }
}

requestPersistentStorage();
checkBackupReminder();
registerServiceWorker();

window.addEventListener('offline', () => {
  showToast('İnternet bağlantısı yok. Harita görüntülenemeyebilir.', { type: 'info' });
});

map.on('load', refreshMarkers);
