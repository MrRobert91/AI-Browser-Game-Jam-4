import { describe, expect, it, vi } from 'vitest';

import type { RunResult } from '../../src/gameplay/ending';
import {
  configuredRemoteHaikuEndpoint,
  createRemoteHaikuPayload,
  requestRemoteHaikuWithFallback,
} from '../../src/gameplay/remote-haiku';

const LOCAL = {
  lines: ['Muchos caminos.', 'Solo aquel que miraste', 'recuerda tus pasos.'],
  approximateSyllables: [8, 9, 8],
} as const;
const RESULT: RunResult = {
  endReason: 'TIME_EXPIRED',
  worldSeed: 0xa91f42c0,
  seedLabel: 'A91F-42C0',
  profile: 'Cartógrafo',
  portrait: {
    fixedCells: 147,
    uniqueTerrainTiles: 9,
    uniqueFeatureTiles: 7,
    unlockedPacks: ['water', 'forest'],
    deaths: 2,
    dangerExposureSeconds: 19,
    averageGazeDwell: 1.1,
    revisitRatio: 0.22,
    maxDistance: 43,
    waterRatio: 0.24,
    forestRatio: 0.31,
    ruinRatio: 0.08,
    unresolvedVisibleCells: 6,
  },
  haiku: LOCAL,
  closure: 'Mundo habitable',
  reading: 'Equilibró profundidad y expansión.',
};

describe('optional remote haiku', () => {
  it('accepts only configured HTTPS endpoints and creates a coarse minimal payload', () => {
    expect(configuredRemoteHaikuEndpoint(undefined)).toBeNull();
    expect(
      configuredRemoteHaikuEndpoint('http://example.test/haiku'),
    ).toBeNull();
    expect(configuredRemoteHaikuEndpoint('https://example.test/haiku')).toBe(
      'https://example.test/haiku',
    );
    const payload = createRemoteHaikuPayload(RESULT);
    expect(payload).toEqual({
      locale: 'es-ES',
      profile: 'Cartógrafo',
      fixedCellsBucket: 150,
      maxDistanceBucket: 45,
      water10: 2,
      forest10: 3,
      ruin10: 1,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /A91F|seed|death|haiku|route/iu,
    );
  });

  it('does not call fetch without explicit consent', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await requestRemoteHaikuWithFallback({
      endpoint: 'https://example.test/haiku',
      consent: false,
      result: RESULT,
      local: LOCAL,
      fetcher,
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(response).toEqual({
      haiku: LOCAL,
      source: 'local',
      error: 'consent',
    });
  });

  it('accepts a valid three-line response with credentialless transport', async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init).toMatchObject({
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      return new Response(
        JSON.stringify({
          lines: [
            'Luz en el musgo.',
            'La piedra oye lejos.',
            'Nadie la reclama.',
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const response = await requestRemoteHaikuWithFallback({
      endpoint: 'https://example.test/haiku',
      consent: true,
      result: RESULT,
      local: LOCAL,
      fetcher,
    });
    expect(response.source).toBe('remote');
    expect(response.haiku.lines).toEqual([
      'Luz en el musgo.',
      'La piedra oye lejos.',
      'Nadie la reclama.',
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('keeps the deterministic local result on errors or invalid responses', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Promise.reject(new Error('offline')),
    );
    await expect(
      requestRemoteHaikuWithFallback({
        endpoint: 'https://example.test/haiku',
        consent: true,
        result: RESULT,
        local: LOCAL,
        fetcher,
        timeoutMs: 10,
      }),
    ).resolves.toEqual({ haiku: LOCAL, source: 'local', error: 'network' });
  });

  it('aborts a slow request and keeps the local result', async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    await expect(
      requestRemoteHaikuWithFallback({
        endpoint: 'https://example.test/haiku',
        consent: true,
        result: RESULT,
        local: LOCAL,
        fetcher,
        timeoutMs: 1,
      }),
    ).resolves.toEqual({ haiku: LOCAL, source: 'local', error: 'network' });
  });
});
