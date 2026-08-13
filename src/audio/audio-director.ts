import type { UnlockablePackId } from '../contracts/tiles';
import type { ResolvedNarrativeCue } from '../gameplay/narrative';
import { narrativeVoicePath } from './narrative-voices';
import { SpatialAudioPool } from './spatial-pool';

export interface AudioVolumes {
  readonly master: number;
  readonly voice: number;
  readonly ambience: number;
  readonly effects: number;
}

export type AudioPlaybackStatus =
  'idle' | 'ready' | 'playing' | 'blocked' | 'error';

export type AmbienceScene = 'room' | 'base' | 'water' | 'ruin' | 'storm';

export interface AudioPlaybackSnapshot {
  readonly status: AudioPlaybackStatus;
  readonly activeClipId: string | null;
  readonly error: string | null;
}

export interface AudioDirectorOptions {
  readonly createContext?: () => AudioContext;
  readonly createVoiceElement?: () => HTMLAudioElement;
  readonly createAmbienceElement?: (
    scene: AmbienceScene,
    path: string,
  ) => HTMLAudioElement;
  readonly onStateChange?: (snapshot: AudioPlaybackSnapshot) => void;
}

interface VoiceRequest {
  readonly id: string;
  readonly path: string;
  readonly isContextValid: () => boolean;
}

interface AmbienceTrack {
  readonly element: HTMLAudioElement;
  readonly source: MediaElementAudioSourceNode;
  readonly gain: GainNode;
}

const AMBIENCE_PATHS: Readonly<Record<AmbienceScene, string>> = {
  room: '/assets/audio/ambience/room.mp3',
  base: '/assets/audio/ambience/base.mp3',
  water: '/assets/audio/ambience/water.mp3',
  ruin: '/assets/audio/ambience/ruin.mp3',
  storm: '/assets/audio/ambience/storm.mp3',
};

const DEFAULT_VOLUMES: AudioVolumes = {
  master: 0.75,
  voice: 0.78,
  ambience: 0.55,
  effects: 0.75,
};

const MEDIA_UNLOCK_SILENCE_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function countdownPulseInterval(
  remainingSeconds: number,
): number | null {
  if (remainingSeconds <= 0 || remainingSeconds > 60) return null;
  return remainingSeconds <= 30 ? 1 : 2.5;
}

/** Local-only Web Audio graph. Authorization depends solely on AudioContext. */
export class AudioDirector {
  private readonly createContext: () => AudioContext;
  private readonly createVoiceElement: () => HTMLAudioElement;
  private readonly createAmbienceElement: NonNullable<
    AudioDirectorOptions['createAmbienceElement']
  >;
  private readonly onStateChange?: AudioDirectorOptions['onStateChange'];
  private context: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private ambienceBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private voiceElement: HTMLAudioElement | null = null;
  private voiceSource: MediaElementAudioSourceNode | null = null;
  private spatialPool: SpatialAudioPool | null = null;
  private readonly ambienceTracks = new Map<AmbienceScene, AmbienceTrack>();
  private activeAmbience: AmbienceScene = 'room';
  private ambienceAttenuation = 1;
  private volumes: AudioVolumes = DEFAULT_VOLUMES;
  private lastCountdownPulse = Number.NEGATIVE_INFINITY;
  private startPromise: Promise<boolean> | null = null;
  private voiceEnabled = true;
  private activeVoice: VoiceRequest | null = null;
  private playback: AudioPlaybackSnapshot = {
    status: 'idle',
    activeClipId: null,
    error: null,
  };

  constructor(options: AudioDirectorOptions = {}) {
    this.createContext =
      options.createContext ??
      (() => {
        const Context = window.AudioContext;
        return new Context();
      });
    this.createVoiceElement = options.createVoiceElement ?? (() => new Audio());
    this.createAmbienceElement =
      options.createAmbienceElement ??
      ((_scene, path) => {
        const element = new Audio(path);
        element.loop = true;
        element.preload = 'auto';
        return element;
      });
    this.onStateChange = options.onStateChange;
  }

