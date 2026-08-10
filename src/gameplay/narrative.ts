import catalogSource from '../content/narrative.json';

export type NarrativeCueId = keyof typeof catalogSource.cues;
export type NarrativeSpeaker = 'LA_MEDIDA' | 'COLLAPSADOR';

export interface NarrativeCueDefinition {
  readonly event: string;
  readonly speaker: NarrativeSpeaker;
  readonly text: string;
  readonly fallbackText: string;
  readonly priority: number;
  readonly durationMs: number;
  readonly once: boolean;
}

export interface ResolvedNarrativeCue extends NarrativeCueDefinition {
  readonly id: NarrativeCueId;
  readonly locale: string;
  readonly text: string;
}

export interface NarrativeEvents {
  readonly onMessage: (message: string) => void;
  readonly onSubtitle: (message: string, durationMs: number) => void;
  readonly onAudioCue?: (cue: ResolvedNarrativeCue) => void;
  readonly onCue?: (cue: ResolvedNarrativeCue) => void;
}

export interface NarrativeCatalog {
  readonly locale: string;
  readonly cues: Readonly<Record<NarrativeCueId, NarrativeCueDefinition>>;
}

export const NARRATIVE_CUE_ORDER = Object.keys(
  catalogSource.cues,
) as NarrativeCueId[];

export const NARRATIVE_CATALOG = catalogSource as NarrativeCatalog;

export function validateNarrativeCatalog(
  catalog: NarrativeCatalog = NARRATIVE_CATALOG,
): readonly string[] {
  const errors: string[] = [];
  const events = new Set<string>();
  for (const cueId of NARRATIVE_CUE_ORDER) {
    const cue = catalog.cues[cueId];
    if (!cue) {
      errors.push(`${cueId}: missing cue`);
      continue;
    }
    if (!cue.text.trim() && !cue.fallbackText.trim()) {
      errors.push(`${cueId}: text and fallback are empty`);
    }
    if (!Number.isFinite(cue.priority) || cue.priority < 0) {
      errors.push(`${cueId}: invalid priority`);
    }
    if (!Number.isFinite(cue.durationMs) || cue.durationMs <= 0) {
      errors.push(`${cueId}: invalid duration`);
    }
    if (events.has(cue.event))
      errors.push(`${cueId}: duplicate event ${cue.event}`);
    events.add(cue.event);
  }
  return errors;
}

export class NarrativeDirector {
  private readonly played = new Set<NarrativeCueId>();
  private readonly history: NarrativeCueId[] = [];

  constructor(
    private readonly events: NarrativeEvents,
    private readonly catalog: NarrativeCatalog = NARRATIVE_CATALOG,
  ) {
    const errors = validateNarrativeCatalog(catalog);
    if (errors.length > 0) throw new Error(errors.join('\n'));
  }

  play(cueId: NarrativeCueId, repeat = false): string {
    const definition = this.catalog.cues[cueId];
    const text = definition.text.trim() || definition.fallbackText;
    if (!repeat && definition.once && this.played.has(cueId)) return text;
    this.played.add(cueId);
    this.history.push(cueId);
    const cue: ResolvedNarrativeCue = {
      ...definition,
      id: cueId,
      locale: this.catalog.locale,
      text,
    };
    this.events.onMessage(text);
    this.events.onSubtitle(text, cue.durationMs);
    this.events.onCue?.(cue);
    this.events.onAudioCue?.(cue);
    return text;
  }

  hasPlayed(cueId: NarrativeCueId): boolean {
    return this.played.has(cueId);
  }

  playedCueIds(): readonly NarrativeCueId[] {
    return [...this.history];
  }
}
