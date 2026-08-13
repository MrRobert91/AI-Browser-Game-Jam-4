import { describe, expect, it } from 'vitest';

import {
  MAX_VISIBLE_SUPERPOSITION_PROXIES,
  SUPERPOSITION_MAX_INTERVAL_MS,
  SUPERPOSITION_MIN_INTERVAL_MS,
  SuperpositionRenderer,
  domainSuperpositionCandidates,
  hasFixedCardinalNeighbor,
  isSuperpositionPhase,
  normalizeCandidatePercentages,
  prioritizeSuperpositionCells,
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
  it('never renders terminal fractured or already materialized cells', () => {
    expect(isSuperpositionPhase('SUPERPOSED')).toBe(true);
    expect(isSuperpositionPhase('DETERMINED')).toBe(true);
    expect(isSuperpositionPhase('UNINITIALIZED')).toBe(true);
    expect(isSuperpositionPhase('COLLAPSING')).toBe(false);
    expect(isSuperpositionPhase('FIXED')).toBe(false);
    expect(isSuperpositionPhase('FRACTURED')).toBe(false);
  });

  it('derives every legal family from real terrain and feature domains', () => {
    const candidates = domainSuperpositionCandidates(
      { lo: 0xffff_ffff, hi: 0x7ff },
      { lo: 0x1f_ffff, hi: 0 },
    );
    expect(new Set(candidates.map((candidate) => candidate.family))).toEqual(
      new Set([
        'empty',
        'ground',
        'water',
        'organic',
        'mineral',
        'structure',
        'hazard',
      ]),
    );
  });
  it('alternates every legal family representative in 160-260 ms', () => {
    const first = selectSuperpositionProxy(cell, 0, 'high');
    const next = selectSuperpositionProxy(cell, first.intervalMs, 'high');

    expect(first.alternativesRemaining).toBe(4);
    expect(first.intervalMs).toBeGreaterThanOrEqual(
      SUPERPOSITION_MIN_INTERVAL_MS,
    );
    expect(first.intervalMs).toBeLessThanOrEqual(SUPERPOSITION_MAX_INTERVAL_MS);
    expect([1, 2, 3, 4]).toContain(first.candidate?.tileId);
    expect(next.candidate?.tileId).not.toBe(first.candidate?.tileId);
  });

  it('removes alternatives as observation charge rises without hiding families by preset', () => {
    const low = selectSuperpositionProxy(cell, 0, 'low');
    const charged = selectSuperpositionProxy(
      { ...cell, observationCharge: 0.8 },
      0,
      'high',
    );

    expect(low.alternativesRemaining).toBe(4);
    expect(charged.alternativesRemaining).toBe(1);
    expect(charged.opacity).toBeLessThan(low.opacity);
  });

  it('caps shared instanced proxies globally while covering the observation disc', () => {
    const renderer = new SuperpositionRenderer('medium');
    const cells = Array.from(
      { length: MAX_VISIBLE_SUPERPOSITION_PROXIES + 25 },
      (_, index): SuperpositionCell => ({ ...cell, cellId: index }),
    );

    expect(renderer.update(cells, 0)).toBe(MAX_VISIBLE_SUPERPOSITION_PROXIES);
    renderer.dispose();
  });

  it('prioritizes every unresolved frontier before interior possibilities', () => {
    const cells: SuperpositionCell[] = [
      { ...cell, cellId: 1, distanceToPlayer: 1 },
      { ...cell, cellId: 2, distanceToPlayer: 8, frontier: true },
      { ...cell, cellId: 3, distanceToPlayer: 3, frontier: true },
    ];
    expect(
      prioritizeSuperpositionCells(cells).map(({ cellId }) => cellId),
    ).toEqual([3, 2, 1]);
    expect(
      hasFixedCardinalNeighbor(65, (neighborId) => neighborId === 64),
    ).toBe(true);
    expect(hasFixedCardinalNeighbor(0, () => false)).toBe(false);
  });

  it('shows deterministic normalized percentages that total exactly 100', () => {
    const percentages = normalizeCandidatePercentages(cell.candidates, 'high');
    expect(
      percentages.map(({ tileId, percentage }) => [tileId, percentage]),
    ).toEqual([
      [1, 50],
      [2, 33],
      [3, 11],
      [4, 6],
    ]);
    expect(
      percentages.reduce((total, candidate) => total + candidate.percentage, 0),
    ).toBe(100);
    expect(normalizeCandidatePercentages(cell.candidates, 'low')).toHaveLength(
      4,
    );
  });
});
