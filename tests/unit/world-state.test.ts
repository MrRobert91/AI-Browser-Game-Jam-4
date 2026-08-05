import { Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { ChunkView } from '../../src/world/chunk-view';
import {
  FixedCellMutationError,
  WORLD_CELL_SIZE_METERS,
  WORLD_CELLS_PER_SIDE,
  WORLD_ORIGIN_CELL,
  WorldState,
  cellCenterToWorld,
  cellCoordinatesToId,
  cellIdToCoordinates,
  worldPositionToCell,
} from '../../src/world/world-state';

describe('WorldState', () => {
  it('uses a 64 x 64 logical map with 2 metre cells and origin (32, 32)', () => {
    const state = new WorldState();
    const originId = cellCoordinatesToId(WORLD_ORIGIN_CELL);

    expect(state.cellsPerSide).toBe(WORLD_CELLS_PER_SIDE);
    expect(state.cellSizeMeters).toBe(WORLD_CELL_SIZE_METERS);
    expect(originId).toBe(2_080);
    expect(cellIdToCoordinates(originId)).toEqual({ x: 32, z: 32 });
    expect(cellCenterToWorld(originId)).toEqual([65, 0, 65]);
    expect(worldPositionToCell([64.2, 1.7, 65.9])).toEqual({ x: 32, z: 32 });
  });

  it('retains fixed tile identity and rotation after a chunk view is released and rebuilt', () => {
    const state = new WorldState();
    const cellId = cellCoordinatesToId({ x: 32, z: 32 });
    state.initializeCell(cellId, 2);
    state.commitFixed({
      cellId,
      terrainTileId: 17,
      featureTileId: 6,
      terrainRotationQuarterTurns: 3,
      featureRotationQuarterTurns: 1,
    });

    const firstView = new ChunkView(2, 2, state);
    firstView.rebuild((cell) =>
      cell.cellId === cellId ? new Object3D() : null,
    );
    expect(firstView.root.children[0]?.userData.cellId).toBe(cellId);
    firstView.releaseVisuals();

    const recreatedView = new ChunkView(2, 2, state);
    const fixedCell = recreatedView
      .snapshot()
      .find((cell) => cell.cellId === cellId);
    expect(fixedCell).toMatchObject({
      terrainTileId: 17,
      featureTileId: 6,
      terrainRotationQuarterTurns: 3,
      featureRotationQuarterTurns: 1,
      phase: 'FIXED',
    });
  });

  it('rejects any mutation of a FIXED cell while allowing idempotent duplicate commits', () => {
    const state = new WorldState();
    const cellId = cellCoordinatesToId({ x: 1, z: 1 });
    const commit = { cellId, terrainTileId: 4, featureTileId: null } as const;
    state.commitFixed(commit);

    expect(state.commitFixed(commit).phase).toBe('FIXED');
    expect(() => state.setObservationCharge(cellId, 0.5)).toThrow(
      FixedCellMutationError,
    );
    expect(() => state.commitFixed({ ...commit, terrainTileId: 5 })).toThrow(
      FixedCellMutationError,
    );
  });
});
