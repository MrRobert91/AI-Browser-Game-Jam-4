import { GameLoop } from './game-loop';
import { ObservableWorldBridge } from './observable-world-bridge';
import { SolverWorkerClient } from './solver-worker-client';
import { Wp5PreviewRuntime } from './wp5-preview-runtime';
import { planSeedAnchors } from '../gameplay/anchors';
import { VerticalSliceDirector } from '../gameplay/vertical-slice';
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
import { Wp5PreviewVisuals } from '../render/wp5-preview-visuals';
import { ObservationReticle } from '../ui/observation-reticle';
import { ProgressionHud } from '../ui/progression-hud';
import { SliceCollapseVisuals } from '../world/collapse-visuals';
import { createOriginDetailField } from '../world/origin-details';
import {
  WorldState,
  cellCenterToWorld,
  cellCoordinatesToId,
  worldPositionToCell,
} from '../world/world-state';

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

    <section class="slice-hud" aria-live="polite">
      <p><span>VENTANA</span><strong data-slice-time>01:30</strong></p>
      <p data-slice-message>Mira para iniciar el registro.</p>
      <p><span>SEED</span><strong>A91F-42C0</strong></p>
    </section>

    <p class="wp5-gate-status" data-wp5-gate-status>
      WP5 PREVIEW · #29 NO-GO · 0/5 TESTERS
    </p>

    <section class="slice-result" data-slice-result hidden>
      <p>REGISTRO DE ATENCIÓN</p>
      <h2>No encontraste este mundo.<br />Lo separaste de todos los demás.</h2>
      <p>Muchos caminos.<br />Solo aquel que miraste<br />recuerda tus pasos.</p>
      <strong>SEED A91F-42C0</strong>
    </section>
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
  const sliceTime = root.querySelector<HTMLElement>('[data-slice-time]');
  const sliceMessage = root.querySelector<HTMLElement>('[data-slice-message]');
  const sliceResult = root.querySelector<HTMLElement>('[data-slice-result]');
  const wp5GateStatus = root.querySelector<HTMLElement>(
    '[data-wp5-gate-status]',
  );

  if (
    !shell ||
    !observationButton ||
    !systemState ||
    !shellStatus ||
    !workerState ||
    !viewport ||
    !sliceTime ||
    !sliceMessage ||
    !sliceResult ||
    !wp5GateStatus
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
  let sliceDirector: VerticalSliceDirector | null = null;
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
  const worldState = new WorldState();
  const fixedVisuals = new SliceCollapseVisuals(gameRenderer.scene, worldState);
  observableWorld = new ObservableWorldBridge({
    solver: solverWorker,
    getPlayerPosition: () => [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ],
    worldState,
    visuals: fixedVisuals,
    onCollapseAccepted: () => sliceDirector?.notifyFirstCollapse(),
    onWarning: (warning) => {
      if (warning.code !== 'ECHO_ONLY') {
        workerState.textContent = `SOLVER // ${warning.code}`;
      }
    },
  });
  const resetTick = observableWorld.reset(0xa91f42c0);
  workerState.textContent = `CONTRATO #${String(resetTick).padStart(6, '0')} // SEED`;

  const search = new URLSearchParams(window.location.search);
  const replayMode = search.get('replay');
  const wp5PreviewEnabled = search.get('wp5') === 'preview';
  const wp5Replay = wp5PreviewEnabled && replayMode === 'wp5';
  const canonicalReplay = replayMode === 'canonical' || wp5Replay;
  const requestedSpeed = Number(search.get('speed') ?? '1');
  const replaySpeed =
    Number.isFinite(requestedSpeed) && requestedSpeed > 0
      ? Math.min(8, requestedSpeed)
      : 1;
  const requestedStart = Number(search.get('start') ?? '0');
  const startAtSeconds =
    search.get('evidence') === '1' && Number.isFinite(requestedStart)
      ? Math.min(89, Math.max(0, requestedStart))
      : 0;
  sliceDirector = new VerticalSliceDirector(
    {
      onWaterUnlock: () => {
        observableWorld!.unlockPack('water');
        sliceMessage.textContent =
          'El agua no estaba ausente. Todavía no era posible.';
        shell.dataset.waterUnlocked = 'true';
      },
      onDeath: () => {
        shell.dataset.playerState = 'death';
        sliceMessage.textContent = 'El mundo recuerda mejor que tú.';
        playerInput.setEnabled(false);
      },
      onRespawn: () => {
        playerPhysics?.controller.respawn();
        shell.dataset.playerState = 'alive';
        sliceMessage.textContent = 'El mundo observado permanece.';
        if (!canonicalReplay) playerInput.setEnabled(true);
      },
      onEnding: () => {
        playerInput.setEnabled(false);
        shell.dataset.ending = 'true';
        superposition.root.visible = false;
        fixedVisuals.setEndingMode(true);
        sliceMessage.textContent = 'No queda tiempo para verlo todo.';
      },
      onComplete: () => {
        sliceResult.hidden = false;
        shell.dataset.complete = 'true';
      },
    },
    { canonicalReplay, startAtSeconds },
  );

  let wp5Preview: Wp5PreviewRuntime | null = null;
  let wp5Visuals: Wp5PreviewVisuals | null = null;
  let progressionHud: ProgressionHud | null = null;
  if (wp5PreviewEnabled) {
    const plan = planSeedAnchors(0xa91f42c0);
    wp5Visuals = new Wp5PreviewVisuals(gameRenderer.scene, plan);
    progressionHud = new ProgressionHud(shell);
    shell.dataset.wp5Preview = 'true';
    wp5Preview = new Wp5PreviewRuntime({
      worldSeed: 0xa91f42c0,
      plan,
      unlockPack: (packId) => observableWorld!.unlockPack(packId),
      visuals: wp5Visuals,
      canonicalAutomation: wp5Replay,
      reducedFlashes: true,
      ensureRespawnGround: () => {
        observableWorld!.collapses.ensureSafeContactGround([2_080], 0);
      },
      isRespawnWalkable: () =>
        observableWorld!.worldState.getCell(2_080).phase === 'FIXED',
      teleportPlayer: () => {
        if (playerPhysics) playerPhysics.controller.respawn();
        else camera.position.set(64, 1.7, 64);
      },
      onMessage: (message) => {
        sliceMessage.textContent = message;
      },
      onClockReward: (seconds) => {
        sliceDirector!.addTime(seconds);
      },
    });
    progressionHud.update(wp5Preview.progression.snapshot());
  }

  const gameLoop = new GameLoop(({ deltaSeconds, elapsedSeconds }) => {
    shell.style.setProperty('--observation-phase', `${elapsedSeconds % 8}`);
    const previousSlice = sliceDirector!.snapshot();
    if (
      !canonicalReplay &&
      wp5Preview?.respawn.snapshot().inputLocked !== true &&
      previousSlice.phase !== 'ENDING' &&
      previousSlice.phase !== 'COMPLETE'
    ) {
      playerPhysics?.controller.update(deltaSeconds);
    }

    if (canonicalReplay && shell.dataset.calibrated === 'true') {
      const replayTime = previousSlice.elapsedSeconds;
      const radius = 3.5 + Math.min(9, replayTime * 0.11);
      const angle = -Math.PI / 2 + replayTime * 0.16;
      camera.position.set(
        64 + Math.cos(angle) * radius,
        1.7,
        64 + Math.sin(angle) * radius,
      );
      camera.lookAt(
        64 + Math.cos(angle + 0.4) * (radius + 4),
        0,
        64 + Math.sin(angle + 0.4) * (radius + 4),
      );
    }

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
      if (
        sliceDirector!.snapshot().phase === 'READY' &&
        nearbyCellIds.some(
          (cellId) =>
            observableWorld!.worldState.getCell(cellId).phase === 'FIXED',
        )
      ) {
        sliceDirector!.notifyFirstCollapse();
        sliceMessage.textContent = 'La mirada está fijando el mundo.';
      }
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
    fixedVisuals.updateFrame(deltaSeconds);

    const playerCoordinates = worldPositionToCell(playerPosition);
    const playerCellId = playerCoordinates
      ? cellCoordinatesToId(playerCoordinates)
      : 2_080;
    const wp5Snapshot = wp5Preview?.update({
      deltaSeconds:
        shell.dataset.calibrated === 'true' ? deltaSeconds * replaySpeed : 0,
      playerPosition,
      cameraForward: [forwardVector.x, forwardVector.y, forwardVector.z],
      playerCellId,
      fixedCells: wp5Replay
        ? Math.max(60, worldState.countFixedCells())
        : worldState.countFixedCells(),
    });
    if (wp5Snapshot && progressionHud) {
      progressionHud.update(wp5Snapshot.progression);
      wp5GateStatus.textContent = `WP5 PREVIEW · #29 NO-GO · ${wp5Snapshot.progression.collectedPacks.length}/4 SEMILLAS · ${wp5Snapshot.uncertainty?.state ?? 'SIN ENEMIGO'}`;
      shell.dataset.respawnPhase = wp5Snapshot.respawn.phase;
    }

    const slice = sliceDirector!.update(
      shell.dataset.calibrated === 'true' &&
        !(wp5Preview?.progression.isClockPaused() ?? false)
        ? deltaSeconds * replaySpeed
        : 0,
    );
    const totalSeconds = Math.ceil(slice.remainingSeconds);
    sliceTime.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
    if (slice.phase === 'OBSERVING' && slice.remainingSeconds <= 30) {
      sliceMessage.textContent =
        'No queda tiempo para verlo todo. Elige qué merece terminar.';
    }

    if (
      !canonicalReplay &&
      !wp5PreviewEnabled &&
      slice.phase === 'OBSERVING' &&
      slice.waterUnlocked
    ) {
      const coordinates = worldPositionToCell(playerPosition);
      if (coordinates) {
        const playerCellId = cellCoordinatesToId(coordinates);
        if (fixedVisuals.isDeepWater(playerCellId)) {
          sliceDirector!.triggerDeath();
        }
      }
    }

    if (slice.phase === 'ENDING') {
      camera.position.y += deltaSeconds * 3.1;
      camera.lookAt(64, 0, 64);
    }
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
    fixedVisuals.dispose();
    wp5Visuals?.dispose();
    progressionHud?.destroy();
    originDetails.dispose();
    gameRenderer.dispose();
    playerInput.dispose();
    playerPhysics?.dispose();
  };
}
