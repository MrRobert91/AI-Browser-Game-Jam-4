import { describe, expect, it, vi } from 'vitest';

import type { CollapseEvent } from '../../src/contracts/messages';
import { ObservableWorldBridge } from '../../src/app/observable-world-bridge';
import type { ObservableSolverClient } from '../../src/app/observable-world-bridge';
import { cellCoordinatesToId } from '../../src/world/world-state';

function fakeSolver(): ObservableSolverClient {
  return {
    sendObservation: vi.fn(() => 1),
    sendUnlockPack: vi.fn(() => 2),
    reset: vi.fn(() => 3),
  };
}

describe('ObservableWorldBridge', () => {
  it('streams observations at 10 Hz and never fixes a worker event outside radius', () => {
    const solver = fakeSolver();
    const bridge = new ObservableWorldBridge({
      solver,
      getPlayerPosition: () => [65, 1.7, 65],
    });
    const nearbyCellIds = bridge.getNearbyCellIds([65, 1.7, 65]);
    expect(
      bridge.update(
        {
          deltaSeconds: 0.1,
          playerPosition: [65, 1.7, 65],
          cameraForward: [0, 0, -1],
          nearbyCellIds,
        },
        0,
      ),
    ).toBe(1);
    expect(solver.sendObservation).toHaveBeenCalledTimes(1);

    const farCellId = cellCoordinatesToId({ x: 50, z: 50 });
    const farEvent: CollapseEvent = {
      type: 'COLLAPSE',
      cellId: farCellId,
      terrainTileId: 1,
      featureTileId: null,
      entropyBefore: 1,
      durationMs: 500,
      worldSeed: 9,
    };
    expect(bridge.handleWorkerOutput(farEvent, 0)).toBe(false);
    expect(bridge.worldState.getCell(farCellId).phase).toBe('UNINITIALIZED');
  });

  it('applies collapse and boundary events once despite duplicates', () => {
    const bridge = new ObservableWorldBridge({
      solver: fakeSolver(),
      getPlayerPosition: () => [65, 1.7, 65],
    });
    const cellId = cellCoordinatesToId({ x: 32, z: 29 });
    const collapse: CollapseEvent = {
      type: 'COLLAPSE',
      cellId,
      terrainTileId: 1,
      featureTileId: null,
      entropyBefore: 1,
      durationMs: 500,
      worldSeed: 9,
    };
    expect(bridge.handleWorkerOutput(collapse, 0)).toBe(true);
    expect(bridge.handleWorkerOutput(collapse, 0)).toBe(false);

    const boundary = {
      type: 'BOUNDARY_UPDATE' as const,
      chunkId: 10,
      north: new Uint16Array(16).fill(1),
      east: new Uint16Array(16).fill(2),
      south: new Uint16Array(16).fill(3),
      west: new Uint16Array(16).fill(4),
    };
    expect(bridge.handleWorkerOutput(boundary, 0)).toBe(true);
    expect(bridge.handleWorkerOutput(boundary, 0)).toBe(false);
    expect(bridge.getBoundary(10)?.east[0]).toBe(2);
  });

  it('applies unlock epochs only to cells initialized afterwards', () => {
    const solver = fakeSolver();
    const bridge = new ObservableWorldBridge({
      solver,
      getPlayerPosition: () => [65, 1.7, 65],
    });
    const oldCell = cellCoordinatesToId({ x: 1, z: 1 });
    const futureCell = cellCoordinatesToId({ x: 2, z: 1 });
    bridge.worldState.initializeCell(oldCell, bridge.getPaletteEpoch());

    expect(bridge.unlockPack('water')).toBe(1);
    expect(bridge.unlockPack('water')).toBe(1);
    bridge.worldState.initializeCell(futureCell, bridge.getPaletteEpoch());

    expect(bridge.worldState.getCell(oldCell).paletteEpoch).toBe(0);
    expect(bridge.worldState.getCell(futureCell).paletteEpoch).toBe(1);
    expect(solver.sendUnlockPack).toHaveBeenCalledTimes(1);
  });
});
