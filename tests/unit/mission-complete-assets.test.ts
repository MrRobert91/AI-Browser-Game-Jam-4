import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface FinalAudioAsset {
  readonly locale: 'en' | 'es';
  readonly path: string;
  readonly model: string;
  readonly voice: string;
  readonly durationSeconds: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly loudnessLufs: number;
  readonly truePeakDbtp: number;
}

describe('mission-complete production assets', () => {
  it('ships a silent 32-second 1080p VP9 master and four real WebP fallbacks', async () => {
    const videoPath = resolve(
      'public/assets/mission-complete/agency-mission-complete.webm',
    );
    const bytes = await readFile(videoPath);
    const manifest = JSON.parse(
      await readFile(
        resolve(
          'public/assets/mission-complete/video-production-manifest.json',
        ),
        'utf8',
      ),
    ) as {
      model: string;
      codec: string;
      finalResolution: string;
      frameRate: number;
      audioTracks: number;
      durationSeconds: number;
      bytes: number;
      sha256: string;
      projectCumulativeCostUsd: number;
      chapters: readonly unknown[];
      fallbacks: readonly { path: string; bytes: number; sha256: string }[];
    };
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    expect(manifest).toMatchObject({
      model: 'google/veo-3.1-lite',
      codec: 'vp9',
      finalResolution: '1920x1080',
      frameRate: 30,
      audioTracks: 0,
      durationSeconds: 32,
    });
    expect(manifest.chapters).toHaveLength(4);
    expect(manifest.fallbacks).toHaveLength(4);
    expect(manifest.bytes).toBe(bytes.byteLength);
    expect(manifest.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    const probe = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          videoPath,
        ],
        { encoding: 'utf8' },
      ),
    ) as {
      streams: readonly {
        codec_name: string;
        codec_type: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }[];
      format: { duration: string };
    };
    expect(probe.streams).toEqual([
      expect.objectContaining({
        codec_name: 'vp9',
        codec_type: 'video',
        width: 1920,
        height: 1080,
        r_frame_rate: '30/1',
      }),
    ]);
    expect(Number(probe.format.duration)).toBeCloseTo(32, 2);
    for (const fallback of manifest.fallbacks) {
      const path = resolve(
        'public',
        fallback.path.replace(/^\/assets\//u, 'assets/'),
      );
      const fallbackBytes = await readFile(path);
      expect(fallbackBytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(fallbackBytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(fallback.bytes).toBe(fallbackBytes.byteLength);
      expect(fallback.sha256).toBe(
        createHash('sha256').update(fallbackBytes).digest('hex'),
      );
    }
  });

  it('ships localized mono MP3 tracks with exact chapters and measured loudness', async () => {
    const manifest = JSON.parse(
      await readFile(
        resolve('public/assets/mission-complete/manifest.json'),
        'utf8',
      ),
    ) as {
      durationSeconds: number;
      skipAfterSeconds: number;
      chapters: Readonly<Record<'en' | 'es', readonly unknown[]>>;
      finalAssets: readonly FinalAudioAsset[];
      projectCumulativeCostUsd: number;
    };
    expect(manifest.durationSeconds).toBe(32);
    expect(manifest.skipAfterSeconds).toBe(3);
    expect(manifest.chapters.en).toHaveLength(4);
    expect(manifest.chapters.es).toHaveLength(4);
    expect(manifest.finalAssets).toHaveLength(2);
    expect(manifest.projectCumulativeCostUsd).toBeLessThan(5);
    for (const asset of manifest.finalAssets) {
      const path = resolve('public', asset.path.replace(/^\//u, ''));
      const bytes = await readFile(path);
      expect(asset.bytes).toBe(bytes.byteLength);
      expect(asset.sha256).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
      expect(asset.durationSeconds).toBeCloseTo(32, 2);
      expect(Math.abs(asset.loudnessLufs - -16)).toBeLessThanOrEqual(0.4);
      expect(asset.truePeakDbtp).toBeLessThanOrEqual(-1.5);
      if (asset.locale === 'en') {
        expect(asset).toMatchObject({
          model: 'microsoft/mai-voice-2',
          voice: 'en-US-Harper:MAI-Voice-2',
        });
      } else {
        expect(asset).toMatchObject({
          model: 'google/gemini-3.1-flash-tts-preview',
          voice: 'Kore',
        });
      }
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
          channels?: number;
        }[];
        format: { duration: string };
      };
      expect(probe.streams).toEqual([
        expect.objectContaining({
          codec_name: 'mp3',
          codec_type: 'audio',
          channels: 1,
        }),
      ]);
      // FFprobe builds disagree by one MP3 padding frame (Linux reports
      // 32.026122 s while Windows reports 32.000000 s for the same bytes).
      expect(Math.abs(Number(probe.format.duration) - 32)).toBeLessThanOrEqual(
        0.05,
      );
    }
  });

  it('keeps all final audio and video under 18 MB with no production sources', async () => {
    const roots = [
      resolve('public/assets/audio'),
      resolve('public/assets/video'),
      resolve('public/assets/mission-complete'),
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
    expect(totalBytes).toBeLessThanOrEqual(18_000_000);
    await expect(
      access(resolve('public/assets/mission-complete/source')),
    ).rejects.toThrow();
    await expect(
      access(resolve('public/assets/mission-complete/audio-source-en')),
    ).rejects.toThrow();
    await expect(
      access(resolve('public/assets/mission-complete/audio-source-es')),
    ).rejects.toThrow();
  });
});
