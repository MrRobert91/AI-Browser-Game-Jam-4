import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface VideoProductionManifest {
  readonly model: string;
  readonly codec: string;
  readonly clarityPipeline: string;
  readonly resolution: string;
  readonly audioTracks: number;
  readonly durationSeconds: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly actualCostUsd: number;
  readonly shots: readonly unknown[];
}

describe('briefing production assets', () => {
  it('ships a sharpened silent 1080p VP9 timeline and seven WebP fallbacks', async () => {
    const path = resolve('public/assets/video/agency-briefing.webm');
    const bytes = await readFile(path);
    const manifest = JSON.parse(
      await readFile(
        resolve('public/assets/video/video-production-manifest.json'),
        'utf8',
      ),
    ) as VideoProductionManifest;
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    expect(manifest).toMatchObject({
      model: 'google/veo-3.1-lite',
      codec: 'vp9',
      resolution: '1920x1080',
      audioTracks: 0,
      durationSeconds: 50,
    });
    expect(manifest.clarityPipeline).toContain('Lanczos');
    expect(manifest.clarityPipeline).toContain('unsharp');
    expect(manifest.shots).toHaveLength(7);
    expect(manifest.bytes).toBe(bytes.byteLength);
    expect(manifest.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path],
        { encoding: 'utf8' },
      ),
    ) as {
      streams: readonly {
        codec_name: string;
        codec_type: string;
        width?: number;
        height?: number;
      }[];
      format: { duration: string };
    };
    expect(probe.streams).toEqual([
      expect.objectContaining({
        codec_name: 'vp9',
        codec_type: 'video',
        width: 1920,
        height: 1080,
      }),
    ]);
    expect(Number(probe.format.duration)).toBeCloseTo(50, 2);
    for (let index = 1; index <= 7; index += 1) {
      const fallback = await readFile(
        resolve(
          `public/assets/video/briefing-fallback-${String(index).padStart(2, '0')}.webp`,
        ),
      );
      expect(fallback.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(fallback.subarray(8, 12).toString('ascii')).toBe('WEBP');
    }
  });

  it('keeps final runtime media below 15 MB and all reported generation below $5', async () => {
    const audioManifest = JSON.parse(
      await readFile(
        resolve('public/assets/audio/audio-manifest.json'),
        'utf8',
      ),
    ) as { totalCostUsd: number };
    const videoManifest = JSON.parse(
      await readFile(
        resolve('public/assets/video/video-production-manifest.json'),
        'utf8',
      ),
    ) as VideoProductionManifest;
    const roots = [
      resolve('public/assets/audio'),
      resolve('public/assets/video'),
    ];
    let totalBytes = 0;
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) await visit(path);
        else totalBytes += (await readFile(path)).byteLength;
      }
    };
    for (const root of roots) await visit(root);
    expect(totalBytes).toBeLessThanOrEqual(15_000_000);
    expect(
      audioManifest.totalCostUsd + videoManifest.actualCostUsd,
    ).toBeLessThan(5);
    await expect(
      access(resolve('public/assets/video/source')),
    ).rejects.toThrow();
    await expect(
      access(resolve('public/assets/audio/briefing/segments-en')),
    ).rejects.toThrow();
  });
});
