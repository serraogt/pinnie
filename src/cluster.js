// supercluster ile görünen alan + zoom için kümeleri hesaplar, her
// kümeyi/pini özel HTML elemanlı bir maplibregl.Marker olarak çizer.
// Harita hareketi bitince (moveend) yeniden hesaplanır; değişmeyen
// marker'lara dokunulmaz, yalnızca değişenler güncellenir.

/* global maplibregl, Supercluster */

const CLUSTER_RADIUS = 70;
const CLUSTER_MAX_ZOOM = 17;
const COLLAGE_CELL_COUNT = 4;
const NOTE_LABEL_MAX_CHARS = 3;

/** @type {Map<string, {marker: maplibregl.Marker, thumbURLs: string[], signature: string}>} */
const activeMarkers = new Map();

/** @type {any|null} Supercluster index örneği */
let index = null;

/** @type {((pinId: string) => void)|null} */
let onPinTap = null;
/** @type {((pinIds: string[]) => void)|null} */
let onClusterUnexpandable = null;

/**
 * @param {{onPinTap?: (pinId: string) => void, onClusterUnexpandable?: (pinIds: string[]) => void}} handlers
 */
export function setClusterHandlers(handlers) {
  onPinTap = handlers.onPinTap ?? null;
  onClusterUnexpandable = handlers.onClusterUnexpandable ?? null;
}

/**
 * Pin özetlerinden yeni bir kümeleme indeksi kurar. Yalnızca veri
 * değiştiğinde (pin eklendi/silindi/güncellendi) çağrılması yeterlidir;
 * harita hareketi için renderClusters yeterlidir.
 *
 * @param {Array<{pin: import('./db.js').Pin, cover: import('./db.js').Photo|undefined, count: number}>} summaries
 */
export function setPinSummaries(summaries) {
  const sc = new Supercluster({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    map: (props) => ({ photoCount: props.photoCount }),
    reduce: (acc, props) => {
      acc.photoCount += props.photoCount;
    },
  });

  const features = summaries
    .filter((s) => s.cover)
    .map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.pin.lng, s.pin.lat] },
      properties: {
        pinId: s.pin.id,
        photoCount: s.count,
        coverThumb: /** @type {import('./db.js').Photo} */ (s.cover).thumb,
        note: s.pin.note,
      },
    }));

  sc.load(features);
  index = sc;
}

/**
 * Bir küme için kolaj hücrelerinde gösterilecek, birbirinden farklı
 * pinlere ait kapak fotoğraflarını döndürür (en çok COLLAGE_CELL_COUNT kadar).
 * @param {number} clusterId
 * @returns {Blob[]}
 */
function getCollageThumbs(clusterId) {
  const leaves = index.getLeaves(clusterId, COLLAGE_CELL_COUNT);
  return leaves.map((/** @type {any} */ l) => l.properties.coverThumb);
}

/** @param {string} note */
function truncateNoteLabel(note) {
  return note.length > NOTE_LABEL_MAX_CHARS ? `${note.slice(0, NOTE_LABEL_MAX_CHARS)}…` : note;
}

/**
 * Marker, altında haritadaki tam konumu işaret eden bir üçgen uç olan
 * bir "balon" olarak çizilir (bubble + pointer). Çerçeve ve uç, düz bir
 * renk yerine ilk fotoğrafın bulanıklaştırılmış bir versiyonu — tıpkı
 * Apple Music/Spotify'daki kapak fotoğrafı arka planı gibi. Küme birden
 * fazla pini temsil ediyorsa (thumbURLs.length > 1), tek fotoğraf
 * yerine 2x2 bir kolaj gösterilir. Notu olan tekil pinlerde, fotoğraf
 * karesinin alt kenarına yapışık, üzerine bindirilmiş bir altyazı
 * şeridinde notun ilk birkaç harfi görünür. maplibregl.Marker
 * bunu anchor:'bottom' ile kullanır, böylece üçgenin sivri ucu tam
 * koordinatın üstüne oturur.
 * @param {{thumbURLs: string[], count: number, note?: string}} props
 */
function createMarkerElement({ thumbURLs, count, note }) {
  const el = document.createElement('div');
  el.className = 'map-marker';

  const bubble = document.createElement('div');
  bubble.className = 'map-marker-bubble';

  const blurBg = document.createElement('div');
  blurBg.className = 'map-marker-blur-bg';
  blurBg.style.backgroundImage = `url(${thumbURLs[0]})`;
  bubble.appendChild(blurBg);

  bubble.appendChild(createThumbContent(thumbURLs));

  if (note) {
    const noteLabel = document.createElement('div');
    noteLabel.className = 'map-marker-note';
    noteLabel.textContent = truncateNoteLabel(note);
    bubble.appendChild(noteLabel);
  }

  el.appendChild(bubble);

  const pointer = document.createElement('div');
  pointer.className = 'map-marker-pointer';
  pointer.style.backgroundImage = `url(${thumbURLs[0]})`;
  el.appendChild(pointer);

  if (count > 1) {
    const badge = document.createElement('span');
    badge.className = 'map-marker-badge';
    badge.textContent = String(count);
    el.appendChild(badge);
  }

  return el;
}

/**
 * Tek fotoğraf (tekil pin) ya da 2x2 kolaj (küme) içeriğini üretir.
 * @param {string[]} thumbURLs
 */
