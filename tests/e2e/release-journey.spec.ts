import { expect, test } from '@playwright/test';

test('canonical offline journey reaches the qualitative ending', async ({
  page,
}, testInfo) => {
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
