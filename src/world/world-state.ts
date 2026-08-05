import type {
  CellCoordinates,
  CellId,
  CellPhase,
  WorldVector3,
} from '../contracts/world';

export const WORLD_CELLS_PER_SIDE = 64;
export const WORLD_CELL_SIZE_METERS = 2;
export const WORLD_CHUNK_CELLS_PER_SIDE = 16;
export const WORLD_ORIGIN_CELL = Object.freeze({ x: 32, z: 32 });

export interface FixedCellCommit {
  readonly cellId: CellId;
  readonly terrainTileId: number;
  readonly featureTileId: number | null;
  readonly terrainRotationQuarterTurns?: 0 | 1 | 2 | 3;
  readonly featureRotationQuarterTurns?: 0 | 1 | 2 | 3 | null;
  readonly paletteEpoch?: number;
}

export interface WorldCellSnapshot {
  readonly cellId: CellId;
  readonly coordinates: CellCoordinates;
  readonly phase: CellPhase;
  readonly observationCharge: number;
  readonly paletteEpoch: number;
  readonly terrainTileId: number | null;
  readonly featureTileId: number | null;
  readonly terrainRotationQuarterTurns: 0 | 1 | 2 | 3;
  readonly featureRotationQuarterTurns: 0 | 1 | 2 | 3 | null;
}

interface MutableWorldCell {
  phase: CellPhase;
  observationCharge: number;
  paletteEpoch: number;
  terrainTileId: number | null;
  featureTileId: number | null;
  terrainRotationQuarterTurns: 0 | 1 | 2 | 3;
  featureRotationQuarterTurns: 0 | 1 | 2 | 3 | null;
}

export class FixedCellMutationError extends Error {
  constructor(cellId: CellId) {
    super(`Cell ${cellId} is FIXED and cannot be mutated.`);
    this.name = 'FixedCellMutationError';
  }
}

function assertCellCoordinates(coordinates: CellCoordinates): void {
  if (
    !Number.isInteger(coordinates.x) ||
    !Number.isInteger(coordinates.z) ||
    coordinates.x < 0 ||
    coordinates.z < 0 ||
    coordinates.x >= WORLD_CELLS_PER_SIDE ||
    coordinates.z >= WORLD_CELLS_PER_SIDE
  ) {
    throw new RangeError(
      `Cell coordinates (${coordinates.x}, ${coordinates.z}) are outside the 64 x 64 world.`,
    );
  }
}

export function cellCoordinatesToId(coordinates: CellCoordinates): CellId {
  assertCellCoordinates(coordinates);
  return coordinates.z * WORLD_CELLS_PER_SIDE + coordinates.x;
}

export function cellIdToCoordinates(cellId: CellId): CellCoordinates {
  if (
    !Number.isInteger(cellId) ||
    cellId < 0 ||
    cellId >= WORLD_CELLS_PER_SIDE * WORLD_CELLS_PER_SIDE
  ) {
    throw new RangeError(`Cell id ${cellId} is outside the 64 x 64 world.`);
  }

  return {
    x: cellId % WORLD_CELLS_PER_SIDE,
    z: Math.floor(cellId / WORLD_CELLS_PER_SIDE),
  };
}

export function cellCenterToWorld(cellId: CellId, y = 0): WorldVector3 {
  const coordinates = cellIdToCoordinates(cellId);
  return [
    (coordinates.x + 0.5) * WORLD_CELL_SIZE_METERS,
    y,
    (coordinates.z + 0.5) * WORLD_CELL_SIZE_METERS,
  ];
}

