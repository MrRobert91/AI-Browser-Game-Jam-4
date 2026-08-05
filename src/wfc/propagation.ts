import type { DomainMask } from '../contracts/world';

import {
  createEmptyMask,
  isEmpty,
  nextSetBit,
  unionInto,
  type MutableDomainMask,
} from './bitset';
import {
  CARDINAL_DIRECTIONS,
  OPPOSITE_DIRECTION,
  type CardinalCompatibilityTable,
} from './compatibility';

export interface PropagationCell {
  readonly domain: MutableDomainMask;
  entropy: number;
  readonly fixed?: boolean;
}

export type EntropyRecalculator = (
  cellId: number,
  domain: DomainMask,
) => number;

export interface PropagationRequest {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly PropagationCell[];
  readonly compatibility: CardinalCompatibilityTable;
  readonly seedCellIds: readonly number[];
  readonly queue: ReusableCellQueue;
  readonly recalculateEntropy: EntropyRecalculator;
}

export interface PropagationResult {
  readonly status: 'STABLE' | 'CONTRADICTION';
  readonly contradictionCellId: number | null;
  readonly processedCells: number;
  readonly changedCells: number;
  readonly entropyRecalculations: number;
  readonly enqueuedCells: number;
  readonly duplicateEnqueuesSkipped: number;
  readonly maxQueueSize: number;
}

/** Fixed-capacity FIFO whose membership flags prevent duplicate pending work. */
export class ReusableCellQueue {
  readonly capacity: number;

  private readonly entries: Int32Array;
  private readonly queued: Uint8Array;
  private head = 0;
  private tail = 0;
  private length = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('queue capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.entries = new Int32Array(capacity);
    this.queued = new Uint8Array(capacity);
  }

  get size(): number {
    return this.length;
  }

  clear(): void {
    this.queued.fill(0);
    this.head = 0;
    this.tail = 0;
    this.length = 0;
  }

  enqueue(cellId: number): boolean {
    this.assertCellId(cellId);
    if (this.queued[cellId] === 1) {
      return false;
    }
    if (this.length === this.capacity) {
      throw new RangeError('propagation queue capacity exceeded');
    }

    this.entries[this.tail] = cellId;
    this.tail = (this.tail + 1) % this.capacity;
    this.queued[cellId] = 1;
    this.length += 1;
    return true;
  }

  dequeue(): number | null {
    if (this.length === 0) {
      return null;
    }

    const cellId = this.entries[this.head];
    if (cellId === undefined) {
      throw new RangeError('propagation queue storage is inconsistent');
    }
    this.head = (this.head + 1) % this.capacity;
    this.queued[cellId] = 0;
    this.length -= 1;
    return cellId;
  }

  private assertCellId(cellId: number): void {
    if (!Number.isInteger(cellId) || cellId < 0 || cellId >= this.capacity) {
      throw new RangeError(
        `cellId must be an integer from 0 to ${this.capacity - 1}`,
      );
    }
  }
}

/**
 * Propagates hard constraints monotonically. A fixed cell is never rewritten:
 * an incompatible restriction against it is reported as a contradiction.
 */
