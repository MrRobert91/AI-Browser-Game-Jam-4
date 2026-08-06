import { describe, expect, it } from 'vitest';

import { evaluateBalanceSessions } from '../../src/gameplay/balance';
import {
  PERFORMANCE_DEGRADATION_ORDER,
  PerformanceBudgetMonitor,
} from '../../src/render/performance-monitor';

describe('release budgets', () => {
  it('reports p95 and preserves the normative degradation order', () => {
    const monitor = new PerformanceBudgetMonitor();
    for (let index = 0; index < 100; index += 1) {
      monitor.sampleWorker(2 + (index % 10) * 0.1);
      monitor.sampleFrame(8 + (index % 10) * 0.2);
    }
    const report = monitor.report({
      drawCalls: 142,
      triangles: 840_000,
      gpuTextureMegabytes: 210,
      compressedDownloadMegabytes: 4,
      timeToInteractiveSeconds: 2.8,
    });
    expect(report.meetsTargets).toBe(true);
    expect(report.degradationOrder).toEqual(PERFORMANCE_DEGRADATION_ORDER);
  });

  it('accepts complete runs in the 9:30–11:00 balance window', () => {
    const report = evaluateBalanceSessions([
      {
        durationSeconds: 600,
        unlockSeconds: [130, 235, 405],
        fixedCells: 170,
        maxDistanceMeters: 47,
        deaths: 1,
        playerUnderstoodEnding: true,
      },
      {
        durationSeconds: 612,
        unlockSeconds: [125, 230, 398],
        fixedCells: 155,
        maxDistanceMeters: 43,
        deaths: 2,
        playerUnderstoodEnding: true,
      },
    ]);
    expect(report.normalRunsInWindow).toBe(true);
    expect(report.unlocksVisiblySpaced).toBe(true);
    expect(report.endingInterpretationRate).toBe(1);
  });
});
