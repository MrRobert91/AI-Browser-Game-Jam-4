import type {
  ChunkBoundaryEvent,
  CollapseEvent,
  DomainPatchEvent,
  FractureEvent,
  FractureRegionInput,
  ObservationInput,
  ResetInput,
  SolverWarning,
  UnlockPackInput,
  VisibleCellObservation,
  WorkerInput,
  WorkerOutput,
} from './messages';
import type { UnlockablePackId } from './tiles';
import type { WorldVector3 } from './world';

type UnknownRecord = Record<string, unknown>;

const PACK_IDS: readonly UnlockablePackId[] = [
  'water',
  'forest',
  'ruin',
  'storm',
];
const WARNING_CODES: readonly SolverWarning['code'][] = [
  'ECHO_ONLY',
  'INVALID_INPUT',
  'QUANTUM_FALLBACK',
  'QUANTUM_VOID_DEBUG',
  'BUDGET_EXHAUSTED',
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isUint32(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 0xffff_ffff;
}

function isWorldVector3(value: unknown): value is WorldVector3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => isFiniteNumber(component))
  );
}

function isVisibleCellObservation(
  value: unknown,
): value is VisibleCellObservation {
  if (!isRecord(value)) return false;

  return (
    isNonNegativeInteger(value.cellId) &&
    isFiniteNumber(value.distance) &&
    value.distance >= 0 &&
    isFiniteNumber(value.alignment) &&
    value.alignment >= 0 &&
    value.alignment <= 1 &&
    typeof value.lineOfSight === 'boolean'
  );
}

function isObservationInput(
  value: UnknownRecord,
): value is UnknownRecord & ObservationInput {
  return (
    value.type === 'OBSERVATION_TICK' &&
    isNonNegativeInteger(value.tick) &&
    isWorldVector3(value.playerPosition) &&
    isWorldVector3(value.cameraForward) &&
    isFiniteNumber(value.elapsedRunSeconds) &&
    value.elapsedRunSeconds >= 0 &&
    Array.isArray(value.visibleCells) &&
    value.visibleCells.every((cell) => isVisibleCellObservation(cell))
  );
}

function isFractureRegionInput(
  value: UnknownRecord,
): value is UnknownRecord & FractureRegionInput {
  return (
    value.type === 'FRACTURE_REGION' &&
    isNonNegativeInteger(value.tick) &&
    isNonNegativeInteger(value.centerCellId) &&
    value.radiusMeters === 30 &&
    Array.isArray(value.protectedCellIds) &&
    value.protectedCellIds.every(isNonNegativeInteger)
  );
}

function isUnlockPackInput(
  value: UnknownRecord,
): value is UnknownRecord & UnlockPackInput {
  return (
    value.type === 'UNLOCK_PACK' &&
    isNonNegativeInteger(value.tick) &&
    PACK_IDS.some((packId) => value.packId === packId)
  );
}

function isResetInput(
  value: UnknownRecord,
): value is UnknownRecord & ResetInput {
  return (
    value.type === 'RESET' &&
    isNonNegativeInteger(value.tick) &&
    isUint32(value.worldSeed)
  );
}

export function isWorkerInput(value: unknown): value is WorkerInput {
  if (!isRecord(value)) return false;

  return (
    isObservationInput(value) ||
    isUnlockPackInput(value) ||
    isResetInput(value) ||
    isFractureRegionInput(value)
  );
}

function isCollapseEvent(
  value: UnknownRecord,
): value is UnknownRecord & CollapseEvent {
  return (
    value.type === 'COLLAPSE' &&
    isNonNegativeInteger(value.cellId) &&
    isNonNegativeInteger(value.terrainTileId) &&
    (value.featureTileId === null ||
      isNonNegativeInteger(value.featureTileId)) &&
    isNonNegativeInteger(value.terrainRotationQuarterTurns) &&
    value.terrainRotationQuarterTurns <= 3 &&
    isFiniteNumber(value.entropyBefore) &&
    value.entropyBefore >= 0 &&
    isFiniteNumber(value.durationMs) &&
    value.durationMs > 0 &&
    isUint32(value.worldSeed)
  );
}

function isDomainMask(value: unknown): boolean {
  return isRecord(value) && isUint32(value.lo) && isUint32(value.hi);
}

function isDomainPatchEvent(
  value: UnknownRecord,
): value is UnknownRecord & DomainPatchEvent {
  return (
    value.type === 'DOMAIN_PATCH' &&
    isNonNegativeInteger(value.tick) &&
    Array.isArray(value.cells) &&
    value.cells.every(
      (cell) =>
        isRecord(cell) &&
        isNonNegativeInteger(cell.cellId) &&
        isDomainMask(cell.terrain) &&
        isDomainMask(cell.feature) &&
        isNonNegativeInteger(cell.paletteEpoch),
    )
  );
}

function isFractureEvent(
  value: UnknownRecord,
): value is UnknownRecord & FractureEvent {
  return (
    value.type === 'FRACTURE' &&
    isNonNegativeInteger(value.tick) &&
    isNonNegativeInteger(value.centerCellId) &&
    Array.isArray(value.cellIds) &&
    value.cellIds.every(isNonNegativeInteger)
  );
}

function isChunkBoundaryEvent(
  value: UnknownRecord,
): value is UnknownRecord & ChunkBoundaryEvent {
  return (
    value.type === 'BOUNDARY_UPDATE' &&
    isNonNegativeInteger(value.chunkId) &&
    value.north instanceof Uint16Array &&
    value.east instanceof Uint16Array &&
    value.south instanceof Uint16Array &&
    value.west instanceof Uint16Array
  );
}

function isSolverWarning(
  value: UnknownRecord,
): value is UnknownRecord & SolverWarning {
  return (
    value.type === 'SOLVER_WARNING' &&
    (value.tick === null || isNonNegativeInteger(value.tick)) &&
    WARNING_CODES.some((code) => value.code === code) &&
    typeof value.message === 'string' &&
    value.message.length > 0
  );
}

export function isWorkerOutput(value: unknown): value is WorkerOutput {
  if (!isRecord(value)) return false;

  return (
    isCollapseEvent(value) ||
    isChunkBoundaryEvent(value) ||
    isDomainPatchEvent(value) ||
    isFractureEvent(value) ||
    isSolverWarning(value)
  );
}

export function readMessageTick(value: unknown): number | null {
  if (!isRecord(value)) return null;
  return isNonNegativeInteger(value.tick) ? value.tick : null;
}
