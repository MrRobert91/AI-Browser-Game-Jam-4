import { describe, expect, it, vi } from 'vitest';

import type { CollapseEvent } from '../../src/contracts/messages';
import {
  COLLIDER_ENABLE_PROGRESS,
  CollapseDirector,
  MAX_COLLAPSE_DURATION_MS,
  MAX_COLLAPSE_COMMIT_DISTANCE_METERS,
  type CollapsePhysicsAdapter,
  type CollapseVisualAdapter,
} from '../../src/world/collapse-director';
import {
  FixedCellMutationError,
  WorldState,
  cellCenterToWorld,
  cellCoordinatesToId,
} from '../../src/world/world-state';

function event(cellId: number): CollapseEvent {
  return {
    type: 'COLLAPSE',
    cellId,
    terrainTileId: 7,
    featureTileId: 2,
    entropyBefore: 1.2,
    durationMs: 600,
    worldSeed: 123,
  };
}

describe('CollapseDirector', () => {
  it('accepts commits ahead and rejects them beyond 20.01 metres', () => {
    const world = new WorldState();
    const director = new CollapseDirector(world);
    const player = [65, 1.7, 65] as const;
    const aheadId = cellCoordinatesToId({ x: 42, z: 32 });
    const beyondId = cellCoordinatesToId({ x: 43, z: 32 });

    expect(MAX_COLLAPSE_COMMIT_DISTANCE_METERS).toBe(20.01);
    expect(director.accept(event(aheadId), player, 0)).toBe(true);
    expect(director.accept(event(beyondId), player, 0)).toBe(false);
    expect(world.getCell(beyondId).phase).toBe('UNINITIALIZED');
  });

  it('enables physics after 70%, then fixes the same tile and rotation immutably', () => {
    const world = new WorldState();
    const cellId = cellCoordinatesToId({ x: 32, z: 29 });
    const visuals: CollapseVisualAdapter = {
      begin: vi.fn(),
      update: vi.fn(),
      emitBoundaryWave: vi.fn(),
      complete: vi.fn(),
    };
    const physics: CollapsePhysicsAdapter = {
      enableFixedCollider: vi.fn(),
    };
    const director = new CollapseDirector(world, visuals, physics);
    const position = cellCenterToWorld(
      cellCoordinatesToId({ x: 32, z: 32 }),
      1.7,
    );

    expect(director.accept(event(cellId), position, 100)).toBe(true);
    expect(world.getCell(cellId).phase).toBe('COLLAPSING');
    director.update(
      100 + MAX_COLLAPSE_DURATION_MS * (COLLIDER_ENABLE_PROGRESS - 0.01),
    );
    expect(physics.enableFixedCollider).not.toHaveBeenCalled();
    director.update(100 + MAX_COLLAPSE_DURATION_MS * COLLIDER_ENABLE_PROGRESS);
    expect(physics.enableFixedCollider).toHaveBeenCalledTimes(1);
    director.update(100 + MAX_COLLAPSE_DURATION_MS);

    const fixed = world.getCell(cellId);
    expect(fixed).toMatchObject({
      phase: 'FIXED',
      terrainTileId: 7,
      featureTileId: 2,
    });
    expect(visuals.emitBoundaryWave).toHaveBeenCalledWith(cellId);
    expect(() => world.setPhase(cellId, 'SUPERPOSED')).toThrow(
      FixedCellMutationError,
    );
  });

  it('fixes safe contact ground immediately with its collider', () => {
    const world = new WorldState();
    const physics: CollapsePhysicsAdapter = {
      enableFixedCollider: vi.fn(),
    };
    const director = new CollapseDirector(world, undefined, physics);
    const contactId = cellCoordinatesToId({ x: 32, z: 32 });

    expect(director.ensureSafeContactGround([contactId], 0)).toEqual([
      contactId,
    ]);
    expect(world.getCell(contactId)).toMatchObject({
      phase: 'FIXED',
      terrainTileId: 0,
      featureTileId: null,
    });
    expect(physics.enableFixedCollider).toHaveBeenCalledTimes(1);
  });
});
