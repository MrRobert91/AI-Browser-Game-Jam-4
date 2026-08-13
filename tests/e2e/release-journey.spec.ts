import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

const appOrigin = `http://127.0.0.1:${Number(process.env.PLAYWRIGHT_PORT ?? 4173)}`;

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

async function enterRoom(
  page: Page,
  locale: 'en' | 'es' = 'en',
): Promise<void> {
  await expect(page.locator('.language-select')).toBeVisible();
  await expect(page.locator('[data-locale="en"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  if (locale === 'es') await page.locator('[data-locale="es"]').click();
  await page.locator('[data-enter-language]').click();
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-game-phase', 'ROOM');
  await expect(shell).toHaveAttribute('data-calibrated', 'true');
  await expect(shell).toHaveAttribute('data-audio-started', 'true');
}

async function pressRoomButton(page: Page): Promise<void> {
  const interaction = page.locator('[data-room-interaction]');
  await page.keyboard.down('KeyW');
  let pressedWhileFocused = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.waitForTimeout(100);
    if (await interaction.isVisible()) {
      await page.keyboard.press('KeyE');
      pressedWhileFocused = true;
      break;
    }
  }
  await page.keyboard.up('KeyW');
  expect(pressedWhileFocused).toBe(true);
  await expect(page.locator('.observation-shell')).toHaveAttribute(
    'data-game-phase',
    'BRIEFING',
  );
  await expect(page.locator('.briefing-captions')).toBeVisible();
}

async function skipBriefingAndCrossPortal(
  page: Page,
  expectedObjectiveText?: string,
): Promise<void> {
  const skip = page.locator('[data-briefing-skip]');
  await expect(skip).toBeEnabled({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await expect(skip).toBeVisible();
  await expect(skip).toBeEnabled();
  await skip.click({ force: true });
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-game-phase', 'OBJECTIVES');
  await expect(page.locator('[data-objectives-transmission]')).toBeVisible();
  if (expectedObjectiveText) {
    await expect(page.locator('[data-objectives-subtitle]')).toContainText(
      expectedObjectiveText,
    );
  }
  await expect(page.locator('[data-objectives-name]')).toHaveText(
    'Dr Alice Boole',
  );
  await expect(shell).toHaveAttribute('data-alice-screen', 'visible');
  await expect(shell).toHaveAttribute('data-briefing-button', 'disabled');
  await expect(page.locator('[data-objectives-replay]')).toHaveCount(0);
  const objectivesSkip = page.locator('[data-objectives-skip]');
  await expect(objectivesSkip).toBeEnabled({ timeout: 10_000 });
  await objectivesSkip.press('Enter');
  await expect(page.locator('.observation-shell')).toHaveAttribute(
    'data-game-phase',
    'PORTAL',
  );
  await expect(shell).toHaveAttribute('data-portal', 'white-sphere');
  await page.keyboard.down('KeyW');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await shell.getAttribute('data-game-phase')) === 'RUN') break;
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('KeyW');
  await expect
    .poll(() => shell.getAttribute('data-game-phase'))
    .toMatch(/^(?:RUN|ENDING)$/u);
}

test('canonical offline English journey reaches the qualitative ending', async ({
  page,
}, testInfo) => {
  test.slow();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  const loadedNarrativeVoices: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== appOrigin) externalRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (response.ok() && response.url().includes('/assets/audio/voice/en/')) {
      loadedNarrativeVoices.push(response.url());
    }
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    const isBenignLocalMediaAbort =
      request.url().startsWith(`${appOrigin}/assets/`) &&
      (failure.includes('ERR_ABORTED') ||
        failure.includes('NS_BINDING_ABORTED') ||
        failure.includes('NS_ERROR_PARSED_DATA_CACHED'));
    if (!isBenignLocalMediaAbort) {
      failedRequests.push(`${request.url()} :: ${failure}`);
    }
  });

  await page.goto('/?wp5=preview&replay=wp5&speed=8&evidence=1&start=590');
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('01-language.png') });
  await enterRoom(page, 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath('02-room.png') });
  await pressRoomButton(page);
  await expect(page.locator('.briefing-captions')).toContainText(
    'Possibility Condensate',
  );
  await expect(page.locator('.observation-shell')).toHaveAttribute(
    'data-briefing-audio',
    'playing',
  );
  const briefingVoice = page.locator('audio.briefing-voice');
  await expect
    .poll(() =>
      briefingVoice.evaluate(
        (element) => (element as HTMLAudioElement).currentTime,
      ),
    )
    .toBeGreaterThan(0.05);
  expect(
    await briefingVoice.evaluate((element) => ({
      paused: (element as HTMLAudioElement).paused,
      volume: (element as HTMLAudioElement).volume,
    })),
  ).toEqual({ paused: false, volume: 0.585 });
  await expect(page.locator('.observation-shell')).not.toHaveAttribute(
    'data-audio-state',
    'error',
  );
  await page.screenshot({ path: testInfo.outputPath('03-briefing.png') });
  const briefingSkip = page.locator('[data-briefing-skip]');
  await expect(briefingSkip).toBeEnabled({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await briefingSkip.click({ force: true });
  await expect(page.locator('[data-objectives-subtitle]')).toContainText(
    'collapse as much of the Condensate as possible',
  );
  await page.screenshot({ path: testInfo.outputPath('04-objectives.png') });
  const objectivesSkip = page.locator('[data-objectives-skip]');
  await expect(objectivesSkip).toBeEnabled({ timeout: 10_000 });
  await objectivesSkip.press('Enter');
  await page.screenshot({
    path: testInfo.outputPath('04b-white-sphere-portal.png'),
  });
  await page.keyboard.down('KeyW');
  const portalShell = page.locator('.observation-shell');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await portalShell.getAttribute('data-game-phase')) === 'RUN') break;
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('KeyW');
  const shell = page.locator('.observation-shell');
  await expect(page.locator('.possibility-probabilities')).toHaveCount(0);
  await expect(page.locator('[data-slice-message]')).toHaveCount(0);
  await expect(page.locator('.slice-hud > p')).toHaveCount(2);
  const subtitle = page.locator('.narrative-subtitle');
  await expect(subtitle).toBeVisible();
  const subtitleBox = await subtitle.boundingBox();
  expect(subtitleBox).not.toBeNull();
  expect(subtitleBox!.y).toBeGreaterThan(page.viewportSize()!.height / 2);
  await expect(page.locator('.onboarding-prompt')).toHaveAttribute(
    'data-complete',
    'true',
  );
  await page.screenshot({ path: testInfo.outputPath('05-collapse.png') });
  await expect(
    page.locator('.progression-hud [data-pack="water"]'),
  ).toHaveAttribute('data-state', 'COLLECTED');

  const result = page.locator('[data-slice-result]');
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(shell).toHaveAttribute('data-ending-fog', 'off');
  expect(
    Number(await shell.getAttribute('data-ending-camera-height')),
  ).toBeGreaterThan(35);
  await expect(result).toHaveAttribute('role', 'dialog');
  await expect(result).toBeFocused();
  await expect(result).toContainText('AGENT UPDATE RECORD');
  await expect(result).toContainText('Profile:');
  await expect(result).toContainText('SEED A91F-42C0');
  await expect(result).toContainText(
    'without recognition of cosmological causality',
  );
  await expect(page.locator('[data-remote-haiku-request]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('06-final.png') });
  const panorama = page.locator('[data-panorama-download]');
  await expect(panorama).toBeEnabled();
  await expect(panorama).toHaveAttribute('data-gallery-saved', 'true');
  await expect(page.locator('[data-panorama-preview]')).toBeVisible();
  await expect(page.locator('[data-panorama-preview]')).toHaveAttribute(
    'src',
    /blob:/,
  );
  if (process.env.PLAYWRIGHT_EVIDENCE === '1') {
    const evidenceDirectory = resolve(
      'docs/progress/issue-115-gameplay-polish',
    );
    await mkdir(evidenceDirectory, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDirectory, 'final-results-with-panorama.png'),
      fullPage: true,
    });
  }
  const downloadEvent = page.waitForEvent('download');
  await panorama.click();
  const download = await downloadEvent;
  const panoramaPath = testInfo.outputPath('panorama.png');
  await download.saveAs(panoramaPath);
  const panoramaBytes = await readFile(panoramaPath);
  expect(panoramaBytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(panoramaBytes.readUInt32BE(16)).toBe(1600);
  expect(panoramaBytes.readUInt32BE(20)).toBe(900);
  await page.locator('[data-panorama-gallery]').click();
  await expect(page.locator('.slice-result__gallery')).toContainText(
    'A91F-42C0',
  );
  expect(consoleErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(loadedNarrativeVoices.length).toBeGreaterThan(0);
  await expect(shell).toHaveAttribute('data-game-phase', 'ENDING');
});

