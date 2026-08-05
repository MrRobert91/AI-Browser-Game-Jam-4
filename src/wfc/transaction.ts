import type { DomainMask } from '../contracts/world';

import {
  assignMask,
  clearBit,
  createEmptyMask,
  setBit,
  type MutableDomainMask,
} from './bitset';
import {
  selectWeightedVariant,
  type EffectiveWeightContext,
  type WeightDefinition,
} from './entropy';
import type { RngState } from './rng';

export const TRANSACTION_RADIUS = 3;
export const MAX_TRANSACTION_ATTEMPTS = 8;

export interface TransactionCell {
  readonly domain: MutableDomainMask;
  entropy: number;
  readonly fixed?: boolean;
}

export interface TransactionSnapshotEntry {
  readonly cellId: number;
  readonly domain: DomainMask;
  readonly entropy: number;
}

export interface TransactionPropagationContext {
  readonly targetCellId: number;
  readonly candidateVariant: number;
  readonly mutableCellIds: ReadonlySet<number>;
}

export type TransactionPropagator = (
  context: TransactionPropagationContext,
) => 'STABLE' | 'CONTRADICTION';

export interface FallbackDefinition {
  readonly variantId: number;
  readonly kind: 'BRIDGE' | 'QUANTUM';
  readonly name: string;
}

export interface CollapseTelemetry {
  readonly attemptedCandidates: readonly number[];
  readonly revertedCandidates: readonly number[];
  readonly fallbackName: string | null;
  readonly warnings: readonly TransactionWarning[];
}

export interface TransactionWarning {
  readonly code: 'QUANTUM_FALLBACK' | 'QUANTUM_VOID_DEBUG';
  readonly message: string;
}

export type ObservedCollapseResult =
  | {
      readonly status: 'COMMITTED' | 'FALLBACK_COMMITTED';
      readonly tileId: number;
      readonly reveal: { readonly cellId: number; readonly tileId: number };
      readonly telemetry: CollapseTelemetry;
    }
  | {
      readonly status: 'CONTRADICTION';
      readonly tileId: null;
      readonly reveal: null;
      readonly telemetry: CollapseTelemetry;
    };

export interface ObservedCollapseRequest {
  readonly cellId: number;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly TransactionCell[];
  readonly definitions: readonly WeightDefinition[];
  readonly weightContext: EffectiveWeightContext;
  readonly rng: RngState;
  readonly propagate: TransactionPropagator;
  readonly fallbacks: readonly FallbackDefinition[];
  readonly quantumVoidDebugVariantId?: number;
}

/** Captures only mutable cells in the normative square radius-three region. */
export function snapshotMutableRegion(
  cells: readonly TransactionCell[],
  width: number,
  height: number,
  centerCellId: number,
  radius = TRANSACTION_RADIUS,
): readonly TransactionSnapshotEntry[] {
  const cellCount = validateGrid(cells, width, height);
  assertCellId(centerCellId, cellCount);
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError('radius must be a non-negative integer');
  }

  const centerX = centerCellId % width;
  const centerZ = Math.floor(centerCellId / width);
  const snapshot: TransactionSnapshotEntry[] = [];
  const minZ = Math.max(0, centerZ - radius);
  const maxZ = Math.min(height - 1, centerZ + radius);
  const minX = Math.max(0, centerX - radius);
  const maxX = Math.min(width - 1, centerX + radius);

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cellId = z * width + x;
      const cell = cells[cellId];
      if (cell === undefined) {
        throw new RangeError(`missing cell ${cellId}`);
      }
      if (cell.fixed === true) {
        continue;
      }
      snapshot.push({
        cellId,
        domain: { lo: cell.domain.lo >>> 0, hi: cell.domain.hi >>> 0 },
        entropy: cell.entropy,
      });
    }
  }

  return snapshot;
}

export function restoreTransactionSnapshot(
  cells: readonly TransactionCell[],
  snapshot: readonly TransactionSnapshotEntry[],
): void {
  for (const entry of snapshot) {
    const cell = cells[entry.cellId];
    if (cell === undefined) {
      throw new RangeError(`missing snapshot cell ${entry.cellId}`);
    }
    if (cell.fixed === true) {
      throw new Error(`fixed cell ${entry.cellId} cannot be restored`);
    }
    assignMask(cell.domain, entry.domain);
    cell.entropy = entry.entropy;
  }
}

