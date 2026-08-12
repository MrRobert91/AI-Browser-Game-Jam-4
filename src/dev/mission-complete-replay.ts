import type { UnlockablePackId } from '../contracts/tiles';
import { MISSION_COMPLETE_FIXED_CELLS } from '../gameplay/ending';
import type { WorldState } from '../world/world-state';

export interface MissionCompleteReplayOutcome {
  readonly collectedPacks: readonly UnlockablePackId[];
  readonly livesRemaining: 1;
  readonly finalFixedCells: number;
}

/**
 * Deterministic evidence fixture for the ten-minute qualified route. It is only
 * reachable through the explicit evidence replay query and never affects a
 * normal observation.
 */
export function applyMissionCompleteReplayOutcome(
  worldState: WorldState,
): MissionCompleteReplayOutcome {
  for (
    let cellId = 0;
    cellId < worldState.cellsPerSide ** 2 &&
    worldState.countFixedCells() < MISSION_COMPLETE_FIXED_CELLS;
    cellId += 1
  ) {
    const phase = worldState.getCellView(cellId).phase;
    if (phase === 'FIXED' || phase === 'FRACTURED') continue;
    worldState.commitFixed({
      cellId,
      terrainTileId: cellId % 2,
      featureTileId: null,
      terrainRotationQuarterTurns: 0,
    });
  }
  return {
    collectedPacks: ['water', 'forest', 'ruin', 'storm'],
    livesRemaining: 1,
    finalFixedCells: worldState.countFixedCells(),
  };
}
