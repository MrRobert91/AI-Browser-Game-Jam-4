import { expect, test } from '@playwright/test';

test.beforeEach(async ({ browserName, page }) => {
  if (browserName !== 'firefox') return;
  await page.addInitScript(() => {
    let lockedElement: Element | null = null;
    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      configurable: true,
      get: () => lockedElement,
    });
    HTMLElement.prototype.requestPointerLock = function () {
      lockedElement = document.querySelector('.observation-shell');
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };
    Document.prototype.exitPointerLock = function () {
      lockedElement = null;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
  });
});

test('canonical offline journey reaches the qualitative ending', async ({
  page,
}, testInfo) => {
  test.slow();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  await page.goto('/?wp5=preview&replay=wp5&speed=8&evidence=1&start=590');
  await page.addStyleTag({
    content: `
      .intro-panel {
        padding: 1rem;
        background: #03090f !important;
        transform: translateY(-46%) translateZ(0) !important;
      }
      .intro-panel *, .slice-result * { text-shadow: none !important; }
      .slice-result { background: #03090f !important; backdrop-filter: none !important; }
    `,
  });
  const calibrate = page.locator('[data-observation-button]');
  await expect(calibrate).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('01-start.png') });

  await calibrate.click();
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-calibrated', 'true');
  await expect(shell).toHaveAttribute('data-audio-started', 'true');
  await expect(page.locator('.onboarding-prompt')).toHaveAttribute(
    'data-complete',
    'true',
  );
  await page.screenshot({ path: testInfo.outputPath('02-collapse.png') });

  await expect(
    page.locator('.progression-hud [data-pack="water"]'),
  ).toHaveAttribute('data-state', 'COLLECTED');
  await page.screenshot({ path: testInfo.outputPath('03-water.png') });
  await expect(page.locator('.wp5-gate-status')).not.toContainText(
    'SIN ENEMIGO',
  );
  await page.screenshot({ path: testInfo.outputPath('04-enemy.png') });

  const result = page.locator('[data-slice-result]');
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(result).toContainText('Perfil:');
  await expect(result).toContainText('SEED A91F-42C0');
  if (testInfo.project.name.startsWith('firefox')) {
    await page.screenshot({ path: testInfo.outputPath('05-final.png') });
    await expect(result).toHaveScreenshot('result-panel.png');
  }
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('pointer lock and pause recover after user gestures', async ({ page }) => {
  await page.goto('/?wp5=preview&replay=wp5&speed=8');
  await page.locator('[data-observation-button]').click();
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-calibrated', 'true');
  await page.keyboard.press('Escape');
  await expect(shell).toHaveAttribute('data-paused', 'true');
  const pauseMenu = page.locator('.pause-menu');
  await expect(pauseMenu).toBeVisible();
  await pauseMenu.locator('[data-resume]').click();
  await expect(shell).toHaveAttribute('data-paused', 'false');
});

test('the Agency introduction can play or be skipped into one-gesture calibration', async ({
  page,
}) => {
  await page.goto('/?wp5=preview&replay=wp5&speed=8');
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-intro-step', 'chamber');
  await expect(page.locator('[data-intro-copy]')).toContainText(
    'Condensado de Posibilidad',
  );
  await page.locator('[data-intro-skip]').click();
  await expect(shell).toHaveAttribute('data-intro-skipped', 'true');
  await expect(shell).toHaveAttribute('data-calibrated', 'true');
  await expect(page.locator('[data-intro-copy]')).toContainText(
    'Mira. Lo que permanezca',
  );
});

test('a rejected first calibration stays visible and can be retried', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const nativeRequestPointerLock = HTMLElement.prototype.requestPointerLock;
    let attempts = 0;
    HTMLElement.prototype.requestPointerLock = function (...options) {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new DOMException('Synthetic rejection'));
      }
      return nativeRequestPointerLock.apply(this, options);
    };
  });
  await page.goto('/?wp5=preview&replay=wp5&speed=8');
  const shell = page.locator('.observation-shell');
  const calibrate = page.locator('[data-observation-button]');

  await calibrate.click();
  await expect(shell).toHaveAttribute('data-calibration', 'error');
  await expect(shell).toHaveAttribute('data-calibrated', 'false');
  await expect(calibrate).toBeVisible();
  await expect(calibrate).toBeEnabled();
  await expect(page.locator('[data-shell-status]')).toContainText('reintentar');
  await page.screenshot({ path: testInfo.outputPath('01-retry-visible.png') });

  await calibrate.click();
  await expect(shell).toHaveAttribute('data-calibration', 'ready');
  await expect(shell).toHaveAttribute('data-calibrated', 'true');
  await page.screenshot({ path: testInfo.outputPath('02-recovered.png') });
});
