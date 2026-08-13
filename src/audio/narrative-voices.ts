import type { NarrativeCueId } from '../gameplay/narrative';

export const NARRATIVE_VOICE_DIRECTORY = '/assets/audio/voice';
export const NARRATIVE_VOICE_COUNT_PER_LOCALE = 60;
export const NARRATIVE_VOICE_TOTAL_COUNT = 120;
export const NARRATIVE_VOICE_CODEC = 'MP3 mono 44.1 kHz normalized to -16 LUFS';

export function narrativeVoicePath(
  locale: 'en-US' | 'es-ES',
  cueId: NarrativeCueId,
): string {
  const directory = locale === 'en-US' ? 'en' : 'es';
  return `${NARRATIVE_VOICE_DIRECTORY}/${directory}/${cueId}.mp3`;
}
