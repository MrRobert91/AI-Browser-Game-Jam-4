import type { RunResult } from './ending';
import {
  approximateEnglishSyllables,
  approximateSpanishSyllables,
  type GeneratedHaiku,
} from './haiku';
import type { Locale } from '../contracts/localization';

export const REMOTE_HAIKU_TIMEOUT_MS = 4_000;

export interface RemoteHaikuPayload {
  readonly locale: 'en-US' | 'es-ES';
  readonly profile: string;
  readonly fixedCellsBucket: number;
  readonly maxDistanceBucket: number;
  readonly water10: number;
  readonly forest10: number;
  readonly ruin10: number;
}

export interface RemoteHaikuResult {
  readonly haiku: GeneratedHaiku;
  readonly source: 'local' | 'remote';
  readonly error: 'disabled' | 'consent' | 'network' | 'response' | null;
}

export interface RemoteHaikuRequestOptions {
  readonly endpoint: string | null;
  readonly consent: boolean;
  readonly result: RunResult;
  readonly local: GeneratedHaiku;
  readonly locale?: Locale;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

export function configuredRemoteHaikuEndpoint(
  raw: string | undefined,
): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function createRemoteHaikuPayload(
  result: RunResult,
  locale: Locale = 'es',
): RemoteHaikuPayload {
  return {
    locale: locale === 'en' ? 'en-US' : 'es-ES',
    profile: result.profile,
    fixedCellsBucket: bucket(result.portrait.fixedCells, 25),
    maxDistanceBucket: bucket(result.portrait.maxDistance, 5),
    water10: ratio10(result.portrait.waterRatio),
    forest10: ratio10(result.portrait.forestRatio),
    ruin10: ratio10(result.portrait.ruinRatio),
  };
}

export async function requestRemoteHaikuWithFallback(
  options: RemoteHaikuRequestOptions,
): Promise<RemoteHaikuResult> {
  if (options.endpoint === null) {
    return { haiku: options.local, source: 'local', error: 'disabled' };
  }
  if (!options.consent) {
    return { haiku: options.local, source: 'local', error: 'consent' };
  }
  const endpoint = configuredRemoteHaikuEndpoint(options.endpoint);
  if (endpoint === null) {
    return { haiku: options.local, source: 'local', error: 'disabled' };
  }
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REMOTE_HAIKU_TIMEOUT_MS,
  );
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        createRemoteHaikuPayload(options.result, options.locale ?? 'es'),
      ),
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      return { haiku: options.local, source: 'local', error: 'network' };
    }
    const lines = parseLines(await response.json());
    if (lines === null) {
      return { haiku: options.local, source: 'local', error: 'response' };
    }
    return {
      haiku: {
        lines,
        approximateSyllables: lines.map(
          options.locale === 'en'
            ? approximateEnglishSyllables
            : approximateSpanishSyllables,
        ) as [number, number, number],
      },
      source: 'remote',
      error: null,
    };
  } catch {
    return { haiku: options.local, source: 'local', error: 'network' };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function parseLines(value: unknown): [string, string, string] | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('lines' in value) ||
    !Array.isArray(value.lines) ||
    value.lines.length !== 3
  ) {
    return null;
  }
  const lines = value.lines.map((line) =>
    typeof line === 'string' ? line.trim() : '',
  );
  if (lines.some((line) => line.length === 0 || line.length > 120)) return null;
  return lines as [string, string, string];
}

function bucket(value: number, size: number): number {
  return Math.max(0, Math.round(value / size) * size);
}

function ratio10(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10)));
}
