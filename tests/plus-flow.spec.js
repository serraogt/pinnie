import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FX = (name) => path.join(__dirname, 'fixtures', name);

test.describe('"+" akışı: EXIF GPS ile otomatik konumlama', () => {
  test('yakın GPS\'li fotoğraflar tek pinde birleşir, uzak olan ayrı pin olur', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#btn-add').click(),
    ]);
    await chooser.setFiles([FX('sample-gps-a.jpg'), FX('sample-gps-b.jpg'), FX('sample-gps-c.jpg')]);
    await page.waitForTimeout(2000);

    const summaries = await page.evaluate(async () => {
      const { loadMapPinSummaries } = await import('/src/pins.js');
      const s = await loadMapPinSummaries();
      return s.map((x) => x.count).sort();
    });
    expect(summaries).toEqual([1, 2]);
  });

  test('GPS\'siz fotoğraf için nişangah açılır, onaylayınca o konuma pin eklenir', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#btn-add').click(),
    ]);
    await chooser.setFiles([FX('sample-no-gps.jpg')]);

    await expect(page.locator('.crosshair-overlay')).toBeVisible();
    await page.locator('.crosshair-confirm').click();

    await expect(page.locator('.map-marker')).toHaveCount(1);
  });

  test('nişangah vazgeçilirse GPS\'siz fotoğraf eklenmez', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(500);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#btn-add').click(),
    ]);
    await chooser.setFiles([FX('sample-gps-a.jpg'), FX('sample-no-gps.jpg')]);
    await page.waitForTimeout(1500);

    await expect(page.locator('.crosshair-overlay')).toBeVisible();
    await page.locator('.crosshair-cancel').click();
    await page.waitForTimeout(500);

    const count = await page.evaluate(async () => {
      const { loadMapPinSummaries } = await import('/src/pins.js');
      return (await loadMapPinSummaries()).length;
    });
    expect(count).toBe(1); // yalnızca GPS'li fotoğrafın pini
  });
});