/** Produces a deterministic weighted order without retrying a candidate. */
export function weightedCandidateOrder(
  domain: DomainMask,
  definitions: readonly WeightDefinition[],
  context: EffectiveWeightContext,
  rng: RngState,
  limit = MAX_TRANSACTION_ATTEMPTS,
): readonly number[] {
  if (
    !Number.isInteger(limit) ||
    limit < 0 ||
    limit > MAX_TRANSACTION_ATTEMPTS
  ) {
    throw new RangeError(
      `limit must be between 0 and ${MAX_TRANSACTION_ATTEMPTS}`,
    );
  }

  const remaining = { lo: domain.lo >>> 0, hi: domain.hi >>> 0 };
  const candidates: number[] = [];
  while (candidates.length < limit) {
    const candidate = selectWeightedVariant(
      remaining,
      definitions,
      context,
      rng,
    );
    if (candidate === null) {
      break;
    }
    candidates.push(candidate);
    clearBit(remaining, candidate);
  }
  return candidates;
}

/**
 * Runs an observed collapse atomically. The returned reveal is constructed only
 * after propagation succeeds, so provisional candidates can never be rendered.
 */
export function attemptObservedCollapse(
  request: ObservedCollapseRequest,
): ObservedCollapseResult {
  const cellCount = validateGrid(request.cells, request.width, request.height);
  assertCellId(request.cellId, cellCount);
  const target = request.cells[request.cellId];
  if (target === undefined) {
    throw new RangeError(`missing target cell ${request.cellId}`);
  }
  if (target.fixed === true) {
    throw new Error('cannot collapse a fixed cell');
  }

  const snapshot = snapshotMutableRegion(
    request.cells,
    request.width,
    request.height,
    request.cellId,
  );
  const mutableCellIds = new Set(snapshot.map((entry) => entry.cellId));
  const candidates = weightedCandidateOrder(
    target.domain,
    request.definitions,
    request.weightContext,
    request.rng,
  );
  const attemptedCandidates: number[] = [];
  const revertedCandidates: number[] = [];
  const warnings: TransactionWarning[] = [];

  for (const candidate of candidates) {
    attemptedCandidates.push(candidate);
    restoreTransactionSnapshot(request.cells, snapshot);
    assignSingleton(target.domain, candidate);
    target.entropy = 0;
    if (
      request.propagate({
        targetCellId: request.cellId,
        candidateVariant: candidate,
        mutableCellIds,
      }) === 'STABLE'
    ) {
      return committed('COMMITTED', candidate, null);
    }
    revertedCandidates.push(candidate);
  }

  for (const fallback of request.fallbacks) {
    attemptedCandidates.push(fallback.variantId);
    restoreTransactionSnapshot(request.cells, snapshot);
    assignSingleton(target.domain, fallback.variantId);
    target.entropy = 0;
    if (
      request.propagate({
        targetCellId: request.cellId,
        candidateVariant: fallback.variantId,
        mutableCellIds,
      }) === 'STABLE'
    ) {
      if (fallback.kind === 'QUANTUM') {
        warnings.push({
          code: 'QUANTUM_FALLBACK',
          message: `${fallback.name} committed after local candidates contradicted.`,
        });
      }
      return committed('FALLBACK_COMMITTED', fallback.variantId, fallback.name);
    }
    revertedCandidates.push(fallback.variantId);
  }

  restoreTransactionSnapshot(request.cells, snapshot);
  if (request.quantumVoidDebugVariantId !== undefined) {
    assignSingleton(target.domain, request.quantumVoidDebugVariantId);
    target.entropy = 0;
    warnings.push({
      code: 'QUANTUM_VOID_DEBUG',
      message:
        'quantum_void_debug was required; this is a delivery-blocking QA failure.',
    });
    return committed(
      'FALLBACK_COMMITTED',
      request.quantumVoidDebugVariantId,
      'quantum_void_debug',
    );
  }

  return {
    status: 'CONTRADICTION',
    tileId: null,
    reveal: null,
    telemetry: {
      attemptedCandidates,
      revertedCandidates,
      fallbackName: null,
      warnings,
    },
  };

  function committed(
    status: 'COMMITTED' | 'FALLBACK_COMMITTED',
    tileId: number,
    fallbackName: string | null,
  ): ObservedCollapseResult {
    return {
      status,
      tileId,
      reveal: { cellId: request.cellId, tileId },
      telemetry: {
        attemptedCandidates,
        revertedCandidates,
        fallbackName,
        warnings,
      },
    };
  }
}

function assignSingleton(domain: MutableDomainMask, variantId: number): void {
  const singleton = createEmptyMask();
  setBit(singleton, variantId);
  assignMask(domain, singleton);
}

function validateGrid(
  cells: readonly TransactionCell[],
  width: number,
  height: number,
): number {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError('width must be a positive integer');
  }
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError('height must be a positive integer');
  }
  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cells.length !== cellCount) {
    throw new RangeError('cells length must equal width * height');
  }
  return cellCount;
}

function assertCellId(cellId: number, cellCount: number): void {
  if (!Number.isInteger(cellId) || cellId < 0 || cellId >= cellCount) {
    throw new RangeError(`cellId must be between 0 and ${cellCount - 1}`);
  }
}
