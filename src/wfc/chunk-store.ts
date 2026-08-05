import type { WorldVector3 } from '../contracts/world';
import type { Direction, UnlockablePackId } from '../contracts/tiles';

import {
  OPPOSITE_BOUNDARY,
  cloneBoundaryConstraint,
  createBoundaryConstraint,
  setBoundaryEdge,
  type BoundaryConstraint,
} from './boundary';

export const WORLD_CELLS_PER_SIDE = 64;
export const CHUNK_CELLS_PER_SIDE = 16;
export const CHUNKS_PER_SIDE = WORLD_CELLS_PER_SIDE / CHUNK_CELLS_PER_SIDE;
export const CELL_SIZE_METERS = 2;
export const CHUNK_SIZE_METERS = CHUNK_CELLS_PER_SIDE * CELL_SIZE_METERS;
export const CHUNK_ACTIVATION_RADIUS_METERS = 18;
export const VISUAL_RELEASE_DISTANCE_METERS = 42;

export interface ChunkInitializationContext {
  readonly chunkId: number;
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly paletteEpoch: number;
  readonly unlockedPacks: ReadonlySet<UnlockablePackId>;
  readonly boundary: BoundaryConstraint;
}

export interface LogicalChunk<TCell> {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly paletteEpoch: number;
  readonly unlockedPacks: ReadonlySet<UnlockablePackId>;
  readonly cells: readonly TCell[];
  readonly incomingBoundary: BoundaryConstraint;
  readonly fixedBoundary: BoundaryConstraint;
  visualLoaded: boolean;
}

export interface ChunkStoreOptions<TCell> {
  readonly createCells: (
    context: ChunkInitializationContext,
  ) => readonly TCell[];
  readonly onInitializedBoundaryUpdate?: (
    chunk: LogicalChunk<TCell>,
    direction: Direction,
    values: Uint16Array,
  ) => void;
}

/** Logical chunks persist independently from their disposable visual views. */
export class ChunkStore<TCell> {
  readonly #createCells: ChunkStoreOptions<TCell>['createCells'];
  readonly #onInitializedBoundaryUpdate:
    ChunkStoreOptions<TCell>['onInitializedBoundaryUpdate'] | undefined;
  readonly #chunks = new Map<number, LogicalChunk<TCell>>();
  readonly #pendingBoundaries = new Map<number, BoundaryConstraint>();
  readonly #unlockedPacks = new Set<UnlockablePackId>();
  #paletteEpoch = 0;

  constructor(options: ChunkStoreOptions<TCell>) {
    this.#createCells = options.createCells;
    this.#onInitializedBoundaryUpdate = options.onInitializedBoundaryUpdate;
  }

  get paletteEpoch(): number {
    return this.#paletteEpoch;
  }

  get initializedCount(): number {
    return this.#chunks.size;
  }

  unlockPack(packId: UnlockablePackId): number {
    if (this.#unlockedPacks.has(packId)) {
      return this.#paletteEpoch;
    }
    this.#unlockedPacks.add(packId);
    this.#paletteEpoch += 1;
    return this.#paletteEpoch;
  }

