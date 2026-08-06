import { planSeedAnchors } from '../gameplay/anchors';
import {
  createSyntheticReplay,
  playReplayHeadless,
  type SyntheticRoute,
} from '../dev/replay';

export interface SimulationCampaignOptions {
  readonly seeds: number;
  readonly ticks: number;
  readonly fullSolverSeeds?: number;
}

export interface SimulationCampaignReport {
  readonly seeds: number;
  readonly fullSolverSeeds: number;
  readonly ticksPerFullReplay: number;
  readonly routes: readonly SyntheticRoute[];
  readonly emptyDomains: number;
  readonly commitsBeyondRadius: number;
  readonly deterministicHashMismatches: number;
  readonly fallbackRate: number;
  readonly quantumVoidDebugCount: number;
  readonly unreachableSeeds: number;
  readonly collapseCount: number;
}

const ROUTES: readonly SyntheticRoute[] = [
  'straight',
  'spiral',
  'zigzag',
  'still',
  'random',
];

export function runSimulationCampaign(
  options: SimulationCampaignOptions,
): SimulationCampaignReport {
  const fullSolverSeeds = Math.min(
    options.seeds,
    options.fullSolverSeeds ?? options.seeds,
  );
  let emptyDomains = 0;
  let commitsBeyondRadius = 0;
  let deterministicHashMismatches = 0;
  let fallbackCount = 0;
  let quantumVoidDebugCount = 0;
  let unreachableSeeds = 0;
  let collapseCount = 0;

  for (let index = 0; index < options.seeds; index += 1) {
    const seed = (0xa91f42c0 + Math.imul(index, 0x9e3779b1)) >>> 0;
    const plan = planSeedAnchors(seed);
    if (
      plan.anchors.length !== 4 ||
      plan.anchors.some(
        (anchor) =>
          anchor.reservedCellIds.length < 9 ||
          anchor.corridorCellIds.length === 0,
      )
    ) {
      unreachableSeeds += 1;
    }
    if (index >= fullSolverSeeds) continue;
    const route = ROUTES[index % ROUTES.length]!;
    const replay = createSyntheticReplay(seed, options.ticks, route);
    const first = playReplayHeadless(seed, replay);
    const second = playReplayHeadless(seed, replay);
    if (first.hash !== second.hash) deterministicHashMismatches += 1;
    if (first.maximumCommitDistanceMeters > 10.01) commitsBeyondRadius += 1;
    emptyDomains += first.emptyDomains;
    fallbackCount += first.fallbackCount;
    quantumVoidDebugCount += first.quantumVoidDebugCount;
    collapseCount += first.collapseCount;
  }

  return {
    seeds: options.seeds,
    fullSolverSeeds,
    ticksPerFullReplay: options.ticks,
    routes: ROUTES,
    emptyDomains,
    commitsBeyondRadius,
    deterministicHashMismatches,
    fallbackRate: collapseCount === 0 ? 0 : fallbackCount / collapseCount,
    quantumVoidDebugCount,
    unreachableSeeds,
    collapseCount,
  };
}

export function campaignPasses(report: SimulationCampaignReport): boolean {
  return (
    report.emptyDomains === 0 &&
    report.commitsBeyondRadius === 0 &&
    report.deterministicHashMismatches === 0 &&
    report.fallbackRate < 0.001 &&
    report.quantumVoidDebugCount === 0 &&
    report.unreachableSeeds === 0
  );
}
