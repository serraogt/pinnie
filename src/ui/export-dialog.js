// Paylaşılabilir tek-HTML dışa aktarma ekranı: pin seçimi, kalite,
// opsiyonel başlık, tahmini dosya boyutu.

import { openPanel, closePanel, nextZIndex } from '../router.js';
import { showProgress, hideProgress } from './progress-overlay.js';
import { showToast } from './toast.js';
import { loadMapPinSummaries } from '../pins.js';
import { createScopeSection, createQualitySection, createTitleSection } from './export-form-fields.js';
import {
  estimateExportSize,
  buildShareableHtml,
  shareableFileName,
  shareShareableHtml,
} from '../share-export.js';

const TWENTY_MB = 20 * 1024 * 1024;

/** @param {number} bytes */
function formatBytesSimple(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function openExportDialog() {
  const summaries = await loadMapPinSummaries();

  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.style.zIndex = String(nextZIndex());

  const header = document.createElement('div');
  header.className = 'pin-detail-header';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'pin-detail-back';
  backBtn.setAttribute('aria-label', 'Geri');
  backBtn.textContent = '‹';
  backBtn.addEventListener('click', () => closePanel());
  const headerTitle = document.createElement('span');
  headerTitle.className = 'export-header-title';
  headerTitle.textContent = 'Paylaşılabilir harita olarak dışa aktar';
  header.append(backBtn, headerTitle);

  const body = document.createElement('div');
  body.className = 'export-body';

  const scope = createScopeSection(summaries);
  const quality = createQualitySection();
  const titleField = createTitleSection('ör. Kapadokya 2026');

  const estimateEl = document.createElement('div');
  estimateEl.className = 'export-estimate';
  estimateEl.textContent = 'Tahmini boyut hesaplanıyor…';

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-primary export-submit';
  exportBtn.textContent = 'Dışa Aktar';

  body.append(scope.section, quality.section, titleField.section, estimateEl, exportBtn);
  overlay.append(header, body);
  document.body.appendChild(overlay);

  let estimateToken = 0;
  async function updateEstimate() {
    const token = ++estimateToken;
    estimateEl.textContent = 'Tahmini boyut hesaplanıyor…';
    try {
      const bytes = await estimateExportSize({ pinIds: scope.getSelectedPinIds(), quality: quality.getQuality() });
      if (token !== estimateToken) return;
      let msg = `Tahmini boyut: ${formatBytesSimple(bytes)}`;
      if (bytes > TWENTY_MB) msg += ' — Mail ekleri için büyük olabilir.';
      estimateEl.textContent = msg;
    } catch {
      if (token === estimateToken) estimateEl.textContent = 'Tahmini boyut hesaplanamadı.';
    }
  }

  scope.onChange(updateEstimate);
  quality.onChange(updateEstimate);

  exportBtn.addEventListener('click', async () => {
    const pinIds = scope.getSelectedPinIds();
    if (pinIds && pinIds.length === 0) {
      showToast('En az bir pin seçmelisin.', { type: 'error' });
      return;
    }

    const title = titleField.getTitle();

    showProgress(0, 1, 'Fotoğraflar hazırlanıyor');
    try {
      const { html, pinCount, photoCount } = await buildShareableHtml({
        pinIds,
        quality: quality.getQuality(),
        title,
        onProgress: (done, total) => showProgress(done, total, 'Fotoğraflar hazırlanıyor'),
      });
      const fileName = shareableFileName(title);
      const result = await shareShareableHtml(html, fileName);
      if (result === 'shared') {
        showToast(`${pinCount} pin, ${photoCount} fotoğraf paylaşıldı.`, { type: 'success' });
      } else if (result === 'downloaded') {
        showToast(`${pinCount} pin, ${photoCount} fotoğraf indirildi.`, { type: 'success' });
      }
      if (result !== 'cancelled') closePanel();
    } catch (err) {
      showToast('Dışa aktarma sırasında bir hata oluştu: ' + err.message, { type: 'error' });
    } finally {
      hideProgress();
    }
  });

  openPanel(() => overlay.remove());

  updateEstimate();
}
