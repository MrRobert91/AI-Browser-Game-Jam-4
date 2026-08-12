import { describe, expect, it, vi } from 'vitest';

import {
  AudioDirector,
  countdownPulseInterval,
} from '../../src/audio/audio-director';
import { MAX_POSITIONAL_AUDIO_SOURCES } from '../../src/audio/spatial-pool';
import {
  NARRATIVE_VOICE_CODEC,
  NARRATIVE_VOICE_COUNT_PER_LOCALE,
  NARRATIVE_VOICE_TOTAL_COUNT,
} from '../../src/audio/narrative-voices';
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
    expect(materials.all.every((material) => material.map !== null)).toBe(true);
    expect(materials.textures.all).toHaveLength(8);
    expect(materials.textures.gpuBytes).toBe(8 * 64 * 64 * 4);
    expect(vegetationCountForQuality(resolveQualityProfile('low'))).toBe(48);
    expect(vegetationCountForQuality(resolveQualityProfile('high'))).toBe(
      MAX_PROCEDURAL_VEGETATION_INSTANCES,
    );
    materials.dispose();
  });
});

describe('WP6 audio contracts', () => {
  it('uses local bilingual voices, eight positional sources and 60/30 s cadence', () => {
    expect(NARRATIVE_VOICE_COUNT_PER_LOCALE).toBe(44);
    expect(NARRATIVE_VOICE_TOTAL_COUNT).toBe(88);
    expect(MAX_POSITIONAL_AUDIO_SOURCES).toBe(8);
    expect(countdownPulseInterval(61)).toBeNull();
    expect(countdownPulseInterval(60)).toBe(2.5);
    expect(countdownPulseInterval(30)).toBe(1);
  });

  it('declares normalized mono MP3 delivery', () => {
    expect(NARRATIVE_VOICE_CODEC).toContain('mono 44.1 kHz');
    expect(NARRATIVE_VOICE_CODEC).toContain('-16 LUFS');
  });

  it('does not allocate an AudioContext before a user gesture', () => {
    const createContext = vi.fn();
    const director = new AudioDirector({ createContext });
    expect(createContext).not.toHaveBeenCalled();
    expect(director.started).toBe(false);
  });

  it('authorizes AudioContext independently from media playback', async () => {
    const gainNodes = Array.from({ length: 9 }, () => ({
      gain: { value: 0, setTargetAtTime: vi.fn() },
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
      createGain: vi.fn(() => gainNodes.shift()!),
      createMediaElementSource: vi.fn(() => mediaSource),
      createOscillator,
      resume: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext;
    const voice = {
      preload: '',
      src: '',
      currentTime: 0,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      onended: null,
      onerror: null,
    } as unknown as HTMLAudioElement;
    const ambiencePlays = Array.from({ length: 5 }, () =>
      vi.fn(async () => undefined),
    );
    const ambience = ambiencePlays.map((play) => ({
      loop: false,
      preload: '',
      play,
      pause: vi.fn(),
    })) as unknown as HTMLAudioElement[];
    let ambienceIndex = 0;
    const director = new AudioDirector({
      createContext: () => context,
      createVoiceElement: () => voice,
      createAmbienceElement: () => ambience[ambienceIndex++]!,
    });

    await expect(director.startFromGesture()).resolves.toBe(true);
    expect(director.snapshot.status).toBe('ready');
    expect(createOscillator).not.toHaveBeenCalled();
    const cue = {
      ...NARRATIVE_CATALOG.cues.start,
      id: 'start' as const,
      locale: 'es-ES' as const,
      text: NARRATIVE_CATALOG.cues.start.text,
    };
    director.playNarrativeCue(cue);
    expect(voice.src).toContain('/assets/audio/voice/es/start.mp3');
    expect(voice.play).toHaveBeenCalledTimes(2);
    const terminalCue = {
      ...NARRATIVE_CATALOG.cues.livesExhausted,
      id: 'livesExhausted' as const,
      locale: 'es-ES' as const,
      text: NARRATIVE_CATALOG.cues.livesExhausted.text,
    };
    director.playExclusiveNarrativeCue(terminalCue);
    expect(voice.pause).toHaveBeenCalled();
    expect(voice.src).toContain('/assets/audio/voice/es/livesExhausted.mp3');
    expect(ambiencePlays.every((play) => play.mock.calls.length >= 1)).toBe(
      true,
    );
    director.setVoicesEnabled(false);
    expect(voice.pause).toHaveBeenCalled();
    director.dispose();
  });
});

describe('WP6 accessible settings and narrative', () => {
  it('defaults subtitles and reduced flashes on and clamps persisted values', () => {
    expect(DEFAULT_GAME_SETTINGS).toMatchObject({
      subtitles: true,
      reducedFlashes: true,
      voicesEnabled: true,
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
      volumes: { master: 0, voice: 0.4, ambience: 1, effects: 0.4 },
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
        start: {
          ...NARRATIVE_CATALOG.cues.start,
          text: '',
          fallbackText: 'Mira. La Cámara está preparada.',
        },
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
