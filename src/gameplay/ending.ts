import type { AttentionPortrait, AttentionProfile } from './portrait';
import type { WorldSeedMode } from './daily-seed';
import type { GeneratedHaiku } from './haiku';
import type { RunMode } from './run-clock';
import type { Locale } from '../contracts/localization';
import { uiCopy } from '../i18n';

export const ENDING_ASCENT_SECONDS = 8;
export const MISSION_VIDEO_SECONDS = 32;
export const MISSION_VIDEO_SKIP_SECONDS = 3;
export const MISSION_COMPLETE_FIXED_CELLS = 1_536;
export type RunEndReason = 'TIME_EXPIRED' | 'LIVES_EXHAUSTED';
export type EndingVariant = 'STANDARD' | 'MISSION_COMPLETE';

export type EndingPhase = 'IDLE' | 'ASCENDING' | 'MISSION_VIDEO' | 'COMPLETE';

export interface EndingEligibilityInput {
  readonly mode: RunMode;
  readonly endingReason: RunEndReason;
  readonly livesRemaining: number;
  readonly collectedPacks: readonly string[];
  readonly finalFixedCells: number;
}

export interface RunResult {
  readonly endingVariant: EndingVariant;
  readonly endingReason: RunEndReason;
  readonly livesRemaining: number;
  readonly finalFixedCells: number;
  readonly collectedPacks?: readonly string[];
  readonly worldSeed: number;
  readonly seedLabel: string;
  readonly seedMode?: WorldSeedMode;
  readonly dailyDateKey?: string | null;
  readonly profile: AttentionProfile;
  readonly portrait: AttentionPortrait;
  readonly haiku: GeneratedHaiku;
  readonly closure:
    'Fragmento observado' | 'Mundo habitable' | 'Mundo que puede continuar';
  readonly reading:
    | 'Protegió lo cercano.'
    | 'Equilibró profundidad y expansión.'
    | 'Aceptó riesgo para ampliar lo posible.';
}

export interface EndingSnapshot {
  readonly phase: EndingPhase;
  readonly variant: EndingVariant;
  readonly progress: number;
  readonly elapsedSeconds: number;
  readonly phaseElapsedSeconds: number;
  readonly canSkipMissionVideo: boolean;
}

const REQUIRED_PACKS = ['water', 'forest', 'ruin', 'storm'] as const;

export function classifyEnding(input: EndingEligibilityInput): EndingVariant {
  if (
    input.mode !== 'standard' ||
    input.endingReason !== 'TIME_EXPIRED' ||
    input.livesRemaining < 1 ||
    input.finalFixedCells < MISSION_COMPLETE_FIXED_CELLS
  ) {
    return 'STANDARD';
  }
  const collected = new Set(input.collectedPacks);
  return REQUIRED_PACKS.every((packId) => collected.has(packId))
    ? 'MISSION_COMPLETE'
    : 'STANDARD';
}

/** Upgrades pre-good-ending local records without invalidating the gallery. */
export function normalizeRunResult(value: unknown): RunResult | null {
  if (!value || typeof value !== 'object') return null;
  const legacy = value as Partial<RunResult> & { endReason?: RunEndReason };
  if (!legacy.portrait || !legacy.haiku || !legacy.seedLabel) return null;
  const endingReason =
    legacy.endingReason ?? legacy.endReason ?? 'TIME_EXPIRED';
  const livesRemaining =
    legacy.livesRemaining ?? Math.max(0, 3 - legacy.portrait.deaths);
  const finalFixedCells = legacy.finalFixedCells ?? legacy.portrait.fixedCells;
  return {
    ...legacy,
    endingVariant: legacy.endingVariant ?? 'STANDARD',
    endingReason,
    livesRemaining,
    finalFixedCells,
  } as RunResult;
}

export function formatSeed(worldSeed: number): string {
  return worldSeed
    .toString(16)
    .toUpperCase()
    .padStart(8, '0')
    .replace(/(.{4})(.{4})/, '$1-$2');
}

export function closureForSeedCount(
  seedCount: number,
): Pick<RunResult, 'closure' | 'reading'> {
  if (seedCount >= 4) {
    return {
      closure: 'Mundo que puede continuar',
      reading: 'Aceptó riesgo para ampliar lo posible.',
    };
  }
  if (seedCount >= 2) {
    return {
      closure: 'Mundo habitable',
      reading: 'Equilibró profundidad y expansión.',
    };
  }
  return {
    closure: 'Fragmento observado',
    reading: 'Protegió lo cercano.',
  };
}

