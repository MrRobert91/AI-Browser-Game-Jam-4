import type { UnlockablePackId } from '../contracts/tiles';
import { MusicStemBank } from './music-stems';
import { SpatialAudioPool } from './spatial-pool';

export interface AudioVolumes {
  readonly master: number;
  readonly music: number;
  readonly effects: number;
}

export interface EnvironmentMix {
  readonly fixed: number;
  readonly unresolved: number;
}

export interface AudioDirectorOptions {
  readonly createContext?: () => AudioContext;
}

interface ContinuousVoice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
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

/** Local procedural score. It allocates no AudioContext before a user gesture. */
export class AudioDirector {
  private readonly createContext: () => AudioContext;
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private unresolvedVoice: ContinuousVoice | null = null;
  private fixedVoice: ContinuousVoice | null = null;
  private observationVoice: ContinuousVoice | null = null;
  private uncertaintyVoice: ContinuousVoice | null = null;
  private stems: MusicStemBank | null = null;
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

  setEnvironmentMix(mix: EnvironmentMix): void {
    const now = this.context?.currentTime;
    if (now === undefined) return;
    this.unresolvedVoice?.gain.gain.setTargetAtTime(
      clamp01(mix.unresolved) * 0.035,
      now,
      0.25,
    );
    this.fixedVoice?.gain.gain.setTargetAtTime(
      clamp01(mix.fixed) * 0.028,
      now,
      0.25,
    );
  }

  setObservationCharge(charge: number): void {
    const now = this.context?.currentTime;
    if (now === undefined || !this.observationVoice) return;
    const normalized = clamp01(charge);
    this.observationVoice.oscillator.frequency.setTargetAtTime(
      320 + normalized * 520,
      now,
      0.035,
    );
    this.observationVoice.gain.gain.setTargetAtTime(
      normalized * 0.07,
      now,
      0.025,
    );
  }

  setUncertaintyObserved(observed: boolean): void {
    const now = this.context?.currentTime;
    if (now === undefined || !this.uncertaintyVoice) return;
    this.uncertaintyVoice.gain.gain.setTargetAtTime(
      observed ? 0 : 0.035,
      now,
      0.04,
    );
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

  unlockStem(packId: UnlockablePackId): void {
    if (this.stems?.unlock(packId)) {
      this.spatialPool?.play({
        frequency: 330,
        durationSeconds: 0.8,
        gain: 0.12,
      });
    }
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
    this.stems?.dispose();
    for (const voice of [
      this.unresolvedVoice,
      this.fixedVoice,
      this.observationVoice,
      this.uncertaintyVoice,
    ]) {
      if (!voice) continue;
      voice.oscillator.stop();
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    void this.context?.close();
    this.context = null;
    this.masterBus = null;
    this.musicBus = null;
    this.effectsBus = null;
  }

  private async performStart(): Promise<boolean> {
    if (!this.context) {
      try {
        this.initialize(this.createContext());
      } catch {
        return false;
      }
    }
    try {
      await this.context!.resume();
      return this.context!.state === 'running';
    } catch {
      return false;
    }
  }

  private initialize(context: AudioContext): void {
    this.context = context;
    this.masterBus = context.createGain();
    this.musicBus = context.createGain();
    this.effectsBus = context.createGain();
    this.musicBus.connect(this.masterBus);
    this.effectsBus.connect(this.masterBus);
    this.masterBus.connect(context.destination);
    this.unresolvedVoice = this.createContinuousVoice(
      'sawtooth',
      73.42,
      this.effectsBus,
    );
    this.fixedVoice = this.createContinuousVoice(
      'sine',
      174.61,
      this.effectsBus,
    );
    this.observationVoice = this.createContinuousVoice(
      'sine',
      320,
      this.effectsBus,
    );
    this.uncertaintyVoice = this.createContinuousVoice(
      'triangle',
      116.54,
      this.effectsBus,
    );
    this.stems = new MusicStemBank(context, this.musicBus);
    this.spatialPool = new SpatialAudioPool(context, this.effectsBus);
    this.setVolumes(this.volumes);
    this.setEnvironmentMix({ fixed: 0, unresolved: 1 });
    this.setObservationCharge(0);
    this.setUncertaintyObserved(true);
  }

  private createContinuousVoice(
    type: OscillatorType,
    frequency: number,
    destination: AudioNode,
  ): ContinuousVoice {
    const oscillator = this.context!.createOscillator();
    const gain = this.context!.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    return { oscillator, gain };
  }
}
