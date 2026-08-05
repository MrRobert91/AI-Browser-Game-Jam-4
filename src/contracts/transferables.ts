import type { WorkerOutput } from './messages';

export function getWorkerOutputTransferables(
  output: WorkerOutput,
): Transferable[] {
  if (output.type !== 'BOUNDARY_UPDATE') return [];

  const transferables = new Set<Transferable>();
  for (const boundary of [
    output.north,
    output.east,
    output.south,
    output.west,
  ]) {
    if (boundary.buffer instanceof ArrayBuffer)
      transferables.add(boundary.buffer);
  }

  return [...transferables];
}
