import type { UnlockablePackId } from './tiles';
import type { CellId, WorldVector3 } from './world';

export interface VisibleCellObservation {
  readonly cellId: CellId;
  readonly distance: number;
  readonly alignment: number;
  readonly lineOfSight: boolean;
}

export interface ObservationInput {
  readonly type: 'OBSERVATION_TICK';
  readonly tick: number;
  readonly playerPosition: WorldVector3;
  readonly cameraForward: WorldVector3;
  readonly visibleCells: readonly VisibleCellObservation[];
}

export interface UnlockPackInput {
  readonly type: 'UNLOCK_PACK';
  readonly packId: UnlockablePackId;
  readonly tick: number;
}

export interface ResetInput {
  readonly type: 'RESET';
  readonly tick: number;
  readonly worldSeed: number;
}

export interface CollapseEvent {
  readonly type: 'COLLAPSE';
  readonly cellId: CellId;
  readonly terrainTileId: number;
  readonly featureTileId: number | null;
  readonly entropyBefore: number;
  readonly durationMs: number;
  readonly worldSeed: number;
}

export interface ChunkBoundaryEvent {
  readonly type: 'BOUNDARY_UPDATE';
  readonly chunkId: number;
  readonly north: Uint16Array;
  readonly east: Uint16Array;
  readonly south: Uint16Array;
  readonly west: Uint16Array;
}

export type SolverWarningCode =
  | 'ECHO_ONLY'
  | 'INVALID_INPUT'
  | 'QUANTUM_FALLBACK'
  | 'QUANTUM_VOID_DEBUG'
  | 'BUDGET_EXHAUSTED';

export interface SolverWarning {
  readonly type: 'SOLVER_WARNING';
  readonly tick: number | null;
  readonly code: SolverWarningCode;
  readonly message: string;
}

export type WorkerInput = ObservationInput | UnlockPackInput | ResetInput;
export type WorkerOutput = CollapseEvent | ChunkBoundaryEvent | SolverWarning;
