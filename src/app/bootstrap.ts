import { Matrix4, Quaternion, Vector3 } from 'three';

import { GameLoop } from './game-loop';
import { ObservableWorldBridge } from './observable-world-bridge';
import { SolverWorkerClient } from './solver-worker-client';
import { Wp5PreviewRuntime } from './wp5-preview-runtime';
import { AudioDirector } from '../audio/audio-director';
import type { GamePhase, Locale } from '../contracts/localization';
import type { UnlockablePackId } from '../contracts/tiles';
import { planSeedAnchors } from '../gameplay/anchors';
import { resolveWorldSeed } from '../gameplay/daily-seed';
import {
  classifyEnding,
  closureForSeedCount,
  EndingDirector,
  formatSeed,
  type EndingVariant,
  type RunResult,
  type RunEndReason,
} from '../gameplay/ending';
import { generateHaiku } from '../gameplay/haiku';
import { BriefingPlayback } from '../gameplay/briefing';
import {
  narrativeCatalog,
  NarrativeDirector,
  type NarrativeCueId,
} from '../gameplay/narrative';
import { capturePanoramaPng, LocalPanoramaGallery } from '../gameplay/panorama';
import { configuredRemoteHaikuEndpoint } from '../gameplay/remote-haiku';
import {
  AttentionPortraitTracker,
  classifyAttentionPortrait,
} from '../gameplay/portrait';
import { RunClock, type RunMode } from '../gameplay/run-clock';
import { PrologueDirector } from '../gameplay/prologue';
import { applyDocumentLocale, loadLocale, saveLocale, uiCopy } from '../i18n';
import { DebugOverlay, debugToolsAvailable } from '../dev/debug-overlay';
import { applyMissionCompleteReplayOutcome } from '../dev/mission-complete-replay';
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
import {
  GameRenderer,
  type GameRendererPerformanceSnapshot,
} from '../render/renderer';
import { FinalArtDirector } from '../render/final-art-director';
import {
  finalWorldCameraPose,
  observedWorldBounds,
  renderObservedWorldMapCanvas,
} from '../render/panorama-capture';
import {
  domainSuperpositionCandidates,
  hasFixedCardinalNeighbor,
  isSuperpositionPhase,
  SuperpositionRenderer,
  type SuperpositionCandidate,
  type SuperpositionCell,
} from '../render/superposition';
import { Wp5PreviewVisuals } from '../render/wp5-preview-visuals';
import {
  AgencyRoom,
  PROLOGUE_ROOM_SPAWN,
  RETURN_ROOM_CAMERA_POSITION,
  RETURN_ROOM_SCREEN_TARGET,
} from '../render/agency-room';
import { ObservationReticle } from '../ui/observation-reticle';
import { GameHud } from '../ui/hud';
import { loadGameSettings, PauseMenu, type GameSettings } from '../ui/pause';
import { ProgressionHud } from '../ui/progression-hud';
import { ResultsPanel } from '../ui/results';
import { MissionCompletePlayback } from '../ui/mission-complete';
import {
  SliceCollapseVisuals,
  visualVariantIndex,
} from '../world/collapse-visuals';
import { createOriginDetailField } from '../world/origin-details';
import { createWorldBoundaryVisual } from '../world/world-boundary';
import {
  WorldState,
  cellCenterToWorld,
  cellCoordinatesToId,
  worldPositionToCell,
} from '../world/world-state';

function shellMarkup(locale: Locale): string {
  const copy = uiCopy(locale);
  return `
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
      <p>${copy.systemBar}</p>
      <p class="system-bar__state" data-system-state>${copy.waiting}</p>
    </header>

    <section class="intro-panel">
      <p class="intro-panel__eyebrow" data-intro-eyebrow>${copy.roomEyebrow}</p>
      <h1 id="game-title">${copy.titleLine1}<br /><span>${copy.titleLine2}</span></h1>
      <p class="intro-panel__statement" data-intro-copy aria-live="polite">
        ${copy.roomStatement}
      </p>
      <div class="intro-panel__actions">
        <button class="observation-button" type="button" data-observation-button>
          <span>${copy.enterChamber}</span>
          <span aria-hidden="true">→</span>
        </button>
        <a class="intro-panel__daily" href="?daily=1" data-seed-mode-link>
          ${copy.dailySeed}
        </a>
      </div>
      <p class="intro-panel__hint" data-shell-status role="status" aria-live="polite">
        ${copy.roomHint}
      </p>
    </section>

    <aside class="possibility-readout" aria-label="${copy.possibilities}">
      <p>${copy.possibilities}</p>
      <ol>
        <li><span>01</span><i></i><strong>${copy.superposed}</strong></li>
        <li><span>02</span><i></i><strong>${copy.undetermined}</strong></li>
        <li><span>03</span><i></i><strong>${copy.waiting}</strong></li>
      </ol>
    </aside>

    <footer class="shell-footer">
      <p>WP8 // RELEASE CANDIDATE</p>
      <p data-worker-state>${copy.workerInitializing}</p>
      <p>${copy.buildLocal}</p>
    </footer>

    <section class="slice-hud" aria-live="polite">
      <p><span>${copy.window}</span><strong data-slice-time>10:00</strong></p>
      <p><span data-seed-mode-label>SEED</span><strong data-seed-label>A91F-42C0</strong></p>
    </section>

    <p class="wp5-gate-status" data-wp5-gate-status>
      WP6 · ${copy.buildLocal}
    </p>

    <p class="room-interaction" data-room-interaction hidden></p>

    <section class="briefing-controls" data-briefing-controls hidden>
      <p>${copy.briefingPaused}</p>
      <button type="button" data-briefing-resume>${copy.resumeBriefing}</button>
      <button type="button" data-briefing-skip disabled>${copy.skipBriefing}</button>
    </section>

    <section class="objectives-transmission" data-objectives-transmission hidden aria-labelledby="alice-name">
      <p class="objectives-transmission__identity">
        <span>${locale === 'en' ? 'AGENCY OPERATIONS' : 'OPERACIONES DE LA AGENCIA'}</span>
        <strong id="alice-name" data-objectives-name>Dr Alice Boole</strong>
      </p>
      <p data-objectives-subtitle role="status" aria-live="polite"></p>
      <div>
        <button type="button" data-objectives-skip disabled>${locale === 'en' ? 'SKIP' : 'OMITIR'}</button>
      </div>
      <audio data-objectives-audio preload="auto"></audio>
    </section>

    <section class="audio-diagnostic" data-audio-diagnostic hidden>
      <span data-audio-diagnostic-status role="status"></span>
      <button type="button" data-audio-retry>${copy.audioRetry}</button>
    </section>

    <section class="mission-complete" data-mission-complete hidden aria-label="${locale === 'en' ? 'Mission complete transmission in the Agency return chamber' : 'Transmisión de misión en la sala de retorno de la Agencia'}">
      <video data-mission-video muted playsinline></video>
      <img data-mission-fallback hidden alt="${locale === 'en' ? 'Agency mission record' : 'Expediente de misión de la Agencia'}" />
      <div class="mission-complete__status" aria-hidden="true">
        <span>${locale === 'en' ? 'REINTEGRATION BAY // RECORD PLAYBACK' : 'SALA DE REINTEGRACIÓN // REPRODUCCIÓN DE EXPEDIENTE'}</span>
        <i></i><i></i><i></i>
      </div>
      <p data-mission-caption aria-live="polite"></p>
      <button type="button" data-mission-skip disabled></button>
      <audio data-mission-audio></audio>
    </section>

    <section class="slice-result" data-slice-result hidden>
      <p>${copy.resultEyebrow}</p>
      <h2>${copy.resultTitle}</h2>
      <strong>SEED A91F-42C0</strong>
    </section>
  </main>
`;
}