  get started(): boolean {
    return this.context !== null;
  }

  get activeSpatialSources(): number {
    return this.spatialPool?.activeCount ?? 0;
  }

  get snapshot(): AudioPlaybackSnapshot {
    return this.playback;
  }

  get narrationActive(): boolean {
    return this.activeVoice !== null;
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
      voice: clamp01(volumes.voice),
      ambience: clamp01(volumes.ambience),
      effects: clamp01(volumes.effects),
    };
    const now = this.context?.currentTime ?? 0;
    this.masterBus?.gain.setTargetAtTime(this.volumes.master, now, 0.04);
    this.ambienceBus?.gain.setTargetAtTime(this.volumes.ambience, now, 0.08);
    this.effectsBus?.gain.setTargetAtTime(this.volumes.effects, now, 0.04);
    this.voiceBus?.gain.setTargetAtTime(
      this.voiceEnabled ? this.volumes.voice : 0,
      now,
      0.04,
    );
  }

  setVoicesEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    const now = this.context?.currentTime ?? 0;
    this.voiceBus?.gain.setTargetAtTime(
      enabled ? this.volumes.voice : 0,
      now,
      0.04,
    );
    if (!enabled) {
      this.voiceElement?.pause();
      this.activeVoice = null;
      this.setPlayback('ready', null, null);
    }
  }

  setAmbienceScene(scene: AmbienceScene): void {
    this.activeAmbience = scene;
    const now = this.context?.currentTime ?? 0;
    for (const [candidate, track] of this.ambienceTracks) {
      track.gain.gain.setTargetAtTime(
        candidate === scene ? this.ambienceAttenuation : 0,
        now,
        0.8,
      );
    }
  }

  setMissionVideoActive(active: boolean): void {
    this.ambienceAttenuation = active ? 0.18 : 1;
    this.setAmbienceScene(this.activeAmbience);
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.voiceElement?.pause();
      for (const track of this.ambienceTracks.values()) track.element.pause();
      return;
    }
    void this.context?.resume().catch(() => undefined);
    for (const track of this.ambienceTracks.values()) {
      void track.element.play().catch(() => undefined);
    }
    if (this.activeVoice) void this.playActiveVoice();
  }

  notifyCollapse(pan = 0): void {
    this.spatialPool?.play({
      frequency: 520,
      durationSeconds: 0.34,
      gain: 0.16,
      pan,
    });
  }

  playNarrativeCue(
    cue?: ResolvedNarrativeCue,
    isContextValid: () => boolean = () => true,
  ): boolean {
    if (!cue) return false;
    return this.tryStartVoice({
      id: cue.id,
      path: narrativeVoicePath(cue.locale, cue.id),
      isContextValid,
    });
  }

  retryActiveVoice(): void {
    if (!this.activeVoice || !this.voiceElement) return;
    void this.playActiveVoice();
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
    this.voiceElement?.pause();
    this.voiceSource?.disconnect();
    for (const track of this.ambienceTracks.values()) {
      track.element.pause();
      track.source.disconnect();
      track.gain.disconnect();
    }
    this.ambienceTracks.clear();
    void this.context?.close();
    this.context = null;
    this.masterBus = null;
    this.ambienceBus = null;
    this.effectsBus = null;
    this.voiceBus = null;
    this.voiceElement = null;
    this.voiceSource = null;
    this.activeVoice = null;
    this.setPlayback('idle', null, null);
  }

  private async performStart(): Promise<boolean> {
    if (!this.context) {
      try {
        this.initialize(this.createContext());
      } catch (error) {
        this.setPlayback('error', null, errorMessage(error));
        return false;
      }
    }
    // Invoke every media-element play synchronously inside the user gesture.
    // The Web Audio context may resume asynchronously, but these exact elements
    // remain authorized for later local narration and ambience playback.
    const mediaUnlocks: Promise<unknown>[] = [];
    if (this.voiceElement) {
      this.voiceElement.src = MEDIA_UNLOCK_SILENCE_DATA_URI;
      mediaUnlocks.push(this.voiceElement.play());
    }
    for (const track of this.ambienceTracks.values()) {
      mediaUnlocks.push(track.element.play());
    }
    try {
      await this.context!.resume();
      await Promise.allSettled(mediaUnlocks);
      if (this.voiceElement && !this.activeVoice) {
        this.voiceElement.pause();
        this.voiceElement.currentTime = 0;
        this.voiceElement.src = '';
      }
      const ready = this.context!.state === 'running';
      this.setPlayback(
        ready ? 'ready' : 'blocked',
        null,
        ready ? null : 'AudioContext suspended',
      );
      if (ready) {
        for (const track of this.ambienceTracks.values())
          void track.element.play().catch(() => undefined);
      }
      return ready;
    } catch (error) {
      this.voiceElement?.pause();
      for (const track of this.ambienceTracks.values()) track.element.pause();
      this.setPlayback('blocked', null, errorMessage(error));
      return false;
    }
  }

  private initialize(context: AudioContext): void {
    this.context = context;
    this.masterBus = context.createGain();
    this.ambienceBus = context.createGain();
    this.effectsBus = context.createGain();
    this.voiceBus = context.createGain();
    this.ambienceBus.connect(this.masterBus);
    this.effectsBus.connect(this.masterBus);
    this.voiceBus.connect(this.masterBus);
    this.masterBus.connect(context.destination);
    this.voiceElement = this.createVoiceElement();
    this.voiceElement.preload = 'auto';
    this.voiceElement.onended = () => this.finishVoice();
    this.voiceElement.onerror = () => {
      const failedId = this.activeVoice?.id ?? null;
      this.activeVoice = null;
      this.setPlayback('error', failedId, 'Voice asset failed');
    };
    this.voiceSource = context.createMediaElementSource(this.voiceElement);
    this.voiceSource.connect(this.voiceBus);
    for (const scene of Object.keys(AMBIENCE_PATHS) as AmbienceScene[]) {
      const element = this.createAmbienceElement(scene, AMBIENCE_PATHS[scene]);
      element.loop = true;
      element.preload = 'auto';
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      gain.gain.value = scene === this.activeAmbience ? 1 : 0;
      source.connect(gain);
      gain.connect(this.ambienceBus);
      this.ambienceTracks.set(scene, { element, source, gain });
    }
    this.spatialPool = new SpatialAudioPool(context, this.effectsBus);
    this.setVolumes(this.volumes);
  }

  private tryStartVoice(request: VoiceRequest): boolean {
    if (!request.isContextValid()) return false;
    // Disabled or unavailable voice must never suppress subtitles/narrative.
    if (!this.voiceEnabled || !this.voiceElement) return true;
    if (this.activeVoice) return false;
    this.startVoice(request);
    return true;
  }

  private startVoice(request: VoiceRequest): void {
    if (!this.voiceElement || !request.isContextValid()) return;
    this.activeVoice = request;
    this.voiceElement.src = request.path;
    this.voiceElement.currentTime = 0;
    void this.playActiveVoice();
  }

  private async playActiveVoice(): Promise<void> {
    if (!this.voiceElement || !this.activeVoice) return;
    const request = this.activeVoice;
    try {
      await this.voiceElement.play();
      if (this.activeVoice === request) {
        this.setPlayback('playing', request.id, null);
      }
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      this.setPlayback(
        name === 'NotAllowedError' ? 'blocked' : 'error',
        request.id,
        errorMessage(error),
      );
    }
  }

  private finishVoice(): void {
    this.activeVoice = null;
    this.setPlayback('ready', null, null);
  }

  private setPlayback(
    status: AudioPlaybackStatus,
    activeClipId: string | null,
    error: string | null,
  ): void {
    this.playback = { status, activeClipId, error };
    this.onStateChange?.(this.playback);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
