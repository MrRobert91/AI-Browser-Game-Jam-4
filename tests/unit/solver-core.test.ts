import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
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
    visibleCells: [{ cellId, distance, alignment: 1, lineOfSight: true }],
  };
}

describe('incremental SolverCore', () => {
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

  it('never commits a cell outside the real 10.01 m radius', () => {
    const core = new SolverCore(7);
    const farCellId = 2088;
    const outputs = [];
    for (let tick = 1; tick <= 20; tick += 1) {
      outputs.push(...core.simulationTick(observation(tick, farCellId, 4)));
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
