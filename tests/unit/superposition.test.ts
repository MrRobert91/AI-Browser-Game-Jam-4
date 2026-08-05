import { describe, expect, it } from 'vitest';

import {
  MAX_VISIBLE_SUPERPOSITION_PROXIES,
  SUPERPOSITION_MAX_INTERVAL_MS,
  SUPERPOSITION_MIN_INTERVAL_MS,
  SuperpositionRenderer,
  selectSuperpositionProxy,
  type SuperpositionCell,
} from '../../src/render/superposition';

const cell: SuperpositionCell = {
  cellId: 42,
  center: [1, 0, 1],
  observationCharge: 0,
  candidates: [
    { tileId: 3, family: 'mineral', weight: 2 },
    { tileId: 1, family: 'ground', weight: 9 },
    { tileId: 2, family: 'organic', weight: 6 },
    { tileId: 4, family: 'structure', weight: 1 },
  ],
};

describe('superposition proxy selection', () => {
  it('alternates only the three highest weighted possibilities in 160-260 ms', () => {
    const first = selectSuperpositionProxy(cell, 0, 'high');
    const next = selectSuperpositionProxy(cell, first.intervalMs, 'high');

    expect(first.alternativesRemaining).toBe(3);
    expect(first.intervalMs).toBeGreaterThanOrEqual(
      SUPERPOSITION_MIN_INTERVAL_MS,
    );
    expect(first.intervalMs).toBeLessThanOrEqual(SUPERPOSITION_MAX_INTERVAL_MS);
    expect([1, 2, 3]).toContain(first.candidate?.tileId);
    expect(next.candidate?.tileId).not.toBe(first.candidate?.tileId);
  });

  it('removes alternatives as observation charge rises and uses two in low quality', () => {
    const low = selectSuperpositionProxy(cell, 0, 'low');
    const charged = selectSuperpositionProxy(
      { ...cell, observationCharge: 0.8 },
      0,
      'high',
    );

    expect(low.alternativesRemaining).toBe(2);
    expect(charged.alternativesRemaining).toBe(1);
    expect(charged.opacity).toBeLessThan(low.opacity);
  });

  it('caps shared instanced proxies globally at 120', () => {
    const renderer = new SuperpositionRenderer('medium');
    const cells = Array.from(
      { length: MAX_VISIBLE_SUPERPOSITION_PROXIES + 25 },
      (_, index): SuperpositionCell => ({ ...cell, cellId: index }),
    );

    expect(renderer.update(cells, 0)).toBe(MAX_VISIBLE_SUPERPOSITION_PROXIES);
    renderer.dispose();
  });
});
