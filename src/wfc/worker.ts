import type { WorkerOutput } from '../contracts/messages';
import { getWorkerOutputTransferables } from '../contracts/transferables';
import { handleWorkerInput } from './worker-runtime';

interface SolverWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
  postMessage(message: WorkerOutput, transfer: Transferable[]): void;
}

const workerScope = self as unknown as SolverWorkerScope;

workerScope.addEventListener('message', (event) => {
  const output = handleWorkerInput(event.data);
  workerScope.postMessage(output, getWorkerOutputTransferables(output));
});
