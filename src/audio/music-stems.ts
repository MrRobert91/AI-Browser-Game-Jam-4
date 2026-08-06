import type { UnlockablePackId } from '../contracts/tiles';

export interface StemDefinition {
  readonly frequency: number;
  readonly type: OscillatorType;
  readonly gain: number;
}

export const STEM_DEFINITIONS: Readonly<
  Record<UnlockablePackId, StemDefinition>
> = {
  water: { frequency: 146.83, type: 'sine', gain: 0.055 },
  forest: { frequency: 196, type: 'triangle', gain: 0.035 },
  ruin: { frequency: 110, type: 'sine', gain: 0.045 },
  storm: { frequency: 293.66, type: 'triangle', gain: 0.025 },
};

interface StemNodes {
  readonly oscillator: OscillatorNode;
  readonly gain: GainNode;
  unlocked: boolean;
}

export class MusicStemBank {
  private readonly stems = new Map<UnlockablePackId, StemNodes>();

  constructor(
    private readonly context: AudioContext,
    destination: AudioNode,
  ) {
    for (const [packId, definition] of Object.entries(STEM_DEFINITIONS) as [
      UnlockablePackId,
      StemDefinition,
    ][]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = definition.type;
      oscillator.frequency.value = definition.frequency;
      gain.gain.value = 0;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      this.stems.set(packId, { oscillator, gain, unlocked: false });
    }
  }

  unlock(packId: UnlockablePackId): boolean {
    const stem = this.stems.get(packId)!;
    if (stem.unlocked) return false;
    stem.unlocked = true;
    const target = STEM_DEFINITIONS[packId].gain;
    stem.gain.gain.setTargetAtTime(target, this.context.currentTime, 0.8);
    return true;
  }

  dispose(): void {
    for (const stem of this.stems.values()) {
      stem.oscillator.stop();
      stem.oscillator.disconnect();
      stem.gain.disconnect();
    }
    this.stems.clear();
  }
}
