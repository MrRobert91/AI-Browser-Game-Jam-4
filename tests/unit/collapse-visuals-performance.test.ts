import { InstancedMesh, Scene } from 'three';
import { describe, expect, it } from 'vitest';

import type { CollapseEvent } from '../../src/contracts/messages';
import {
  classifySliceTile,
  MAX_FIXED_WORLD_DRAW_BATCHES,
  SliceCollapseVisuals,
  visualVariantIndex,
} from '../../src/world/collapse-visuals';
import { WorldState, cellCenterToWorld } from '../../src/world/world-state';

function event(cellId: number): CollapseEvent {
  return {
    type: 'COLLAPSE',
    cellId,
    terrainTileId: 0,
    featureTileId: null,
    terrainRotationQuarterTurns: 0,
    entropyBefore: 1,
    durationMs: 450,
    worldSeed: 1,
  };
}

describe('fixed world render batching', () => {
  it('keeps five stable visual variants outside the WFC domain', () => {
    const variants = new Set(
      Array.from({ length: 200 }, (_, cellId) =>
        visualVariantIndex(7, cellId, 2),
      ),
    );
    expect(variants).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(visualVariantIndex(7, 42, 2)).toBe(visualVariantIndex(7, 42, 2));
  });
  it('keeps five visual variants for tree, rock and ruin definitions', () => {
    for (const featureTileId of [2, 8, 9, 12, 13, 14, 15]) {
      const variants = new Set(
        Array.from({ length: 256 }, (_, cellId) =>
          classifySliceTile({ ...event(cellId), featureTileId }).visualVariant,
        ),
      );
      expect(variants).toEqual(new Set([0, 1, 2, 3, 4]));
    }
  });
  it('keeps completed terrain and features in a bounded number of draw batches', () => {
    const scene = new Scene();
    const world = new WorldState();
    const visuals = new SliceCollapseVisuals(scene, world);

    for (let cellId = 0; cellId < 256; cellId += 1) {
      world.initializeCell(cellId, cellId % 3);
      visuals.begin(event(cellId), cellCenterToWorld(cellId));
      visuals.complete(cellId);
    }

    expect(visuals.root.children.length).toBeLessThanOrEqual(
      MAX_FIXED_WORLD_DRAW_BATCHES,
    );
    expect(
      visuals.root.children.every((child) => child instanceof InstancedMesh),
    ).toBe(true);
    const terrainInstances = visuals.root.children
      .filter((child) => child.name.startsWith('fixed-terrain-'))
      .reduce((total, child) => total + (child as InstancedMesh).count, 0);
    expect(terrainInstances).toBe(256);

    visuals.dispose();
  });
});
