// Paylaşılabilir tek-HTML dışa aktarımının giriş betiği. Bu dosya,
// share-export.js tarafından kaynak metni olarak okunup diğer
// paylaşılan modüllerle (router.js, cluster.js, ui/toast.js,
// ui/photo-viewer.js, ui/photo-grid-panel.js) birlikte çıktı
// dosyasına gömülür — ana uygulama bunu doğrudan kullanmaz.

/* global maplibregl */

/** @param {string} dataUri */
function dataUriToBlob(dataUri) {
  const [header, base64] = dataUri.split(',');
  const mime = header.slice(header.indexOf(':') + 1, header.indexOf(';'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const dataEl = document.getElementById('map-data');
const manifest = JSON.parse(dataEl.textContent);

/** @type {Map<string, any[]>} pinId -> Photo benzeri (Blob) nesneler */
const photosByPinId = new Map();

const summaries = manifest.pins.map((p) => {
  const photos = p.photos.map((ph) => ({
    id: ph.id,
    thumb: dataUriToBlob(ph.thumb),
    full: dataUriToBlob(ph.full),
    width: ph.width,
    height: ph.height,
  }));
  photosByPinId.set(p.id, photos);
  return {
    pin: { id: p.id, lat: p.lat, lng: p.lng, title: p.title, note: p.note },
    cover: photos[0],
    count: photos.length,
  };
});

if (manifest.title) {
  const banner = document.createElement('div');
  banner.className = 'viewer-title-banner';
  banner.textContent = manifest.title;
  document.body.appendChild(banner);
}

const bounds = summaries.length
  ? summaries.reduce(
      (b, s) => [
        Math.min(b[0], s.pin.lng),
        Math.min(b[1], s.pin.lat),
        Math.max(b[2], s.pin.lng),
        Math.max(b[3], s.pin.lat),
      ],
      [Infinity, Infinity, -Infinity, -Infinity]
    )
  : [26, 36, 45, 42]; // pin yoksa Türkiye'ye yakın genel bir görünüm

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  bounds,
  fitBoundsOptions: { padding: 56, maxZoom: 16 },
  attributionControl: { compact: true },
});

function getPhotosForPins(pinIds) {
  return pinIds.flatMap((id) => photosByPinId.get(id) ?? []);
}

setClusterHandlers({
  onPinTap: (pinId) => showPhotoGridPanel(photosByPinId.get(pinId) ?? []),
  onClusterUnexpandable: (pinIds) => showPhotoGridPanel(getPhotosForPins(pinIds)),
});

function refresh() {
  setPinSummaries(summaries);
  renderClusters(map);
}

map.on('load', refresh);
map.on('moveend', () => renderClusters(map));
