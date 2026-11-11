import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  await page.waitForTimeout(1000);
}

test.describe('Paylaşılabilir tek-HTML dışa aktarma', () => {
  test.beforeEach(async ({ page }) => {
    // Headless otomasyonda navigator.share() askıda kalabiliyor; indirme yoluna zorla.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined });
    });
  });

  test('dışa aktarılan dosya file:// ile açılınca harita, kümeleme ve foto görüntüleyici çalışır', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [
      [39.0, 35.0, 2],
      [39.00005, 35.00005, 1], // yakın -> kümeye girer
      [40.0, 36.0, 1], // uzak -> ayrı marker
    ]);

    await page.locator('#btn-menu').click();
    await page.locator('.menu-item', { hasText: 'Paylaşılabilir harita' }).click();
    await page.locator('.export-title-input').fill('Test Gezisi');
    await page.waitForTimeout(1500); // tahmini boyut hesaplaması

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-submit').click(),
    ]);
    expect(download.suggestedFilename()).toBe('test-gezisi.html');
    const savePath = testInfo.outputPath('exported.html');
    await download.saveAs(savePath);

    const viewerPage = await page.context().newPage();
    const errors = [];
    viewerPage.on('pageerror', (err) => errors.push(err.message));
    await viewerPage.goto(pathToFileURL(savePath).href, { waitUntil: 'load' });
    await viewerPage.waitForTimeout(2500);

    expect(await viewerPage.title()).toContain('Test Gezisi');
    await expect(viewerPage.locator('#map canvas')).toBeVisible();
    await expect(viewerPage.locator('.viewer-title-banner')).toHaveText('Test Gezisi');
    await expect(viewerPage.locator('.map-marker')).toHaveCount(2);
    await expect(viewerPage.locator('.map-marker-badge', { hasText: '3' })).toHaveCount(1);

    const singleMarker = viewerPage
      .locator('.map-marker')
      .filter({ hasNot: viewerPage.locator('.map-marker-badge') });
    await singleMarker.click();
    await expect(viewerPage.locator('.photo-grid-overlay')).toBeVisible();
    await expect(viewerPage.locator('.photo-grid-thumb')).toHaveCount(1);

    await viewerPage.locator('.photo-grid-thumb').click();
    await expect(viewerPage.locator('.photo-viewer-overlay')).toBeVisible();

    expect(errors).toEqual([]);
    await viewerPage.close();
  });

  test('"Listeden seç" ile yalnızca işaretli pinler dışa aktarılır', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedPins(page, [
      [39.0, 35.0, 1],
      [40.0, 36.0, 1],
      [41.0, 37.0, 1],
    ]);

    await page.locator('#btn-menu').click();
    await page.locator('.menu-item', { hasText: 'Paylaşılabilir harita' }).click();
    await page.locator('input[name="export-scope"][value="selected"]').check();
    await expect(page.locator('.export-pin-item')).toHaveCount(3);
    await page.locator('.export-pin-item input[type=checkbox]').nth(2).uncheck();
    await page.waitForTimeout(1200);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-submit').click(),
    ]);
    const savePath = testInfo.outputPath('exported-selected.html');
    await download.saveAs(savePath);

    const viewerPage = await page.context().newPage();
    await viewerPage.goto(pathToFileURL(savePath).href, { waitUntil: 'load' });
    await viewerPage.waitForTimeout(2000);
    await expect(viewerPage.locator('.map-marker')).toHaveCount(2);
    await viewerPage.close();
  });
});
