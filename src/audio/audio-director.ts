import type { UnlockablePackId } from '../contracts/tiles';
import type { CollapsadorRecord } from '../gameplay/collapsador-records';
import type { ResolvedNarrativeCue } from '../gameplay/narrative';
import { createCustomSongElement } from './custom-song';
import {
  collapsadorRecordVoicePath,
  narrativeVoicePath,
} from './narrative-voices';
import { SpatialAudioPool } from './spatial-pool';

export interface AudioVolumes {
  readonly master: number;
  readonly music: number;
  readonly effects: number;
}

export interface AudioDirectorOptions {
  readonly createContext?: () => AudioContext;
  readonly createMusicElement?: () => HTMLAudioElement;
  readonly createVoiceElement?: () => HTMLAudioElement;
}

interface VoiceRequest {
  readonly path: string;
  readonly priority: number;
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
  private readonly createVoiceElement: () => HTMLAudioElement;
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private musicElement: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private voiceElement: HTMLAudioElement | null = null;
  private voiceSource: MediaElementAudioSourceNode | null = null;
  private spatialPool: SpatialAudioPool | null = null;
  private volumes: AudioVolumes = DEFAULT_VOLUMES;
  private lastCountdownPulse = Number.NEGATIVE_INFINITY;
  private startPromise: Promise<boolean> | null = null;
  private voiceEnabled = true;
  private activeVoice: VoiceRequest | null = null;
  private readonly voiceQueue: VoiceRequest[] = [];

  constructor(options: AudioDirectorOptions = {}) {
    this.createContext =
      options.createContext ??
      (() => {
        const Context = window.AudioContext;
        return new Context();
      });
    this.createMusicElement =
      options.createMusicElement ?? createCustomSongElement;
    this.createVoiceElement = options.createVoiceElement ?? (() => new Audio());
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
    this.voiceBus?.gain.setTargetAtTime(
      this.voiceEnabled ? this.volumes.effects : 0,
      now,
      0.04,
    );
  }

  setVoicesEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    const now = this.context?.currentTime ?? 0;
    this.voiceBus?.gain.setTargetAtTime(
      enabled ? this.volumes.effects : 0,
      now,
      0.04,
    );
    if (!enabled) {
      this.voiceElement?.pause();
      this.activeVoice = null;
      this.voiceQueue.length = 0;
      this.restoreMusicAfterVoice();
    }
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.musicElement?.pause();
      this.voiceElement?.pause();
      return;
    }
    void this.context?.resume().catch(() => undefined);
    void this.musicElement?.play().catch(() => undefined);
    if (this.activeVoice) void this.voiceElement?.play().catch(() => undefined);
  }

  notifyCollapse(pan = 0): void {
    this.spatialPool?.play({
      frequency: 520,
      durationSeconds: 0.34,
      gain: 0.16,
      pan,
    });
  }

  playNarrativeCue(cue?: ResolvedNarrativeCue): void {
    if (!cue) return;
    this.enqueueVoice({
      path: narrativeVoicePath(cue.id),
      priority: cue.priority,
    });
  }

  playCollapsadorRecord(record: CollapsadorRecord): void {
    this.enqueueVoice({
      path: collapsadorRecordVoicePath(record),
      priority: record.priority,
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
    this.voiceElement?.pause();
    this.musicSource?.disconnect();
    this.voiceSource?.disconnect();
    void this.context?.close();
    this.context = null;
    this.masterBus = null;
    this.musicBus = null;
    this.effectsBus = null;
    this.voiceBus = null;
    this.musicElement = null;
    this.musicSource = null;
    this.voiceElement = null;
    this.voiceSource = null;
    this.activeVoice = null;
    this.voiceQueue.length = 0;
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
    this.voiceBus = context.createGain();
    this.musicBus.connect(this.masterBus);
    this.effectsBus.connect(this.masterBus);
    this.voiceBus.connect(this.masterBus);
    this.masterBus.connect(context.destination);
    this.musicElement = this.createMusicElement();
    this.musicElement.loop = true;
    this.musicElement.preload = 'auto';
    this.musicSource = context.createMediaElementSource(this.musicElement);
    this.musicSource.connect(this.musicBus);
    this.voiceElement = this.createVoiceElement();
    this.voiceElement.preload = 'auto';
    this.voiceElement.onended = () => this.finishVoice();
    this.voiceElement.onerror = () => this.finishVoice();
    this.voiceSource = context.createMediaElementSource(this.voiceElement);
    this.voiceSource.connect(this.voiceBus);
    this.spatialPool = new SpatialAudioPool(context, this.effectsBus);
    this.setVolumes(this.volumes);
  }

  private enqueueVoice(request: VoiceRequest): void {
    if (!this.voiceEnabled || !this.voiceElement) return;
    if (!this.activeVoice) {
      this.startVoice(request);
      return;
    }
    if (request.priority > this.activeVoice.priority) {
      this.voiceElement.pause();
      this.startVoice(request);
      return;
    }
    if (this.voiceQueue.length >= 2) return;
    this.voiceQueue.push(request);
    this.voiceQueue.sort((left, right) => right.priority - left.priority);
  }

  private startVoice(request: VoiceRequest): void {
    if (!this.voiceElement) return;
    this.activeVoice = request;
    this.voiceElement.src = request.path;
    this.voiceElement.currentTime = 0;
    const now = this.context?.currentTime ?? 0;
    this.musicBus?.gain.setTargetAtTime(this.volumes.music * 0.32, now, 0.18);
    void this.voiceElement.play().catch(() => this.finishVoice());
  }

  private finishVoice(): void {
    this.activeVoice = null;
    const next = this.voiceQueue.shift();
    if (next) this.startVoice(next);
    else this.restoreMusicAfterVoice();
  }

  private restoreMusicAfterVoice(): void {
    const now = this.context?.currentTime ?? 0;
    this.musicBus?.gain.setTargetAtTime(this.volumes.music, now, 0.24);
  }
}
