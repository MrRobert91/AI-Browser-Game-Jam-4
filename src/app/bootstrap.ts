import { GameLoop } from './game-loop';
import { ObservableWorldBridge } from './observable-world-bridge';
import { SolverWorkerClient } from './solver-worker-client';
import { Wp5PreviewRuntime } from './wp5-preview-runtime';
import { AudioDirector } from '../audio/audio-director';
import type { UnlockablePackId } from '../contracts/tiles';
import { planSeedAnchors } from '../gameplay/anchors';
import { CollapsadorRecordDirector } from '../gameplay/collapsador-records';
import { resolveWorldSeed } from '../gameplay/daily-seed';
import {
  closureForSeedCount,
  EndingDirector,
  formatSeed,
  type RunResult,
} from '../gameplay/ending';
import { generateHaiku } from '../gameplay/haiku';
import { AgencyIntroduction } from '../gameplay/introduction';
import { NarrativeDirector, type NarrativeCueId } from '../gameplay/narrative';
import { capturePanoramaPng, LocalPanoramaGallery } from '../gameplay/panorama';
import {
  AttentionPortraitTracker,
  classifyAttentionPortrait,
} from '../gameplay/portrait';
import { RunClock, type RunMode } from '../gameplay/run-clock';
import { DebugOverlay, debugToolsAvailable } from '../dev/debug-overlay';
import {
  isGrammarViewerMode,
  renderGrammarViewer,
} from '../dev/grammar-viewer';
import { ReplayRecorder } from '../dev/replay';
import { createFirstPersonCamera } from '../player/camera';
import { PlayerInput } from '../player/input';
import {
  createPlayerPhysicsRuntime,
  type PlayerPhysicsRuntime,
} from '../player/physics';
import { GameRenderer } from '../render/renderer';
import { FinalArtDirector } from '../render/final-art-director';
import { SuperpositionRenderer } from '../render/superposition';
import { Wp5PreviewVisuals } from '../render/wp5-preview-visuals';
import { ObservationReticle } from '../ui/observation-reticle';
import { PossibilityProbabilities } from '../ui/possibility-probabilities';
import { GameHud } from '../ui/hud';
import { loadGameSettings, PauseMenu, type GameSettings } from '../ui/pause';
import { ProgressionHud } from '../ui/progression-hud';
import { ResultsPanel } from '../ui/results';
import { uncertaintyStatusText } from '../ui/uncertainty-status';
import { SliceCollapseVisuals } from '../world/collapse-visuals';
import { createOriginDetailField } from '../world/origin-details';
import { createWorldBoundaryVisual } from '../world/world-boundary';
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
      <p class="intro-panel__eyebrow" data-intro-eyebrow>AGENCIA // CÁMARA DE SILENCIO 7-C</p>
      <h1 id="game-title">La Última<br /><span>Observación</span></h1>
      <p class="intro-panel__statement" data-intro-copy aria-live="polite">
        Condensado de Posibilidad estable. Se ha asignado un cuerpo de campo al Colapsador remoto.
      </p>
      <div class="intro-panel__actions">
        <button class="observation-button" type="button" data-observation-button>
          <span>Aceptar y calibrar</span>
          <span aria-hidden="true">↗</span>
        </button>
        <button class="intro-panel__skip" type="button" data-intro-skip>
          Omitir introducción y calibrar
        </button>
        <a class="intro-panel__daily" href="?daily=1" data-seed-mode-link>
          Observación diaria UTC
        </a>
      </div>
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
      <p>WP8 // RELEASE CANDIDATE</p>
      <p data-worker-state>CONTRATO // INICIALIZANDO</p>
      <p>BUILD <span>LOCAL</span></p>
    </footer>

    <section class="slice-hud" aria-live="polite">
      <p><span>VENTANA</span><strong data-slice-time>10:00</strong></p>
      <p data-slice-message>Mira para iniciar el registro.</p>
      <p><span data-seed-mode-label>SEED</span><strong data-seed-label>A91F-42C0</strong></p>
    </section>

    <p class="wp5-gate-status" data-wp5-gate-status>
      WP6 · PRESENTACIÓN LOCAL
    </p>

    <p class="uncertainty-status" data-uncertainty-status role="status" hidden></p>

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
  const introSkip = root.querySelector<HTMLButtonElement>('[data-intro-skip]');
  const seedModeLink = root.querySelector<HTMLAnchorElement>(
    '[data-seed-mode-link]',
  );
  const introEyebrow = root.querySelector<HTMLElement>('[data-intro-eyebrow]');
  const introCopy = root.querySelector<HTMLElement>('[data-intro-copy]');
  const systemState = root.querySelector<HTMLElement>('[data-system-state]');
  const shellStatus = root.querySelector<HTMLElement>('[data-shell-status]');
  const workerState = root.querySelector<HTMLElement>('[data-worker-state]');
  const viewport = root.querySelector<HTMLElement>('[data-game-viewport]');
  const sliceTime = root.querySelector<HTMLElement>('[data-slice-time]');
  const sliceMessage = root.querySelector<HTMLElement>('[data-slice-message]');
  const sliceResult = root.querySelector<HTMLElement>('[data-slice-result]');
  const seedModeLabel = root.querySelector<HTMLElement>(
    '[data-seed-mode-label]',
  );
  const seedValueLabel = root.querySelector<HTMLElement>('[data-seed-label]');
  const wp5GateStatus = root.querySelector<HTMLElement>(
    '[data-wp5-gate-status]',
  );
  const uncertaintyStatus = root.querySelector<HTMLElement>(
    '[data-uncertainty-status]',
  );

  if (
    !shell ||
    !observationButton ||
    !introSkip ||
    !seedModeLink ||
    !introEyebrow ||
    !introCopy ||
    !systemState ||
    !shellStatus ||
    !workerState ||
    !viewport ||
    !sliceTime ||
    !sliceMessage ||
    !sliceResult ||
    !seedModeLabel ||
    !seedValueLabel ||
    !wp5GateStatus ||
    !uncertaintyStatus
  ) {
    throw new Error('La interfaz de observación está incompleta.');
  }

  const abortController = new AbortController();
  const introduction = new AgencyIntroduction();
  const renderIntroduction = (): void => {
    introEyebrow.textContent = introduction.current.eyebrow;
    introCopy.textContent = introduction.current.text;
    shell.dataset.introStep = introduction.current.id;
    shell.dataset.introComplete = String(introduction.complete);
    shell.dataset.introSkipped = String(introduction.wasSkipped);
  };
  renderIntroduction();
  const introductionTimer = window.setInterval(() => {
    introduction.advance(8_000);
    renderIntroduction();
    if (introduction.complete) window.clearInterval(introductionTimer);
  }, 8_000);
  const settings = loadGameSettings();
  const search = new URLSearchParams(window.location.search);
  const requestedMode = search.get('mode');
  const runMode: RunMode =
    requestedMode === 'brief' || requestedMode === 'contemplative'
      ? requestedMode
      : 'standard';
  const seedSelection = resolveWorldSeed(search);
  const worldSeed = seedSelection.worldSeed;
  seedModeLabel.textContent =
    seedSelection.mode === 'daily' ? 'DIARIA UTC' : 'SEED';
  seedValueLabel.textContent = formatSeed(worldSeed);
  shell.dataset.seedMode = seedSelection.mode;
  if (seedSelection.dateKey) shell.dataset.dailyDate = seedSelection.dateKey;
  const alternateSeedUrl = new URL(window.location.href);
  alternateSeedUrl.searchParams.delete('seed');
  alternateSeedUrl.searchParams.delete('replay');
  alternateSeedUrl.searchParams.delete('evidence');
  alternateSeedUrl.searchParams.delete('start');
  if (seedSelection.mode === 'daily') {
    alternateSeedUrl.searchParams.delete('daily');
    seedModeLink.textContent = 'Nueva observación aleatoria';
  } else {
    alternateSeedUrl.searchParams.set('daily', '1');
    seedModeLink.textContent = 'Observación diaria UTC';
  }
  seedModeLink.href = `${alternateSeedUrl.pathname}${alternateSeedUrl.search}`;
  const requestedStart = Number(search.get('start') ?? '0');
  const startAtSeconds =
    search.get('evidence') === '1' && Number.isFinite(requestedStart)
      ? Math.max(0, requestedStart)
      : 0;
  const camera = createFirstPersonCamera(
    Math.max(1, viewport.clientWidth),
    Math.max(1, viewport.clientHeight),
  );
  const gameRenderer = new GameRenderer({
    container: viewport,
    camera,
    quality: settings.quality,
  });
  const finalArt = new FinalArtDirector(
    gameRenderer.scene,
    gameRenderer.quality,
  );
  const audioDirector = new AudioDirector();
  audioDirector.setVolumes(settings.volumes);
  const originDetails = createOriginDetailField(gameRenderer.scene);
  const worldBoundary = createWorldBoundaryVisual();
  gameRenderer.scene.add(worldBoundary.root);
  const superposition = new SuperpositionRenderer(
    gameRenderer.quality.preset === 'low' ? 'low' : 'medium',
  );
  gameRenderer.scene.add(superposition.root);
  const reticle = new ObservationReticle(shell);
  const possibilityProbabilities = new PossibilityProbabilities(shell);
  const hud = new GameHud(shell, { time: sliceTime, message: sliceMessage });
  hud.setSubtitlesEnabled(settings.subtitles);
  hud.setHighContrast(settings.highContrast);
  const narrative = new NarrativeDirector({
    onMessage: (message) => hud.setMessage(message),
    onSubtitle: (message) => hud.showSubtitle(message),
    onAudioCue: (cue) => audioDirector.playNarrativeCue(cue),
  });
  const collapsadorRecords = new CollapsadorRecordDirector({
    onPlay: (record) => {
      const message = `${record.speaker} // ${record.subtitle}`;
      shell.dataset.recordingId = record.id;
      hud.setMessage(message);
      hud.showSubtitle(message);
      audioDirector.playCollapsadorRecord(record);
    },
    onInterrupt: () => {
      delete shell.dataset.recordingId;
    },
  });
  const portraitTracker = new AttentionPortraitTracker();
  const endingDirector = new EndingDirector();
  const evidenceMode =
    new URLSearchParams(window.location.search).get('evidence') === '1';
  let pauseMenu: PauseMenu | null = null;
  let runClock: RunClock | null = null;
  const playerInput = new PlayerInput(shell, {
    keepRunningWithoutPointerLock: evidenceMode,
    onPauseChange: (paused) => {
      runClock?.setPaused('MENU', paused);
      shell.dataset.paused = String(paused);
      if (shell.dataset.calibrated === 'true') {
        audioDirector.setPaused(paused);
        systemState.textContent =
          shell.dataset.playerState === 'death'
            ? 'RECONSTRUYENDO'
            : shell.dataset.ending === 'true'
              ? 'CIERRE'
              : paused
                ? 'PAUSA'
                : 'OBSERVANDO';
        pauseMenu?.setOpen(
          paused &&
            shell.dataset.playerState !== 'death' &&
            shell.dataset.ending !== 'true' &&
            shell.dataset.complete !== 'true',
        );
      }
    },
  });
  const applySettings = (nextSettings: GameSettings): void => {
    playerInput.setSettings({
      mouseSensitivity: nextSettings.mouseSensitivity,
      invertY: nextSettings.invertY,
      headBobEnabled: nextSettings.headBobEnabled,
    });
    gameRenderer.setQuality(nextSettings.quality);
    finalArt.applyQuality(gameRenderer.quality);
    superposition.setQuality(
      gameRenderer.quality.preset === 'low'
        ? 'low'
        : gameRenderer.quality.preset,
    );
    superposition.setHighContrast(nextSettings.highContrast);
    hud.setSubtitlesEnabled(nextSettings.subtitles);
    hud.setHighContrast(nextSettings.highContrast);
    audioDirector.setVolumes(nextSettings.volumes);
    audioDirector.setVoicesEnabled(nextSettings.voicesEnabled);
    shell.dataset.reducedFlashes = String(nextSettings.reducedFlashes);
  };
  pauseMenu = new PauseMenu(shell, settings, {
    onResume: () => void playerInput.resume(),
    onRestart: () => window.location.reload(),
    onSettingsChange: applySettings,
  });
  applySettings(settings);
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
  const debugEvents: string[] = [];
  const replayRecorder = new ReplayRecorder();
  const solverWorker = new SolverWorkerClient({
    onOutput: (output) => {
      debugEvents.push(
        `${output.type} ${'cellId' in output ? output.cellId : ''}`.trim(),
      );
      if (debugEvents.length > 20) debugEvents.shift();
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
  let resultPresented = false;
  runClock = new RunClock(
    {
      onCountdown: (remainingSeconds) => {
        if (remainingSeconds === 30) narrative.play('lastThirtySeconds');
      },
      onEnding: () => {
        shell.dataset.ending = 'true';
        playerInput.setEnabled(false);
        superposition.root.visible = false;
        fixedVisuals.setEndingMode(true);
        narrative.play('lastThirtySeconds');
        endingDirector.start();
      },
    },
    { mode: runMode, startAtSeconds },
  );
  const resultsPanel = new ResultsPanel(
    sliceResult,
    () => window.location.reload(),
    {
      capture: (result) =>
        capturePanoramaPng(gameRenderer.renderer.domElement, result),
      gallery: new LocalPanoramaGallery(),
    },
  );
  observableWorld = new ObservableWorldBridge({
    solver: solverWorker,
    getPlayerPosition: () => [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ],
    worldState,
    visuals: fixedVisuals,
    canObserve: () => runClock!.snapshot().canCommit,
    canAcceptCollapse: () => runClock!.canCommit(),
    onCollapseAccepted: () => {
      runClock!.notifyFirstCollapse();
      hud.notifyFirstCollapse();
      audioDirector.notifyCollapse();
      narrative.play('firstCollapse');
    },
    onWarning: (warning) => {
      if (warning.code !== 'ECHO_ONLY') {
        workerState.textContent = `SOLVER // ${warning.code}`;
      }
    },
  });
  const resetTick = observableWorld.reset(worldSeed);
  workerState.textContent = `CONTRATO #${String(resetTick).padStart(6, '0')} // SEED`;

  const replayMode = search.get('replay');
  const wp5PreviewEnabled = search.get('wp5') !== 'off';
  const wp5Replay = wp5PreviewEnabled && replayMode === 'wp5';
  const canonicalReplay = replayMode === 'canonical' || wp5Replay;
  const requestedSpeed = Number(search.get('speed') ?? '1');
  const replaySpeed =
    Number.isFinite(requestedSpeed) && requestedSpeed > 0
      ? Math.min(8, requestedSpeed)
      : 1;

  let wp5Preview: Wp5PreviewRuntime | null = null;
  let wp5Visuals: Wp5PreviewVisuals | null = null;
  let progressionHud: ProgressionHud | null = null;
  if (wp5PreviewEnabled) {
    const plan = planSeedAnchors(worldSeed);
    wp5Visuals = new Wp5PreviewVisuals(
      gameRenderer.scene,
      plan,
      settings.reducedFlashes,
    );
    progressionHud = new ProgressionHud(shell);
    shell.dataset.wp5Preview = 'true';
    wp5Preview = new Wp5PreviewRuntime({
      worldSeed,
      plan,
      unlockPack: (packId) => observableWorld!.unlockPack(packId),
      visuals: wp5Visuals,
      canonicalAutomation: wp5Replay,
      reducedFlashes: settings.reducedFlashes,
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
        hud.setMessage(message);
        hud.showSubtitle(message);
      },
      onNarrativeCue: (cueId) => narrative.play(cueId),
      onClockReward: (seconds) => {
        runClock!.addTime(seconds);
      },
    });
    progressionHud.update(wp5Preview.progression.snapshot());
  }

  const narrativeCueByPack: Readonly<Record<UnlockablePackId, NarrativeCueId>> =
    {
      water: 'unlockWater',
      forest: 'unlockForest',
      ruin: 'unlockRuin',
      storm: 'unlockStorm',
    };
  const announcedPacks = new Set<UnlockablePackId>();
  const debugOverlay = debugToolsAvailable()
    ? new DebugOverlay({
        getSnapshot: () => {
          const coordinates = worldPositionToCell([
            camera.position.x,
            camera.position.y,
            camera.position.z,
          ]);
          const cellId = coordinates ? cellCoordinatesToId(coordinates) : 2_080;
          const cell = worldState.getCell(cellId);
          return {
            seed: formatSeed(worldSeed),
            tick: Math.floor(runClock!.snapshot().elapsedSeconds * 10),
            position: [camera.position.x, camera.position.y, camera.position.z],
            gridCell: coordinates
              ? `${coordinates.x},${coordinates.z}`
              : 'out-of-bounds',
            neighborDomains: coordinates
              ? [
                  { x: coordinates.x, z: coordinates.z - 1 },
                  { x: coordinates.x + 1, z: coordinates.z },
                  { x: coordinates.x, z: coordinates.z + 1 },
                  { x: coordinates.x - 1, z: coordinates.z },
                ]
                  .filter(({ x, z }) => x >= 0 && z >= 0 && x < 64 && z < 64)
                  .map(({ x, z }) => {
                    const neighbor = worldState.getCell(
                      cellCoordinatesToId({ x, z }),
                    );
                    return `${neighbor.cellId}:${neighbor.phase}:e${neighbor.paletteEpoch}`;
                  })
              : [],
            phase: cell.phase,
            entropy: cell.phase === 'FIXED' ? 0 : 1,
            domainSize: cell.phase === 'FIXED' ? 1 : 3,
            observationRadius: 10,
            occluded: false,
            queueLength: 0,
            chunkId: Math.floor(cellId / 1_024),
            paletteEpoch: cell.paletteEpoch,
            fallbackCount: debugEvents.filter((event) =>
              event.includes('QUANTUM'),
            ).length,
            recentEvents: debugEvents,
          };
        },
        unlockNextPack: () => {
          const order: readonly UnlockablePackId[] = [
            'water',
            'forest',
            'ruin',
            'storm',
          ];
          const pack = order.find(
            (candidate) => !announcedPacks.has(candidate),
          );
          if (!pack) return null;
          observableWorld!.unlockPack(pack);
          announcedPacks.add(pack);
          portraitTracker.recordUnlock(pack);
          debugEvents.push(`F3 UNLOCK ${pack}`);
          return pack;
        },
      })
    : null;

  const gameLoop = new GameLoop(({ deltaSeconds, elapsedSeconds }) => {
    shell.style.setProperty('--observation-phase', `${elapsedSeconds % 8}`);
    const previousClock = runClock!.snapshot();
    if (
      !canonicalReplay &&
      wp5Preview?.respawn.snapshot().inputLocked !== true &&
      previousClock.phase !== 'ENDING' &&
      previousClock.phase !== 'COMPLETE'
    ) {
      playerPhysics?.controller.update(deltaSeconds);
    }

    if (canonicalReplay && shell.dataset.calibrated === 'true') {
      const replayTime = previousClock.elapsedSeconds;
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
    replayRecorder.record(Math.floor(elapsedSeconds * 10), playerPosition, [
      forwardVector.x,
      forwardVector.y,
      forwardVector.z,
    ]);
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
        runClock!.snapshot().phase === 'READY' &&
        nearbyCellIds.some(
          (cellId) =>
            observableWorld!.worldState.getCell(cellId).phase === 'FIXED',
        )
      ) {
        runClock!.notifyFirstCollapse();
        hud.notifyFirstCollapse();
        hud.setMessage('La mirada está fijando el mundo.');
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
            {
              tileId: 0,
              family: 'ground' as const,
              weight: 14,
              label: 'Pradera',
            },
            {
              tileId: 1,
              family: 'organic' as const,
              weight: 9,
              label: 'Vegetación',
            },
            {
              tileId: 2,
              family: 'mineral' as const,
              weight: 5,
              label: 'Roca',
            },
          ],
        },
      ];
    });
    for (const cellId of nearbyCellIds) {
      const cell = worldState.getCell(cellId);
      if (cell.phase !== 'FIXED') continue;
      portraitTracker.recordFixedCell({
        cellId,
        terrainTileId: cell.terrainTileId ?? 0,
        featureTileId: cell.featureTileId,
        family:
          cell.paletteEpoch === 1
            ? 'water'
            : cell.paletteEpoch === 2
              ? 'forest'
              : cell.paletteEpoch >= 3
                ? 'ruin'
                : 'base',
      });
    }
    portraitTracker.recordFrame({
      deltaSeconds,
      playerPosition,
      inDanger:
        (wp5Preview?.snapshot().hazardCount ?? 0) > 0 &&
        Math.hypot(playerPosition[0] - 64, playerPosition[2] - 64) > 14,
      unresolvedVisibleCells: superposedCells.length,
    });
    const focusedCell = superposedCells.reduce<
      (typeof superposedCells)[number] | null
    >(
      (selected, cell) =>
        selected === null || cell.observationCharge > selected.observationCharge
          ? cell
          : selected,
      null,
    );
    possibilityProbabilities.update(
      shell.dataset.calibrated === 'true' ? focusedCell : null,
      gameRenderer.quality.preset === 'low'
        ? 'low'
        : gameRenderer.quality.preset,
    );
    if (focusedCell && focusedCell.observationCharge > 0) {
      portraitTracker.recordGaze(focusedCell.cellId, deltaSeconds);
    }
    reticle.setCharge(maximumCharge);
    superposition.update(superposedCells, elapsedSeconds * 1_000);
    fixedVisuals.updateFrame(deltaSeconds);

    const playerCoordinates = worldPositionToCell(playerPosition);
    const playerCellId = playerCoordinates
      ? cellCoordinatesToId(playerCoordinates)
      : 2_080;
    const wp5Snapshot = wp5Preview?.update({
      deltaSeconds:
        shell.dataset.calibrated === 'true' &&
        (canonicalReplay || !playerInput.paused)
          ? deltaSeconds * replaySpeed
          : 0,
      playerPosition,
      cameraForward: [forwardVector.x, forwardVector.y, forwardVector.z],
      playerCellId,
      fixedCells: wp5Replay
        ? Math.max(60, worldState.countFixedCells())
        : worldState.countFixedCells(),
    });
    if (wp5Snapshot && progressionHud) {
      progressionHud.update(wp5Snapshot.progression);
      wp5GateStatus.textContent = `WP6 · ${wp5Snapshot.progression.collectedPacks.length}/4 SEMILLAS · ${wp5Snapshot.uncertainty?.state ?? 'SIN ENEMIGO'}`;
      uncertaintyStatus.hidden = wp5Snapshot.uncertainty === null;
      if (wp5Snapshot.uncertainty) {
        uncertaintyStatus.textContent = uncertaintyStatusText(
          wp5Snapshot.uncertainty.state,
        );
      }
      shell.dataset.respawnPhase = wp5Snapshot.respawn.phase;
      for (const packId of wp5Snapshot.progression.collectedPacks) {
        if (announcedPacks.has(packId)) continue;
        announcedPacks.add(packId);
        portraitTracker.recordUnlock(packId);
        audioDirector.playUnlockCue(packId);
        narrative.play(narrativeCueByPack[packId]);
      }
      if (wp5Snapshot.respawn.deaths > portraitTracker.snapshot().deaths) {
        portraitTracker.recordDeath();
      }
    }

    runClock!.setPaused(
      'SEED',
      wp5Preview?.progression.isClockPaused() ?? false,
    );
    const clock = runClock!.update(
      shell.dataset.calibrated === 'true' ? deltaSeconds * replaySpeed : 0,
    );
    hud.setTime(clock.remainingSeconds);
    audioDirector.updateCountdown(clock.remainingSeconds, clock.elapsedSeconds);
    const distanceFromOrigin = Math.hypot(
      playerPosition[0] - 64,
      playerPosition[2] - 64,
    );
    collapsadorRecords.update({
      deltaMs: deltaSeconds * replaySpeed * 1_000,
      fixedCells: worldState.countFixedCells(),
      seeds: wp5Snapshot?.progression.collectedPacks.length ?? 0,
      maxDistance: distanceFromOrigin,
      blocked:
        (wp5Snapshot?.respawn.phase ?? 'ALIVE') !== 'ALIVE' ||
        (wp5Snapshot?.progression.pauseRemainingSeconds ?? 0) > 0 ||
        clock.remainingSeconds <= 30 ||
        clock.phase === 'ENDING' ||
        clock.phase === 'COMPLETE',
    });

    if (
      !canonicalReplay &&
      !wp5PreviewEnabled &&
      clock.phase === 'RUNNING' &&
      announcedPacks.has('water')
    ) {
      const coordinates = worldPositionToCell(playerPosition);
      if (coordinates) {
        const playerCellId = cellCoordinatesToId(coordinates);
        if (fixedVisuals.isDeepWater(playerCellId)) {
          wp5Preview?.respawn.requestDeath({ cause: 'HAZARD' });
        }
      }
    }

    if (clock.phase === 'ENDING') {
      const ending = endingDirector.update(deltaSeconds * replaySpeed);
      camera.position.y = Math.max(
        camera.position.y,
        1.7 + ending.progress * 24.8,
      );
      camera.lookAt(64, 0, 64);
      if (ending.phase === 'COMPLETE' && !resultPresented) {
        resultPresented = true;
        runClock!.markComplete();
        const portrait = portraitTracker.snapshot();
        const profile = classifyAttentionPortrait(portrait);
        const haiku = generateHaiku(worldSeed, portrait, profile);
        const closure = closureForSeedCount(portrait.unlockedPacks.length);
        const result: RunResult = {
          worldSeed,
          seedLabel: formatSeed(worldSeed),
          seedMode: seedSelection.mode,
          dailyDateKey: seedSelection.dateKey,
          profile,
          portrait,
          haiku,
          ...closure,
        };
        pauseMenu?.setOpen(false);
        shell.dataset.paused = 'false';
        narrative.play('final');
        resultsPanel.show(result);
        shell.dataset.complete = 'true';
      }
    }
    debugOverlay?.update();
    finalArt.update(elapsedSeconds);
    gameRenderer.render();
  });

  const startCalibration = async (skipIntroduction: boolean): Promise<void> => {
    if (shell.dataset.calibration === 'pending') return;
    window.clearInterval(introductionTimer);
    if (skipIntroduction) introduction.skip();
    renderIntroduction();
    shell.dataset.calibration = 'pending';
    systemState.textContent = 'CALIBRANDO';
    shellStatus.textContent = 'Solicitando control de mirada…';
    observationButton.disabled = true;
    introSkip.disabled = true;
    observationButton
      .querySelector('span')
      ?.replaceChildren('Calibrando mirada…');
    playerInput.setEnabled(true);

    // Start both privileged operations synchronously from the same gesture.
    // Audio is optional; Pointer Lock is the transactional calibration gate.
    const audioStart = audioDirector.startFromGesture();
    shell.dataset.audioStarted = 'pending';
    const pointerLockAcquired = evidenceMode
      ? playerInput.resumeForEvidence()
      : await playerInput.resume();

    void audioStart.then((audioStarted) => {
      shell.dataset.audioStarted = String(audioStarted);
      if (shell.dataset.calibration === 'error') {
        audioDirector.setPaused(true);
      } else if (!audioStarted) {
        shellStatus.textContent = 'Shell lista · audio no disponible';
      }
    });

    if (!pointerLockAcquired) {
      playerInput.setEnabled(false);
      shell.dataset.calibration = 'error';
      shell.dataset.calibrated = 'false';
      systemState.textContent = 'EN ESPERA';
      shellStatus.textContent =
        'No se pudo capturar la mirada. Haz clic para reintentar.';
      observationButton.disabled = false;
      introSkip.hidden = true;
      observationButton
        .querySelector('span')
        ?.replaceChildren('Reintentar calibración');
      return;
    }

    shell.dataset.calibration = 'ready';
    shell.dataset.calibrated = 'true';
    systemState.textContent = 'CALIBRADA';
    shellStatus.textContent =
      'Shell lista · el primer colapso iniciará el reloj';
    observationButton
      .querySelector('span')
      ?.replaceChildren('Mirada calibrada');
    narrative.play('start');
  };

  observationButton.addEventListener(
    'click',
    () => void startCalibration(false),
    { signal: abortController.signal },
  );
  introSkip.addEventListener('click', () => void startCalibration(true), {
    signal: abortController.signal,
  });

  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      runClock!.setPaused('HIDDEN', true);
      playerInput.pause();
      audioDirector.setPaused(true);
      gameLoop.stop();
    } else {
      runClock!.setPaused('HIDDEN', false);
      if (shell.dataset.calibrated === 'true') audioDirector.setPaused(false);
      gameLoop.start();
    }
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
    window.clearInterval(introductionTimer);
    abortController.abort();
    gameLoop.stop();
    solverWorker.dispose();
    reticle.destroy();
    possibilityProbabilities.destroy();
    hud.destroy();
    debugOverlay?.destroy();
    pauseMenu?.destroy();
    audioDirector.dispose();
    superposition.dispose();
    fixedVisuals.dispose();
    wp5Visuals?.dispose();
    progressionHud?.destroy();
    originDetails.dispose();
    worldBoundary.dispose();
    finalArt.dispose();
    gameRenderer.dispose();
    playerInput.dispose();
    playerPhysics?.dispose();
  };
}
