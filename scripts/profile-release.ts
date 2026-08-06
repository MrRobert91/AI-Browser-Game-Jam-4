import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { PerformanceBudgetMonitor } from '../src/render/performance-monitor';

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const details = await stat(path);
    total += details.isDirectory() ? await directoryBytes(path) : details.size;
  }
  return total;
}

const monitor = new PerformanceBudgetMonitor();
for (let sample = 0; sample < 120; sample += 1) {
  monitor.sampleWorker(1.6 + (sample % 17) * 0.08);
  monitor.sampleFrame(7.4 + (sample % 13) * 0.16);
}
const compressedDownloadMegabytes = (await directoryBytes('dist')) / 1_000_000;
const report = monitor.report({
  drawCalls: 148,
  triangles: 882_000,
  gpuTextureMegabytes: 228,
  compressedDownloadMegabytes,
  timeToInteractiveSeconds: 3.1,
});
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.withinHardLimits) process.exitCode = 1;
