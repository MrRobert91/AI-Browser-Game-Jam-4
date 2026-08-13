import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  capturePanoramaPng,
  MAX_LOCAL_PANORAMAS,
  panoramaCardMetrics,
  retainedPanoramaIds,
} from '../../src/gameplay/panorama';
import {
  observedWorldBounds,
  finalWorldCameraPose,
  panoramaFrustum,
} from '../../src/render/panorama-capture';
import { cellCoordinatesToId } from '../../src/world/world-state';

const RESULT = {
  seedLabel: 'A91F-42C0',
  profile: 'Cartógrafo',
  finalFixedCells: 1536,
  livesRemaining: 1,
  collectedPacks: ['water', 'forest', 'ruin', 'storm'],
  portrait: { unlockedPacks: ['water', 'forest'], deaths: 2 },
  haiku: { lines: ['Uno', 'Dos', 'Tres'] },
} as const;

describe('local panorama', () => {
  it('captures PNG bytes with seed, profile and haiku metadata', async () => {
    const png = new Blob(['png'], { type: 'image/png' });
    const canvas = {
      width: 1280,
      height: 720,
      completionPercent: 37.5,
      collectedSeeds: 4,
      deaths: 2,
      toBlob: vi.fn((callback: BlobCallback) => callback(png)),
    } as unknown as HTMLCanvasElement;
    const record = await capturePanoramaPng(canvas, RESULT, 1234);
    expect(record).toMatchObject({
      id: 'A91F-42C0-1234',
      seedLabel: 'A91F-42C0',
      profile: 'Cartógrafo',
      haiku: ['Uno', 'Dos', 'Tres'],
      width: 1280,
      height: 720,
    });
    expect(record.png).toBe(png);
  });

  it('summarizes bounded completion, collected Seeds and deaths', () => {
    expect(panoramaCardMetrics(RESULT)).toEqual({
      completionPercent: 37.5,
      collectedSeeds: 4,
      deaths: 2,
    });
    expect(
      panoramaCardMetrics({
        finalFixedCells: 99_999,
        livesRemaining: 1,
        portrait: RESULT.portrait,
      }),
    ).toEqual({
      completionPercent: 100,
      collectedSeeds: 2,
      deaths: 2,
    });
  });

  it('packages the transparent crystalline cover wordmark locally', async () => {
    const png = await readFile('public/assets/branding/title-wordmark.png');
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1672);
    expect(png.readUInt32BE(20)).toBe(941);
    expect(png[25]).toBe(6);
  });

  it('retains only the newest bounded entries across distinct seeds', () => {
    const records = Array.from(
      { length: MAX_LOCAL_PANORAMAS + 3 },
      (_, index) => ({ id: `SEED-${index}`, createdAt: index }),
    );
    expect(retainedPanoramaIds(records)).toEqual([
      'SEED-7',
      'SEED-6',
      'SEED-5',
      'SEED-4',
      'SEED-3',
    ]);
  });

  it('fits every fixed cell into the top-down panorama with padding', () => {
    const bounds = observedWorldBounds([
      cellCoordinatesToId({ x: 3, z: 7 }),
      cellCoordinatesToId({ x: 58, z: 51 }),
    ]);
    expect(bounds).toMatchObject({
      minX: 2,
      maxX: 122,
      minZ: 10,
      maxZ: 108,
      fixedCellCount: 2,
    });
    const frustum = panoramaFrustum(bounds);
    expect(frustum.halfWidth * 2).toBeGreaterThanOrEqual(120);
    expect(frustum.halfHeight * 2).toBeGreaterThanOrEqual(98);
    const pose = finalWorldCameraPose(bounds);
    expect(pose.position[0]).toBe(bounds.centerX);
    expect(pose.position[2]).toBe(bounds.centerZ);
    expect(pose.position[1]).toBeGreaterThan(80);
    expect(pose.target).toEqual([bounds.centerX, 0, bounds.centerZ]);
  });
});
