import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results-desktop',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-desktop' }],
  ],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: 'chrome',
    locale: 'es-ES',
    viewport: { width: 1920, height: 1080 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chrome-stable-1080p' }],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
