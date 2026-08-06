import narrative from '../content/narrative.json';

export type NarrativeCueId = keyof typeof narrative;

export interface NarrativeEvents {
  readonly onMessage: (message: string) => void;
  readonly onSubtitle: (message: string) => void;
  readonly onAudioCue?: () => void;
}

export class NarrativeDirector {
  private readonly played = new Set<NarrativeCueId>();

  constructor(private readonly events: NarrativeEvents) {}

  play(cueId: NarrativeCueId, repeat = false): string {
    const message = narrative[cueId];
    if (!repeat && this.played.has(cueId)) return message;
    this.played.add(cueId);
    this.events.onMessage(message);
    this.events.onSubtitle(message);
    this.events.onAudioCue?.();
    return message;
  }

  hasPlayed(cueId: NarrativeCueId): boolean {
    return this.played.has(cueId);
  }
}
