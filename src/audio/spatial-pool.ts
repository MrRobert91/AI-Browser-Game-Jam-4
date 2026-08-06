export const MAX_POSITIONAL_AUDIO_SOURCES = 8;

export interface SpatialTone {
  readonly frequency: number;
  readonly durationSeconds: number;
  readonly gain?: number;
  readonly pan?: number;
}

interface ActiveVoice {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
  readonly panner: StereoPannerNode;
}

/** Bounded Web Audio voice pool; a ninth request is dropped, never allocated. */
export class SpatialAudioPool {
  private readonly active = new Set<ActiveVoice>();

  constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode,
  ) {}

  get activeCount(): number {
    return this.active.size;
  }

  play(tone: SpatialTone): boolean {
    if (this.active.size >= MAX_POSITIONAL_AUDIO_SOURCES) return false;
    const now = this.context.currentTime;
    const duration = Math.max(0.03, Math.min(3, tone.durationSeconds));
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(
      Math.max(20, Math.min(8_000, tone.frequency)),
      now,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, Math.min(0.7, tone.gain ?? 0.12)),
      now + Math.min(0.025, duration / 3),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, tone.pan ?? 0)), now);
    oscillator.connect(gain).connect(panner).connect(this.destination);
    const voice = { oscillator, gain, panner };
    this.active.add(voice);
    oscillator.onended = () => this.release(voice);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    return true;
  }

  dispose(): void {
    for (const voice of [...this.active]) {
      voice.oscillator.onended = null;
      voice.oscillator.stop();
      this.release(voice);
    }
  }

  private release(voice: ActiveVoice): void {
    if (!this.active.delete(voice)) return;
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    voice.panner.disconnect();
  }
}
