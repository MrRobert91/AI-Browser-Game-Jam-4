import type { DomainMask } from '../contracts/world';

import { isEmpty, singletonIndex } from './bitset';

export interface AsciiDomainCell {
  readonly domain: DomainMask;
}

/** Stable row-major debug view: ! empty, ? unresolved, symbol singleton. */
export function renderDomainAscii(
  width: number,
  height: number,
  cells: readonly AsciiDomainCell[],
  symbols: readonly string[],
): string {
  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0 ||
    cells.length !== width * height
  ) {
    throw new RangeError('ASCII dimensions must match the cell count');
  }
  for (const symbol of symbols) {
    if ([...symbol].length !== 1 || symbol === '?' || symbol === '!') {
      throw new RangeError(
        'ASCII symbols must be one character and not ? or !',
      );
    }
  }

  let output = '';
  for (let cellId = 0; cellId < cells.length; cellId += 1) {
    const cell = cells[cellId];
    if (cell === undefined) {
      throw new RangeError(`missing ASCII cell ${cellId}`);
    }

    if (isEmpty(cell.domain)) {
      output += '!';
    } else {
      const variant = singletonIndex(cell.domain);
      if (variant === null) {
        output += '?';
      } else {
        const symbol = symbols[variant];
        if (symbol === undefined) {
          throw new RangeError(`missing ASCII symbol for variant ${variant}`);
        }
        output += symbol;
      }
    }

    if ((cellId + 1) % width === 0 && cellId + 1 < cells.length) {
      output += '\n';
    }
  }
  return output;
}
