export interface PlayerInputSettings {
  readonly mouseSensitivity: number;
  readonly invertY: boolean;
  readonly headBobEnabled: boolean;
}

export interface MovementIntent {
  readonly x: number;
  readonly forward: number;
  readonly sprint: boolean;
}

export interface LookDelta {
  readonly x: number;
  readonly y: number;
}

export interface PlayerInputHandlers {
  readonly onPauseChange?: (paused: boolean) => void;
}

const DEFAULT_SETTINGS: PlayerInputSettings = {
  mouseSensitivity: 0.002,
  invertY: false,
  headBobEnabled: true,
};

export class PlayerInput {
  readonly #pointerTarget: HTMLElement;
  readonly #handlers: PlayerInputHandlers;
  readonly #abortController = new AbortController();
  readonly #keys = new Set<string>();
  #settings: PlayerInputSettings = DEFAULT_SETTINGS;
  #lookX = 0;
  #lookY = 0;
  #jumpQueued = false;
  #enabled = false;
  #paused = true;
  #resumePromise: Promise<void> | null = null;

  constructor(pointerTarget: HTMLElement, handlers: PlayerInputHandlers = {}) {
    this.#pointerTarget = pointerTarget;
    this.#handlers = handlers;
    const signal = this.#abortController.signal;
    document.addEventListener('keydown', this.#handleKeyDown, { signal });
    document.addEventListener('keyup', this.#handleKeyUp, { signal });
    document.addEventListener('mousemove', this.#handleMouseMove, { signal });
    document.addEventListener(
      'pointerlockchange',
      this.#handlePointerLockChange,
      {
        signal,
      },
    );
    window.addEventListener('blur', this.#handleBlur, { signal });
    pointerTarget.addEventListener('click', this.#handlePointerTargetClick, {
      signal,
    });
  }

  get paused(): boolean {
    return this.#paused;
  }

  get settings(): PlayerInputSettings {
    return this.#settings;
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (!enabled) this.pause();
  }

  setSettings(settings: Partial<PlayerInputSettings>): void {
    const mouseSensitivity =
      settings.mouseSensitivity ?? this.#settings.mouseSensitivity;
    if (
      !Number.isFinite(mouseSensitivity) ||
      mouseSensitivity < 0.0001 ||
      mouseSensitivity > 0.02
    ) {
      throw new RangeError('mouseSensitivity must be between 0.0001 and 0.02');
    }
    this.#settings = {
      mouseSensitivity,
      invertY: settings.invertY ?? this.#settings.invertY,
      headBobEnabled: settings.headBobEnabled ?? this.#settings.headBobEnabled,
    };
  }

  movementIntent(): MovementIntent {
    return movementIntentFromKeys(this.#keys);
  }

  consumeLookDelta(): LookDelta {
    const delta = { x: this.#lookX, y: this.#lookY };
    this.#lookX = 0;
    this.#lookY = 0;
    return delta;
  }

  consumeJump(): boolean {
    const queued = this.#jumpQueued;
    this.#jumpQueued = false;
    return queued;
  }

  resume(): Promise<void> {
    if (!this.#enabled) return Promise.resolve();
    this.#resumePromise ??= this.#performResume().finally(() => {
      this.#resumePromise = null;
    });
    return this.#resumePromise;
  }

  async #performResume(): Promise<void> {
    try {
      if (document.pointerLockElement !== this.#pointerTarget) {
        await this.#pointerTarget.requestPointerLock();
      }
      this.#setPaused(false);
    } catch {
      this.#setPaused(true);
    }
  }

  pause(): void {
    this.#keys.clear();
    this.#jumpQueued = false;
    if (document.pointerLockElement === this.#pointerTarget) {
      document.exitPointerLock();
    }
    this.#setPaused(true);
  }

  dispose(): void {
    this.pause();
    this.#abortController.abort();
  }

  readonly #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      this.pause();
      return;
    }
    if (this.#paused) return;
    if (event.code === 'Space' && !event.repeat) {
      this.#jumpQueued = true;
      event.preventDefault();
    }
    if (isMovementCode(event.code)) this.#keys.add(event.code);
  };

  readonly #handleKeyUp = (event: KeyboardEvent): void => {
    this.#keys.delete(event.code);
  };

  readonly #handleMouseMove = (event: MouseEvent): void => {
    if (this.#paused || document.pointerLockElement !== this.#pointerTarget)
      return;
    this.#lookX += event.movementX;
    this.#lookY += event.movementY;
  };

  readonly #handlePointerLockChange = (): void => {
    if (document.pointerLockElement !== this.#pointerTarget) {
      this.#keys.clear();
      this.#setPaused(true);
    } else if (this.#enabled) {
      this.#setPaused(false);
    }
  };

  readonly #handleBlur = (): void => {
    this.pause();
  };

  readonly #handlePointerTargetClick = (): void => {
    if (this.#enabled && this.#paused) void this.resume();
  };

  #setPaused(paused: boolean): void {
    if (this.#paused === paused) return;
    this.#paused = paused;
    this.#handlers.onPauseChange?.(paused);
  }
}

export function movementIntentFromKeys(
  keys: ReadonlySet<string>,
): MovementIntent {
  const horizontal =
    Number(keys.has('KeyD') || keys.has('ArrowRight')) -
    Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const forward =
    Number(keys.has('KeyW') || keys.has('ArrowUp')) -
    Number(keys.has('KeyS') || keys.has('ArrowDown'));
  const length = Math.hypot(horizontal, forward);
  const normalization = length > 1 ? 1 / length : 1;
  return {
    x: horizontal * normalization,
    forward: forward * normalization,
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

function isMovementCode(code: string): boolean {
  return (
    code === 'KeyW' ||
    code === 'KeyA' ||
    code === 'KeyS' ||
    code === 'KeyD' ||
    code === 'ArrowUp' ||
    code === 'ArrowDown' ||
    code === 'ArrowLeft' ||
    code === 'ArrowRight' ||
    code === 'ShiftLeft' ||
    code === 'ShiftRight'
  );
}
