import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const HOST = '127.0.0.1';
const PORT = 4174;
const ORIGIN = `http://${HOST}:${PORT}`;

interface BrowserProfile {
  readonly sampleSeconds: number;
  readonly frames: number;
  readonly averageFps: number;
  readonly p50FrameMs: number;
  readonly p95FrameMs: number;
  readonly p99FrameMs: number;
  readonly framesOver33Ms: number;
  readonly resolvedPreset: string | null;
  readonly resolutionScale: number | null;
  readonly drawCalls: number | null;
  readonly triangles: number | null;
  readonly bloomEnabled: boolean | null;
  readonly ssaoEnabled: boolean | null;
  readonly drawingBuffer: string | null;
  readonly gpuRenderer: string | null;
}

const CPU_THROTTLING_RATE = Number(process.env.PROFILE_CPU_RATE ?? '2');
const WARMUP_MS = Number(process.env.PROFILE_WARMUP_MS ?? '4000');
const SAMPLE_MS = Number(process.env.PROFILE_SAMPLE_MS ?? '5000');
const REPLAY_SPEED = Number(process.env.PROFILE_REPLAY_SPEED ?? '1');
const CALIBRATE = process.env.PROFILE_CALIBRATE !== '0';
const QUALITY = process.env.PROFILE_QUALITY ?? 'auto';
const HARDWARE_CORES = Number(process.env.PROFILE_CORES ?? '8');
const HARDWARE_MEMORY_GB = Number(process.env.PROFILE_MEMORY_GB ?? '8');
const ARTIFACT_DIR = process.env.PROFILE_ARTIFACT_DIR;

async function waitForPreview(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Preview did not become ready at ${ORIGIN}.`);
}

async function measureFrames(): Promise<BrowserProfile> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      ...(ARTIFACT_DIR
        ? {
            recordVideo: {
              dir: ARTIFACT_DIR,
              size: { width: 1440, height: 900 },
            },
          }
        : {}),
    });
    const page = await context.newPage();
    await page.addInitScript(
      `localStorage.setItem('ultima-observacion.settings.v1', ${JSON.stringify(
        JSON.stringify({ quality: QUALITY }),
      )});`,
    );
    await page.addInitScript(
      ({ cores, memoryGb }) => {
        let lockedElement: Element | null = null;
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          configurable: true,
          get: () => cores,
        });
        Object.defineProperty(navigator, 'deviceMemory', {
          configurable: true,
          get: () => memoryGb,
        });
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
      },
      { cores: HARDWARE_CORES, memoryGb: HARDWARE_MEMORY_GB },
    );
    if (CPU_THROTTLING_RATE > 1) {
      const session = await context.newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate', {
        rate: CPU_THROTTLING_RATE,
      });
    }
    await page.goto(
      `${ORIGIN}/?wp5=preview&replay=wp5&speed=${REPLAY_SPEED}&evidence=1`,
    );
    if (CALIBRATE) await page.locator('[data-observation-button]').click();
    await page.waitForTimeout(WARMUP_MS);

    const profile = (await page.evaluate(`new Promise((resolve) => {
      const samples = [];
      const durationMs = ${JSON.stringify(SAMPLE_MS)};
      const startedAt = performance.now();
      let lastFrameAt = startedAt;
      const sample = (now) => {
        samples.push(now - lastFrameAt);
        lastFrameAt = now;
        if (now - startedAt >= durationMs) {
          const sorted = [...samples].sort((left, right) => left - right);
          const percentile = (ratio) => sorted[
            Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
          ] ?? 0;
          const sampleSeconds = (lastFrameAt - startedAt) / 1000;
          const runtime = window.__ULTIMA_OBSERVATION_PERFORMANCE__?.() ?? null;
          const canvas = document.querySelector('.game-viewport__canvas');
          const gl = canvas?.getContext('webgl2') ?? null;
          const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info') ?? null;
          resolve({
            sampleSeconds,
            frames: samples.length,
            averageFps: samples.length / sampleSeconds,
            p50FrameMs: percentile(0.5),
            p95FrameMs: percentile(0.95),
            p99FrameMs: percentile(0.99),
            framesOver33Ms: samples.filter((value) => value > 33.34).length,
            resolvedPreset: runtime?.preset ?? null,
            resolutionScale: runtime?.resolutionScale ?? null,
            drawCalls: runtime?.drawCalls ?? null,
            triangles: runtime?.triangles ?? null,
            bloomEnabled: runtime?.bloomEnabled ?? null,
            ssaoEnabled: runtime?.ssaoEnabled ?? null,
            drawingBuffer: runtime
              ? runtime.drawingBufferWidth + 'x' + runtime.drawingBufferHeight
              : null,
            gpuRenderer: gl && debugInfo
              ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
              : null,
          });
        } else {
          window.requestAnimationFrame(sample);
        }
      };
      window.requestAnimationFrame(sample);
    })`)) as BrowserProfile;
    if (ARTIFACT_DIR) {
      await page.screenshot({
        path: join(ARTIFACT_DIR, 'optimized-gameplay.png'),
      });
      const video = page.video();
      if (video) {
        await page.close();
        const target = join(ARTIFACT_DIR, 'optimized-gameplay.webm');
        await video.saveAs(target);
        const rawVideo = await video.path();
        if (resolve(rawVideo) !== resolve(target)) {
          await rm(rawVideo);
        }
      }
    }
    return profile;
  } finally {
    await browser.close();
  }
}

const preview = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    HOST,
    '--port',
    String(PORT),
  ],
  { stdio: 'ignore' },
);

try {
  if (ARTIFACT_DIR) await mkdir(ARTIFACT_DIR, { recursive: true });
  await waitForPreview();
  const profile = await measureFrames();
  const normalized = {
    ...profile,
    averageFps: Number(profile.averageFps.toFixed(2)),
    p50FrameMs: Number(profile.p50FrameMs.toFixed(2)),
    p95FrameMs: Number(profile.p95FrameMs.toFixed(2)),
    p99FrameMs: Number(profile.p99FrameMs.toFixed(2)),
  };
  process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
  if (ARTIFACT_DIR) {
    await writeFile(
      join(ARTIFACT_DIR, 'profile.json'),
      `${JSON.stringify(normalized, null, 2)}\n`,
      'utf8',
    );
  }
} finally {
  preview.kill();
}
