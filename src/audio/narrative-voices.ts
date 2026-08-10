import type { CollapsadorRecord } from '../gameplay/collapsador-records';
import type { NarrativeCueId } from '../gameplay/narrative';

export const NARRATIVE_VOICE_DIRECTORY = '/assets/audio/narrative';
export const NARRATIVE_VOICE_COUNT = 20;
export const NARRATIVE_VOICE_TOTAL_BYTES = 1_030_044;
export const NARRATIVE_VOICE_CODEC = 'MP3 mono 24 kHz 56 kbps';

export function narrativeVoicePath(cueId: NarrativeCueId): string {
  return `${NARRATIVE_VOICE_DIRECTORY}/cue-${cueId}.mp3`;
}

export function collapsadorRecordVoicePath(
  record: Pick<CollapsadorRecord, 'id'>,
): string {
  return `${NARRATIVE_VOICE_DIRECTORY}/record-${record.id}.mp3`;
}

export function introductionVoicePath(beatId: string): string {
  return `${NARRATIVE_VOICE_DIRECTORY}/intro-${beatId}.mp3`;
}
