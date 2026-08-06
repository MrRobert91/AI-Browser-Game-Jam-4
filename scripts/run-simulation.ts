import { campaignPasses, runSimulationCampaign } from '../src/qa/simulation';

function argument(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix));
  const parsed = Number(raw?.slice(prefix.length) ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return parsed;
}

const seeds = argument('seeds', 100);
const ticks = argument('ticks', 600);
const fullSolverSeeds = argument('full', Math.min(100, seeds));
const startedAt = performance.now();
const report = runSimulationCampaign({ seeds, ticks, fullSolverSeeds });
const output = {
  ...report,
  elapsedMilliseconds: Math.round(performance.now() - startedAt),
  passed: campaignPasses(report),
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!output.passed) process.exitCode = 1;