function createThumbContent(thumbURLs) {
  if (thumbURLs.length === 1) {
    const img = document.createElement('img');
    img.className = 'map-marker-thumb';
    img.alt = '';
    img.src = thumbURLs[0];
    return img;
  }

  const cellCount = Math.min(thumbURLs.length, COLLAGE_CELL_COUNT);
  const grid = document.createElement('div');
  grid.className = `map-marker-grid map-marker-grid-cells-${cellCount}`;
  for (let i = 0; i < cellCount; i++) {
    const img = document.createElement('img');
    img.className = 'map-marker-grid-cell';
    img.alt = '';
    img.src = thumbURLs[i];
    grid.appendChild(img);
  }
  return grid;
}

/**
 * @param {HTMLElement} el
 * @param {{thumbURLs: string[], count: number, note?: string}} props
 */
function updateMarkerElement(el, { thumbURLs, count, note }) {
  const bubble = /** @type {HTMLElement} */ (el.querySelector('.map-marker-bubble'));

  bubble.querySelector('.map-marker-thumb, .map-marker-grid')?.remove();
  bubble.insertBefore(createThumbContent(thumbURLs), bubble.querySelector('.map-marker-note') ?? null);

  /** @type {HTMLElement} */ (bubble.querySelector('.map-marker-blur-bg')).style.backgroundImage =
    `url(${thumbURLs[0]})`;
  /** @type {HTMLElement} */ (el.querySelector('.map-marker-pointer')).style.backgroundImage =
    `url(${thumbURLs[0]})`;

  let badge = el.querySelector('.map-marker-badge');
  if (count > 1) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'map-marker-badge';
      el.appendChild(badge);
    }
    badge.textContent = String(count);
  } else if (badge) {
    badge.remove();
  }

  let noteLabel = bubble.querySelector('.map-marker-note');
  if (note) {
    if (!noteLabel) {
      noteLabel = document.createElement('div');
      noteLabel.className = 'map-marker-note';
      bubble.appendChild(noteLabel);
    }
    noteLabel.textContent = truncateNoteLabel(note);
  } else if (noteLabel) {
    noteLabel.remove();
  }
}

/**
 * @param {maplibregl.Map} map
 * @param {any} item supercluster'dan dönen küme ya da tekil pin feature'ı
 */
function handleTap(map, item) {
  if (!item.properties.cluster) {
    onPinTap?.(item.properties.pinId);
    return;
  }

  const clusterId = item.properties.cluster_id;
  const expansionZoom = index.getClusterExpansionZoom(clusterId);

  if (expansionZoom <= CLUSTER_MAX_ZOOM) {
    map.easeTo({ center: item.geometry.coordinates, zoom: expansionZoom });
  } else {
    // Maksimum zoomda bile ayrışmıyor (pinler birbirine çok yakın/aynı konumda).
    const leaves = index.getLeaves(clusterId, Infinity);
    onClusterUnexpandable?.(leaves.map((/** @type {any} */ l) => l.properties.pinId));
  }
}

/**
 * Mevcut harita görünümü (bbox + zoom) için kümeleri/pinleri hesaplar
 * ve marker'ları eşitler.
 * @param {maplibregl.Map} map
 */
export function renderClusters(map) {
  if (!index) return;

  const bounds = map.getBounds();
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  const zoom = Math.floor(map.getZoom());
  const items = index.getClusters(bbox, zoom);

  const seen = new Set();

  for (const item of items) {
    const isCluster = !!item.properties.cluster;
    const [lng, lat] = item.geometry.coordinates;
    const key = isCluster ? `cluster-${item.properties.cluster_id}` : item.properties.pinId;
    seen.add(key);

    const identity = isCluster ? item.properties.cluster_id : item.properties.pinId;
    const note = isCluster ? undefined : item.properties.note;
    const signature = `${identity}:${item.properties.photoCount}:${note ?? ''}`;
    const existing = activeMarkers.get(key);

    if (existing) {
      existing.marker.setLngLat([lng, lat]);
      if (existing.signature !== signature) {
        const newThumbs = isCluster
          ? getCollageThumbs(item.properties.cluster_id)
          : [item.properties.coverThumb];
        const newURLs = newThumbs.map((b) => URL.createObjectURL(b));
        updateMarkerElement(existing.marker.getElement(), {
          thumbURLs: newURLs,
          count: item.properties.photoCount,
          note,
        });
        for (const url of existing.thumbURLs) URL.revokeObjectURL(url);
        existing.thumbURLs = newURLs;
        existing.signature = signature;
      }
    } else {
      const thumbs = isCluster ? getCollageThumbs(item.properties.cluster_id) : [item.properties.coverThumb];
      const thumbURLs = thumbs.map((b) => URL.createObjectURL(b));
      const el = createMarkerElement({ thumbURLs, count: item.properties.photoCount, note });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTap(map, item);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map);
      activeMarkers.set(key, { marker, thumbURLs, signature });
    }
  }

  for (const [key, entry] of activeMarkers) {
    if (!seen.has(key)) {
      entry.marker.remove();
      for (const url of entry.thumbURLs) URL.revokeObjectURL(url);
      activeMarkers.delete(key);
    }
  }
}
