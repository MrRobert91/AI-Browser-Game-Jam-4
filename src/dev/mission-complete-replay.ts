import type { UnlockablePackId } from '../contracts/tiles';
import { GRAMMAR_SOURCE } from '../contracts/grammar-runtime';
import { MISSION_COMPLETE_FIXED_CELLS } from '../gameplay/ending';
import type { FixedCellCommit, WorldState } from '../world/world-state';

export interface MissionCompleteReplayOutcome {
  readonly collectedPacks: readonly UnlockablePackId[];
  readonly livesRemaining: 1;
  readonly finalFixedCells: number;
  readonly fixedCommits: readonly FixedCellCommit[];
}

function hash01(cellId: number): number {
  let value = Math.imul(cellId + 1, 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  return (value ^ (value >>> 13)) / 0x1_0000_0000;
}

function replayCellScore(cellId: number, cellsPerSide: number): number {
  if (cellId === 0) return -1;
  const x = (cellId % cellsPerSide) - (cellsPerSide - 1) / 2;
  const z = Math.floor(cellId / cellsPerSide) - (cellsPerSide - 1) / 2;
  const radius = Math.hypot(x, z) / (cellsPerSide * 0.7);
  const angle = Math.atan2(z, x);
  const branches = Math.abs(Math.sin(angle * 5 + radius * 11));
  return radius * 0.56 + branches * 0.16 + hash01(cellId) * 0.36;
}

function replayCommit(cellId: number): FixedCellCommit {
  const x = cellId % 64;
  const z = Math.floor(cellId / 64);
  const biome = (Math.floor(x / 13) + Math.floor(z / 11)) % 5;
  const terrainPools = [
    [0, 1, 2, 3, 4],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19],
    [20, 21, 22, 23, 24, 25],
  ] as const;
  const featurePools = [
    [1, 2, 3, 17],
    [5, 6, 2],
    [8, 9, 11, 3],
    [12, 13, 14, 15, 2],
    [16, 19, 20, 21, 17],
  ] as const;
  const terrainPool = terrainPools[biome]!;
  const featurePool = featurePools[biome]!;
  const terrainTileId = terrainPool[cellId % terrainPool.length]!;
  const showFeature = cellId % 5 !== 0;
  return {
    cellId,
    terrainTileId,
    featureTileId: showFeature
      ? featurePool[Math.floor(cellId / 5) % featurePool.length]!
      : null,
    terrainRotationQuarterTurns: (cellId % 4) as 0 | 1 | 2 | 3,
  };
}

/**
 * Deterministic evidence fixture for the ten-minute qualified route. It is only
 * reachable through the explicit evidence replay query and never affects a
 * normal observation.
 */
export function applyMissionCompleteReplayOutcome(
  worldState: WorldState,
): MissionCompleteReplayOutcome {
  const candidates = Array.from(
    { length: worldState.cellsPerSide ** 2 },
    (_, cellId) => cellId,
  ).sort(
    (left, right) =>
      replayCellScore(left, worldState.cellsPerSide) -
      replayCellScore(right, worldState.cellsPerSide),
  );
  const fixedCommits: FixedCellCommit[] = [];
  for (const cellId of candidates) {
    if (worldState.countFixedCells() >= MISSION_COMPLETE_FIXED_CELLS) break;
    const phase = worldState.getCellView(cellId).phase;
    if (phase === 'FIXED' || phase === 'FRACTURED' || phase === 'COLLAPSING')
      continue;
    const commit = replayCommit(cellId);
    worldState.commitFixed(commit);
    fixedCommits.push(commit);
  }
  if (
    fixedCommits.some(
      (commit) =>
        !GRAMMAR_SOURCE.terrain.some(
          (terrain) => terrain.numericId === commit.terrainTileId,
        ),
    )
  ) {
    throw new Error('Mission replay selected an unknown terrain tile.');
  }
  return {
    collectedPacks: ['water', 'forest', 'ruin', 'storm'],
    livesRemaining: 1,
    finalFixedCells: worldState.countFixedCells(),
    fixedCommits,
  };
}
