import { describe, expect, it, vi } from 'vitest';

import { renderDomainAscii } from '../../src/wfc/ascii';
import {
  createEmptyMask,
  createFullMask,
  hasBit,
  setBit,
} from '../../src/wfc/bitset';
import {
  CARDINAL_DIRECTIONS,
  OPPOSITE_DIRECTION,
  compileCardinalCompatibility,
  type CardinalVariantDefinition,
} from '../../src/wfc/compatibility';
import {
  ReusableCellQueue,
  propagateCardinalConstraints,
  type PropagationCell,
} from '../../src/wfc/propagation';

const checkerVariants: readonly CardinalVariantDefinition[] = [
  { id: 'A', sockets: { N: 'A', E: 'A', S: 'A', W: 'A' } },
  { id: 'B', sockets: { N: 'B', E: 'B', S: 'B', W: 'B' } },
];
const checkerCompatibility = compileCardinalCompatibility(checkerVariants, {
  A: ['B'],
  B: ['A'],
});

function checkerCells(width: number, height: number): PropagationCell[] {
  return Array.from({ length: width * height }, () => ({
    domain: createFullMask(2),
    entropy: Math.log(2),
  }));
}

describe('cardinal compatibility compilation', () => {
  it('compiles reciprocal masks for every direction', () => {
    for (const direction of CARDINAL_DIRECTIONS) {
      const opposite = OPPOSITE_DIRECTION[direction];
      for (let source = 0; source < checkerVariants.length; source += 1) {
        const allowed = checkerCompatibility[direction][source];
        expect(allowed).toBeDefined();
        for (let target = 0; target < checkerVariants.length; target += 1) {
          if (allowed !== undefined && hasBit(allowed, target)) {
            const reverse = checkerCompatibility[opposite][target];
            expect(reverse).toBeDefined();
            expect(reverse !== undefined && hasBit(reverse, source)).toBe(true);
          }
        }
      }
    }
  });

  it('rejects non-reciprocal and unknown socket rules', () => {
    expect(() =>
      compileCardinalCompatibility(checkerVariants, {
        A: ['B'],
        B: ['B'],
      }),
    ).toThrow(/not reciprocal/);
    expect(() =>
      compileCardinalCompatibility(checkerVariants, {
        A: ['B', 'UNKNOWN'],
        B: ['A'],
      }),
    ).toThrow(/unknown compatible socket/);
  });
});

describe('reusable propagation queue', () => {
  it('deduplicates pending cells and reuses its fixed storage', () => {
    const queue = new ReusableCellQueue(3);
    expect(queue.enqueue(1)).toBe(true);
    expect(queue.enqueue(1)).toBe(false);
    expect(queue.size).toBe(1);
    expect(queue.dequeue()).toBe(1);
    expect(queue.enqueue(1)).toBe(true);
    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toBeNull();
  });
});

describe('FIFO cardinal propagation', () => {
  it('propagates a deterministic checker map and only recalculates changes', () => {
    const width = 5;
    const height = 4;
    const cells = checkerCells(width, height);
    setBitToSingleton(cells[0]!.domain, 0);
    cells[0]!.entropy = 0;
    const recalculateEntropy = vi.fn(() => 0);

    const result = propagateCardinalConstraints({
      width,
      height,
      cells,
      compatibility: checkerCompatibility,
      seedCellIds: [0, 0],
      queue: new ReusableCellQueue(cells.length),
      recalculateEntropy,
    });

    expect(result.status).toBe('STABLE');
    expect(result.changedCells).toBe(cells.length - 1);
    expect(result.entropyRecalculations).toBe(result.changedCells);
    expect(recalculateEntropy).toHaveBeenCalledTimes(cells.length - 1);
    expect(result.duplicateEnqueuesSkipped).toBeGreaterThan(0);
    expect(result.maxQueueSize).toBeLessThanOrEqual(cells.length);
    expect(renderDomainAscii(width, height, cells, ['A', 'B'])).toBe(
      'ABABA\nBABAB\nABABA\nBABAB',
    );

    const stableEntropy = vi.fn(() => 0);
    const stableResult = propagateCardinalConstraints({
      width,
      height,
      cells,
      compatibility: checkerCompatibility,
      seedCellIds: [0],
      queue: new ReusableCellQueue(cells.length),
      recalculateEntropy: stableEntropy,
    });
    expect(stableResult.changedCells).toBe(0);
    expect(stableResult.entropyRecalculations).toBe(0);
    expect(stableEntropy).not.toHaveBeenCalled();
  });

  it('reports a contradiction without rewriting a fixed neighbor', () => {
    const cells = checkerCells(2, 1);
    setBitToSingleton(cells[0]!.domain, 0);
    setBitToSingleton(cells[1]!.domain, 0);
    cells[0]!.entropy = 0;
    cells[1]!.entropy = 0;
    Object.defineProperty(cells[1], 'fixed', { value: true });
    const before = { ...cells[1]!.domain };
    const recalculateEntropy = vi.fn(() => 0);

    const result = propagateCardinalConstraints({
      width: 2,
      height: 1,
      cells,
      compatibility: checkerCompatibility,
      seedCellIds: [0],
      queue: new ReusableCellQueue(cells.length),
      recalculateEntropy,
    });

    expect(result).toMatchObject({
      status: 'CONTRADICTION',
      contradictionCellId: 1,
      changedCells: 0,
      entropyRecalculations: 0,
    });
    expect(cells[1]!.domain).toEqual(before);
    expect(recalculateEntropy).not.toHaveBeenCalled();
  });

  it('detects an empty domain and leaves the queue reusable', () => {
    const cells = checkerCells(1, 1);
    cells[0]!.domain.lo = 0;
    cells[0]!.domain.hi = 0;
    const queue = new ReusableCellQueue(1);

    const result = propagateCardinalConstraints({
      width: 1,
      height: 1,
      cells,
      compatibility: checkerCompatibility,
      seedCellIds: [0],
      queue,
      recalculateEntropy: () => 0,
    });

    expect(result.status).toBe('CONTRADICTION');
    expect(result.contradictionCellId).toBe(0);
    expect(queue.size).toBe(0);
    expect(queue.enqueue(0)).toBe(true);
  });
});

describe('ASCII domain maps', () => {
  it('renders empty, unresolved and singleton domains in row-major order', () => {
    const empty = createEmptyMask();
    const unresolved = createFullMask(2);
    const singleton = createEmptyMask();
    setBit(singleton, 1);

    expect(
      renderDomainAscii(
        3,
        1,
        [{ domain: empty }, { domain: unresolved }, { domain: singleton }],
        ['A', 'B'],
      ),
    ).toBe('!?B');
  });
});

function setBitToSingleton(
  domain: { lo: number; hi: number },
  bit: number,
): void {
  domain.lo = 0;
  domain.hi = 0;
  setBit(domain, bit);
}
