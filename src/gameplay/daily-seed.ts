import { deriveSeed } from '../wfc/rng';

export const DAILY_SEED_TIME_ZONE = 'UTC';
export const CANONICAL_REPLAY_SEED = 0xa91f42c0;

export type WorldSeedMode = 'daily' | 'explicit' | 'random' | 'replay';

export interface WorldSeedSelection {
  readonly worldSeed: number;
  readonly mode: WorldSeedMode;
  readonly dateKey: string | null;
}

export function utcDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  return date.toISOString().slice(0, 10);
}

export function dailySeedForDate(date: Date): number {
  return deriveSeed(
    0x4441494c,
    `ultima-observacion:daily:${DAILY_SEED_TIME_ZONE}:${utcDateKey(date)}`,
  );
}

export function resolveWorldSeed(
  search: URLSearchParams,
  date = new Date(),
  randomUint32: () => number = secureRandomUint32,
): WorldSeedSelection {
  const requested = search.get('seed');
  const parsed = requested
    ? Number.parseInt(requested.replace('-', ''), 16)
    : Number.NaN;
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xffff_ffff) {
    return { worldSeed: parsed >>> 0, mode: 'explicit', dateKey: null };
  }
  if (search.get('daily') === '1') {
    return {
      worldSeed: dailySeedForDate(date),
      mode: 'daily',
      dateKey: utcDateKey(date),
    };
  }
  const replay = search.get('replay');
  if (replay === 'canonical' || replay === 'wp5') {
    return {
      worldSeed: CANONICAL_REPLAY_SEED,
      mode: 'replay',
      dateKey: null,
    };
  }
  return { worldSeed: randomUint32() >>> 0, mode: 'random', dateKey: null };
}

function secureRandomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
