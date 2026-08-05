import { describe, expect, it, vi } from 'vitest';

import type { CollapseEvent } from '../../src/contracts/messages';
import {
  COLLIDER_ENABLE_PROGRESS,
  CollapseDirector,
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
  it('never accepts a FIXED commit beyond 10.01 metres', () => {
    const world = new WorldState();
    const cellId = cellCoordinatesToId({ x: 40, z: 40 });
    const director = new CollapseDirector(world);

    expect(director.accept(event(cellId), [65, 1.7, 65], 0)).toBe(false);
    expect(world.getCell(cellId).phase).toBe('UNINITIALIZED');
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
    director.update(100 + 600 * (COLLIDER_ENABLE_PROGRESS - 0.01));
    expect(physics.enableFixedCollider).not.toHaveBeenCalled();
    director.update(100 + 600 * COLLIDER_ENABLE_PROGRESS);
    expect(physics.enableFixedCollider).toHaveBeenCalledTimes(1);
    director.update(700);

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
