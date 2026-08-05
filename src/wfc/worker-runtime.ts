import type { WorkerOutput } from '../contracts/messages';
import {
  isWorkerInput,
  readMessageTick,
} from '../contracts/runtime-validation';
import { SolverCore, solverWarning } from './solver-core';

export class SolverWorkerRuntime {
  #core: SolverCore | null = null;

  handle(value: unknown): readonly WorkerOutput[] {
    if (!isWorkerInput(value)) {
      return [
        solverWarning(
          readMessageTick(value),
          'INVALID_INPUT',
          'Rejected invalid worker input.',
        ),
      ];
    }

    switch (value.type) {
      case 'OBSERVATION_TICK': {
        this.#core ??= new SolverCore(0);
        const outputs = this.#core.simulationTick(value);
        return outputs.length > 0
          ? outputs
          : [
              solverWarning(
                value.tick,
                'ECHO_ONLY',
                `Observation tick ${value.tick} completed with no emitted events.`,
              ),
            ];
      }
      case 'UNLOCK_PACK':
        this.#core ??= new SolverCore(0);
        this.#core.unlockPack(value.packId);
        return [
          solverWarning(
            value.tick,
            'ECHO_ONLY',
            `Unlock ${value.packId} applied to future chunks.`,
          ),
        ];
      case 'RESET':
        this.#core = new SolverCore(value.worldSeed);
        return [
          solverWarning(
            value.tick,
            'ECHO_ONLY',
            `Reset for seed ${value.worldSeed} completed.`,
          ),
        ];
    }
  }
}

const defaultRuntime = new SolverWorkerRuntime();

export function handleWorkerInput(value: unknown): WorkerOutput {
  return (
    defaultRuntime.handle(value)[0] ??
    solverWarning(null, 'INVALID_INPUT', 'Worker runtime emitted no output.')
  );
}

export function handleWorkerInputBatch(
  value: unknown,
): readonly WorkerOutput[] {
  return defaultRuntime.handle(value);
}
