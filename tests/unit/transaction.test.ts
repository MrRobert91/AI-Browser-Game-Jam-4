import { describe, expect, it, vi } from 'vitest';

import { createFullMask, hasBit, setBit } from '../../src/wfc/bitset';
import { createRng } from '../../src/wfc/rng';
import {
  attemptObservedCollapse,
  snapshotMutableRegion,
  weightedCandidateOrder,
  type TransactionCell,
} from '../../src/wfc/transaction';

function cells(count: number, variants = 4): TransactionCell[] {
  return Array.from({ length: count }, () => ({
    domain: createFullMask(variants),
    entropy: Math.log(variants),
  }));
}

const definitions = [1, 2, 3, 4].map((weight) => ({ weight }));
const neutralContext = {
  distanceFromOrigin: 0,
  deterministicNoise01: 0.5,
} as const;

describe('local collapse snapshots', () => {
  it('captures a radius-three square and never includes fixed cells', () => {
    const grid = cells(81);
    Object.defineProperty(grid[39], 'fixed', { value: true });
    const snapshot = snapshotMutableRegion(grid, 9, 9, 40);

    expect(snapshot).toHaveLength(48);
    expect(snapshot.map((entry) => entry.cellId)).not.toContain(39);
    expect(snapshot.map((entry) => entry.cellId)).toContain(10);
    expect(snapshot.map((entry) => entry.cellId)).toContain(70);
  });

  it('creates a deterministic weighted order capped at eight unique variants', () => {
    const domain = createFullMask(10);
    const weights = Array.from({ length: 10 }, (_, index) => ({
      weight: index + 1,
    }));
    const left = weightedCandidateOrder(
      domain,
      weights,
      neutralContext,
      createRng(42),
    );
    const right = weightedCandidateOrder(
      domain,
      weights,
      neutralContext,
      createRng(42),
    );

    expect(left).toEqual(right);
    expect(left).toHaveLength(8);
    expect(new Set(left)).toHaveLength(8);
  });
});

describe('atomic observed collapse', () => {
  it('restores domains and entropies exactly before trying the next candidate', () => {
    const grid = cells(9);
    const beforeNeighbor = {
      domain: { ...grid[1]!.domain },
      entropy: grid[1]!.entropy,
    };
    let attempt = 0;
    const propagate = vi.fn(
      ({ mutableCellIds }: { mutableCellIds: ReadonlySet<number> }) => {
        expect(mutableCellIds.has(0)).toBe(true);
        if (attempt === 0) {
          grid[1]!.domain.lo = 0;
          grid[1]!.domain.hi = 0;
          grid[1]!.entropy = -1;
          attempt += 1;
          return 'CONTRADICTION' as const;
        }
        expect(grid[1]!.domain).toEqual(beforeNeighbor.domain);
        expect(grid[1]!.entropy).toBe(beforeNeighbor.entropy);
        return 'STABLE' as const;
      },
    );

    const result = attemptObservedCollapse({
      cellId: 0,
      width: 3,
      height: 3,
      cells: grid,
      definitions,
      weightContext: neutralContext,
      rng: createRng(9),
      propagate,
      fallbacks: [],
    });

    expect(result.status).toBe('COMMITTED');
    expect(result.reveal).toEqual({ cellId: 0, tileId: result.tileId });
    expect(result.telemetry.revertedCandidates).toHaveLength(1);
    expect(propagate).toHaveBeenCalledTimes(2);
  });

  it('leaves fixed cells untouched and emits no reveal for a rolled back candidate', () => {
    const grid = cells(2);
    const fixedDomain = createFullMask(1);
    grid[1] = { domain: fixedDomain, entropy: 0, fixed: true };
    const before = { ...fixedDomain };

    const result = attemptObservedCollapse({
      cellId: 0,
      width: 2,
      height: 1,
      cells: grid,
      definitions,
      weightContext: neutralContext,
      rng: createRng(1),
      propagate: () => {
        expect(grid[1]!.domain).toEqual(before);
        return 'CONTRADICTION';
      },
      fallbacks: [],
    });

    expect(result.status).toBe('CONTRADICTION');
    expect(result.reveal).toBeNull();
    expect(grid[1]!.domain).toEqual(before);
  });

  it('commits a walkable Quantum fallback with telemetry after contradictions', () => {
    const grid = cells(1);
    const result = attemptObservedCollapse({
      cellId: 0,
      width: 1,
      height: 1,
      cells: grid,
      definitions,
      weightContext: neutralContext,
      rng: createRng(2),
      propagate: ({ candidateVariant }) =>
        candidateVariant === 6 ? 'STABLE' : 'CONTRADICTION',
      fallbacks: [
        { variantId: 5, kind: 'BRIDGE', name: 'bridge.meadow' },
        { variantId: 6, kind: 'QUANTUM', name: 'Quantum Meadow' },
      ],
    });

    expect(result).toMatchObject({
      status: 'FALLBACK_COMMITTED',
      tileId: 6,
      reveal: { cellId: 0, tileId: 6 },
      telemetry: {
        fallbackName: 'Quantum Meadow',
        warnings: [{ code: 'QUANTUM_FALLBACK' }],
      },
    });
    expect(hasBit(grid[0]!.domain, 6)).toBe(true);
  });

  it('uses quantum_void_debug only as the terminal QA fallback', () => {
    const grid = cells(1);
    setBit(grid[0]!.domain, 3);
    const result = attemptObservedCollapse({
      cellId: 0,
      width: 1,
      height: 1,
      cells: grid,
      definitions,
      weightContext: neutralContext,
      rng: createRng(3),
      propagate: () => 'CONTRADICTION',
      fallbacks: [{ variantId: 6, kind: 'QUANTUM', name: 'Quantum Slab' }],
      quantumVoidDebugVariantId: 7,
    });

    expect(result).toMatchObject({
      status: 'FALLBACK_COMMITTED',
      tileId: 7,
      telemetry: {
        fallbackName: 'quantum_void_debug',
        warnings: [{ code: 'QUANTUM_VOID_DEBUG' }],
      },
    });
  });
});
