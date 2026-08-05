import type {
  ObservationInput,
  ResetInput,
  UnlockPackInput,
  VisibleCellObservation,
  WorkerOutput,
} from '../contracts/messages';
import { isWorkerOutput } from '../contracts/runtime-validation';
import type { UnlockablePackId } from '../contracts/tiles';
import type { WorldVector3 } from '../contracts/world';

export interface ObservationTickData {
  readonly playerPosition: WorldVector3;
  readonly cameraForward: WorldVector3;
  readonly visibleCells: readonly VisibleCellObservation[];
}

export interface SolverWorkerClientHandlers {
  readonly onOutput: (output: WorkerOutput) => void;
  readonly onProtocolError: (message: string) => void;
}

export class SolverWorkerClient {
  readonly #handlers: SolverWorkerClientHandlers;
  readonly #worker: Worker;
  #nextTick = 1;

  constructor(handlers: SolverWorkerClientHandlers) {
    this.#handlers = handlers;
    this.#worker = new Worker(new URL('../wfc/worker.ts', import.meta.url), {
      name: 'la-ultima-observacion-solver',
      type: 'module',
    });

    this.#worker.addEventListener('message', this.#handleMessage);
    this.#worker.addEventListener('error', this.#handleError);
  }

  sendObservation(data: ObservationTickData): number {
    const tick = this.#nextTick;
    this.#nextTick += 1;

    const message: ObservationInput = {
      type: 'OBSERVATION_TICK',
      tick,
      playerPosition: data.playerPosition,
      cameraForward: data.cameraForward,
      visibleCells: data.visibleCells,
    };

    this.#worker.postMessage(message);
    return tick;
  }

  sendUnlockPack(packId: UnlockablePackId): number {
    const tick = this.#nextTick;
    this.#nextTick += 1;
    const message: UnlockPackInput = { type: 'UNLOCK_PACK', packId, tick };
    this.#worker.postMessage(message);
    return tick;
  }

  reset(worldSeed: number): number {
    const tick = this.#nextTick;
    this.#nextTick += 1;
    const message: ResetInput = { type: 'RESET', worldSeed, tick };
    this.#worker.postMessage(message);
    return tick;
  }

  dispose(): void {
    this.#worker.removeEventListener('message', this.#handleMessage);
    this.#worker.removeEventListener('error', this.#handleError);
    this.#worker.terminate();
  }

  readonly #handleMessage = (event: MessageEvent<unknown>): void => {
    if (!isWorkerOutput(event.data)) {
      this.#handlers.onProtocolError(
        'El worker devolvió un mensaje fuera de contrato.',
      );
      return;
    }

    this.#handlers.onOutput(event.data);
  };

  readonly #handleError = (event: ErrorEvent): void => {
    this.#handlers.onProtocolError(
      event.message || 'El worker no pudo iniciar.',
    );
  };
}
