import haikuLines from '../content/haiku-lines.json';
import englishHaikuLines from '../content/haiku-lines.en.json';
import type { Locale } from '../contracts/localization';
import { createRng, deriveSeed, nextUint32 } from '../wfc/rng';
import type { AttentionPortrait, AttentionProfile } from './portrait';

interface TaggedLine {
  readonly text: string;
  readonly tags: readonly string[];
}

export interface GeneratedHaiku {
  readonly lines: readonly [string, string, string];
  readonly approximateSyllables: readonly [number, number, number];
}

const PROFILE_TAG: Readonly<Record<AttentionProfile, string>> = {
  Jardinero: 'gardener',
  Cartógrafo: 'cartographer',
  Guardián: 'guardian',
  Testigo: 'witness',
  Impaciente: 'impatient',
};

export function approximateSpanishSyllables(line: string): number {
  const normalized = line
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zñü\s]/g, ' ');
  const groups = normalized.match(/[aeiouyü]+/g);
  return Math.max(1, groups?.length ?? 0);
}

export function approximateEnglishSyllables(line: string): number {
  const words = line.toLocaleLowerCase('en').match(/[a-z]+/g) ?? [];
  return Math.max(
    1,
    words.reduce((total, word) => {
      const normalized = word.replace(/(?:e|es|ed)$/u, '');
      return total + Math.max(1, normalized.match(/[aeiouy]+/g)?.length ?? 1);
    }, 0),
  );
}

function tagsForPortrait(
  portrait: AttentionPortrait,
  profile: AttentionProfile,
): ReadonlySet<string> {
  const tags = new Set<string>([PROFILE_TAG[profile]]);
  if (portrait.waterRatio >= 0.12) tags.add('water');
  if (portrait.forestRatio >= 0.12) tags.add('forest');
  if (portrait.ruinRatio >= 0.08) tags.add('ruin');
  if (portrait.deaths > 0) tags.add('death');
  if (portrait.dangerExposureSeconds >= 20) tags.add('danger');
  if (portrait.averageGazeDwell >= 1.1) tags.add('dwell');
  if (portrait.revisitRatio >= 0.2) tags.add('revisit');
  if (portrait.unresolvedVisibleCells >= 8) tags.add('unresolved');
  return tags;
}

function chooseLine(
  lines: readonly TaggedLine[],
  tags: ReadonlySet<string>,
  seed: number,
  slot: string,
  locale: Locale,
): string | null {
  const metricEligible = lines.filter((line) => {
    const syllables =
      locale === 'es'
        ? approximateSpanishSyllables(line.text)
        : approximateEnglishSyllables(line.text);
    return syllables >= 8 && syllables <= 17;
  });
  const tagged = metricEligible.filter((line) =>
    line.tags.some((tag) => tags.has(tag)),
  );
  const eligible = tagged.length > 0 ? tagged : metricEligible;
  if (eligible.length === 0) return null;
  const rng = createRng(deriveSeed(seed, `haiku:${slot}`));
  return eligible[nextUint32(rng) % eligible.length]?.text ?? null;
}

function fitApproximateMetric(line: string, locale: Locale): string {
  const syllables =
    locale === 'es'
      ? approximateSpanishSyllables(line)
      : approximateEnglishSyllables(line);
  if (syllables >= 8) return line;
  return `${line.replace(/[.,;:]$/, '')}${locale === 'es' ? ' todavía.' : ' remains here.'}`;
}

export function generateHaiku(
  worldSeed: number,
  portrait: AttentionPortrait,
  profile: AttentionProfile,
  locale: Locale = 'es',
): GeneratedHaiku {
  const catalog = locale === 'es' ? haikuLines : englishHaikuLines;
  const tags = tagsForPortrait(portrait, profile);
  const fallbackIndex =
    nextUint32(
      createRng(deriveSeed(worldSeed, `haiku:${locale}:${PROFILE_TAG[profile]}`)),
    ) % catalog.fallbacks.length;
  const fallback =
    catalog.fallbacks[fallbackIndex] ?? catalog.fallbacks[0]!;
  const lines = [
    chooseLine(catalog.openings, tags, worldSeed, 'opening', locale) ?? fallback[0]!,
    chooseLine(catalog.middles, tags, worldSeed, 'middle', locale) ?? fallback[1]!,
    chooseLine(catalog.closings, tags, worldSeed, 'closing', locale) ?? fallback[2]!,
  ].map((line) => fitApproximateMetric(line, locale)) as [string, string, string];
  return {
    lines,
    approximateSyllables: lines.map((line) =>
      locale === 'es'
        ? approximateSpanishSyllables(line)
        : approximateEnglishSyllables(line),
    ) as [
      number,
      number,
      number,
    ],
  };
}
