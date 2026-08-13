import catalogSource from '../content/narrative.catalog.json';
import type { Locale } from '../contracts/localization';

export type NarrativeCueId =
  | 'start'
  | 'firstCollapse'
  | 'unlockWater'
  | 'unlockForest'
  | 'unlockRuin'
  | 'unlockStorm'
  | 'firstDanger'
  | 'firstDeath'
  | 'respawn'
  | 'lastSixtySeconds'
  | 'lastThirtySeconds'
  | 'fiveMinutes'
  | 'final'
  | 'distanceNear'
  | 'distanceMid'
  | 'distanceFar'
  | 'distanceOuter'
  | 'distanceReturn'
  | 'attentionLongA'
  | 'attentionLongB'
  | 'attentionLongC'
  | 'attentionLongD'
  | 'attentionLongE'
  | 'revisitA'
  | 'revisitB'
  | 'revisitC'
  | 'revisitD'
  | 'riskA'
  | 'riskB'
  | 'riskC'
  | 'riskD'
  | 'stalledA'
  | 'stalledB'
  | 'stalledC'
  | 'stalledD'
  | 'deathAgainA'
  | 'deathAgainB'
  | 'deathAgainC'
  | 'deathAgainD'
  | 'ambientA'
  | 'ambientB'
  | 'ambientC'
  | 'ambientD'
  | 'seedWaterHint'
  | 'seedForestHint'
  | 'seedRuinHint'
  | 'seedStormHint'
  | 'bombRiskThreePercent'
  | 'bombRiskFivePercent'
  | 'bombRiskSevenPercent'
  | 'bombRiskNinePercent'
  | 'coverageBehindA'
  | 'coverageBehindB'
  | 'coverageBehindC'
  | 'coverageBehindD'
  | 'rockJumpA'
  | 'rockJumpB'
  | 'rockJumpC'
  | 'objectivesDirective'
  | 'livesExhausted';
export type NarrativeCategory =
  | 'critical'
  | 'distance'
  | 'attention'
  | 'revisit'
  | 'risk'
  | 'stalled'
  | 'death'
  | 'ambient'
  | 'hint'
  | 'forecast'
  | 'coverage'
  | 'traversal';
export type NarrativeSpeaker = 'LA_MEDIDA';

export const NARRATIVE_COOLDOWN_MS = 18_000;
export const REACTIVE_NARRATIVE_COOLDOWN_MS = 6_000;
export const MAX_NARRATIVE_CUES_PER_RUN = 34;

export interface NarrativeCueDefinition {
  readonly event: string;
  readonly speaker: NarrativeSpeaker;
  readonly text: string;
  readonly fallbackText: string;
  readonly priority: number;
  readonly durationMs: number;
  readonly once: boolean;
  readonly category: NarrativeCategory;
  readonly critical: boolean;
}

export interface ResolvedNarrativeCue extends NarrativeCueDefinition {
  readonly id: NarrativeCueId;
  readonly locale: 'en-US' | 'es-ES';
  readonly text: string;
}

export interface NarrativeEvents {
  readonly onMessage: (message: string) => void;
  readonly onSubtitle: (message: string, durationMs: number) => void;
  readonly onAudioCue?: (cue: ResolvedNarrativeCue) => boolean | void;
  readonly onCue?: (cue: ResolvedNarrativeCue) => void;
}

export interface NarrativeCatalog {
  readonly locale: 'en-US' | 'es-ES';
  readonly cues: Readonly<Record<NarrativeCueId, NarrativeCueDefinition>>;
}

export const NARRATIVE_CUE_ORDER = catalogSource.map(
  (entry) => entry.id,
) as NarrativeCueId[];