export function formatRunResult(
  result: RunResult,
  locale: Locale = 'es',
): string {
  const copy = uiCopy(locale);
  const mode =
    result.seedMode === 'daily' && result.dailyDateKey
      ? [
          locale === 'en'
            ? `Mode: Daily UTC ${result.dailyDateKey}`
            : `Modo: Diaria UTC ${result.dailyDateKey}`,
        ]
      : [];
  return [
    copy.title.toUpperCase(),
    ...(result.endingVariant === 'MISSION_COMPLETE'
      ? [locale === 'en' ? 'MISSION COMPLETE' : 'MISIÓN COMPLETADA']
      : []),
    copy.resultEyebrow,
    `Seed: ${result.seedLabel}`,
    ...mode,
    `${locale === 'en' ? 'Ending' : 'Final'}: ${result.endingVariant} (${result.endingReason})`,
    `${locale === 'en' ? 'Lives remaining' : 'Vidas restantes'}: ${result.livesRemaining}`,
    `FIXED: ${result.finalFixedCells}`,
    `${copy.profile}: ${copy.profileLabels[result.profile] ?? result.profile}`,
    `${locale === 'en' ? 'Reading' : 'Lectura'}: ${copy.closures[result.closure] ?? result.closure} · ${copy.readings[result.reading] ?? result.reading}`,
    `${locale === 'en' ? 'Attention' : 'Atención'}: ${describeAgentUpdate(result, locale)}`,
    `Haiku: ${result.haiku.lines[0]}`,
    result.haiku.lines[1],
    result.haiku.lines[2],
    copy.agencyNote,
  ].join('\n');
}

export function describeAgentUpdate(
  result: RunResult,
  locale: Locale = 'es',
): string {
  const portrait = result.portrait;
  const breadth =
    locale === 'en'
      ? `${portrait.fixedCells} results, ${portrait.uniqueTerrainTiles + portrait.uniqueFeatureTiles} forms`
      : `${portrait.fixedCells} resultados, ${portrait.uniqueTerrainTiles + portrait.uniqueFeatureTiles} formas`;
  const route =
    portrait.maxDistance >= 36
      ? locale === 'en'
        ? 'distant interventions'
        : 'intervenciones lejanas'
      : portrait.revisitRatio >= 0.25
        ? locale === 'en'
          ? 'revisited interventions'
          : 'intervenciones revisitadas'
        : locale === 'en'
          ? 'concentrated interventions'
          : 'intervenciones concentradas';
  const risk =
    portrait.dangerExposureSeconds >= 20
      ? locale === 'en'
        ? 'with exposure to risk'
        : 'con exposición al riesgo'
      : locale === 'en'
        ? 'with attention to shelter'
        : 'con atención al resguardo';
  return `${breadth}; ${route}; ${risk}.`;
}

export class EndingDirector {
  private phase: EndingPhase = 'IDLE';
  private variant: EndingVariant = 'STANDARD';
  private ascentElapsedSeconds = 0;
  private missionElapsedSeconds = 0;

  start(variant: EndingVariant = 'STANDARD'): EndingSnapshot {
    if (this.phase === 'IDLE') {
      this.variant = variant;
      this.phase = 'ASCENDING';
    }
    return this.snapshot();
  }

  update(deltaSeconds: number): EndingSnapshot {
    let remaining = Number.isFinite(deltaSeconds)
      ? Math.max(0, deltaSeconds)
      : 0;
    if (this.phase === 'ASCENDING') {
      const consumed = Math.min(
        remaining,
        ENDING_ASCENT_SECONDS - this.ascentElapsedSeconds,
      );
      this.ascentElapsedSeconds += consumed;
      remaining -= consumed;
      if (this.ascentElapsedSeconds >= ENDING_ASCENT_SECONDS) {
        this.phase =
          this.variant === 'MISSION_COMPLETE' ? 'MISSION_VIDEO' : 'COMPLETE';
      }
    }
    if (this.phase === 'MISSION_VIDEO' && remaining > 0) {
      this.missionElapsedSeconds += remaining;
    }
    return this.snapshot();
  }

  skipMissionVideo(): EndingSnapshot {
    if (
      this.phase === 'MISSION_VIDEO' &&
      this.missionElapsedSeconds >= MISSION_VIDEO_SKIP_SECONDS
    ) {
      this.phase = 'COMPLETE';
    }
    return this.snapshot();
  }

  finishMissionVideo(): EndingSnapshot {
    if (this.phase === 'MISSION_VIDEO') {
      this.missionElapsedSeconds = MISSION_VIDEO_SECONDS;
      this.phase = 'COMPLETE';
    }
    return this.snapshot();
  }

  snapshot(): EndingSnapshot {
    const phaseElapsedSeconds =
      this.phase === 'ASCENDING'
        ? this.ascentElapsedSeconds
        : this.phase === 'MISSION_VIDEO'
          ? this.missionElapsedSeconds
          : 0;
    return {
      phase: this.phase,
      variant: this.variant,
      elapsedSeconds: this.ascentElapsedSeconds + this.missionElapsedSeconds,
      phaseElapsedSeconds,
      progress: Math.min(1, this.ascentElapsedSeconds / ENDING_ASCENT_SECONDS),
      canSkipMissionVideo:
        this.phase === 'MISSION_VIDEO' &&
        this.missionElapsedSeconds >= MISSION_VIDEO_SKIP_SECONDS,
    };
  }
}
