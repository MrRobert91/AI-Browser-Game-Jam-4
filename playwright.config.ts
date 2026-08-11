import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  // Two concurrent WebGL games contend for the same headless GPU and distort
  // movement-time assertions; browser projects run serially for stable evidence.
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.035 } },
  use: {
    baseURL,
    locale: 'es-ES',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    video: process.env.PLAYWRIGHT_EVIDENCE === '1' ? 'on' : 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-16x10', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox-16x9',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
