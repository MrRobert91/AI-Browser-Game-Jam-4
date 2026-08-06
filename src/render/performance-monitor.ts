export const PERFORMANCE_DEGRADATION_ORDER = [
  'DPR',
  'SSAO',
  'SHADOWS_FOG',
  'SUPERPOSITION_CANDIDATES',
  'PARTICLES',
  'AGGRESSIVE_LOD',
  'SIMULTANEOUS_COLLAPSES',
] as const;

export interface RenderMetrics {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly gpuTextureMegabytes: number;
  readonly compressedDownloadMegabytes: number;
  readonly timeToInteractiveSeconds: number;
}

export interface PerformanceReport extends RenderMetrics {
  readonly workerP95Ms: number;
  readonly mainThreadP95Ms: number;
  readonly estimatedFps: number;
  readonly degradationOrder: typeof PERFORMANCE_DEGRADATION_ORDER;
  readonly withinHardLimits: boolean;
  readonly meetsTargets: boolean;
}

function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
  ]!;
}

export class PerformanceBudgetMonitor {
  private readonly workerSamples: number[] = [];
  private readonly frameSamples: number[] = [];

  sampleWorker(milliseconds: number): void {
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      this.workerSamples.push(milliseconds);
    }
  }

  sampleFrame(milliseconds: number): void {
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      this.frameSamples.push(milliseconds);
    }
  }

  report(metrics: RenderMetrics): PerformanceReport {
    const workerP95Ms = percentile95(this.workerSamples);
    const mainThreadP95Ms = percentile95(this.frameSamples);
    const estimatedFps =
      mainThreadP95Ms === 0 ? 60 : Math.min(60, 1000 / mainThreadP95Ms);
    return {
      ...metrics,
      workerP95Ms,
      mainThreadP95Ms,
      estimatedFps,
      degradationOrder: PERFORMANCE_DEGRADATION_ORDER,
      withinHardLimits:
        workerP95Ms < 8 &&
        mainThreadP95Ms < 22 &&
        metrics.drawCalls < 260 &&
        metrics.triangles < 2_000_000 &&
        metrics.gpuTextureMegabytes < 500 &&
        metrics.compressedDownloadMegabytes < 55 &&
        metrics.timeToInteractiveSeconds < 15,
      meetsTargets:
        workerP95Ms < 4 &&
        mainThreadP95Ms < 12 &&
        metrics.drawCalls < 180 &&
        metrics.triangles < 1_200_000 &&
        metrics.gpuTextureMegabytes < 350 &&
        metrics.compressedDownloadMegabytes < 35 &&
        metrics.timeToInteractiveSeconds < 8,
    };
  }
}
