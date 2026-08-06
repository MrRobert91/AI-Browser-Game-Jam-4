import { describe, expect, it, vi } from 'vitest';

import {
  AudioDirector,
  countdownPulseInterval,
} from '../../src/audio/audio-director';
import { STEM_DEFINITIONS } from '../../src/audio/music-stems';
import { MAX_POSITIONAL_AUDIO_SOURCES } from '../../src/audio/spatial-pool';
import { NarrativeDirector } from '../../src/gameplay/narrative';
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
  it('keeps four local stems, eight positional voices and 60/30 s cadence', () => {
    expect(Object.keys(STEM_DEFINITIONS)).toEqual([
      'water',
      'forest',
      'ruin',
      'storm',
    ]);
    expect(MAX_POSITIONAL_AUDIO_SOURCES).toBe(8);
    expect(countdownPulseInterval(61)).toBeNull();
    expect(countdownPulseInterval(60)).toBe(2.5);
    expect(countdownPulseInterval(30)).toBe(1);
  });

  it('does not allocate an AudioContext before a user gesture', () => {
    const createContext = vi.fn();
    const director = new AudioDirector({ createContext });
    expect(createContext).not.toHaveBeenCalled();
    expect(director.started).toBe(false);
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
    expect(director.play('firstDeath')).toBe('El mundo recuerda mejor que tú.');
    expect(director.play('lastThirtySeconds')).toBe(
      'No queda tiempo para verlo todo. Elige qué merece terminar.',
    );
    expect(director.play('final')).toBe(
      'No encontraste este mundo. Lo separaste de todos los demás.',
    );
    expect(onMessage).toHaveBeenCalledTimes(4);
    expect(onSubtitle).toHaveBeenCalledTimes(4);
  });
});
