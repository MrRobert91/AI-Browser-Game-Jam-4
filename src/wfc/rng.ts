const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const WORLD_HASH_VERSION = 1;

export const SIMULATION_TICK_HZ = 10;
export const SIMULATION_TICK_MS = 1_000 / SIMULATION_TICK_HZ;

export interface RngState {
  value: number;
}

export interface FixedWorldCellHashInput {
  readonly cellId: number;
  readonly terrainTileId: number;
  readonly featureTileId: number | null;
}

/** Creates the only mutable state owned by a deterministic PRNG stream. */
export function createRng(seed: number): RngState {
  return { value: assertUint32(seed, 'seed') };
}

/** Mulberry32 step. All arithmetic is explicitly reduced to uint32. */
export function nextUint32(state: RngState): number {
  state.value = (state.value + MULBERRY_INCREMENT) >>> 0;

  let mixed = state.value;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return (mixed ^ (mixed >>> 14)) >>> 0;
}

/** Returns a value in [0, 1), preserving all 32 output bits. */
export function nextFloat01(state: RngState): number {
  return nextUint32(state) / UINT32_RANGE;
}

/**
 * Derives an independent stream seed from the world and subsystem identity.
 * String length and field tags keep adjacent fields unambiguous.
 */
export function deriveSeed(
  worldSeed: number,
  systemName: string,
  chunkX = 0,
  chunkZ = 0,
): number {
  let hash = FNV_OFFSET_BASIS;
  hash = appendUint32(hash, 0x574f524c); // "WORL"
  hash = appendUint32(hash, assertUint32(worldSeed, 'worldSeed'));
  hash = appendUint32(hash, systemName.length);

  for (let index = 0; index < systemName.length; index += 1) {
    hash = appendUint16(hash, systemName.charCodeAt(index));
  }

  hash = appendUint32(hash, assertInt32(chunkX, 'chunkX') >>> 0);
  hash = appendUint32(hash, assertInt32(chunkZ, 'chunkZ') >>> 0);
  return avalanche32(hash);
}

/**
 * Maps elapsed run time to the last complete 10 Hz simulation tick.
 * Callers advance every tick between their previous and returned values.
 */
export function simulationTickAt(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('elapsedMs must be a finite non-negative number');
  }

  const boundaryTolerance = Number.EPSILON * Math.max(1, elapsedMs) * 8;
  return Math.floor((elapsedMs + boundaryTolerance) / SIMULATION_TICK_MS);
}

/**
 * Hashes the final fixed world in canonical cell order. The result does not
 * depend on insertion or collapse order, only on seed and fixed tile choices.
 */
export function hashFinalWorld(
  worldSeed: number,
  fixedCells: readonly FixedWorldCellHashInput[],
): number {
  const canonicalCells = [...fixedCells].sort(
    (left, right) => left.cellId - right.cellId,
  );

  let hash = FNV_OFFSET_BASIS;
  hash = appendUint32(hash, 0x57464331); // "WFC1"
  hash = appendUint32(hash, WORLD_HASH_VERSION);
  hash = appendUint32(hash, assertUint32(worldSeed, 'worldSeed'));
  hash = appendUint32(hash, canonicalCells.length);

  let previousCellId: number | null = null;
  for (const cell of canonicalCells) {
    const cellId = assertUint32(cell.cellId, 'cellId');
    if (cellId === previousCellId) {
      throw new RangeError(`cellId ${cellId} appears more than once`);
    }

    hash = appendUint32(hash, cellId);
    hash = appendUint32(
      hash,
      assertUint32(cell.terrainTileId, 'terrainTileId'),
    );
    hash = appendUint32(hash, cell.featureTileId === null ? 0 : 1);
    if (cell.featureTileId !== null) {
      hash = appendUint32(
        hash,
        assertUint32(cell.featureTileId, 'featureTileId'),
      );
    }
    previousCellId = cellId;
  }

  return avalanche32(hash);
}

function appendUint16(hash: number, value: number): number {
  let nextHash = appendByte(hash, value & 0xff);
  nextHash = appendByte(nextHash, value >>> 8);
  return nextHash;
}

function appendUint32(hash: number, value: number): number {
  let nextHash = appendByte(hash, value & 0xff);
  nextHash = appendByte(nextHash, (value >>> 8) & 0xff);
  nextHash = appendByte(nextHash, (value >>> 16) & 0xff);
  nextHash = appendByte(nextHash, value >>> 24);
  return nextHash;
}

function appendByte(hash: number, value: number): number {
  return Math.imul(hash ^ value, FNV_PRIME) >>> 0;
}

function avalanche32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function assertUint32(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
    throw new RangeError(`${name} must be a uint32`);
  }
  return value >>> 0;
}

function assertInt32(value: number, name: string): number {
  if (!Number.isInteger(value) || value < -0x8000_0000 || value > 0x7fff_ffff) {
    throw new RangeError(`${name} must be an int32`);
  }
  return value;
}