export function baseSuperpositionCandidates(
  locale: Locale,
): readonly SuperpositionCandidate[] {
  return locale === 'en'
    ? [
        { tileId: 0, family: 'ground', weight: 14, label: 'Meadow' },
        { tileId: 1, family: 'organic', weight: 9, label: 'Vegetation' },
        { tileId: 2, family: 'mineral', weight: 5, label: 'Rock' },
      ]
    : [
        { tileId: 0, family: 'ground', weight: 14, label: 'Pradera' },
        { tileId: 1, family: 'organic', weight: 9, label: 'Vegetación' },
        { tileId: 2, family: 'mineral', weight: 5, label: 'Roca' },
      ];
}

type PerformanceWindow = Window & {
  __ULTIMA_OBSERVATION_PERFORMANCE__?: () => GameRendererPerformanceSnapshot;
};

function toErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message;
  return locale === 'en'
    ? 'Unknown error during startup.'
    : 'Error desconocido durante el arranque.';
}

export function renderBootstrapError(root: HTMLElement, error: unknown): void {
  const locale = loadLocale();
  const copy = uiCopy(locale);
  applyDocumentLocale(locale);
  const message = toErrorMessage(error, locale);
  root.innerHTML = `
    <main class="error-shell" role="alert">
      <p class="error-shell__code">${copy.bootInterrupted}</p>
      <h1>${copy.bootFailed}</h1>
      <p data-error-message></p>
      <button type="button" data-retry-button>${copy.retry}</button>
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
  let selectedLocale = loadLocale();
  let gameDisposer: (() => void) | null = null;
  const abortController = new AbortController();
  const renderSelector = (): void => {
    const copy = uiCopy(selectedLocale);
    applyDocumentLocale(selectedLocale);
    root.innerHTML = `
      <main class="language-select" aria-labelledby="language-title">
        <p class="language-select__eyebrow">AGENCY // AGENCIA</p>
        <h1 id="language-title">${copy.languageTitle}</h1>
        <p>${copy.languageHint}</p>
        <div class="language-select__options" role="radiogroup" aria-label="${copy.languageTitle}">
          <button type="button" role="radio" aria-checked="${String(selectedLocale === 'en')}" data-locale="en">${copy.english}</button>
          <button type="button" role="radio" aria-checked="${String(selectedLocale === 'es')}" data-locale="es">${copy.spanish}</button>
        </div>
        <button class="observation-button" type="button" data-enter-language>${copy.enterChamber}</button>
      </main>
    `;
    for (const option of root.querySelectorAll<HTMLButtonElement>(
      '[data-locale]',
    )) {
      option.addEventListener(
        'click',
        () => {
          const candidate = option.dataset.locale;
          if (candidate !== 'en' && candidate !== 'es') return;
          selectedLocale = candidate;
          saveLocale(selectedLocale);
          renderSelector();
        },
        { signal: abortController.signal },
      );
    }
    root
      .querySelector<HTMLButtonElement>('[data-enter-language]')
      ?.addEventListener(
        'click',
        () => {
          saveLocale(selectedLocale);
          applyDocumentLocale(selectedLocale);
          abortController.abort();
          gameDisposer = bootstrapGame(root, selectedLocale, true);
        },
        { signal: abortController.signal, once: true },
      );
  };
  renderSelector();
  return () => {
    abortController.abort();
    gameDisposer?.();
  };
}

function bootstrapGame(
  root: HTMLElement,
  locale: Locale,
  enterFromLanguageGesture = false,
): () => void {
  const copy = uiCopy(locale);
  root.innerHTML = shellMarkup(locale);

  const shell = root.querySelector<HTMLElement>('.observation-shell');
  const observationButton = root.querySelector<HTMLButtonElement>(
    '[data-observation-button]',
  );
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
  const sliceResult = root.querySelector<HTMLElement>('[data-slice-result]');
  const seedModeLabel = root.querySelector<HTMLElement>(
    '[data-seed-mode-label]',
  );
  const seedValueLabel = root.querySelector<HTMLElement>('[data-seed-label]');
  const wp5GateStatus = root.querySelector<HTMLElement>(
    '[data-wp5-gate-status]',
  );
  const audioDiagnostic = root.querySelector<HTMLElement>(
    '[data-audio-diagnostic]',
  );
  const audioDiagnosticStatus = root.querySelector<HTMLElement>(
    '[data-audio-diagnostic-status]',
  );
  const audioRetry =
    root.querySelector<HTMLButtonElement>('[data-audio-retry]');
  const roomInteraction = root.querySelector<HTMLElement>(
    '[data-room-interaction]',
  );
  const briefingControls = root.querySelector<HTMLElement>(
    '[data-briefing-controls]',
  );
  const briefingResume = root.querySelector<HTMLButtonElement>(
    '[data-briefing-resume]',
  );
  const briefingSkip = root.querySelector<HTMLButtonElement>(
    '[data-briefing-skip]',
  );
  const objectivesTransmission = root.querySelector<HTMLElement>(
    '[data-objectives-transmission]',
  );
  const objectivesSubtitle = root.querySelector<HTMLElement>(
    '[data-objectives-subtitle]',
  );
  const objectivesSkip = root.querySelector<HTMLButtonElement>(
    '[data-objectives-skip]',
  );
  const objectivesAudio = root.querySelector<HTMLAudioElement>(
    '[data-objectives-audio]',
  );

  if (
    !shell ||
    !observationButton ||
    !seedModeLink ||
    !introEyebrow ||
    !introCopy ||
    !systemState ||
    !shellStatus ||
    !workerState ||
    !viewport ||
    !sliceTime ||
    !sliceResult ||
    !seedModeLabel ||
    !seedValueLabel ||
    !wp5GateStatus ||
    !audioDiagnostic ||
    !audioDiagnosticStatus ||
    !audioRetry ||
    !roomInteraction ||
    !briefingControls ||
    !briefingResume ||
    !briefingSkip ||
    !objectivesTransmission ||
    !objectivesSubtitle ||
    !objectivesSkip ||
    !objectivesAudio
  ) {
    throw new Error(
      locale === 'en'
        ? 'The observation interface is incomplete.'
        : 'La interfaz de observación está incompleta.',
    );
  }

  const abortController = new AbortController();
  const settings = loadGameSettings();
  let currentSettings = settings;
  const search = new URLSearchParams(window.location.search);
  const requestedMode = search.get('mode');
  const runMode: RunMode =
    requestedMode === 'brief' || requestedMode === 'contemplative'
      ? requestedMode
      : 'standard';
  const seedSelection = resolveWorldSeed(search);
  const worldSeed = seedSelection.worldSeed;
  seedModeLabel.textContent =
    seedSelection.mode === 'daily' ? copy.dailySeed : 'SEED';
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
    seedModeLink.textContent = copy.randomObservation;
  } else {
    alternateSeedUrl.searchParams.set('daily', '1');
    seedModeLink.textContent = copy.dailySeed;
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
  const performanceSnapshot = (): GameRendererPerformanceSnapshot =>
    gameRenderer.performanceSnapshot;
  (window as PerformanceWindow).__ULTIMA_OBSERVATION_PERFORMANCE__ =
    performanceSnapshot;
  const finalArt = new FinalArtDirector(
    gameRenderer.scene,
    gameRenderer.quality,
    gameRenderer.textures,
  );
  const audioDirector = new AudioDirector({
    onStateChange: (snapshot) => {
      shell.dataset.audioState = snapshot.status;
      if (snapshot.activeClipId)
        shell.dataset.audioClip = snapshot.activeClipId;
      else delete shell.dataset.audioClip;
      if (snapshot.error) shell.dataset.audioError = snapshot.error;
      else delete shell.dataset.audioError;
      const failed =
        snapshot.status === 'blocked' || snapshot.status === 'error';
      audioDiagnostic.hidden = !failed;
      audioDiagnosticStatus.textContent =
        snapshot.status === 'blocked' ? copy.audioBlocked : copy.audioError;
    },
  });
  audioDirector.setVolumes(settings.volumes);
  audioRetry.addEventListener(
    'click',
    () => {
      void audioDirector
        .startFromGesture()
        .then(() => audioDirector.retryActiveVoice());
    },
    { signal: abortController.signal },
  );
  const prologue = new PrologueDirector();
  prologue.enterRoom();
  shell.dataset.gamePhase = 'ROOM';
  let room: AgencyRoom | null = new AgencyRoom(
    gameRenderer.scene,
    locale,
    gameRenderer.textures,
  );
  let playerPhysics: PlayerPhysicsRuntime | null = null;
  let enterRun = (): void => undefined;
  const objectiveText =
    locale === 'en'
      ? 'Agency operational directive. During the next ten minutes, collapse as much of the Condensate as possible. Recover the Possibility Seeds in the authorized order: Water, Forest, Ruin, and Storm. Avoid consciousness bombs; detonation revokes fifteen metres of approved reality. You have been allocated three lives. The loss of the third will close the record, regardless of your objections.'
      : 'Directiva operativa de la Agencia. Durante los próximos diez minutos, colapsa la mayor superficie posible del Condensado. Recupera las Semillas de Posibilidad en el orden autorizado: Agua, Bosque, Ruina y Tormenta. Evita las bombas de consciencia; su detonación revoca quince metros de realidad aprobada. Se te han asignado tres vidas. La pérdida de la tercera cerrará el expediente, con independencia de tus objeciones.';
  const defeatText =
    locale === 'en'
      ? 'Third life exhausted. You are dead. The Agency regrets to inform you that no further field body has been authorized. It was not in vain: part of the Condensate was collapsed by your attention and will remain in the record. Your absence has been classified as a conclusive contribution.'
      : 'Tercera vida agotada. Has muerto. La Agencia lamenta informarte de que no procede otro cuerpo de campo. No ha sido en vano: una parte del Condensado quedó colapsada por tu atención y permanecerá en el expediente. Tu ausencia ha sido clasificada como aportación concluyente.';
  let objectivesElapsedSeconds = 0;
  let defeatTransmission = false;
  const startObjectivesAudio = (
    cue: 'objectivesDirective' | 'livesExhausted',
  ): void => {
    objectivesAudio.src = `/assets/audio/voice/${locale}/${cue}.mp3`;
    objectivesAudio.currentTime = 0;
    void objectivesAudio.play().catch(() => {
      shell.dataset.objectivesAudio = 'blocked';
    });
  };
  const openPortalAfterObjectives = (): void => {
    if (prologue.snapshot().phase === 'OBJECTIVES') {
      prologue.completeObjectives();
    }
    shell.dataset.gamePhase = 'PORTAL';
    shell.dataset.portal = 'white-sphere';
    systemState.textContent = locale === 'en' ? 'PORTAL READY' : 'PORTAL LISTO';
    roomInteraction.textContent = copy.enterPortal;
    roomInteraction.hidden = false;
    room?.setPhase('PORTAL');
    objectivesTransmission.hidden = true;
    objectivesSkip.hidden = true;
  };
  const completeBriefing = (): void => {
    prologue.completeBriefing();
    shell.dataset.gamePhase = 'OBJECTIVES';
    shell.dataset.briefingButton = 'disabled';
    systemState.textContent =
      locale === 'en' ? 'OPERATIONAL DIRECTIVE' : 'DIRECTIVA OPERATIVA';
    objectivesElapsedSeconds = 0;
    objectivesSubtitle.textContent = objectiveText;
    objectivesTransmission.hidden = false;
    objectivesSkip.hidden = false;
    objectivesSkip.disabled = true;
    roomInteraction.hidden = true;
    room?.setPhase('OBJECTIVES');
    room?.attachPortrait('/assets/portraits/dr-alice-boole.webp');
    shell.dataset.aliceScreen = 'visible';
    startObjectivesAudio('objectivesDirective');
  };
  const briefing = new BriefingPlayback(shell, locale, {
    onComplete: completeBriefing,
    onFallbackChapter: (chapter) =>
      room?.setFallbackSlide(chapter.title, chapter.caption),
    onMediaState: (state) => {
      shell.dataset.briefingMedia = state;
    },
    onAudioState: (state) => {
      shell.dataset.briefingAudio = state;
    },
  });
  room.attachVideo(briefing.video);
  briefing.setVolume(settings.volumes.master, settings.volumes.voice);
  gameRenderer.setWorldAtmosphereVisible(false);
  const originDetails = createOriginDetailField(
    gameRenderer.scene,
    gameRenderer.textures,
  );
  originDetails.family.mesh.visible = false;
  const worldBoundary = createWorldBoundaryVisual();
  worldBoundary.root.visible = false;
  gameRenderer.scene.add(worldBoundary.root);
  const superposition = new SuperpositionRenderer(
    gameRenderer.quality.preset === 'low' ? 'low' : 'medium',
  );
  superposition.root.visible = false;
  finalArt.vegetation.root.visible = false;
  gameRenderer.scene.add(superposition.root);
  const stopQualitySync = gameRenderer.onQualityChange((profile) => {
    finalArt.applyQuality(profile);
    superposition.setQuality(profile.preset === 'low' ? 'low' : profile.preset);
  });
  const reticle = new ObservationReticle(shell);
  const hud = new GameHud(shell, { time: sliceTime }, locale);
  hud.setSubtitlesEnabled(settings.subtitles);
  hud.setHighContrast(settings.highContrast);
  const narrative = new NarrativeDirector(
    {
      onMessage: () => undefined,
      onSubtitle: (message) => hud.showSubtitle(message),
      onAudioCue: (cue) => audioDirector.playNarrativeCue(cue),
    },
    narrativeCatalog(locale),
  );
  const portraitTracker = new AttentionPortraitTracker();
  const endingDirector = new EndingDirector();
  const evidenceMode =
    new URLSearchParams(window.location.search).get('evidence') === '1';
  const missionCompleteReplay =
    evidenceMode && search.get('replay') === 'mission-complete';
  let pauseMenu: PauseMenu | null = null;
  let runClock: RunClock | null = null;
  let runEndReason: RunEndReason = 'TIME_EXPIRED';
  let endingVariant: EndingVariant = 'STANDARD';
  let finalFixedCells = 0;
  let finalLivesRemaining = 3;
  let finalCollectedPacks: readonly UnlockablePackId[] = [];
  let missionPlaybackStarted = false;
  let missionPlaybackStartedAtSeconds = 0;
  const endingCameraStart = new Vector3();
  let endingCameraPose = finalWorldCameraPose(observedWorldBounds([]));
  let wp5Preview: Wp5PreviewRuntime | null = null;
  const playerInput = new PlayerInput(shell, {
    keepRunningWithoutPointerLock: evidenceMode,
    onPauseChange: (paused) => {
      const gamePhase = prologue.snapshot().phase;
      if (gamePhase === 'BRIEFING') {
        shell.dataset.paused = String(paused);
        if (paused) {
          briefing.pause();
          briefingControls.hidden = false;
          briefingSkip.disabled = !prologue.snapshot().canSkip;
          systemState.textContent = copy.briefingPaused;
        }
        return;
      }
      runClock?.setPaused('MENU', paused);
      shell.dataset.paused = String(paused);
      if (shell.dataset.calibrated === 'true') {
        audioDirector.setPaused(
          shell.dataset.ending === 'true' ? false : paused,
        );
        systemState.textContent =
          shell.dataset.playerState === 'death'
            ? copy.rebuilding
            : shell.dataset.ending === 'true'
              ? copy.ending
              : paused
                ? copy.pause
                : copy.observing;
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
    currentSettings = nextSettings;
    playerInput.setSettings({
      mouseSensitivity: nextSettings.mouseSensitivity,
      invertY: nextSettings.invertY,
      headBobEnabled: nextSettings.headBobEnabled,
    });
    gameRenderer.setQuality(nextSettings.quality);
    superposition.setHighContrast(nextSettings.highContrast);
    hud.setSubtitlesEnabled(nextSettings.subtitles);
    hud.setHighContrast(nextSettings.highContrast);
    audioDirector.setVolumes(nextSettings.volumes);
    briefing.setVolume(nextSettings.volumes.master, nextSettings.volumes.voice);
    audioDirector.setVoicesEnabled(nextSettings.voicesEnabled);
    shell.dataset.reducedFlashes = String(nextSettings.reducedFlashes);
  };
  pauseMenu = new PauseMenu(
    shell,
    settings,
    {
      onResume: () => void playerInput.resume(),
      onRestart: () => window.location.reload(),
      onSettingsChange: applySettings,
    },
    locale,
  );
  applySettings(settings);
  const beginBriefing = (): void => {
    const snapshot = prologue.pressButton(true);
    if (snapshot.phase !== 'BRIEFING') return;
    shell.dataset.gamePhase = 'BRIEFING';
    systemState.textContent = copy.briefingPlaying;
    roomInteraction.hidden = true;
    briefingControls.hidden = true;
    room?.setPhase('BRIEFING');
    briefing.start();
  };
  briefingResume.addEventListener(
    'click',
    () => {
      void playerInput.resume().then((resumed) => {
        if (!resumed) return;
        briefing.resume();
        briefingControls.hidden = true;
        systemState.textContent = copy.briefingPlaying;
      });
    },
    { signal: abortController.signal },
  );
  briefingSkip.addEventListener(
    'click',
    () => {
      if (!prologue.snapshot().canSkip) return;
      prologue.skip();
      completeBriefing();
      briefing.skip();
      briefingControls.hidden = true;
      void playerInput.resume();
    },
    { signal: abortController.signal },
  );
  objectivesAudio.addEventListener(
    'ended',
    () => {
      if (!defeatTransmission) openPortalAfterObjectives();
    },
    { signal: abortController.signal },
  );
  objectivesSkip.addEventListener(
    'click',
    () => {
      if (defeatTransmission || objectivesSkip.disabled) return;
      objectivesAudio.pause();
      openPortalAfterObjectives();
    },
    { signal: abortController.signal },
  );
  let disposed = false;
  const playerPhysicsPromise = createPlayerPhysicsRuntime(camera, playerInput)
    .then((runtime) => {
      if (disposed) {
        runtime.dispose();
        return null;
      } else {
        playerPhysics = runtime;
        runtime.activatePrologueRoom();
        if (shell.dataset.calibrated === 'true') {
          runtime.controller.respawn(PROLOGUE_ROOM_SPAWN);
        }
        shell.dataset.physics = 'ready';
        return runtime;
      }
    })
    .catch((error: unknown) => {
      shell.dataset.physics = 'error';
      workerState.textContent =
        locale === 'en' ? 'PHYSICS // ERROR' : 'FÍSICA // ERROR';
      workerState.dataset.contractState = 'error';
      console.error(
        locale === 'en'
          ? 'Rapier could not initialize.'
          : 'Rapier no pudo iniciar.',
        error,
      );
      return null;
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
      workerState.textContent =
        locale === 'en' ? 'CONTRACT // ERROR' : 'CONTRATO // ERROR';
      workerState.dataset.contractState = 'error';
      console.error(message);
    },
  });
  const worldState = new WorldState();
  let fracturedCellCount = 0;
  const fixedVisuals = new SliceCollapseVisuals(
    gameRenderer.scene,
    worldState,
    gameRenderer.textures,
  );
  fixedVisuals.root.visible = false;
  let resultPresented = false;
  let returnRoom: AgencyRoom | null = null;
  const missionPlayback = new MissionCompletePlayback(shell, {
    locale,
    onSkip: () => endingDirector.skipMissionVideo(),
    onFinished: () => endingDirector.finishMissionVideo(),
    onFallbackFrame: (path) => returnRoom?.attachPortrait(path),
  });
  runClock = new RunClock(
    {
      onCountdown: (remainingSeconds) => {
        if (remainingSeconds === 300) narrative.play('fiveMinutes');
        if (remainingSeconds === 60) narrative.play('lastSixtySeconds');
        if (remainingSeconds === 30) narrative.play('lastThirtySeconds');
      },
      onEnding: () => {
        const replayOutcome = missionCompleteReplay
          ? applyMissionCompleteReplayOutcome(worldState)
          : null;
        finalFixedCells =
          replayOutcome?.finalFixedCells ?? worldState.countFixedCells();
        finalLivesRemaining =
          replayOutcome?.livesRemaining ??
          wp5Preview?.respawn.snapshot().livesRemaining ??
          3;
        finalCollectedPacks =
          replayOutcome?.collectedPacks ??
          wp5Preview?.progression.snapshot().collectedPacks ??
          [];
        endingVariant = classifyEnding({
          mode: runMode,
          endingReason: runEndReason,
          livesRemaining: finalLivesRemaining,
          collectedPacks: finalCollectedPacks,
          finalFixedCells,
        });
        prologue.startEnding();
        shell.dataset.gamePhase = 'ENDING';
        shell.dataset.ending = 'true';
        shell.dataset.endingVariant = endingVariant;
        shell.dataset.endingPhase = 'ASCENDING';
        playerInput.setEnabled(false);
        superposition.root.visible = false;
        fixedVisuals.setEndingMode(true);
        endingCameraStart.copy(camera.position);
        endingCameraPose = finalWorldCameraPose(
          observedWorldBounds(worldState.fixedCellIds()),
          camera.aspect,
          camera.fov,
        );
        camera.up.set(0, 0, -1);
        gameRenderer.setWorldFogEnabled(false);
        endingDirector.start(endingVariant);
      },
    },
    { mode: runMode, startAtSeconds },
  );
  const resultsPanel = new ResultsPanel(
    sliceResult,
    () => window.location.reload(),
    {
      capture: (result) =>
        capturePanoramaPng(
          renderObservedWorldMapCanvas(
            gameRenderer.renderer,
            gameRenderer.scene,
            worldState.fixedCellIds(),
          ),
          result,
        ),
      gallery: new LocalPanoramaGallery(),
    },
    configuredRemoteHaikuEndpoint(import.meta.env.VITE_REMOTE_HAIKU_ENDPOINT),
    locale,
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
    physics: {
      enableFixedCollider: (commit) =>
        playerPhysics?.enableFeatureCollider(commit),
    },
    canObserve: () =>
      prologue.snapshot().phase === 'RUN' && runClock!.snapshot().canCommit,
    canAcceptCollapse: () =>
      prologue.snapshot().phase === 'RUN' && runClock!.canCommit(),
    onCollapseAccepted: (event) => {
      runClock!.notifyFirstCollapse();
      hud.notifyFirstCollapse();
      audioDirector.notifyCollapse();
      narrative.play('firstCollapse');
      if (event.featureTileId === 17) {
        wp5Preview?.registerConsciousnessBomb(
          event.cellId,
          (event.durationMs * 0.7) / 1_000,
        );
      }
    },
    onWarning: (warning) => {
      if (warning.code !== 'ECHO_ONLY') {
        workerState.textContent = `SOLVER // ${warning.code}`;
      }
    },
    onFractured: (cellIds) => {
      fracturedCellCount += cellIds.length;
      shell.dataset.fracturedCells = String(fracturedCellCount);
      playerPhysics?.removeFeatureColliders(cellIds);
      const fractured = new Set(cellIds);
      superposedCells = superposedCells.filter(
        (cell) => !fractured.has(cell.cellId),
      );
      if (
        focusedSuperposedCell &&
        fractured.has(focusedSuperposedCell.cellId)
      ) {
        focusedSuperposedCell = null;
      }
      superposition.update(superposedCells, performance.now());
    },
  });
  let worldInitialized = false;
  workerState.textContent =
    locale === 'en' ? 'CONTRACT // PROLOGUE' : 'CONTRATO // PRÓLOGO';

  const replayMode = search.get('replay');
  const wp5PreviewEnabled = search.get('wp5') !== 'off';
  const wp5Replay =
    wp5PreviewEnabled &&
    (replayMode === 'wp5' || replayMode === 'mission-complete');
  const livesReplay = wp5PreviewEnabled && replayMode === 'wfc2-lives';
  const canonicalReplay =
    replayMode === 'canonical' || wp5Replay || livesReplay;
  const requestedSpeed = Number(search.get('speed') ?? '1');
  const replaySpeed =
    Number.isFinite(requestedSpeed) && requestedSpeed > 0
      ? Math.min(8, requestedSpeed)
      : 1;

  let wp5Visuals: Wp5PreviewVisuals | null = null;
  let progressionHud: ProgressionHud | null = null;
  if (wp5PreviewEnabled) {
    const plan = planSeedAnchors(worldSeed);
    wp5Visuals = new Wp5PreviewVisuals(
      gameRenderer.scene,
      plan,
      settings.reducedFlashes,
      gameRenderer.textures,
    );
    wp5Visuals.root.visible = false;
    progressionHud = new ProgressionHud(shell, locale);
    progressionHud.element.hidden = true;
    shell.dataset.wp5Preview = 'true';
    wp5Preview = new Wp5PreviewRuntime({
      worldSeed,
      plan,
      unlockPack: (packId) => observableWorld!.unlockPack(packId),
      visuals: wp5Visuals,
      canonicalAutomation: wp5Replay,
      canonicalBombAutomation: livesReplay,
      ensureRespawnGround: () => {
        observableWorld!.collapses.ensureSafeContactGround([2_080], 0);
      },
      isRespawnWalkable: () =>
        observableWorld!.worldState.getCell(2_080).phase === 'FIXED',
      teleportPlayer: () => {
        if (playerPhysics) playerPhysics.controller.respawn();
        else camera.position.set(64, 1.7, 64);
      },
      onNarrativeCue: (cueId) => narrative.play(cueId),
      fractureRegion: (centerCellId, protectedCellIds) => {
        observableWorld!.fractureRegion(centerCellId, protectedCellIds);
      },
      onTerminalContact: () => {
        runClock!.setPaused('MENU', true);
      },
      onLivesExhausted: () => {
        runEndReason = 'LIVES_EXHAUSTED';
        shell.dataset.endReason = runEndReason;
        defeatTransmission = true;
        objectivesTransmission.hidden = false;
        objectivesSubtitle.textContent = defeatText;
        objectivesSkip.hidden = true;
        objectivesAudio.pause();
        narrative.play('livesExhausted');
        runClock!.endNow();
      },
    });
    progressionHud.update(wp5Preview.progression.snapshot());
  }

  enterRun = (): void => {
    if (prologue.snapshot().phase !== 'PORTAL') return;
    prologue.crossPortal();
    shell.dataset.gamePhase = 'RUN';
    roomInteraction.hidden = true;
    briefingControls.hidden = true;
    room?.dispose();
    room = null;
    briefing.dispose();
    objectivesAudio.pause();
    objectivesTransmission.hidden = true;
    playerPhysics?.deactivatePrologueRoom();
    playerPhysics?.controller.respawn();
    gameRenderer.setWorldAtmosphereVisible(true);
    finalArt.vegetation.root.visible = true;
    originDetails.family.mesh.visible = true;
    worldBoundary.root.visible = true;
    superposition.root.visible = true;
    if (evidenceMode && search.get('showcase') === 'variants') {
      const usedCellIds = new Set<number>();
      const families = [
        { featureTileId: 8, terrainTileIds: [13, 14, 13, 14, 13], z: 62 },
        { featureTileId: 12, terrainTileIds: [17, 18, 17, 18, 17], z: 65 },
        { featureTileId: 2, terrainTileIds: [9, 10, 9, 10, 9], z: 68 },
      ] as const;
      for (const family of families) {
        for (let variant = 0; variant < 5; variant += 1) {
          let cellId = 0;
          while (
            usedCellIds.has(cellId) ||
            visualVariantIndex(worldSeed, cellId, family.featureTileId) !==
              variant
          )
            cellId += 1;
          usedCellIds.add(cellId);
          fixedVisuals.begin(
            {
              type: 'COLLAPSE',
              cellId,
              terrainTileId: family.terrainTileIds[variant],
              featureTileId: family.featureTileId,
              terrainRotationQuarterTurns: 0,
              entropyBefore: 1,
              durationMs: 225,
              worldSeed,
            },
            [60 + variant * 2, 0, family.z],
          );
          fixedVisuals.complete(cellId);
        }
      }
      playerPhysics?.controller.respawn({ x: 64, y: 1.7, z: 75 });
      camera.lookAt(64, 2.5, 64);
      shell.dataset.visualShowcase = 'ready';
    }
    fixedVisuals.root.visible = true;
    if (wp5Visuals) wp5Visuals.root.visible = true;
    if (progressionHud) progressionHud.element.hidden = false;
    audioDirector.setAmbienceScene('base');
    if (!worldInitialized) {
      const resetTick = observableWorld!.reset(worldSeed);
      workerState.textContent = `${locale === 'en' ? 'CONTRACT' : 'CONTRATO'} #${String(resetTick).padStart(6, '0')} // SEED`;
      worldInitialized = true;
    }
    systemState.textContent = copy.observing;
  };

  const narrativeCueByPack: Readonly<Record<UnlockablePackId, NarrativeCueId>> =
    {
      water: 'unlockWater',
      forest: 'unlockForest',
      ruin: 'unlockRuin',
      storm: 'unlockStorm',
    };
  const seedHintCueByPack: Readonly<Record<UnlockablePackId, NarrativeCueId>> =
    {
      water: 'seedWaterHint',
      forest: 'seedForestHint',
      ruin: 'seedRuinHint',
      storm: 'seedStormHint',
    };
  const bombForecastCueByStage: Readonly<Record<number, NarrativeCueId>> = {
    1: 'bombRiskThreePercent',
    2: 'bombRiskFivePercent',
    3: 'bombRiskSevenPercent',
    4: 'bombRiskNinePercent',
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

  const forwardVector = new Vector3();
  let superposedCells: readonly SuperpositionCell[] = [];
  let focusedSuperposedCell: SuperpositionCell | null = null;
  let maximumCharge = 0;
  let lastWorldVisualSampleSeconds = Number.NEGATIVE_INFINITY;
  let recordedDeaths = 0;
  let firstDangerAnnounced = false;
  let lastContextualSlot = 0;
  let contextualFixedCells = 0;
  let lastBombForecastStage = 0;
  let pendingRockJumpUntilSeconds = 0;
  let rockJumpSequence = 0;
  const pendingSeedHints: Array<{
    readonly cueId: NarrativeCueId;
    readonly dueAtRunSeconds: number;
  }> = [];
  const briefingTarget = new Vector3(64, 2.35, 58.17);
  const briefingLookMatrix = new Matrix4();
  const briefingTargetQuaternion = new Quaternion();

  const gameLoop = new GameLoop(({ deltaSeconds, elapsedSeconds }) => {
    const previousClock = runClock!.snapshot();
    let gamePhase: GamePhase = prologue.snapshot().phase;
    if (
      (gamePhase === 'ROOM' || gamePhase === 'PORTAL') &&
      shell.dataset.calibrated === 'true' &&
      !playerInput.paused
    ) {
      playerPhysics?.controller.update(deltaSeconds);
    }
    if (gamePhase === 'BRIEFING') {
      if (!playerInput.paused) {
        prologue.update(deltaSeconds);
        briefing.update(deltaSeconds);
      }
      briefingSkip.disabled = !prologue.snapshot().canSkip;
      briefingLookMatrix.lookAt(camera.position, briefingTarget, camera.up);
      briefingTargetQuaternion.setFromRotationMatrix(briefingLookMatrix);
      camera.quaternion.slerp(
        briefingTargetQuaternion,
        1 - Math.exp(-deltaSeconds * 2.8),
      );
    }
    if (gamePhase === 'OBJECTIVES') {
      objectivesElapsedSeconds += deltaSeconds;
      objectivesSkip.disabled = objectivesElapsedSeconds < 3;
    }
    const buttonFocused =
      gamePhase === 'ROOM' && room?.isButtonFocused(camera) === true;
    room?.update(elapsedSeconds, buttonFocused);
    if (gamePhase === 'ROOM' || gamePhase === 'PORTAL') {
      roomInteraction.hidden = gamePhase === 'ROOM' ? !buttonFocused : false;
      roomInteraction.textContent =
        gamePhase === 'PORTAL' ? copy.enterPortal : copy.interactHint;
      if (playerInput.consumeInteract() && buttonFocused) beginBriefing();
      if (gamePhase === 'PORTAL' && room?.isPortalEntered(camera)) {
        enterRun();
        gamePhase = prologue.snapshot().phase;
      }
    }
    if (gamePhase !== 'RUN' && gamePhase !== 'ENDING') {
      debugOverlay?.update();
      gameRenderer.render();
      return;
    }
    if (
      !canonicalReplay &&
      shell.dataset.calibrated === 'true' &&
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
    if (shell.dataset.visualShowcase === 'ready') {
      camera.position.set(64, 11, 78);
      camera.lookAt(64, 2, 64);
    }

    const playerPosition = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ] as const;
    playerPhysics?.updateFeatureColliders(playerPosition);
    if (playerPhysics?.consumeRockJump(playerPosition)) {
      rockJumpSequence += 1;
      pendingRockJumpUntilSeconds = elapsedSeconds + 7;
    }
    if (pendingRockJumpUntilSeconds > 0) {
      if (elapsedSeconds > pendingRockJumpUntilSeconds) {
        pendingRockJumpUntilSeconds = 0;
      } else if (
        narrative.playPool('traversal', worldSeed ^ rockJumpSequence) !== null
      ) {
        pendingRockJumpUntilSeconds = 0;
      }
    }
    camera.getWorldDirection(forwardVector);
    replayRecorder.record(Math.floor(elapsedSeconds * 10), playerPosition, [
      forwardVector.x,
      forwardVector.y,
      forwardVector.z,
    ]);
    const nearbyCellIds = observableWorld!.getNearbyCellIds(playerPosition);
    let observationTicks = 0;
    if (shell.dataset.calibrated === 'true' && worldInitialized) {
      observationTicks = observableWorld!.update(
        {
          deltaSeconds,
          elapsedRunSeconds: runClock!.snapshot().elapsedSeconds,
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
            observableWorld!.worldState.getCellView(cellId).phase === 'FIXED',
        )
      ) {
        runClock!.notifyFirstCollapse();
        hud.notifyFirstCollapse();
        hud.showSubtitle(
          locale === 'en'
            ? 'Your gaze is fixing the world.'
            : 'La mirada está fijando el mundo.',
        );
      }
    }

    if (
      observationTicks > 0 ||
      elapsedSeconds - lastWorldVisualSampleSeconds >= 0.1
    ) {
      const nextSuperposedCells: SuperpositionCell[] = [];
      maximumCharge = 0;
      focusedSuperposedCell = null;
      for (const cellId of nearbyCellIds) {
        const cell = worldState.getCellView(cellId);
        if (cell.phase === 'FIXED') {
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
          continue;
        }
        if (!isSuperpositionPhase(cell.phase)) continue;
        maximumCharge = Math.max(maximumCharge, cell.observationCharge);
        const superposedCell: SuperpositionCell = {
          cellId,
          center: cellCenterToWorld(cellId, 0),
          observationCharge: cell.observationCharge,
          frontier: hasFixedCardinalNeighbor(
            cellId,
            (neighborId) =>
              worldState.getCellView(neighborId).phase === 'FIXED',
          ),
          distanceToPlayer: Math.hypot(
            cellCenterToWorld(cellId, 0)[0] - playerPosition[0],
            cellCenterToWorld(cellId, 0)[2] - playerPosition[2],
          ),
          candidates: domainSuperpositionCandidates(
            cell.terrainDomain,
            cell.featureDomain,
          ),
        };
        nextSuperposedCells.push(superposedCell);
        if (
          focusedSuperposedCell === null ||
          cell.observationCharge > focusedSuperposedCell.observationCharge
        ) {
          focusedSuperposedCell = superposedCell;
        }
      }
      superposedCells = nextSuperposedCells;
      reticle.setCharge(maximumCharge);
      superposition.update(superposedCells, elapsedSeconds * 1_000);
      lastWorldVisualSampleSeconds = elapsedSeconds;
    }
    portraitTracker.recordFrame({
      deltaSeconds,
      playerPosition,
      inDanger:
        (wp5Preview?.snapshot().bombCount ?? 0) > 0 &&
        Math.hypot(playerPosition[0] - 64, playerPosition[2] - 64) > 14,
      unresolvedVisibleCells: superposedCells.length,
    });
    if (focusedSuperposedCell && focusedSuperposedCell.observationCharge > 0) {
      portraitTracker.recordGaze(focusedSuperposedCell.cellId, deltaSeconds);
    }
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
      const gateStatus = `WFC2 · ${wp5Snapshot.progression.collectedPacks.length}/4 SEMILLAS · ${wp5Snapshot.respawn.livesRemaining}/3 VIDAS`;
      if (wp5GateStatus.textContent !== gateStatus) {
        wp5GateStatus.textContent = gateStatus;
      }
      if (!firstDangerAnnounced && wp5Snapshot.bombCount > 0) {
        firstDangerAnnounced = true;
        narrative.play('firstDanger');
      }
      if (shell.dataset.respawnPhase !== wp5Snapshot.respawn.phase) {
        shell.dataset.respawnPhase = wp5Snapshot.respawn.phase;
      }
      for (const packId of wp5Snapshot.progression.collectedPacks) {
        if (announcedPacks.has(packId)) continue;
        announcedPacks.add(packId);
        portraitTracker.recordUnlock(packId);
        audioDirector.playUnlockCue(packId);
        audioDirector.setAmbienceScene(packId === 'forest' ? 'base' : packId);
        narrative.play(narrativeCueByPack[packId]);
        pendingSeedHints.push({
          cueId: seedHintCueByPack[packId],
          dueAtRunSeconds: runClock!.snapshot().elapsedSeconds + 8,
        });
      }
      if (wp5Snapshot.respawn.deaths > recordedDeaths) {
        portraitTracker.recordDeath();
        recordedDeaths = wp5Snapshot.respawn.deaths;
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
    hud.setCoverage(worldState.countFixedCells());
    hud.setLives(wp5Preview?.respawn.snapshot().livesRemaining ?? 3);
    audioDirector.updateCountdown(clock.remainingSeconds, clock.elapsedSeconds);
    const pendingSeedHint = pendingSeedHints[0];
    if (
      pendingSeedHint &&
      clock.elapsedSeconds >= pendingSeedHint.dueAtRunSeconds &&
      narrative.tryPlay(pendingSeedHint.cueId)
    ) {
      pendingSeedHints.shift();
    }
    const contextualSlot = Math.floor(clock.elapsedSeconds / 20);
    if (
      clock.phase === 'RUNNING' &&
      clock.remainingSeconds > 60 &&
      contextualSlot > lastContextualSlot
    ) {
      const portrait = portraitTracker.snapshot();
      const fixedCells = worldState.countFixedCells();
      const bombForecastStage = Math.min(
        4,
        Math.floor(clock.elapsedSeconds / 120),
      );
      const forecastCue = bombForecastCueByStage[bombForecastStage];
      if (
        forecastCue &&
        bombForecastStage > lastBombForecastStage &&
        narrative.tryPlay(forecastCue)
      ) {
        lastBombForecastStage = bombForecastStage;
      } else if (bombForecastStage <= lastBombForecastStage) {
        const expectedFixedCells = (clock.elapsedSeconds / 600) * 1_536;
        const category =
          recordedDeaths > 1
            ? 'death'
            : clock.elapsedSeconds >= 90 &&
                fixedCells < expectedFixedCells * 0.65
              ? 'coverage'
              : fixedCells <= contextualFixedCells
                ? 'stalled'
                : portrait.dangerExposureSeconds >= 12
                  ? 'risk'
                  : portrait.revisitRatio >= 0.25
                    ? 'revisit'
                    : portrait.averageGazeDwell >= 1.4
                      ? 'attention'
                      : portrait.maxDistance >= 18
                        ? 'distance'
                        : 'ambient';
        narrative.playPool(category, worldSeed ^ contextualSlot);
      }
      lastContextualSlot = contextualSlot;
      contextualFixedCells = fixedCells;
    }
    if (clock.phase === 'ENDING') {
      const ending = endingDirector.update(
        deltaSeconds *
          (endingDirector.snapshot().phase === 'MISSION_VIDEO'
            ? 1
            : replaySpeed),
      );
      shell.dataset.endingPhase = ending.phase;
      shell.dataset.endingPhaseElapsed = ending.phaseElapsedSeconds.toFixed(3);
      if (
        ending.phase === 'ASCENDING' ||
        (ending.phase === 'COMPLETE' && !returnRoom)
      ) {
        const ascentProgress =
          ending.progress * ending.progress * (3 - 2 * ending.progress);
        camera.position.set(
          endingCameraStart.x +
            (endingCameraPose.position[0] - endingCameraStart.x) *
              ascentProgress,
          endingCameraStart.y +
            (endingCameraPose.position[1] - endingCameraStart.y) *
              ascentProgress,
          endingCameraStart.z +
            (endingCameraPose.position[2] - endingCameraStart.z) *
              ascentProgress,
        );
        camera.lookAt(...endingCameraPose.target);
      }
      shell.dataset.endingCameraHeight = camera.position.y.toFixed(3);
      shell.dataset.endingFog = gameRenderer.scene.fog === null ? 'off' : 'on';
      if (ending.phase === 'MISSION_VIDEO') {
        if (!returnRoom) {
          fixedVisuals.root.visible = false;
          finalArt.vegetation.root.visible = false;
          originDetails.family.mesh.visible = false;
          worldBoundary.root.visible = false;
          gameRenderer.setWorldAtmosphereVisible(false);
          returnRoom = new AgencyRoom(
            gameRenderer.scene,
            locale,
            gameRenderer.textures,
            'return',
          );
          returnRoom.attachVideo(missionPlayback.video);
          shell.dataset.missionChamber = 'return';
        }
        camera.up.set(0, 1, 0);
        camera.position.copy(RETURN_ROOM_CAMERA_POSITION);
        camera.lookAt(RETURN_ROOM_SCREEN_TARGET);
        if (!missionPlaybackStarted) {
          if (audioDirector.narrationActive) {
            shell.dataset.missionAudioGate = 'waiting';
          } else {
            missionPlaybackStarted = true;
            missionPlaybackStartedAtSeconds = ending.phaseElapsedSeconds;
            delete shell.dataset.missionAudioGate;
            audioDirector.setMissionVideoActive(true);
            missionPlayback.start(
              currentSettings.volumes.master,
              currentSettings.volumes.voice,
              currentSettings.voicesEnabled,
            );
          }
        }
        if (missionPlaybackStarted) {
          missionPlayback.update(
            ending.phaseElapsedSeconds - missionPlaybackStartedAtSeconds,
          );
        }
        returnRoom.update(elapsedSeconds, false);
      }
      if (ending.phase === 'COMPLETE' && !resultPresented) {
        resultPresented = true;
        if (missionPlaybackStarted) {
          missionPlayback.stop();
          audioDirector.setMissionVideoActive(false);
        }
        runClock!.markComplete();
        const portrait = portraitTracker.snapshot();
        const profile = classifyAttentionPortrait(portrait);
        const haiku = generateHaiku(worldSeed, portrait, profile, locale);
        const closure = closureForSeedCount(finalCollectedPacks.length);
        const result: RunResult = {
          endingVariant,
          endingReason: runEndReason,
          livesRemaining: finalLivesRemaining,
          finalFixedCells,
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
        if (runEndReason !== 'LIVES_EXHAUSTED') narrative.play('final');
        resultsPanel.show(result);
        shell.dataset.complete = 'true';
      }
    }
    debugOverlay?.update();
    finalArt.update(elapsedSeconds);
    gameRenderer.render();
  });

  const startCalibration = async (): Promise<void> => {
    if (shell.dataset.calibration === 'pending') return;
    shell.dataset.calibration = 'pending';
    systemState.textContent = locale === 'en' ? 'CALIBRATING' : 'CALIBRANDO';
    shellStatus.textContent =
      locale === 'en'
        ? 'Requesting gaze control…'
        : 'Solicitando control de mirada…';
    observationButton.disabled = true;
    observationButton
      .querySelector('span')
      ?.replaceChildren(
        locale === 'en' ? 'Calibrating gaze…' : 'Calibrando mirada…',
      );
    playerInput.setEnabled(true);

    // Start both privileged operations synchronously from the same gesture.
    // Audio is optional; Pointer Lock is the transactional calibration gate.
    void briefing.authorizeAudioFromGesture();
    missionPlayback.authorizeFromGesture();
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
        shellStatus.textContent = copy.audioUnavailable;
      }
    });

    if (!pointerLockAcquired) {
      playerInput.setEnabled(false);
      shell.dataset.calibration = 'error';
      shell.dataset.calibrated = 'false';
      systemState.textContent = copy.waiting;
      shellStatus.textContent = copy.calibrationFailed;
      observationButton.disabled = false;
      observationButton
        .querySelector('span')
        ?.replaceChildren(copy.retryCalibration);
      return;
    }

    const readyPlayerPhysics = await playerPhysicsPromise;
    if (!readyPlayerPhysics) {
      playerInput.setEnabled(false);
      shell.dataset.calibration = 'error';
      shell.dataset.calibrated = 'false';
      systemState.textContent =
        locale === 'en' ? 'PHYSICS UNAVAILABLE' : 'FÍSICA NO DISPONIBLE';
      shellStatus.textContent = copy.physicsUnavailable;
      observationButton.disabled = false;
      observationButton
        .querySelector('span')
        ?.replaceChildren(copy.retryCalibration);
      return;
    }
    readyPlayerPhysics.activatePrologueRoom();
    readyPlayerPhysics.controller.respawn(PROLOGUE_ROOM_SPAWN);
    camera.lookAt(64, 1.05, 64);
    audioDirector.setAmbienceScene('room');

    shell.dataset.calibration = 'ready';
    shell.dataset.calibrated = 'true';
    systemState.textContent = locale === 'en' ? 'IN CHAMBER' : 'EN CÁMARA';
    shellStatus.textContent = copy.roomHint;
    observationButton
      .querySelector('span')
      ?.replaceChildren(
        locale === 'en' ? 'Gaze calibrated' : 'Mirada calibrada',
      );
    narrative.play('start');
  };

  observationButton.addEventListener('click', () => void startCalibration(), {
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
  if (enterFromLanguageGesture) void startCalibration();

  return () => {
    disposed = true;
    abortController.abort();
    gameLoop.stop();
    solverWorker.dispose();
    reticle.destroy();
    hud.destroy();
    debugOverlay?.destroy();
    pauseMenu?.destroy();
    missionPlayback.dispose();
    audioDirector.dispose();
    briefing.dispose();
    objectivesAudio.pause();
    room?.dispose();
    returnRoom?.dispose();
    superposition.dispose();
    fixedVisuals.dispose();
    wp5Visuals?.dispose();
    progressionHud?.destroy();
    originDetails.dispose();
    worldBoundary.dispose();
    stopQualitySync();
    finalArt.dispose();
    if (
      (window as PerformanceWindow).__ULTIMA_OBSERVATION_PERFORMANCE__ ===
      performanceSnapshot
    ) {
      delete (window as PerformanceWindow).__ULTIMA_OBSERVATION_PERFORMANCE__;
    }
    gameRenderer.dispose();
    playerInput.dispose();
    playerPhysics?.dispose();
  };
}