export function propagateCardinalConstraints(
  request: PropagationRequest,
): PropagationResult {
  const cellCount = validateRequest(request);
  const queue = request.queue;
  queue.clear();

  let processedCells = 0;
  let changedCells = 0;
  let entropyRecalculations = 0;
  let enqueuedCells = 0;
  let duplicateEnqueuesSkipped = 0;
  let maxQueueSize = 0;

  const enqueue = (cellId: number): void => {
    if (queue.enqueue(cellId)) {
      enqueuedCells += 1;
      maxQueueSize = Math.max(maxQueueSize, queue.size);
    } else {
      duplicateEnqueuesSkipped += 1;
    }
  };

  for (const seedCellId of request.seedCellIds) {
    assertGridCellId(seedCellId, cellCount);
    enqueue(seedCellId);
  }

  const allowedNeighborDomain = createEmptyMask();
  while (queue.size > 0) {
    const sourceCellId = queue.dequeue();
    if (sourceCellId === null) {
      break;
    }
    const sourceCell = request.cells[sourceCellId];
    if (sourceCell === undefined) {
      throw new RangeError(`missing source cell ${sourceCellId}`);
    }
    processedCells += 1;

    if (isEmpty(sourceCell.domain)) {
      return result('CONTRADICTION', sourceCellId);
    }

    for (const direction of CARDINAL_DIRECTIONS) {
      const neighborCellId = neighborOf(
        sourceCellId,
        direction,
        request.width,
        request.height,
      );
      if (neighborCellId === null) {
        continue;
      }

      const neighbor = request.cells[neighborCellId];
      if (neighbor === undefined) {
        throw new RangeError(`missing neighbor cell ${neighborCellId}`);
      }

      allowedNeighborDomain.lo = 0;
      allowedNeighborDomain.hi = 0;
      for (
        let sourceVariant = nextSetBit(sourceCell.domain);
        sourceVariant !== -1;
        sourceVariant = nextSetBit(sourceCell.domain, sourceVariant + 1)
      ) {
        const compatible = request.compatibility[direction][sourceVariant];
        if (compatible === undefined) {
          throw new RangeError(
            `missing ${direction} compatibility for variant ${sourceVariant}`,
          );
        }
        unionInto(allowedNeighborDomain, compatible);
      }

      const nextLo = (neighbor.domain.lo & allowedNeighborDomain.lo) >>> 0;
      const nextHi = (neighbor.domain.hi & allowedNeighborDomain.hi) >>> 0;
      const changed =
        nextLo !== neighbor.domain.lo || nextHi !== neighbor.domain.hi;
      if (!changed) {
        continue;
      }

      if (neighbor.fixed === true || (nextLo === 0 && nextHi === 0)) {
        return result('CONTRADICTION', neighborCellId);
      }

      neighbor.domain.lo = nextLo;
      neighbor.domain.hi = nextHi;
      neighbor.entropy = request.recalculateEntropy(
        neighborCellId,
        neighbor.domain,
      );
      changedCells += 1;
      entropyRecalculations += 1;
      enqueue(neighborCellId);
    }
  }

  return result('STABLE', null);

  function result(
    status: PropagationResult['status'],
    contradictionCellId: number | null,
  ): PropagationResult {
    queue.clear();
    return {
      status,
      contradictionCellId,
      processedCells,
      changedCells,
      entropyRecalculations,
      enqueuedCells,
      duplicateEnqueuesSkipped,
      maxQueueSize,
    };
  }
}

function neighborOf(
  cellId: number,
  direction: (typeof CARDINAL_DIRECTIONS)[number],
  width: number,
  height: number,
): number | null {
  const x = cellId % width;
  const z = Math.floor(cellId / width);
  switch (direction) {
    case 'N':
      return z === 0 ? null : cellId - width;
    case 'E':
      return x + 1 === width ? null : cellId + 1;
    case 'S':
      return z + 1 === height ? null : cellId + width;
    case 'W':
      return x === 0 ? null : cellId - 1;
  }
}

function validateRequest(request: PropagationRequest): number {
  if (!Number.isInteger(request.width) || request.width <= 0) {
    throw new RangeError('width must be a positive integer');
  }
  if (!Number.isInteger(request.height) || request.height <= 0) {
    throw new RangeError('height must be a positive integer');
  }

  const cellCount = request.width * request.height;
  if (!Number.isSafeInteger(cellCount) || request.cells.length !== cellCount) {
    throw new RangeError('cells length must equal width * height');
  }
  if (request.queue.capacity !== cellCount) {
    throw new RangeError('queue capacity must equal width * height');
  }

  for (const direction of CARDINAL_DIRECTIONS) {
    const opposite = OPPOSITE_DIRECTION[direction];
    if (
      request.compatibility[direction].length !==
      request.compatibility[opposite].length
    ) {
      throw new RangeError('compatibility tables must have equal lengths');
    }
  }
  return cellCount;
}

function assertGridCellId(cellId: number, cellCount: number): void {
  if (!Number.isInteger(cellId) || cellId < 0 || cellId >= cellCount) {
    throw new RangeError(`seed cellId must be between 0 and ${cellCount - 1}`);
  }
}
