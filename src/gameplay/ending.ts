import type { AttentionPortrait, AttentionProfile } from './portrait';
import type { WorldSeedMode } from './daily-seed';
import type { GeneratedHaiku } from './haiku';
import type { Locale } from '../contracts/localization';
import { uiCopy } from '../i18n';

export const ENDING_ASCENT_SECONDS = 8;

export type EndingPhase = 'IDLE' | 'ASCENDING' | 'COMPLETE';

export interface RunResult {
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
  readonly progress: number;
  readonly elapsedSeconds: number;
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
    copy.resultEyebrow,
    `Seed: ${result.seedLabel}`,
    ...mode,
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
  private elapsedSeconds = 0;

  start(): EndingSnapshot {
    if (this.phase === 'IDLE') this.phase = 'ASCENDING';
    return this.snapshot();
  }

  update(deltaSeconds: number): EndingSnapshot {
    if (this.phase !== 'ASCENDING') return this.snapshot();
    this.elapsedSeconds = Math.min(
      ENDING_ASCENT_SECONDS,
      this.elapsedSeconds + Math.max(0, deltaSeconds),
    );
    if (this.elapsedSeconds >= ENDING_ASCENT_SECONDS) this.phase = 'COMPLETE';
    return this.snapshot();
  }

  snapshot(): EndingSnapshot {
    return {
      phase: this.phase,
      elapsedSeconds: this.elapsedSeconds,
      progress: Math.min(1, this.elapsedSeconds / ENDING_ASCENT_SECONDS),
    };
  }
}
