export const CUSTOM_SONG_PATH = '/assets/audio/la-funcion-que-nos-mira.mp3';
export const CUSTOM_SONG_TITLE = 'La función que nos mira';
export const CUSTOM_SONG_MODEL = 'google/lyria-3-pro-preview';

export function createCustomSongElement(): HTMLAudioElement {
  const element = new Audio(CUSTOM_SONG_PATH);
  element.loop = true;
  element.preload = 'auto';
  return element;
}
