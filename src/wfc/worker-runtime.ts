import type { SolverWarning, WorkerOutput } from '../contracts/messages';
import { isWorkerInput, readMessageTick } from '../contracts/runtime-validation';

function warning(
  tick: number | null,
  code: SolverWarning['code'],
  message: string,
): SolverWarning {
  return { type: 'SOLVER_WARNING', tick, code, message };
}

export function handleWorkerInput(value: unknown): WorkerOutput {
  if (!isWorkerInput(value)) {
    return warning(readMessageTick(value), 'INVALID_INPUT', 'Rejected invalid worker input.');
  }

  switch (value.type) {
    case 'OBSERVATION_TICK':
      return warning(
        value.tick,
        'ECHO_ONLY',
        `Observation tick ${value.tick} acknowledged with ${value.visibleCells.length} visible cells.`,
      );
    case 'UNLOCK_PACK':
      return warning(value.tick, 'ECHO_ONLY', `Unlock ${value.packId} acknowledged.`);
    case 'RESET':
      return warning(value.tick, 'ECHO_ONLY', `Reset for seed ${value.worldSeed} acknowledged.`);
  }
}
