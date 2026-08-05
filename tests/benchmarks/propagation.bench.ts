import { bench, describe } from 'vitest';

import { createFullMask, setBit } from '../../src/wfc/bitset';
import { compileCardinalCompatibility } from '../../src/wfc/compatibility';
import {
  ReusableCellQueue,
  propagateCardinalConstraints,
  type PropagationCell,
} from '../../src/wfc/propagation';

const width = 64;
const height = 64;
const cellCount = width * height;
const fullDomain = createFullMask(2);
const cells: PropagationCell[] = Array.from({ length: cellCount }, () => ({
  domain: { ...fullDomain },
  entropy: Math.log(2),
}));
const compatibility = compileCardinalCompatibility(
  [
    { id: 'A', sockets: { N: 'A', E: 'A', S: 'A', W: 'A' } },
    { id: 'B', sockets: { N: 'B', E: 'B', S: 'B', W: 'B' } },
  ],
  { A: ['B'], B: ['A'] },
);
const queue = new ReusableCellQueue(cellCount);

describe('64x64 FIFO propagation hot path', () => {
  bench('propagate checker constraints', () => {
    for (const cell of cells) {
      cell.domain.lo = fullDomain.lo;
      cell.domain.hi = fullDomain.hi;
      cell.entropy = Math.log(2);
    }
    cells[0]!.domain.lo = 0;
    cells[0]!.domain.hi = 0;
    setBit(cells[0]!.domain, 0);
    cells[0]!.entropy = 0;

    propagateCardinalConstraints({
      width,
      height,
      cells,
      compatibility,
      seedCellIds: [0],
      queue,
      recalculateEntropy: () => 0,
    });
  });
});
