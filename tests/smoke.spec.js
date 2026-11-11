import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PHOTO = path.join(__dirname, 'fixtures', 'sample-no-gps.jpg');

test.describe('Harita Pin Lite - duman testleri', () => {
  test('sayfa açılıyor ve harita render oluyor', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#map canvas')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#btn-locate')).toBeVisible();
  });

  test('haritaya uzun basınca fotoğraf seçiliyor ve pin oluşuyor', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000); // stil/karo yüklemesi için kısa bekleme

    const mapBox = await page.locator('#map').boundingBox();
    const x = mapBox.x + mapBox.width / 2;
    const y = mapBox.y + mapBox.height / 2;

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(650); // 500ms uzun basma eşiğini aşmak için
    await page.mouse.up();

    const chooser = await fileChooserPromise;
    await chooser.setFiles([SAMPLE_PHOTO]);

    await expect(page.locator('.map-marker')).toHaveCount(1, { timeout: 10000 });
  });

  test('kısa bir dokunuş pin oluşturmuyor', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(1000);

    const mapBox = await page.locator('#map').boundingBox();
    const x = mapBox.x + mapBox.width / 2;
    const y = mapBox.y + mapBox.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(150); // 500ms eşiğinin çok altında
    await page.mouse.up();
    await page.waitForTimeout(800);

    await expect(page.locator('.map-marker')).toHaveCount(0);
  });
});
