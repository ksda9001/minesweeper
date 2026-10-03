import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', channel: 'chrome', locale: 'zh-CN', launchOptions: { args: ['--disable-webgpu'] }, viewport: { width: 1100, height: 900 } },
  webServer: [
    { command: 'pnpm build && pnpm preview --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 120000 },
  ],
});
