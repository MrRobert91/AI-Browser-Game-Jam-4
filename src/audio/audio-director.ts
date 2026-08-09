import type { UnlockablePackId } from '../contracts/tiles';
import { createCustomSongElement } from './custom-song';
import { SpatialAudioPool } from './spatial-pool';

export interface AudioVolumes {
  readonly master: number;
  readonly music: number;
  readonly effects: number;
}

export interface AudioDirectorOptions {
  readonly createContext?: () => AudioContext;
  readonly createMusicElement?: () => HTMLAudioElement;
}

const DEFAULT_VOLUMES: AudioVolumes = {
  master: 0.75,
  music: 0.55,
  effects: 0.75,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function countdownPulseInterval(
  remainingSeconds: number,
): number | null {
  if (remainingSeconds <= 0 || remainingSeconds > 60) return null;
  return remainingSeconds <= 30 ? 1 : 2.5;
}

/** Local generated score. It allocates no AudioContext before a user gesture. */
export class AudioDirector {
  private readonly createContext: () => AudioContext;
  private readonly createMusicElement: () => HTMLAudioElement;
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private musicElement: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private spatialPool: SpatialAudioPool | null = null;
  private volumes: AudioVolumes = DEFAULT_VOLUMES;
  private lastCountdownPulse = Number.NEGATIVE_INFINITY;
  private startPromise: Promise<boolean> | null = null;

  constructor(options: AudioDirectorOptions = {}) {
    this.createContext =
      options.createContext ??
      (() => {
        const Context = window.AudioContext;
        return new Context();
      });
    this.createMusicElement =
      options.createMusicElement ?? createCustomSongElement;
  }

  get started(): boolean {
    return this.context !== null;
  }

  get activeSpatialSources(): number {
    return this.spatialPool?.activeCount ?? 0;
  }

  startFromGesture(): Promise<boolean> {
    this.startPromise ??= this.performStart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  setVolumes(volumes: AudioVolumes): void {
    this.volumes = {
      master: clamp01(volumes.master),
      music: clamp01(volumes.music),
      effects: clamp01(volumes.effects),
    };
    const now = this.context?.currentTime ?? 0;
    this.masterBus?.gain.setTargetAtTime(this.volumes.master, now, 0.04);
    this.musicBus?.gain.setTargetAtTime(this.volumes.music, now, 0.04);
    this.effectsBus?.gain.setTargetAtTime(this.volumes.effects, now, 0.04);
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.musicElement?.pause();
      return;
    }
    void this.context?.resume().catch(() => undefined);
    void this.musicElement?.play().catch(() => undefined);
  }

  notifyCollapse(pan = 0): void {
    this.spatialPool?.play({
      frequency: 520,
      durationSeconds: 0.34,
      gain: 0.16,
      pan,
    });
  }

  playNarrativeCue(): void {
    this.spatialPool?.play({
      frequency: 246.94,
      durationSeconds: 0.5,
      gain: 0.08,
    });
  }

  playUnlockCue(packId: UnlockablePackId): void {
    const packPitch: Readonly<Record<UnlockablePackId, number>> = {
      water: 293.66,
      forest: 349.23,
      ruin: 220,
      storm: 440,
    };
    this.spatialPool?.play({
      frequency: packPitch[packId],
      durationSeconds: 0.8,
      gain: 0.12,
    });
  }

  updateCountdown(remainingSeconds: number, elapsedSeconds: number): void {
    const interval = countdownPulseInterval(remainingSeconds);
    if (
      interval === null ||
      elapsedSeconds - this.lastCountdownPulse < interval
    ) {
      return;
    }
    this.lastCountdownPulse = elapsedSeconds;
    this.spatialPool?.play({
      frequency: remainingSeconds <= 30 ? 82.41 : 65.41,
      durationSeconds: remainingSeconds <= 30 ? 0.22 : 0.35,
      gain: remainingSeconds <= 30 ? 0.16 : 0.1,
    });
  }

  dispose(): void {
    this.spatialPool?.dispose();
    this.musicElement?.pause();
    this.musicSource?.disconnect();
    void this.context?.close();
    this.context = null;
    this.masterBus = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.musicElement = null;
    this.musicSource = null;
  }

  private async performStart(): Promise<boolean> {
    if (!this.context) {
      try {
        this.initialize(this.createContext());
      } catch {
        return false;
      }
    }
    const contextStart = this.context!.resume()
      .then(() => this.context!.state === 'running')
      .catch(() => false);
    const musicStart = this.musicElement!.play()
      .then(() => true)
      .catch(() => false);
    const [contextStarted, musicStarted] = await Promise.all([
      contextStart,
      musicStart,
    ]);
    return contextStarted && musicStarted;
  }

  private initialize(context: AudioContext): void {
    this.context = context;
    this.masterBus = context.createGain();
    this.musicBus = context.createGain();
    this.effectsBus = context.createGain();
    this.musicBus.connect(this.masterBus);
    this.effectsBus.connect(this.masterBus);
    this.masterBus.connect(context.destination);
    this.musicElement = this.createMusicElement();
    this.musicElement.loop = true;
    this.musicElement.preload = 'auto';
    this.musicSource = context.createMediaElementSource(this.musicElement);
    this.musicSource.connect(this.musicBus);
    this.spatialPool = new SpatialAudioPool(context, this.effectsBus);
    this.setVolumes(this.volumes);
  }
}