function buildCatalog(locale: Locale): NarrativeCatalog {
  return {
    locale: locale === 'en' ? 'en-US' : 'es-ES',
    cues: Object.fromEntries(
      catalogSource.map((entry) => {
        const text = locale === 'en' ? entry.en : entry.es;
        return [
          entry.id,
          {
            event: entry.id
              .replace(/[A-Z]/g, (letter) => `_${letter}`)
              .toUpperCase(),
            speaker: 'LA_MEDIDA' as const,
            text,
            fallbackText: text,
            priority: entry.priority,
            durationMs: entry.durationMs,
            once: entry.once,
            category: entry.category,
            critical: entry.category === 'critical',
          },
        ];
      }),
    ) as unknown as Readonly<Record<NarrativeCueId, NarrativeCueDefinition>>,
  };
}

export const NARRATIVE_CATALOGS = {
  en: buildCatalog('en'),
  es: buildCatalog('es'),
} as const;

/** Spanish remains exported for compatibility with deterministic unit tooling. */
export const NARRATIVE_CATALOG = NARRATIVE_CATALOGS.es;

export function narrativeCatalog(locale: Locale): NarrativeCatalog {
  return NARRATIVE_CATALOGS[locale];
}

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

function stablePoolIndex(seed: number, category: string, size: number): number {
  let hash = seed >>> 0;
  for (const character of category) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x45d9f3b) >>> 0;
  }
  return size === 0 ? 0 : hash % size;
}

export class NarrativeDirector {
  private readonly played = new Set<NarrativeCueId>();
  private readonly history: NarrativeCueId[] = [];
  private lastPlayedAtMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly events: NarrativeEvents,
    private readonly catalog: NarrativeCatalog = NARRATIVE_CATALOG,
  ) {
    const errors = validateNarrativeCatalog(catalog);
    if (errors.length > 0) throw new Error(errors.join('\n'));
  }

  play(
    cueId: NarrativeCueId,
    repeat = false,
    nowMs = performance.now(),
  ): string {
    const definition = this.catalog.cues[cueId];
    const text = definition.text.trim() || definition.fallbackText;
    if (!repeat && definition.once && this.played.has(cueId)) return text;
    if (this.history.length >= MAX_NARRATIVE_CUES_PER_RUN) return text;
    if (
      !definition.critical &&
      nowMs - this.lastPlayedAtMs <
        (definition.category === 'traversal' || definition.category === 'hint'
          ? REACTIVE_NARRATIVE_COOLDOWN_MS
          : NARRATIVE_COOLDOWN_MS)
    ) {
      return text;
    }
    const cue: ResolvedNarrativeCue = {
      ...definition,
      id: cueId,
      locale: this.catalog.locale,
      text,
    };
    if (this.events.onAudioCue?.(cue) === false) return text;
    this.played.add(cueId);
    this.history.push(cueId);
    this.lastPlayedAtMs = nowMs;
    this.events.onMessage(text);
    this.events.onSubtitle(text, cue.durationMs);
    this.events.onCue?.(cue);
    return text;
  }

  tryPlay(
    cueId: NarrativeCueId,
    repeat = false,
    nowMs = performance.now(),
  ): boolean {
    const previousCount = this.history.length;
    this.play(cueId, repeat, nowMs);
    return this.history.length > previousCount;
  }

  playPool(
    category: Exclude<NarrativeCategory, 'critical'>,
    seed: number,
    contextStillValid = true,
    nowMs = performance.now(),
  ): NarrativeCueId | null {
    if (!contextStillValid) return null;
    const candidates = NARRATIVE_CUE_ORDER.filter(
      (cueId) =>
        this.catalog.cues[cueId].category === category &&
        !this.played.has(cueId),
    );
    if (candidates.length === 0) return null;
    const cueId =
      candidates[stablePoolIndex(seed, category, candidates.length)]!;
    const previousCount = this.history.length;
    this.play(cueId, false, nowMs);
    return this.history.length > previousCount ? cueId : null;
  }

  hasPlayed(cueId: NarrativeCueId): boolean {
    return this.played.has(cueId);
  }

  playedCueIds(): readonly NarrativeCueId[] {
    return [...this.history];
  }
}
