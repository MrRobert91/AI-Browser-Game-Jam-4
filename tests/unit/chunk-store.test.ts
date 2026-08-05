import { describe, expect, it, vi } from 'vitest';

import type { Direction } from '../../src/contracts/tiles';

import {
  BOUNDARY_LENGTH,
  UNCONSTRAINED_TILE,
  hasBoundaryConstraint,
} from '../../src/wfc/boundary';
import {
  CHUNK_CELLS_PER_SIDE,
  ChunkStore,
  chunkIdOf,
  type ChunkInitializationContext,
  type LogicalChunk,
} from '../../src/wfc/chunk-store';

interface TestCell {
  value: number;
}

function createStore(
  contexts: ChunkInitializationContext[] = [],
  onBoundaryUpdate?: (
    chunk: LogicalChunk<TestCell>,
    direction: Direction,
    values: Uint16Array,
  ) => void,
): ChunkStore<TestCell> {
  return new ChunkStore({
    createCells: (context) => {
      contexts.push(context);
      return Array.from({ length: CHUNK_CELLS_PER_SIDE ** 2 }, () => ({
        value: context.paletteEpoch,
      }));
    },
    ...(onBoundaryUpdate === undefined
      ? {}
      : { onInitializedBoundaryUpdate: onBoundaryUpdate }),
  });
}

describe('logical chunk store', () => {
  it('activates chunks within 18 m and reuses their logical state', () => {
    const store = createStore();
    const active = store.activateChunksWithin([64, 1.7, 64]);
    expect(active).toHaveLength(4);
    expect(store.initializedCount).toBe(4);

    active[0]!.cells[0]!.value = 91;
    expect(store.activateChunksWithin([64, 1.7, 64])[0]!.cells[0]!.value).toBe(
      91,
    );
  });

  it('freezes paletteEpoch and unlocked packs when a chunk initializes', () => {
    const store = createStore();
    const original = store.ensureChunk(0, 0);
    expect(original.paletteEpoch).toBe(0);
    expect(original.unlockedPacks.size).toBe(0);

    expect(store.unlockPack('water')).toBe(1);
    expect(store.unlockPack('water')).toBe(1);
    const future = store.ensureChunk(1, 0);

    expect(original.paletteEpoch).toBe(0);
    expect(original.unlockedPacks.has('water')).toBe(false);
    expect(future.paletteEpoch).toBe(1);
    expect(future.unlockedPacks.has('water')).toBe(true);
  });

  it('keeps logical cells after releasing and reloading a visual view', () => {
    const store = createStore();
    const chunk = store.ensureChunk(0, 0);
    chunk.cells[4]!.value = 123;

    expect(store.releaseVisualsBeyond([128, 1.7, 128])).toContain(chunk.id);
    expect(chunk.visualLoaded).toBe(false);
    const reactivated = store.activateChunksWithin([0, 1.7, 0]);

    expect(reactivated).toContain(chunk);
    expect(chunk.visualLoaded).toBe(true);
    expect(chunk.cells[4]!.value).toBe(123);
  });
});

describe('chunk boundaries', () => {
  it('conditions a future neighbor from a fixed cardinal edge', () => {
    const contexts: ChunkInitializationContext[] = [];
    const store = createStore(contexts);
    const source = store.ensureChunk(1, 1);
    const east = new Uint16Array(BOUNDARY_LENGTH);
    east.fill(7);
    store.updateFixedBoundary(source.id, 'E', east);

    const neighbor = store.ensureChunk(2, 1);
    expect([...neighbor.incomingBoundary.west]).toEqual([...east]);
    expect([...contexts.at(-1)!.boundary.west]).toEqual([...east]);
  });

  it('updates an already initialized neighbor without replacing its state', () => {
    const onBoundaryUpdate = vi.fn();
    const store = createStore([], onBoundaryUpdate);
    const source = store.ensureChunk(1, 1);
    const neighbor = store.ensureChunk(1, 0);
    neighbor.cells[0]!.value = 33;
    const north = new Uint16Array(BOUNDARY_LENGTH);
    north.fill(11);

    store.updateFixedBoundary(source.id, 'N', north);

    expect([...neighbor.incomingBoundary.south]).toEqual([...north]);
    expect(neighbor.cells[0]!.value).toBe(33);
    expect(onBoundaryUpdate).toHaveBeenCalledWith(
      neighbor,
      'S',
      expect.any(Uint16Array),
    );
  });

  it('treats map limits as unconstrained instead of empty domains', () => {
    const contexts: ChunkInitializationContext[] = [];
    const store = createStore(contexts);
    const corner = store.ensureChunk(0, 0);
    const north = new Uint16Array(BOUNDARY_LENGTH);
    north.fill(2);
    store.updateFixedBoundary(corner.id, 'N', north);

    expect(store.initializedCount).toBe(1);
    expect(hasBoundaryConstraint(corner.incomingBoundary)).toBe(false);
    expect([...corner.incomingBoundary.north]).toEqual(
      Array(BOUNDARY_LENGTH).fill(UNCONSTRAINED_TILE),
    );
    expect(() => chunkIdOf(-1, 0)).toThrow(RangeError);
  });
});
