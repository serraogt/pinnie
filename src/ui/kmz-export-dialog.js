// KMZ (Google Earth) dışa aktarma ekranı: pin seçimi, kalite, opsiyonel başlık.

import { openPanel, closePanel, nextZIndex } from '../router.js';
import { showProgress, hideProgress } from './progress-overlay.js';
import { showToast } from './toast.js';
import { loadMapPinSummaries } from '../pins.js';
import { createScopeSection, createQualitySection, createTitleSection } from './export-form-fields.js';
import { buildKmz, kmzFileName, shareKmz } from '../kmz-export.js';

export async function openKmzExportDialog() {
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
  headerTitle.textContent = 'KMZ olarak dışa aktar';
  header.append(backBtn, headerTitle);

  const body = document.createElement('div');
  body.className = 'export-body';

  const scope = createScopeSection(summaries);
  const quality = createQualitySection();
  const titleField = createTitleSection('ör. Kapadokya 2026');

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-primary export-submit';
  exportBtn.textContent = 'Dışa Aktar';

  body.append(scope.section, quality.section, titleField.section, exportBtn);
  overlay.append(header, body);
  document.body.appendChild(overlay);

  exportBtn.addEventListener('click', async () => {
    const pinIds = scope.getSelectedPinIds();
    if (pinIds && pinIds.length === 0) {
      showToast('En az bir pin seçmelisin.', { type: 'error' });
      return;
    }

    const title = titleField.getTitle();

    showProgress(0, 1, 'Fotoğraflar hazırlanıyor');
    try {
      const { bytes, pinCount, photoCount } = await buildKmz({
        pinIds,
        quality: quality.getQuality(),
        title,
        onProgress: (done, total) => showProgress(done, total, 'Fotoğraflar hazırlanıyor'),
      });
      const fileName = kmzFileName(title);
      const result = await shareKmz(bytes, fileName);
      if (result === 'shared') {
        showToast(`${pinCount} pin, ${photoCount} fotoğraf paylaşıldı.`, { type: 'success' });
      } else if (result === 'downloaded') {
        showToast(`${pinCount} pin, ${photoCount} fotoğraf indirildi.`, { type: 'success' });
      }
      if (result !== 'cancelled') closePanel();
    } catch (err) {
      showToast('KMZ oluşturulurken bir hata oluştu: ' + err.message, { type: 'error' });
    } finally {
      hideProgress();
    }
  });

  openPanel(() => overlay.remove());
}
