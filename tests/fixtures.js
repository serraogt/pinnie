// Bazı kurumsal/yönetilen Chrome kurulumları, Playwright'in varsayılan
// pipe tabanlı CDP bağlantısıyla yeni bir tarayıcı başlatmasını güvenlik
// politikasıyla engelleyebilir (başlatılan Chrome anında kapanır).
// Böyle bir ortamda şunu yapabilirsin:
//   1) Chrome'u elle başlat: chrome.exe --remote-debugging-port=9222
//   2) CDP_ENDPOINT=http://localhost:9222 npm test
// CDP_ENDPOINT tanımlı değilse testler normal şekilde yeni bir Chrome
// başlatır (çoğu bilgisayarda ek bir şey gerekmez).
import { test as base, expect, chromium } from 'playwright/test';

export const test = base.extend({
  browser: [
    async ({ playwright }, use) => {
      const endpoint = process.env.CDP_ENDPOINT;
      const browser = endpoint
        ? await chromium.connectOverCDP(endpoint)
        : await chromium.launch({ channel: 'chrome' });
      await use(browser);
      await browser.close();
    },
    { scope: 'worker' },
  ],
});

export { expect };
