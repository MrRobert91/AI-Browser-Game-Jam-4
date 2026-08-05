import { GameLoop } from './game-loop';
import { ObservableWorldBridge } from './observable-world-bridge';
import { SolverWorkerClient } from './solver-worker-client';
import {
  isGrammarViewerMode,
  renderGrammarViewer,
} from '../dev/grammar-viewer';
import { createFirstPersonCamera } from '../player/camera';
import { PlayerInput } from '../player/input';
import {
  createPlayerPhysicsRuntime,
  type PlayerPhysicsRuntime,
} from '../player/physics';
import { GameRenderer } from '../render/renderer';
import { SuperpositionRenderer } from '../render/superposition';
import { ObservationReticle } from '../ui/observation-reticle';
import { createOriginDetailField } from '../world/origin-details';
import { cellCenterToWorld } from '../world/world-state';

const SHELL_MARKUP = `
  <main class="observation-shell" aria-labelledby="game-title">
    <div class="field" aria-hidden="true">
      <div class="game-viewport" data-game-viewport></div>
      <div class="field__horizon"></div>
      <div class="field__orb field__orb--one"></div>
      <div class="field__orb field__orb--two"></div>
      <div class="field__orb field__orb--three"></div>
      <div class="field__grid"></div>
    </div>

    <header class="system-bar">
      <p>ESTACIÓN // VENTANA DE OBSERVACIÓN</p>
      <p class="system-bar__state" data-system-state>EN ESPERA</p>
    </header>

    <section class="intro-panel">
      <p class="intro-panel__eyebrow">LA MEDIDA // REGISTRO 01</p>
      <h1 id="game-title">La Última<br /><span>Observación</span></h1>
      <p class="intro-panel__statement">
        <strong>Mira.</strong> Lo que permanezca bajo tu atención tendrá derecho a existir.
      </p>
      <button class="observation-button" type="button" data-observation-button>
        <span>Calibrar mirada</span>
        <span aria-hidden="true">↗</span>
      </button>
      <p class="intro-panel__hint" data-shell-status role="status" aria-live="polite">
        Instrumento local · sin conexión de runtime
      </p>
    </section>

    <aside class="possibility-readout" aria-label="Estado de posibilidades">
      <p>POSIBILIDADES</p>
      <ol>
        <li><span>01</span><i></i><strong>SUPERPUESTA</strong></li>
        <li><span>02</span><i></i><strong>INDETERMINADA</strong></li>
        <li><span>03</span><i></i><strong>EN ESPERA</strong></li>
      </ol>
    </aside>

    <footer class="shell-footer">
      <p>WP0 // SYSTEM SHELL</p>
      <p data-worker-state>CONTRATO // INICIALIZANDO</p>
      <p>BUILD <span>LOCAL</span></p>
    </footer>
  </main>
`;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message;
  return 'Error desconocido durante el arranque.';
}

export function renderBootstrapError(root: HTMLElement, error: unknown): void {
  const message = toErrorMessage(error);
  root.innerHTML = `
    <main class="error-shell" role="alert">
      <p class="error-shell__code">OBSERVACIÓN INTERRUMPIDA</p>
      <h1>El instrumento no pudo iniciar.</h1>
      <p data-error-message></p>
      <button type="button" data-retry-button>Reintentar</button>
    </main>
  `;

  const errorMessage = root.querySelector<HTMLElement>('[data-error-message]');
  if (errorMessage) errorMessage.textContent = message;

  root
    .querySelector<HTMLButtonElement>('[data-retry-button]')
    ?.addEventListener('click', () => {
      window.location.reload();
    });
}