for (const locale of ['en', 'es'] as const) {
  test(`qualified ${locale.toUpperCase()} replay reaches mission video after ascent`, async ({
    page,
  }, testInfo) => {
    test.slow();
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== appOrigin) externalRequests.push(request.url());
    });
    await page.goto(
      '/?wp5=preview&replay=mission-complete&speed=1&evidence=1&start=599',
    );
    await enterRoom(page, locale);
    await pressRoomButton(page);
    await skipBriefingAndCrossPortal(
      page,
      locale === 'en'
        ? 'collapse as much of the Condensate as possible'
        : 'colapsa la mayor superficie posible',
    );
    const shell = page.locator('.observation-shell');
    await expect(shell).toHaveAttribute(
      'data-ending-variant',
      'MISSION_COMPLETE',
      { timeout: 20_000 },
    );
    await expect(shell).toHaveAttribute('data-ending-phase', 'ASCENDING');
    await page.screenshot({
      path: testInfo.outputPath(`${locale}-mission-ascent.png`),
    });
    await expect(shell).toHaveAttribute('data-ending-phase', 'MISSION_VIDEO', {
      timeout: 15_000,
    });
    const mission = page.locator('[data-mission-complete]');
    await expect(mission).toBeVisible();
    await expect(mission).toHaveAttribute('data-media', 'video');
    await expect(mission).toHaveAttribute('data-voice', 'playing');
    await expect
      .poll(() =>
        page
          .locator('[data-mission-video]')
          .evaluate((element) => (element as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0);
    const chapters =
      locale === 'en'
        ? ([
            ['recorded-seeds', 'Congratulations, Collapser'],
            ['ending-uncertainty', 'Thanks to your intervention'],
            ['new-condensates', 'Should new Probability Condensates'],
            ['provisional-reality', 'Until then, you may provisionally assume'],
          ] as const)
        : ([
            ['recorded-seeds', 'Enhorabuena, Colapsador'],
            ['ending-uncertainty', 'Gracias a su intervención'],
            ['new-condensates', 'Si aparecen nuevos Condensados'],
            [
              'provisional-reality',
              'Hasta entonces, puede asumir provisionalmente',
            ],
          ] as const);
    const skip = page.locator('[data-mission-skip]');
    for (const [index, [chapterId, caption]] of chapters.entries()) {
      await expect(mission).toHaveAttribute('data-chapter', chapterId, {
        timeout: index === 0 ? 5_000 : 12_000,
      });
      await expect(page.locator('[data-mission-caption]')).toContainText(
        caption,
      );
      await page.screenshot({
        path: testInfo.outputPath(
          `${locale}-mission-${index + 1}-${chapterId}.png`,
        ),
      });
    }
    await expect(skip).toBeEnabled();
    expect(
      Number(await shell.getAttribute('data-ending-phase-elapsed')),
    ).toBeGreaterThanOrEqual(24);
    const result = page.locator('[data-slice-result]');
    await expect(result).toBeVisible({ timeout: 12_000 });
    await expect(result).toContainText(
      locale === 'en' ? 'MISSION COMPLETE' : 'MISIÓN COMPLETADA',
    );
    await expect(result).toContainText('1536');
    await page.screenshot({
      path: testInfo.outputPath(`${locale}-mission-results.png`),
    });
    await expect(page.locator('[data-mission-complete]')).toBeHidden();
    expect(externalRequests).toEqual([]);
  });
}

