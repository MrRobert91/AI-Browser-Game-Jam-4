import type { AudioVolumes } from '../audio/audio-director';
import type { QualityPreset } from '../render/quality';

export interface GameSettings {
  readonly mouseSensitivity: number;
  readonly invertY: boolean;
  readonly headBobEnabled: boolean;
  readonly reducedFlashes: boolean;
  readonly highContrast: boolean;
  readonly subtitles: boolean;
  readonly quality: QualityPreset;
  readonly volumes: AudioVolumes;
}

interface MutableGameSettings {
  mouseSensitivity: number;
  invertY: boolean;
  headBobEnabled: boolean;
  reducedFlashes: boolean;
  highContrast: boolean;
  subtitles: boolean;
  quality: QualityPreset;
  volumes: { master: number; music: number; effects: number };
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mouseSensitivity: 0.002,
  invertY: false,
  headBobEnabled: true,
  reducedFlashes: true,
  highContrast: false,
  subtitles: true,
  quality: 'auto',
  volumes: { master: 0.75, music: 0.55, effects: 0.75 },
};

const STORAGE_KEY = 'ultima-observacion.settings.v1';
const QUALITY_PRESETS = new Set<QualityPreset>([
  'auto',
  'low',
  'medium',
  'high',
]);

function finiteRange(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

export function normalizeGameSettings(value: unknown): GameSettings {
  const candidate =
    typeof value === 'object' && value !== null
      ? (value as Partial<GameSettings>)
      : {};
  const volumes =
    typeof candidate.volumes === 'object' && candidate.volumes !== null
      ? candidate.volumes
      : DEFAULT_GAME_SETTINGS.volumes;
  const quality = QUALITY_PRESETS.has(candidate.quality as QualityPreset)
    ? (candidate.quality as QualityPreset)
    : DEFAULT_GAME_SETTINGS.quality;
  return {
    mouseSensitivity: finiteRange(
      candidate.mouseSensitivity,
      DEFAULT_GAME_SETTINGS.mouseSensitivity,
      0.0001,
      0.02,
    ),
    invertY: candidate.invertY ?? DEFAULT_GAME_SETTINGS.invertY,
    headBobEnabled:
      candidate.headBobEnabled ?? DEFAULT_GAME_SETTINGS.headBobEnabled,
    reducedFlashes:
      candidate.reducedFlashes ?? DEFAULT_GAME_SETTINGS.reducedFlashes,
    highContrast: candidate.highContrast ?? DEFAULT_GAME_SETTINGS.highContrast,
    subtitles: candidate.subtitles ?? DEFAULT_GAME_SETTINGS.subtitles,
    quality,
    volumes: {
      master: finiteRange(volumes.master, 0.75, 0, 1),
      music: finiteRange(volumes.music, 0.55, 0, 1),
      effects: finiteRange(volumes.effects, 0.75, 0, 1),
    },
  };
}

export function loadGameSettings(
  storage: Storage = window.localStorage,
): GameSettings {
  try {
    const serialized = storage.getItem(STORAGE_KEY);
    return serialized
      ? normalizeGameSettings(JSON.parse(serialized) as unknown)
      : DEFAULT_GAME_SETTINGS;
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

export function saveGameSettings(
  settings: GameSettings,
  storage: Storage = window.localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in privacy contexts; settings still apply in memory.
  }
}

export interface PauseMenuHandlers {
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSettingsChange: (settings: GameSettings) => void;
}

export class PauseMenu {
  readonly element: HTMLElement;
  private readonly abortController = new AbortController();
  private settings: GameSettings;
  private restartTimer: number | null = null;
  private open = false;

  constructor(
    parent: HTMLElement,
    initialSettings: GameSettings,
    private readonly handlers: PauseMenuHandlers,
  ) {
    this.settings = initialSettings;
    this.element = document.createElement('section');
    this.element.className = 'pause-menu';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Pausa y opciones');
    this.element.innerHTML = `
      <div class="pause-menu__panel">
        <p>INSTRUMENTO EN PAUSA</p>
        <h2>Pausa</h2>
        <button type="button" data-resume>Continuar observación</button>
        <div class="pause-menu__options">
          <label>Sensibilidad <input data-setting="sensitivity" type="range" min="0.0005" max="0.008" step="0.0005"></label>
          <label><input data-setting="invertY" type="checkbox"> Invertir eje Y</label>
          <label><input data-setting="headBob" type="checkbox"> Cabeceo reducido</label>
          <label><input data-setting="reducedFlashes" type="checkbox"> Destellos reducidos</label>
          <label><input data-setting="highContrast" type="checkbox"> Superposición de alto contraste</label>
          <label><input data-setting="subtitles" type="checkbox"> Subtítulos</label>
          <label>Calidad <select data-setting="quality"><option value="auto">Automática</option><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
          <label>Volumen maestro <input data-setting="master" type="range" min="0" max="1" step="0.05"></label>
          <label>Música <input data-setting="music" type="range" min="0" max="1" step="0.05"></label>
          <label>Efectos <input data-setting="effects" type="range" min="0" max="1" step="0.05"></label>
        </div>
        <button class="pause-menu__restart" type="button" data-restart>Reiniciar · mantén R durante 2 s</button>
      </div>
    `;
    parent.append(this.element);
    this.syncControls();
    const signal = this.abortController.signal;
    this.element
      .querySelector('[data-resume]')
      ?.addEventListener('click', handlers.onResume, { signal });
    this.element.addEventListener('input', this.handleInput, { signal });
    document.addEventListener('keydown', this.handleKeyDown, { signal });
    document.addEventListener('keyup', this.handleKeyUp, { signal });
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.element.hidden = !open;
    this.element.setAttribute('aria-hidden', String(!open));
    if (!open) this.cancelRestart();
    else
      this.element.querySelector<HTMLButtonElement>('[data-resume]')?.focus();
  }

  destroy(): void {
    this.cancelRestart();
    this.abortController.abort();
    this.element.remove();
  }

  private readonly handleInput = (event: Event): void => {
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ))
      return;
    const key = target.dataset.setting;
    const next: MutableGameSettings = {
      ...this.settings,
      volumes: { ...this.settings.volumes },
    };
    if (key === 'sensitivity' && target instanceof HTMLInputElement) {
      next.mouseSensitivity = Number(target.value);
    } else if (key === 'invertY' && target instanceof HTMLInputElement) {
      next.invertY = target.checked;
    } else if (key === 'headBob' && target instanceof HTMLInputElement) {
      next.headBobEnabled = target.checked;
    } else if (key === 'reducedFlashes' && target instanceof HTMLInputElement) {
      next.reducedFlashes = target.checked;
    } else if (key === 'highContrast' && target instanceof HTMLInputElement) {
      next.highContrast = target.checked;
    } else if (key === 'subtitles' && target instanceof HTMLInputElement) {
      next.subtitles = target.checked;
    } else if (key === 'quality' && target instanceof HTMLSelectElement) {
      next.quality = target.value as QualityPreset;
    } else if (key === 'master' && target instanceof HTMLInputElement) {
      next.volumes.master = Number(target.value);
    } else if (key === 'music' && target instanceof HTMLInputElement) {
      next.volumes.music = Number(target.value);
    } else if (key === 'effects' && target instanceof HTMLInputElement) {
      next.volumes.effects = Number(target.value);
    } else {
      return;
    }
    this.settings = normalizeGameSettings(next);
    saveGameSettings(this.settings);
    this.handlers.onSettingsChange(this.settings);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.open ||
      event.code !== 'KeyR' ||
      event.repeat ||
      this.restartTimer !== null
    )
      return;
    this.element.dataset.restartHolding = 'true';
    this.restartTimer = window.setTimeout(() => {
      this.restartTimer = null;
      this.handlers.onRestart();
    }, 2_000);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'KeyR') this.cancelRestart();
  };

  private cancelRestart(): void {
    if (this.restartTimer !== null) window.clearTimeout(this.restartTimer);
    this.restartTimer = null;
    delete this.element.dataset.restartHolding;
  }

  private syncControls(): void {
    const setInput = (key: string, value: string | number | boolean): void => {
      const input = this.element.querySelector<
        HTMLInputElement | HTMLSelectElement
      >(`[data-setting="${key}"]`);
      if (input instanceof HTMLInputElement && typeof value === 'boolean')
        input.checked = value;
      else if (input) input.value = String(value);
    };
    setInput('sensitivity', this.settings.mouseSensitivity);
    setInput('invertY', this.settings.invertY);
    setInput('headBob', this.settings.headBobEnabled);
    setInput('reducedFlashes', this.settings.reducedFlashes);
    setInput('highContrast', this.settings.highContrast);
    setInput('subtitles', this.settings.subtitles);
    setInput('quality', this.settings.quality);
    setInput('master', this.settings.volumes.master);
    setInput('music', this.settings.volumes.music);
    setInput('effects', this.settings.volumes.effects);
  }
}
