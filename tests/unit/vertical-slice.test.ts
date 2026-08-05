import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_DEATH_AT_SECONDS,
  VERTICAL_SLICE_DURATION_SECONDS,
  WATER_UNLOCK_AT_SECONDS,
  VerticalSliceDirector,
} from '../../src/gameplay/vertical-slice';
import { classifySliceTile } from '../../src/world/collapse-visuals';

describe('VerticalSliceDirector', () => {
  it('starts only on first collapse, unlocks water and ends at 90 seconds', () => {
    const onWaterUnlock = vi.fn();
    const onEnding = vi.fn();
    const slice = new VerticalSliceDirector({ onWaterUnlock, onEnding });

    slice.update(10);
    expect(slice.snapshot().elapsedSeconds).toBe(0);
    slice.notifyFirstCollapse();
    slice.update(WATER_UNLOCK_AT_SECONDS);
    expect(onWaterUnlock).toHaveBeenCalledTimes(1);
    expect(slice.snapshot().waterUnlocked).toBe(true);
    slice.update(VERTICAL_SLICE_DURATION_SECONDS - WATER_UNLOCK_AT_SECONDS);
    expect(slice.snapshot().phase).toBe('ENDING');
    expect(onEnding).toHaveBeenCalledTimes(1);
  });

  it('replays one canonical death and preserves elapsed time through respawn', () => {
    const onDeath = vi.fn();
    const onRespawn = vi.fn();
    const slice = new VerticalSliceDirector(
      { onDeath, onRespawn },
      { canonicalReplay: true },
    );
    slice.notifyFirstCollapse();
    slice.update(CANONICAL_DEATH_AT_SECONDS);
    expect(slice.snapshot()).toMatchObject({ phase: 'RESPAWNING', deaths: 1 });
    slice.update(0.82);
    expect(slice.snapshot().phase).toBe('OBSERVING');
    expect(onDeath).toHaveBeenCalledTimes(1);
    expect(onRespawn).toHaveBeenCalledTimes(1);
  });

  it('offers base features and water only after a future palette epoch', () => {
    const features = new Set(
      Array.from(
        { length: 64 },
        (_, cellId) => classifySliceTile(cellId, 0).feature,
      ),
    );
    expect(features).toEqual(new Set(['empty', 'tree', 'flower', 'rock']));
    expect(
      Array.from({ length: 64 }, (_, cellId) =>
        classifySliceTile(cellId, 0),
      ).some((tile) => tile.deepWater),
    ).toBe(false);
    expect(
      Array.from({ length: 64 }, (_, cellId) =>
        classifySliceTile(cellId, 1),
      ).some((tile) => tile.deepWater),
    ).toBe(true);
  });

  it('can begin a canonical evidence replay from a bounded timeline offset', () => {
    const slice = new VerticalSliceDirector({}, { startAtSeconds: 28 });
    expect(slice.snapshot().remainingSeconds).toBe(62);
    slice.notifyFirstCollapse();
    slice.update(2);
    expect(slice.snapshot().waterUnlocked).toBe(true);
  });
});
