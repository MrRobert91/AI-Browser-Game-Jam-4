import { describe, expect, it, vi } from 'vitest';

import {
  capturePanoramaPng,
  MAX_LOCAL_PANORAMAS,
  retainedPanoramaIds,
} from '../../src/gameplay/panorama';

const RESULT = {
  seedLabel: 'A91F-42C0',
  profile: 'Cartógrafo',
  haiku: { lines: ['Uno', 'Dos', 'Tres'] },
} as const;

describe('local panorama', () => {
  it('captures PNG bytes with seed, profile and haiku metadata', async () => {
    const png = new Blob(['png'], { type: 'image/png' });
    const canvas = {
      width: 1280,
      height: 720,
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
});