test('mission video and voice failures keep captions and reach results once', async ({
  page,
}, testInfo) => {
  test.slow();
  await page.route(
    '**/assets/mission-complete/agency-mission-complete.webm',
    (route) => route.abort(),
  );
  await page.route(
    '**/assets/mission-complete/agency-mission-complete.en.mp3',
    (route) => route.abort(),
  );
  await page.goto(
    '/?wp5=preview&replay=mission-complete&speed=8&evidence=1&start=599',
  );
  await enterRoom(page, 'en');
  await pressRoomButton(page);
  await skipBriefingAndCrossPortal(
    page,
    'collapse as much of the Condensate as possible',
  );
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-ending-phase', 'MISSION_VIDEO', {
    timeout: 20_000,
  });
  const mission = page.locator('[data-mission-complete]');
  await expect(mission).toHaveAttribute('data-media', 'fallback');
  await expect(mission).toHaveAttribute('data-voice', 'fallback');
  await expect(page.locator('[data-mission-fallback]')).toBeVisible();
  await expect(page.locator('[data-mission-caption]')).not.toBeEmpty();
  await page.screenshot({
    path: testInfo.outputPath('mission-fallback.png'),
  });
  const skip = page.locator('[data-mission-skip]');
  await expect(skip).toBeEnabled({ timeout: 5_000 });
  await skip.click();
  await expect(page.locator('[data-slice-result]')).toHaveCount(1);
  await expect(page.locator('[data-slice-result]')).toBeVisible();
});