export function bootstrap(root: HTMLElement): () => void {
  if (isGrammarViewerMode()) return renderGrammarViewer(root);
  root.innerHTML = SHELL_MARKUP;

  const shell = root.querySelector<HTMLElement>('.observation-shell');
  const observationButton = root.querySelector<HTMLButtonElement>(
    '[data-observation-button]',
  );
  const systemState = root.querySelector<HTMLElement>('[data-system-state]');
  const shellStatus = root.querySelector<HTMLElement>('[data-shell-status]');
  const workerState = root.querySelector<HTMLElement>('[data-worker-state]');
  const viewport = root.querySelector<HTMLElement>('[data-game-viewport]');

  if (
    !shell ||
    !observationButton ||
    !systemState ||
    !shellStatus ||
    !workerState ||
    !viewport
  ) {
    throw new Error('La interfaz de observación está incompleta.');
  }

  const abortController = new AbortController();
  const camera = createFirstPersonCamera(
    Math.max(1, viewport.clientWidth),
    Math.max(1, viewport.clientHeight),
  );
  const gameRenderer = new GameRenderer({ container: viewport, camera });
  const originDetails = createOriginDetailField(gameRenderer.scene);
  const superposition = new SuperpositionRenderer(
    gameRenderer.quality.preset === 'low' ? 'low' : 'medium',
  );
  gameRenderer.scene.add(superposition.root);
  const reticle = new ObservationReticle(shell);
  const playerInput = new PlayerInput(shell, {
    onPauseChange: (paused) => {
      shell.dataset.paused = String(paused);
      if (shell.dataset.calibrated === 'true') {
        systemState.textContent = paused ? 'PAUSA' : 'OBSERVANDO';
      }
    },
  });
  let playerPhysics: PlayerPhysicsRuntime | null = null;
  let disposed = false;
  void createPlayerPhysicsRuntime(camera, playerInput)
    .then((runtime) => {
      if (disposed) runtime.dispose();
      else {
        playerPhysics = runtime;
        shell.dataset.physics = 'ready';
      }
    })
    .catch((error: unknown) => {
      shell.dataset.physics = 'error';
      workerState.textContent = 'FÍSICA // ERROR';
      workerState.dataset.contractState = 'error';
      console.error('Rapier no pudo iniciar.', error);
    });
  let observableWorld: ObservableWorldBridge | null = null;
  const solverWorker = new SolverWorkerClient({
    onOutput: (output) => {
      observableWorld?.handleWorkerOutput(output, performance.now());
      if (
        output.type === 'SOLVER_WARNING' &&
        output.code === 'ECHO_ONLY' &&
        output.tick !== null
      ) {
        workerState.textContent = `CONTRATO #${String(output.tick).padStart(6, '0')} // ECO`;
        workerState.dataset.contractState = 'ready';
      }
    },
    onProtocolError: (message) => {
      workerState.textContent = 'CONTRATO // ERROR';
      workerState.dataset.contractState = 'error';
      console.error(message);
    },
  });
  observableWorld = new ObservableWorldBridge({
    solver: solverWorker,
    getPlayerPosition: () => [camera.position.x, camera.position.y, camera.position.z],
    onWarning: (warning) => {
      if (warning.code !== 'ECHO_ONLY') {
        workerState.textContent = `SOLVER // ${warning.code}`;
      }
    },
  });
  const resetTick = observableWorld.reset(0xa91f42c0);
  workerState.textContent = `CONTRATO #${String(resetTick).padStart(6, '0')} // SEED`;

  const gameLoop = new GameLoop(({ deltaSeconds, elapsedSeconds }) => {
    shell.style.setProperty('--observation-phase', `${elapsedSeconds % 8}`);
    playerPhysics?.controller.update(deltaSeconds);

    const playerPosition = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ] as const;
    const forwardVector = camera.getWorldDirection(camera.up.clone());
    const nearbyCellIds = observableWorld!.getNearbyCellIds(playerPosition);
    let maximumCharge = 0;
    if (shell.dataset.calibrated === 'true') {
      observableWorld!.update(
        {
          deltaSeconds,
          playerPosition,
          cameraForward: [forwardVector.x, forwardVector.y, forwardVector.z],
          nearbyCellIds,
        },
        elapsedSeconds * 1_000,
      );
    }

    const superposedCells = nearbyCellIds.flatMap((cellId) => {
      const cell = observableWorld!.worldState.getCell(cellId);
      maximumCharge = Math.max(maximumCharge, cell.observationCharge);
      if (cell.phase === 'FIXED' || cell.phase === 'COLLAPSING') return [];
      return [
        {
          cellId,
          center: cellCenterToWorld(cellId, 0),
          observationCharge: cell.observationCharge,
          candidates: [
            { tileId: 0, family: 'ground' as const, weight: 14 },
            { tileId: 1, family: 'organic' as const, weight: 9 },
            { tileId: 2, family: 'mineral' as const, weight: 5 },
          ],
        },
      ];
    });
    reticle.setCharge(maximumCharge);
    superposition.update(superposedCells, elapsedSeconds * 1_000);
    gameRenderer.render();
  });

  observationButton.addEventListener(
    'click',
    () => {
      shell.dataset.calibrated = 'true';
      systemState.textContent = 'CALIBRADA';
      shellStatus.textContent =
        'Shell lista · el primer colapso iniciará el reloj';
      observationButton.disabled = true;
      observationButton
        .querySelector('span')
        ?.replaceChildren('Mirada calibrada');
      playerInput.setEnabled(true);
      void playerInput.resume();
    },
    { signal: abortController.signal },
  );

  const handleVisibilityChange = (): void => {
    if (document.hidden) gameLoop.stop();
    else gameLoop.start();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange, {
    signal: abortController.signal,
  });
  window.addEventListener('resize', () => gameRenderer.resize(), {
    signal: abortController.signal,
  });

  gameLoop.start();

  return () => {
    disposed = true;
    abortController.abort();
    gameLoop.stop();
    solverWorker.dispose();
    reticle.destroy();
    superposition.dispose();
    originDetails.dispose();
    gameRenderer.dispose();
    playerInput.dispose();
    playerPhysics?.dispose();
  };
}
