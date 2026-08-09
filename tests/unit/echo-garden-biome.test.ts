import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COMPILED_GRAMMAR, GRAMMAR_SOURCE } from '../../src/content/grammar';
import { CHUNK_CELLS_PER_SIDE, ChunkStore } from '../../src/wfc/chunk-store';

const TERRAIN_IDS = [
  'terrain.storm.echo-moss',
  'terrain.storm.prism-soil',
  'terrain.storm.echo-clearing',
] as const;
const FEATURE_IDS = [
  'feature.storm.bell-flower',
  'feature.storm.mirror-reed',
  'feature.storm.memory-stone',
] as const;

describe('Echo Garden post-jam biome', () => {
  it('uses OPEN_FLAT adapters, LOD proxies and stays below both 64-variant limits', async () => {
    const terrain = GRAMMAR_SOURCE.terrain.filter((tile) =>
      tile.tags.includes('echo_garden'),
    );
    const features = GRAMMAR_SOURCE.features.filter((tile) =>
      tile.tags.includes('echo_garden'),
    );
    expect(terrain.map((tile) => tile.id)).toEqual(TERRAIN_IDS);
    expect(features.map((tile) => tile.id)).toEqual(FEATURE_IDS);
    expect(
      terrain.every((tile) =>
        Object.values(tile.sockets).includes('OPEN_FLAT'),
      ),
    ).toBe(true);
    expect(COMPILED_GRAMMAR.terrain.length).toBe(43);
    expect(COMPILED_GRAMMAR.features.length).toBe(22);

    const bytes = await Promise.all(
      [...terrain, ...features].map(async (tile) =>
        stat(resolve('public', tile.mesh!.slice(1))).then(
          (entry) => entry.size,
        ),
      ),
    );
    expect(bytes.reduce((sum, size) => sum + size, 0)).toBeLessThan(10_000);
  });

  it('enters with Storm only for future chunks and never rewrites an initialized palette', () => {
    const store = new ChunkStore<{ epoch: number }>({
      createCells: ({ paletteEpoch }) =>
        Array.from({ length: CHUNK_CELLS_PER_SIDE ** 2 }, () => ({
          epoch: paletteEpoch,
        })),
    });
    const past = store.ensureChunk(0, 0);
    store.unlockPack('storm');
    const future = store.ensureChunk(1, 0);

    expect(past.paletteEpoch).toBe(0);
    expect(past.unlockedPacks.has('storm')).toBe(false);
    expect(past.cells[0]?.epoch).toBe(0);
    expect(future.paletteEpoch).toBe(1);
    expect(future.unlockedPacks.has('storm')).toBe(true);
  });
});