test('Spanish fallback briefing keeps captions and reaches RUN', async ({
  page,
}) => {
  await page.route('**/assets/video/agency-briefing.webm', (route) =>
    route.abort(),
  );
  await page.goto('/?wp5=off&evidence=1');
  await enterRoom(page, 'es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await pressRoomButton(page);
  await expect(page.locator('.briefing-captions')).toContainText(
    'Condensado de Posibilidad',
  );
  await expect(page.locator('.observation-shell')).toHaveAttribute(
    'data-briefing-media',
    'fallback',
  );
  await skipBriefingAndCrossPortal(page, 'colapsa la mayor superficie posible');
  await expect(page.locator('[data-seed-mode-label]')).toHaveText('SEED');
});

test('three consciousness bombs fracture the world and end the run', async ({
  page,
}, testInfo) => {
  test.slow();
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ultima-observacion.settings.v2',
      JSON.stringify({ reducedFlashes: false }),
    );
  });
  await page.goto('/?wp5=preview&replay=wfc2-lives&speed=1&evidence=1');
  await enterRoom(page, 'en');
  await pressRoomButton(page);
  await skipBriefingAndCrossPortal(
    page,
    'collapse as much of the Condensate as possible',
  );
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-respawn-phase', 'DETONATING', {
    timeout: 15_000,
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath('bomb-detonating.png') });
  await expect(shell).toHaveAttribute('data-end-reason', 'LIVES_EXHAUSTED', {
    timeout: 35_000,
  });
  await expect(page.locator('[data-lives]')).toHaveText('○ ○ ○');
  await expect
    .poll(async () => Number(await shell.getAttribute('data-fractured-cells')))
    .toBeGreaterThan(0);
  await expect(page.locator('[data-objectives-transmission]')).toBeVisible();
  await expect(page.locator('[data-objectives-subtitle]')).toContainText(
    'Third life exhausted. You are dead.',
  );
  await page.screenshot({ path: testInfo.outputPath('wfc2-lives-final.png') });
  await expect(page.locator('[data-slice-result]')).toBeVisible({
    timeout: 20_000,
  });
});