export function worldPositionToCell(
  position: WorldVector3,
): CellCoordinates | null {
  const coordinates = {
    x: Math.floor(position[0] / WORLD_CELL_SIZE_METERS),
    z: Math.floor(position[2] / WORLD_CELL_SIZE_METERS),
  };

  try {
    assertCellCoordinates(coordinates);
    return coordinates;
  } catch {
    return null;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function snapshotsMatchCommit(
  cell: MutableWorldCell,
  commit: FixedCellCommit,
): boolean {
  return (
    cell.terrainTileId === commit.terrainTileId &&
    cell.featureTileId === commit.featureTileId &&
    cell.terrainRotationQuarterTurns ===
      (commit.terrainRotationQuarterTurns ?? 0) &&
    cell.featureRotationQuarterTurns ===
      (commit.featureRotationQuarterTurns ?? null) &&
    cell.paletteEpoch === (commit.paletteEpoch ?? cell.paletteEpoch)
  );
}

export class WorldState {
  readonly cellsPerSide = WORLD_CELLS_PER_SIDE;
  readonly cellSizeMeters = WORLD_CELL_SIZE_METERS;
  readonly originCell = WORLD_ORIGIN_CELL;

  private readonly cells: MutableWorldCell[];

  constructor() {
    this.cells = Array.from(
      { length: WORLD_CELLS_PER_SIDE * WORLD_CELLS_PER_SIDE },
      () => ({
        phase: 'UNINITIALIZED' as const,
        observationCharge: 0,
        paletteEpoch: 0,
        terrainTileId: null,
        featureTileId: null,
        terrainRotationQuarterTurns: 0 as const,
        featureRotationQuarterTurns: null,
      }),
    );
  }

  getCell(cellId: CellId): WorldCellSnapshot {
    const coordinates = cellIdToCoordinates(cellId);
    const cell = this.cells[cellId]!;
    return Object.freeze({
      cellId,
      coordinates,
      phase: cell.phase,
      observationCharge: cell.observationCharge,
      paletteEpoch: cell.paletteEpoch,
      terrainTileId: cell.terrainTileId,
      featureTileId: cell.featureTileId,
      terrainRotationQuarterTurns: cell.terrainRotationQuarterTurns,
      featureRotationQuarterTurns: cell.featureRotationQuarterTurns,
    });
  }

  initializeCell(cellId: CellId, paletteEpoch = 0): WorldCellSnapshot {
    const cell = this.getMutableCell(cellId);
    if (cell.phase === 'FIXED') {
      throw new FixedCellMutationError(cellId);
    }
    if (cell.phase === 'UNINITIALIZED') {
      cell.phase = 'SUPERPOSED';
      cell.paletteEpoch = paletteEpoch;
    }
    return this.getCell(cellId);
  }

  setPhase(
    cellId: CellId,
    phase: Exclude<CellPhase, 'FIXED'>,
  ): WorldCellSnapshot {
    const cell = this.getMutableCell(cellId);
    this.assertMutable(cellId, cell);
    cell.phase = phase;
    return this.getCell(cellId);
  }

  setObservationCharge(cellId: CellId, charge: number): WorldCellSnapshot {
    const cell = this.getMutableCell(cellId);
    this.assertMutable(cellId, cell);
    cell.observationCharge = clamp01(charge);
    return this.getCell(cellId);
  }

  commitFixed(commit: FixedCellCommit): WorldCellSnapshot {
    const cell = this.getMutableCell(commit.cellId);
    if (cell.phase === 'FIXED') {
      if (snapshotsMatchCommit(cell, commit)) {
        return this.getCell(commit.cellId);
      }
      throw new FixedCellMutationError(commit.cellId);
    }

    cell.phase = 'FIXED';
    cell.observationCharge = 1;
    cell.terrainTileId = commit.terrainTileId;
    cell.featureTileId = commit.featureTileId;
    cell.terrainRotationQuarterTurns = commit.terrainRotationQuarterTurns ?? 0;
    cell.featureRotationQuarterTurns =
      commit.featureRotationQuarterTurns ?? null;
    cell.paletteEpoch = commit.paletteEpoch ?? cell.paletteEpoch;
    return this.getCell(commit.cellId);
  }

  getChunkCells(chunkX: number, chunkZ: number): readonly WorldCellSnapshot[] {
    if (
      !Number.isInteger(chunkX) ||
      !Number.isInteger(chunkZ) ||
      chunkX < 0 ||
      chunkZ < 0 ||
      chunkX >= WORLD_CELLS_PER_SIDE / WORLD_CHUNK_CELLS_PER_SIDE ||
      chunkZ >= WORLD_CELLS_PER_SIDE / WORLD_CHUNK_CELLS_PER_SIDE
    ) {
      throw new RangeError(
        `Chunk (${chunkX}, ${chunkZ}) is outside the world.`,
      );
    }

    const snapshots: WorldCellSnapshot[] = [];
    const startX = chunkX * WORLD_CHUNK_CELLS_PER_SIDE;
    const startZ = chunkZ * WORLD_CHUNK_CELLS_PER_SIDE;
    for (let z = startZ; z < startZ + WORLD_CHUNK_CELLS_PER_SIDE; z += 1) {
      for (let x = startX; x < startX + WORLD_CHUNK_CELLS_PER_SIDE; x += 1) {
        snapshots.push(this.getCell(cellCoordinatesToId({ x, z })));
      }
    }
    return snapshots;
  }

  countFixedCells(): number {
    let count = 0;
    for (const cell of this.cells) {
      if (cell.phase === 'FIXED') count += 1;
    }
    return count;
  }

  private getMutableCell(cellId: CellId): MutableWorldCell {
    cellIdToCoordinates(cellId);
    return this.cells[cellId]!;
  }

  private assertMutable(cellId: CellId, cell: MutableWorldCell): void {
    if (cell.phase === 'FIXED') {
      throw new FixedCellMutationError(cellId);
    }
  }
}
