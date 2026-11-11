import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PHOTO = path.join(__dirname, 'fixtures', 'sample-no-gps.jpg');

test.describe('KMZ olarak dışa aktarma', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined });
    });
  });

  test('geçerli bir .kmz indirir: doc.kml + files/ fotoğrafları', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');

    const base64 = (await readFile(SAMPLE_PHOTO)).toString('base64');
    await page.evaluate(async (base64) => {
      const { createPinWithPhotos, updatePinMeta } = await import('/src/pins.js');
      const resp = await fetch('data:image/jpeg;base64,' + base64);
      const blob = await resp.blob();
      const mk = () => new File([blob], 'sample.jpg', { type: blob.type });
      const pin = await createPinWithPhotos(39.0, 35.0, [mk(), mk()]);
      await updatePinMeta(pin.id, { title: 'Deniz Kenarı', note: 'Not <test>' });
    }, base64);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#map canvas');
    await page.waitForTimeout(800);

    await page.locator('#btn-menu').click();
    await page.locator('.menu-item', { hasText: 'KMZ olarak dışa aktar' }).click();
    await page.locator('.export-title-input').fill('Gezi KMZ');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-submit').click(),
    ]);
    expect(download.suggestedFilename()).toBe('gezi-kmz.kmz');
    const savePath = testInfo.outputPath('export.kmz');
    await download.saveAs(savePath);

    const { unzipSync, strFromU8 } = await import('../vendor/fflate/fflate.esm.js');
    const buf = await readFile(savePath);
    const entries = unzipSync(new Uint8Array(buf));
    expect(Object.keys(entries)).toContain('doc.kml');

    const kml = strFromU8(entries['doc.kml']);
    expect(kml).toContain('<name>Gezi KMZ</name>');
    expect(kml).toContain('<name>Deniz Kenarı</name>');
    expect(kml).toContain('&lt;test&gt;'); // not metni XML'i bozmayacak şekilde kaçırılmış
    expect(kml).toContain('<coordinates>35,39,0</coordinates>');
    expect((kml.match(/<img src="files\//g) || []).length).toBe(2);

    const photoFiles = Object.keys(entries).filter((name) => name.startsWith('files/') && name !== 'files/');
    expect(photoFiles).toHaveLength(2);
  });
});
