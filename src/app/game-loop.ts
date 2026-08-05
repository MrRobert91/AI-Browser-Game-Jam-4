export interface GameLoopFrame {
  readonly deltaSeconds: number;
  readonly elapsedSeconds: number;
}

export type GameLoopUpdate = (frame: GameLoopFrame) => void;

const MAX_DELTA_SECONDS = 0.1;

export class GameLoop {
  readonly #update: GameLoopUpdate;
  #animationFrameId: number | null = null;
  #elapsedSeconds = 0;
  #lastTimestamp: number | null = null;

  constructor(update: GameLoopUpdate) {
    this.#update = update;
  }

  get running(): boolean {
    return this.#animationFrameId !== null;
  }

  start(): void {
    if (this.running) return;

    this.#lastTimestamp = null;
    this.#animationFrameId = window.requestAnimationFrame(this.#tick);
  }

  stop(): void {
    if (this.#animationFrameId !== null) {
      window.cancelAnimationFrame(this.#animationFrameId);
    }

    this.#animationFrameId = null;
    this.#lastTimestamp = null;
  }

  readonly #tick = (timestamp: number): void => {
    if (this.#animationFrameId === null) return;

    const rawDeltaSeconds =
      this.#lastTimestamp === null
        ? 0
        : (timestamp - this.#lastTimestamp) / 1_000;
    const deltaSeconds = Math.min(
      Math.max(rawDeltaSeconds, 0),
      MAX_DELTA_SECONDS,
    );

    this.#lastTimestamp = timestamp;
    this.#elapsedSeconds += deltaSeconds;
    this.#update({ deltaSeconds, elapsedSeconds: this.#elapsedSeconds });
    this.#animationFrameId = window.requestAnimationFrame(this.#tick);
  };
}
