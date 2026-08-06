import type { AttentionPortrait, AttentionProfile } from './portrait';
import type { GeneratedHaiku } from './haiku';

export const ENDING_ASCENT_SECONDS = 8;

export type EndingPhase = 'IDLE' | 'ASCENDING' | 'COMPLETE';

export interface RunResult {
  readonly worldSeed: number;
  readonly seedLabel: string;
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

export function formatRunResult(result: RunResult): string {
  return [
    'LA ÚLTIMA OBSERVACIÓN',
    `Seed: ${result.seedLabel}`,
    `Perfil: ${result.profile}`,
    `Haiku: ${result.haiku.lines[0]}`,
    result.haiku.lines[1],
    result.haiku.lines[2],
  ].join('\n');
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
