import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PHOTO = path.join(__dirname, 'fixtures', 'sample-no-gps.jpg');

/**
 * @param {import('playwright/test').Page} page
 * @param {Array<[number, number, number]>} specs [lat, lng, fotoSayisi][]
 */
async function seedPins(page, specs) {
  const base64 = (await readFile(SAMPLE_PHOTO)).toString('base64');
  await page.evaluate(
    async ({ base64, specs }) => {
      const { createPinWithPhotos } = await import('/src/pins.js');
      const resp = await fetch('data:image/jpeg;base64,' + base64);
      const blob = await resp.blob();
      for (const [lat, lng, count] of specs) {
        const files = Array.from({ length: count }, () => new File([blob], 'sample.jpg', { type: blob.type }));
        await createPinWithPhotos(lat, lng, files);
      }
    },
    { base64, specs }
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#map canvas');
  await page.waitForTimeout(1200);
}

test.describe('Pine dokunma: tam ekran görüntüleyici akışı', () => {
  test.beforeEach(({ page }) => {
    page.on('dialog', (d) => d.accept());
  });

  test('pine dokununca ara ekran olmadan direkt tam ekran görüntüleyici açılır', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 2]]);

    await page.locator('.map-marker').click();
    await expect(page.locator('.photo-viewer-overlay')).toBeVisible();
    await expect(page.locator('.photo-viewer-slide')).toHaveCount(2);
    await expect(page.locator('.pin-detail-overlay')).toHaveCount(0);
  });

  test('Düzenle ile başlık/not girilir, tam metin altyazıda (kırpılmadan) görünür ve kalıcı olur', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 1]]);

    const longNote = 'Bu çok uzun bir not metni, kırpılmadan tam ekranda tamamen görünmesi gerekiyor.';

    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-btn', { hasText: 'Düzenle' }).click();
    await expect(page.locator('.pin-detail-overlay')).toBeVisible();

    await page.locator('.pin-detail-title').fill('Deniz Kenarı');
    await page.locator('.pin-detail-note').fill(longNote);
    await page.locator('.pin-edit-save').click();

    await expect(page.locator('.pin-detail-overlay')).toHaveCount(0);
    await expect(page.locator('.photo-viewer-caption')).toHaveText(longNote);

    await page.goBack(); // görüntüleyiciyi kapat
    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-btn', { hasText: 'Düzenle' }).click();
    await expect(page.locator('.pin-detail-title')).toHaveValue('Deniz Kenarı');
    await expect(page.locator('.pin-detail-note')).toHaveValue(longNote);
  });

  test('geri tuşu önce Düzenle ekranını, sonra görüntüleyiciyi kapatır', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 1]]);

    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-btn', { hasText: 'Düzenle' }).click();
    await expect(page.locator('.pin-detail-overlay')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.pin-detail-overlay')).toHaveCount(0);
    await expect(page.locator('.photo-viewer-overlay')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.photo-viewer-overlay')).toHaveCount(0);
  });

  test('"⋯" menüsünden fotoğraf eklenince görüntüleyici kapanır ve rozet güncellenir', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 1]]);

    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-menu').click();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('.menu-item', { hasText: 'Fotoğraf Ekle' }).click(),
    ]);
    await chooser.setFiles([SAMPLE_PHOTO]);
    await page.waitForTimeout(800);

    await expect(page.locator('.photo-viewer-overlay')).toHaveCount(0);
    await expect(page.locator('.map-marker-badge')).toHaveText('2');
  });

  test('"⋯" menüsünden "Bu fotoğrafı sil" son fotoğrafsa pini de kaldırır', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 1]]);

    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-menu').click();
    await page.locator('.menu-item', { hasText: 'Bu fotoğrafı sil' }).click();
    await page.locator('.dialog-card .dialog-action-destructive').click();
    await page.waitForTimeout(600);

    await expect(page.locator('.photo-viewer-overlay')).toHaveCount(0);
    await expect(page.locator('.map-marker')).toHaveCount(0);
  });

  test('"⋯" menüsünden "Pini Sil" onaylanınca marker kalkar', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 1]]);

    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-menu').click();
    await page.locator('.menu-item', { hasText: 'Pini Sil' }).click();
    await page.locator('.dialog-card .dialog-action-destructive').click();
    await page.waitForTimeout(600);

    await expect(page.locator('.photo-viewer-overlay')).toHaveCount(0);
    await expect(page.locator('.map-marker')).toHaveCount(0);
  });

  test('"⋯" menüsünden "Pini Taşı" nişangahı açar (görüntüleyici gizlenir), onaylayınca kapanır', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [[39.0, 35.0, 1]]);

    await page.locator('.map-marker').click();
    await page.locator('.photo-viewer-toolbar-menu').click();
    await page.locator('.menu-item', { hasText: 'Pini Taşı' }).click();
    await expect(page.locator('.crosshair-overlay')).toBeVisible();
    await expect(page.locator('.photo-viewer-overlay')).toBeHidden();

    await page.locator('.crosshair-confirm').click();
    await expect(page.locator('.crosshair-overlay')).toHaveCount(0);
    await expect(page.locator('.photo-viewer-overlay')).toHaveCount(0);
    await expect(page.locator('.map-marker')).toHaveCount(1);
  });
});
