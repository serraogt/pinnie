import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PHOTO = path.join(__dirname, 'fixtures', 'sample-no-gps.jpg');

async function seedOnePin(page, lat, lng) {
  const base64 = (await import('node:fs/promises').then((fs) => fs.readFile(SAMPLE_PHOTO))).toString(
    'base64'
  );
  await page.evaluate(
    async ({ base64, lat, lng }) => {
      const { createPinWithPhotos } = await import('/src/pins.js');
      const resp = await fetch('data:image/jpeg;base64,' + base64);
      const blob = await resp.blob();
      await createPinWithPhotos(lat, lng, [new File([blob], 'sample.jpg', { type: blob.type })]);
    },
    { base64, lat, lng }
  );
}

test.describe('Yedekle / Geri yükle', () => {
  test('hiç yedek alınmamışsa hatırlatma toast\'u gösterilir', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);
    await expect(page.locator('.toast', { hasText: 'yedek' })).toBeVisible();
  });

  test('depolama bilgisi diyaloğu açılır', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.locator('#btn-menu').click();
    await page.locator('.menu-item', { hasText: 'Depolama bilgisi' }).click();
    await expect(page.locator('.dialog-message')).toContainText('Kullanılan alan');
  });

  test('yedekle .zip indirir ve geri yükleme (birleştir) pinleri geri getirir', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedOnePin(page, 39.0, 35.0);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);

    await page.locator('#btn-menu').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.menu-item', { hasText: 'Yedekle' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^harita-yedek-\d{4}-\d{2}-\d{2}\.zip$/);
    const zipPath = testInfo.outputPath('backup-download.zip');
    await download.saveAs(zipPath);

    // Aynı zip'i tekrar yükle (birleştir) -> aynı id'ler tekrar eklenmemeli
    await page.locator('#btn-menu').click();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('.menu-item', { hasText: 'Geri yükle' }).click(),
    ]);
    await chooser.setFiles([zipPath]);
    await page.locator('.dialog-card .dialog-action', { hasText: 'birleştir' }).click();
    await page.waitForTimeout(500);

    const count = await page.evaluate(async () => {
      const { loadMapPinSummaries } = await import('/src/pins.js');
      return (await loadMapPinSummaries()).length;
    });
    expect(count).toBe(1); // tekrar eklenmedi
  });

  test('geri yükleme "değiştir" modu mevcut veriyi silip yedektekiyle değiştirir', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await seedOnePin(page, 39.0, 35.0);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);

    await page.locator('#btn-menu').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.menu-item', { hasText: 'Yedekle' }).click(),
    ]);
    const zipPath = testInfo.outputPath('backup-replace.zip');
    await download.saveAs(zipPath);

    // Yedekte olmayan ekstra bir pin ekle
    await seedOnePin(page, 10, 10);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);

    await page.locator('#btn-menu').click();
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('.menu-item', { hasText: 'Geri yükle' }).click(),
    ]);
    await chooser.setFiles([zipPath]);
    await page.locator('.dialog-card .dialog-action-destructive').click();
    await page.waitForTimeout(500);

    const pins = await page.evaluate(async () => {
      const { loadMapPinSummaries } = await import('/src/pins.js');
      return (await loadMapPinSummaries()).map((s) => [s.pin.lat, s.pin.lng]);
    });
    expect(pins).toEqual([[39, 35]]);
  });
});
