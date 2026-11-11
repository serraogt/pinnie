import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PHOTO = path.join(__dirname, 'fixtures', 'sample-no-gps.jpg');

/**
 * pins.js üzerinden doğrudan pin oluşturur (uzun basma UI akışını
 * atlayarak); test verisini hızlıca hazırlamak için kullanılır.
 * @param {import('playwright/test').Page} page
 * @param {Array<[number, number]>} coords
 */
async function seedPins(page, coords) {
  const buffer = await import('node:fs/promises').then((fs) => fs.readFile(SAMPLE_PHOTO));
  const base64 = buffer.toString('base64');
  await page.evaluate(
    async ({ base64, coords }) => {
      const { createPinWithPhotos } = await import('/src/pins.js');
      const resp = await fetch('data:image/jpeg;base64,' + base64);
      const blob = await resp.blob();
      for (const [lat, lng] of coords) {
        await createPinWithPhotos(lat, lng, [new File([blob], 'sample.jpg', { type: blob.type })]);
      }
    },
    { base64, coords }
  );
}

test.describe('Kümeleme ve rozetler', () => {
  test('yakın pinler tek markerda kümelenir ve toplam foto rozeti gösterir', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000);

    await seedPins(page, [
      [39.0, 35.0],
      [39.0045, 35.0],
      [39.009, 35.0],
      [40.0, 36.0], // ayrı, kümelenmeyecek kadar uzak ama görünür alanda
    ]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1500);

    await expect(page.locator('.map-marker')).toHaveCount(2);
    await expect(page.locator('.map-marker-badge', { hasText: '3' })).toHaveCount(1);
  });

  test('küme kapağı birden fazla pinin fotoğraflarından oluşan 2x2 kolaj gösterir', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000);

    await seedPins(page, [
      [39.0, 35.0],
      [39.0045, 35.0],
      [39.009, 35.0],
      [39.0135, 35.0],
    ]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1500);

    await expect(page.locator('.map-marker')).toHaveCount(1);
    await expect(page.locator('.map-marker-grid-cell')).toHaveCount(4);
    await expect(page.locator('.map-marker-thumb')).toHaveCount(0);
  });

  test('tekil pine dokununca direkt tam ekran görüntüleyici açılır (kümeden ayrı akış)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000);

    await seedPins(page, [
      [39.0, 35.0],
      [40.0, 36.0],
    ]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1500);

    await page.locator('.map-marker').filter({ hasNot: page.locator('.map-marker-badge') }).first().click();

    await expect(page.locator('.photo-viewer-overlay')).toBeVisible();
    await expect(page.locator('.photo-viewer-slide')).toHaveCount(1);
  });

  test('notu olan tekil pinin marker etiketinde ilk birkaç harfi kırpılmış gösterilir', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000);

    await seedPins(page, [[39.0, 35.0]]);
    await page.evaluate(async () => {
      const { loadMapPinSummaries } = await import('/src/pins.js');
      const { updatePinMeta } = await import('/src/pins.js');
      const [{ pin }] = await loadMapPinSummaries();
      await updatePinMeta(pin.id, { note: 'Burası çok güzeldi' });
    });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1500);

    await expect(page.locator('.map-marker-note')).toHaveText('Bur…');
  });

  test('aynı konumdaki pinler maksimum zoomda ayrışmaz ve grid panel açar', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000);

    await seedPins(page, [
      [39.0, 35.0],
      [39.0, 35.0],
    ]);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1500);

    await page.locator('.map-marker').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.photo-grid-overlay')).toBeVisible();
    await expect(page.locator('.photo-grid-thumb')).toHaveCount(2);
  });
});