test('evidence showcase renders five deterministic tree, rock and ruin silhouettes', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-16x10');
  await page.goto(
    '/?wp5=preview&replay=wp5&speed=1&evidence=1&showcase=variants',
  );
  await enterRoom(page, 'en');
  await pressRoomButton(page);
  await skipBriefingAndCrossPortal(page);
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-visual-showcase', 'ready');
  await page.waitForTimeout(750);
  await page.screenshot({ path: testInfo.outputPath('visual-variants.png') });
});

test('pointer lock and pause recover after language selection', async ({
  page,
}) => {
  await page.goto('/?wp5=preview&replay=wp5&speed=8');
  await enterRoom(page);
  const shell = page.locator('.observation-shell');
  await page.keyboard.press('Escape');
  await expect(shell).toHaveAttribute('data-paused', 'true');
  const pauseMenu = page.locator('.pause-menu');
  await expect(pauseMenu).toBeVisible();
  await pauseMenu.locator('[data-resume]').click();
  await expect(shell).toHaveAttribute('data-paused', 'false');
});

test('daily mode is shared by UTC date and language choice stays locked in-room', async ({
  page,
}) => {
  await page.goto('/?daily=1&wp5=off&evidence=1');
  await enterRoom(page, 'es');
  const shell = page.locator('.observation-shell');
  await expect(shell).toHaveAttribute('data-seed-mode', 'daily');
  await expect(shell).toHaveAttribute(
    'data-daily-date',
    /^\d{4}-\d{2}-\d{2}$/u,
  );
  await expect(page.locator('[data-seed-mode-label]')).toHaveText('DIARIA UTC');
  const first = await page.locator('[data-seed-label]').textContent();
  await page.reload();
  await expect(page.locator('[data-locale="es"]')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.locator('[data-enter-language]').click();
  await expect(page.locator('[data-seed-label]')).toHaveText(first ?? '');
  await expect(page.locator('[data-seed-mode-link]')).toHaveText(
    'Nueva observación aleatoria',
  );
});

test('grammar gallery exposes the bounded Echo Garden extension', async ({
  page,
}, testInfo) => {
  await page.goto('/?grammar=1');
  const app = page.locator('#app');
  const viewer = page.locator('.grammar-viewer');
  await expect(app).toHaveAttribute('data-gallery-ready', 'true');
  await page.locator('[data-pack-filter]').selectOption('storm');
  const cards = page.locator('.grammar-card[data-pack="storm"]');
  await expect(cards).toHaveCount(10);
  await expect(viewer).toContainText('terrain.storm.echo-clearing');
  await expect(viewer).toContainText('feature.storm.memory-stone');
  await expect(page.locator('[data-gallery-summary]')).toContainText(
    '10 tiles',
  );
  await page.screenshot({
    path: testInfo.outputPath('echo-garden-gallery.png'),
    fullPage: true,
  });
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
  await page.locator('[data-enter-language]').click();
  const shell = page.locator('.observation-shell');
  const calibrate = page.locator('[data-observation-button]');
  await expect(shell).toHaveAttribute('data-calibration', 'error');
  await expect(shell).toHaveAttribute('data-calibrated', 'false');
  await expect(calibrate).toBeVisible();
  await expect(calibrate).toBeEnabled();
  await expect(page.locator('[data-shell-status]')).toContainText('retry');
  await page.screenshot({ path: testInfo.outputPath('01-retry-visible.png') });
  await calibrate.click();
  await expect(shell).toHaveAttribute('data-calibration', 'ready');
  await expect(shell).toHaveAttribute('data-calibrated', 'true');
  await page.screenshot({ path: testInfo.outputPath('02-recovered.png') });
});