  ensureChunk(chunkX: number, chunkZ: number): LogicalChunk<TCell> {
    const chunkId = chunkIdOf(chunkX, chunkZ);
    const existing = this.#chunks.get(chunkId);
    if (existing !== undefined) {
      return existing;
    }

    const incomingBoundary = cloneBoundaryConstraint(
      this.#pendingBoundaries.get(chunkId) ?? createBoundaryConstraint(),
    );
    const unlockedPacks = new Set(this.#unlockedPacks);
    const context: ChunkInitializationContext = {
      chunkId,
      chunkX,
      chunkZ,
      paletteEpoch: this.#paletteEpoch,
      unlockedPacks,
      boundary: cloneBoundaryConstraint(incomingBoundary),
    };
    const cells = this.#createCells(context);
    const expectedCellCount = CHUNK_CELLS_PER_SIDE ** 2;
    if (cells.length !== expectedCellCount) {
      throw new RangeError(
        `chunk factory must create ${expectedCellCount} logical cells`,
      );
    }

    const chunk: LogicalChunk<TCell> = {
      id: chunkId,
      x: chunkX,
      z: chunkZ,
      paletteEpoch: this.#paletteEpoch,
      unlockedPacks,
      cells,
      incomingBoundary,
      fixedBoundary: createBoundaryConstraint(),
      visualLoaded: true,
    };
    this.#chunks.set(chunkId, chunk);
    return chunk;
  }

  getChunk(chunkId: number): LogicalChunk<TCell> | null {
    return this.#chunks.get(chunkId) ?? null;
  }

  activateChunksWithin(
    playerPosition: WorldVector3,
    radius = CHUNK_ACTIVATION_RADIUS_METERS,
  ): readonly LogicalChunk<TCell>[] {
    assertRadius(radius);
    const active: LogicalChunk<TCell>[] = [];
    for (let chunkZ = 0; chunkZ < CHUNKS_PER_SIDE; chunkZ += 1) {
      for (let chunkX = 0; chunkX < CHUNKS_PER_SIDE; chunkX += 1) {
        if (distanceToChunk(playerPosition, chunkX, chunkZ) <= radius) {
          const chunk = this.ensureChunk(chunkX, chunkZ);
          chunk.visualLoaded = true;
          active.push(chunk);
        }
      }
    }
    return active;
  }

  releaseVisualsBeyond(
    playerPosition: WorldVector3,
    distance = VISUAL_RELEASE_DISTANCE_METERS,
  ): readonly number[] {
    assertRadius(distance);
    const released: number[] = [];
    for (const chunk of this.#chunks.values()) {
      if (
        chunk.visualLoaded &&
        distanceToChunk(playerPosition, chunk.x, chunk.z) > distance
      ) {
        chunk.visualLoaded = false;
        released.push(chunk.id);
      }
    }
    return released;
  }

  updateFixedBoundary(
    chunkId: number,
    direction: Direction,
    values: Uint16Array,
  ): void {
    const source = this.#chunks.get(chunkId);
    if (source === undefined) {
      throw new RangeError(`chunk ${chunkId} is not initialized`);
    }
    setBoundaryEdge(source.fixedBoundary, direction, values);

    const neighborCoordinates = neighborOf(source.x, source.z, direction);
    if (neighborCoordinates === null) {
      return;
    }
    const neighborId = chunkIdOf(neighborCoordinates.x, neighborCoordinates.z);
    const incoming =
      this.#pendingBoundaries.get(neighborId) ?? createBoundaryConstraint();
    const incomingDirection = OPPOSITE_BOUNDARY[direction];
    setBoundaryEdge(incoming, incomingDirection, values);
    this.#pendingBoundaries.set(neighborId, incoming);

    const initializedNeighbor = this.#chunks.get(neighborId);
    if (initializedNeighbor !== undefined) {
      setBoundaryEdge(
        initializedNeighbor.incomingBoundary,
        incomingDirection,
        values,
      );
      this.#onInitializedBoundaryUpdate?.(
        initializedNeighbor,
        incomingDirection,
        values.slice(),
      );
    }
  }
}

export function chunkIdOf(chunkX: number, chunkZ: number): number {
  assertChunkCoordinate(chunkX, 'chunkX');
  assertChunkCoordinate(chunkZ, 'chunkZ');
  return chunkZ * CHUNKS_PER_SIDE + chunkX;
}

export function chunkCoordinatesOf(chunkId: number): {
  readonly x: number;
  readonly z: number;
} {
  if (
    !Number.isInteger(chunkId) ||
    chunkId < 0 ||
    chunkId >= CHUNKS_PER_SIDE ** 2
  ) {
    throw new RangeError(
      `chunkId must be between 0 and ${CHUNKS_PER_SIDE ** 2 - 1}`,
    );
  }
  return {
    x: chunkId % CHUNKS_PER_SIDE,
    z: Math.floor(chunkId / CHUNKS_PER_SIDE),
  };
}

function neighborOf(
  chunkX: number,
  chunkZ: number,
  direction: Direction,
): { readonly x: number; readonly z: number } | null {
  switch (direction) {
    case 'N':
      return chunkZ === 0 ? null : { x: chunkX, z: chunkZ - 1 };
    case 'E':
      return chunkX + 1 === CHUNKS_PER_SIDE
        ? null
        : { x: chunkX + 1, z: chunkZ };
    case 'S':
      return chunkZ + 1 === CHUNKS_PER_SIDE
        ? null
        : { x: chunkX, z: chunkZ + 1 };
    case 'W':
      return chunkX === 0 ? null : { x: chunkX - 1, z: chunkZ };
  }
}

function distanceToChunk(
  playerPosition: WorldVector3,
  chunkX: number,
  chunkZ: number,
): number {
  const minX = chunkX * CHUNK_SIZE_METERS;
  const maxX = minX + CHUNK_SIZE_METERS;
  const minZ = chunkZ * CHUNK_SIZE_METERS;
  const maxZ = minZ + CHUNK_SIZE_METERS;
  const closestX = Math.max(minX, Math.min(maxX, playerPosition[0]));
  const closestZ = Math.max(minZ, Math.min(maxZ, playerPosition[2]));
  return Math.hypot(playerPosition[0] - closestX, playerPosition[2] - closestZ);
}

function assertChunkCoordinate(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= CHUNKS_PER_SIDE) {
    throw new RangeError(
      `${name} must be between 0 and ${CHUNKS_PER_SIDE - 1}`,
    );
  }
}

function assertRadius(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('radius must be a finite non-negative number');
  }
}
