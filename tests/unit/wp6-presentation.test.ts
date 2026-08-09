import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  AudioDirector,
  countdownPulseInterval,
} from '../../src/audio/audio-director';
import {
  CUSTOM_SONG_MODEL,
  CUSTOM_SONG_PATH,
} from '../../src/audio/custom-song';
import { MAX_POSITIONAL_AUDIO_SOURCES } from '../../src/audio/spatial-pool';
import {
  NARRATIVE_CATALOG,
  NARRATIVE_CUE_ORDER,
  NarrativeDirector,
  validateNarrativeCatalog,
} from '../../src/gameplay/narrative';
import { createStylizedMaterialLibrary } from '../../src/render/materials';
import { resolveQualityProfile } from '../../src/render/quality';
import {
  MAX_PROCEDURAL_VEGETATION_INSTANCES,
  vegetationCountForQuality,
} from '../../src/render/vegetation';
import {
  DEFAULT_GAME_SETTINGS,
  normalizeGameSettings,
} from '../../src/ui/pause';

describe('WP6 final art direction', () => {
  it('shares named materials and scales deterministic vegetation by preset', () => {
    const materials = createStylizedMaterialLibrary();
    expect(materials.all.map((material) => material.name)).toEqual([
      'fixed-meadow-shared',
      'fixed-foliage-shared',
      'fixed-stone-shared',
      'collapse-gold-shared',
    ]);
    expect(vegetationCountForQuality(resolveQualityProfile('low'))).toBe(48);
    expect(vegetationCountForQuality(resolveQualityProfile('high'))).toBe(
      MAX_PROCEDURAL_VEGETATION_INSTANCES,
    );
    materials.dispose();
  });
});

describe('WP6 audio contracts', () => {
  it('uses one local generated song, eight positional voices and 60/30 s cadence', () => {
    expect(CUSTOM_SONG_PATH).toBe('/assets/audio/la-funcion-que-nos-mira.mp3');
    expect(CUSTOM_SONG_MODEL).toBe('google/lyria-3-pro-preview');
    expect(MAX_POSITIONAL_AUDIO_SOURCES).toBe(8);
    expect(countdownPulseInterval(61)).toBeNull();
    expect(countdownPulseInterval(60)).toBe(2.5);
    expect(countdownPulseInterval(30)).toBe(1);
  });

  it('packages the selected generated song as a real local MP3 asset', async () => {
    const audio = await readFile(
      resolve('public/assets/audio/la-funcion-que-nos-mira.mp3'),
    );
    expect(audio.byteLength).toBeGreaterThan(1_000_000);
    expect(audio.subarray(0, 3).toString('ascii')).toBe('ID3');
  });

  it('does not allocate an AudioContext before a user gesture', () => {
    const createContext = vi.fn();
    const director = new AudioDirector({ createContext });
    expect(createContext).not.toHaveBeenCalled();
    expect(director.started).toBe(false);
  });

  it('starts the local song without allocating continuous oscillators', async () => {
    const gainNodes = Array.from({ length: 3 }, () => ({
      gain: { setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));
    const mediaSource = { connect: vi.fn(), disconnect: vi.fn() };
    const createOscillator = vi.fn(() => {
      throw new Error('continuous oscillator should not be allocated');
    });
    const context = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: vi
        .fn()
        .mockReturnValueOnce(gainNodes[0])
        .mockReturnValueOnce(gainNodes[1])
        .mockReturnValueOnce(gainNodes[2]),
      createMediaElementSource: vi.fn(() => mediaSource),
      createOscillator,
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext;
    const music = {
      loop: false,
      preload: '',
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
    } as unknown as HTMLAudioElement;
    const director = new AudioDirector({
      createContext: () => context,
      createMusicElement: () => music,
    });

    await expect(director.startFromGesture()).resolves.toBe(true);
    expect(music.play).toHaveBeenCalledOnce();
    expect(createOscillator).not.toHaveBeenCalled();
    director.dispose();
  });
});

describe('WP6 accessible settings and narrative', () => {
  it('defaults subtitles and reduced flashes on and clamps persisted values', () => {
    expect(DEFAULT_GAME_SETTINGS).toMatchObject({
      subtitles: true,
      reducedFlashes: true,
    });
    expect(
      normalizeGameSettings({
        mouseSensitivity: 9,
        quality: 'impossible',
        volumes: { master: -2, music: 3, effects: 0.4 },
      }),
    ).toMatchObject({
      mouseSensitivity: 0.02,
      quality: 'auto',
      volumes: { master: 0, music: 1, effects: 0.4 },
    });
  });

  it('emits canonical Spanish lines once without requiring a voice track', () => {
    const onMessage = vi.fn();
    const onSubtitle = vi.fn();
    const director = new NarrativeDirector({ onMessage, onSubtitle });
    expect(director.play('start')).toBe(
      'Mira. Lo que permanezca bajo tu atención tendrá derecho a existir.',
    );
    director.play('start');
    expect(validateNarrativeCatalog()).toEqual([]);
    expect(new Set(NARRATIVE_CUE_ORDER).size).toBe(NARRATIVE_CUE_ORDER.length);
    expect(director.play('firstDeath')).toContain(
      'El mundo recuerda mejor que tú.',
    );
    expect(director.play('lastThirtySeconds')).toContain(
      'No queda tiempo para verlo todo. Elige qué merece terminar.',
    );
    expect(director.play('final')).toBe(
      'No encontraste este mundo. Lo separaste de todos los demás.',
    );
    expect(onMessage).toHaveBeenCalledTimes(4);
    expect(onSubtitle).toHaveBeenCalledTimes(4);
    expect(director.playedCueIds()).toEqual([
      'start',
      'firstDeath',
      'lastThirtySeconds',
      'final',
    ]);
    expect(NARRATIVE_CATALOG.locale).toBe('es-ES');
  });

  it('uses the localized fallback when approved copy is unavailable', () => {
    const catalog = {
      ...NARRATIVE_CATALOG,
      cues: {
        ...NARRATIVE_CATALOG.cues,
        start: { ...NARRATIVE_CATALOG.cues.start, text: '' },
      },
    };
    const onMessage = vi.fn();
    const director = new NarrativeDirector(
      { onMessage, onSubtitle: vi.fn() },
      catalog,
    );
    expect(director.play('start')).toBe('Mira. La Cámara está preparada.');
    expect(onMessage).toHaveBeenCalledWith('Mira. La Cámara está preparada.');
  });
});
