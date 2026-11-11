import { test, expect } from './fixtures.js';

test.describe('PWA: manifest, ikonlar, service worker', () => {
  test('manifest.webmanifest bağlı ve geçerli', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('manifest.webmanifest');

    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
  });

  test('apple-touch-icon ve ikon dosyaları erişilebilir', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

    for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
      const res = await request.get(path);
      expect(res.ok(), `${path} erişilebilir olmalı`).toBeTruthy();
    }
  });

  test('service worker kaydolur ve aktif olur', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated', null, {
      timeout: 5000,
    });
  });

  test('uygulama çevrimdışı modda (harita hariç) açılır', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForSelector('#map canvas');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1000); // cache.addAll'ın tamamlanması için

    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });

    await expect(page.locator('#btn-menu')).toBeVisible();
    await expect(page.locator('#btn-add')).toBeVisible();
    await expect(page.locator('#map')).toBeVisible();

    await context.setOffline(false);
  });
});
