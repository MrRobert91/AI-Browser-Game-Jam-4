import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  consciousnessBombProbability,
  MAX_OBSERVATION_DISTANCE_METERS,
  SolverCore,
  runHeadlessSimulation,
} from '../../src/wfc/solver-core';

const playerPosition = [64, 1.7, 64] as const;
const targetCellId = 2082;
const targetDistance = Math.hypot(69 - 64, 65 - 64);

function observation(
  tick: number,
  cellId = targetCellId,
  distance = targetDistance,
) {
  return {
    type: 'OBSERVATION_TICK' as const,
    tick,
    playerPosition,
    cameraForward: [0, 0, -1] as const,
    elapsedRunSeconds: tick * 0.1,
    visibleCells: [{ cellId, distance, alignment: 1, lineOfSight: true }],
  };
}

describe('incremental SolverCore', () => {
  it('uses the deterministic stepped 1-10 percent bomb curve', () => {
    expect([0, 60, 120, 540, 1_200].map(consciousnessBombProbability)).toEqual([
      0.01, 0.02, 0.03, 0.1, 0.1,
    ]);
  });

  it('fills one visible four-neighbour hole as a forced consequence', () => {
    const core = new SolverCore(99, { now: () => 0 });
    const hole = 30 * 64 + 30;
    for (const neighbor of [hole - 64, hole + 1, hole + 64, hole - 1]) {
      core.primeFixedCell(neighbor);
    }
    const trigger = hole + 2;
    const outputs = [];
    for (let tick = 1; tick <= 20; tick += 1) {
      outputs.push(
        ...core.simulationTick({
          type: 'OBSERVATION_TICK',
          tick,
          playerPosition: [61, 1.7, 65],
          cameraForward: [0, 0, -1],
          elapsedRunSeconds: tick * 0.1,
          visibleCells: [
            { cellId: trigger, distance: 4, alignment: 1, lineOfSight: true },
            { cellId: hole, distance: 2, alignment: 0, lineOfSight: true },
          ],
        }),
      );
    }
    expect(
      outputs.some(
        (output) => output.type === 'COLLAPSE' && output.cellId === hole,
      ),
    ).toBe(true);
  });

  it('fractures fixed cells at 30 m, preserves protected cells and is idempotent', () => {
    const core = new SolverCore(1);
    const center = 20 * 64 + 20;
    const inside = center + 15;
    const outside = center + 16;
    const protectedCell = center + 1;
    for (const cellId of [center, inside, outside, protectedCell]) {
      core.primeFixedCell(cellId);
    }
    const request = {
      type: 'FRACTURE_REGION' as const,
      tick: 4,
      centerCellId: center,
      radiusMeters: 30 as const,
      protectedCellIds: [protectedCell],
    };
    const first = core.fractureRegion(request);
    expect(first.cellIds).toContain(center);
    expect(first.cellIds).toContain(inside);
    expect(first.cellIds).not.toContain(outside);
    expect(first.cellIds).not.toContain(protectedCell);
    expect(core.fractureRegion(request).cellIds).toEqual([]);
  });
  it('defers work beyond 4 ms and resumes it on following ticks', () => {
    let time = 0;
    const core = new SolverCore(42, { now: () => time++ });
    const outputs = [];
    for (let tick = 1; tick <= 20; tick += 1) {
      outputs.push(...core.simulationTick(observation(tick)));
    }

    expect(
      outputs.some(
        (output) =>
          output.type === 'SOLVER_WARNING' &&
          output.code === 'BUDGET_EXHAUSTED',
      ),
    ).toBe(true);
    expect(outputs.filter((output) => output.type === 'COLLAPSE')).toHaveLength(
      1,
    );
    expect(core.diagnostics.pendingWork).toBe(0);
  });

  it('commits ahead beyond the old radius but never beyond 20.01 m', () => {
    const core = new SolverCore(7);
    const aheadCellId = 2088;
    const aheadOutputs = [];
    for (let tick = 1; tick <= 80; tick += 1) {
      aheadOutputs.push(
        ...core.simulationTick(observation(tick, aheadCellId, 17)),
      );
    }
    expect(aheadOutputs.some((output) => output.type === 'COLLAPSE')).toBe(
      true,
    );

    const outsideCore = new SolverCore(7);
    const farCellId = 2090;
    const outputs = [];
    for (let tick = 1; tick <= 20; tick += 1) {
      outputs.push(
        ...outsideCore.simulationTick(observation(tick, farCellId, 4)),
      );
    }

    expect(outputs.some((output) => output.type === 'COLLAPSE')).toBe(false);
  });

  it('preserves the cooldown and produces at most one commit per 10 Hz tick', () => {
    const core = new SolverCore(9);
    for (let tick = 1; tick <= 8; tick += 1) {
      const outputs = core.simulationTick({
        ...observation(tick),
        visibleCells: [
          ...observation(tick).visibleCells,
          {
            cellId: 2145,
            distance: targetDistance,
            alignment: 1,
            lineOfSight: true,
          },
        ],
      });
      expect(
        outputs.filter((output) => output.type === 'COLLAPSE').length,
      ).toBeLessThanOrEqual(1);
    }
  });
});

describe('headless solver harness', () => {
  it('runs 100 seeds without empty domains or quantum_void_debug', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const result = runHeadlessSimulation(seed, 48);
      expect(result.emptyDomains).toBe(0);
      expect(result.quantumVoidDebugCount).toBe(0);
      expect(result.maxCommitDistance).toBeLessThanOrEqual(
        MAX_OBSERVATION_DISTANCE_METERS,
      );
    }
  });

  it('keeps solver and worker sources independent from Three.js', async () => {
    const source = await Promise.all([
      readFile('src/wfc/solver-core.ts', 'utf8'),
      readFile('src/wfc/worker.ts', 'utf8'),
      readFile('src/wfc/worker-runtime.ts', 'utf8'),
    ]);
    expect(source.join('\n')).not.toMatch(/from ['"]three['"]/u);
  });
});
