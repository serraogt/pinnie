import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    channel: 'chrome',
  },
  webServer: {
    command: 'npx serve . -p 4173 -n',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 20000,
  },
});
