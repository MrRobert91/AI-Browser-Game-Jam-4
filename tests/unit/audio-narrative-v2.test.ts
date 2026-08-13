import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { AudioAssetManifest } from '../../src/contracts/localization';
import {
  MAX_NARRATIVE_CUES_PER_RUN,
  NARRATIVE_COOLDOWN_MS,
  NARRATIVE_CUE_ORDER,
  NARRATIVE_CATALOGS,
  NarrativeDirector,
} from '../../src/gameplay/narrative';
import {
  LEGACY_SETTINGS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  loadGameSettings,
  saveGameSettings,
} from '../../src/ui/pause';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

async function productionText(directory: string): Promise<string> {
  const entries = await readdir(directory, { withFileTypes: true });
  const values: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) values.push(await productionText(path));
    else if (/\.(?:ts|json)$/u.test(entry.name))
      values.push(await readFile(path, 'utf8'));
  }
  return values.join('\n');
}

describe('audio settings v2', () => {
  it('migrates v1 music to ambience and effects to voice/effects', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEGACY_SETTINGS_STORAGE_KEY,
      JSON.stringify({ volumes: { master: 0.6, music: 0.3, effects: 0.8 } }),
    );
    const migrated = loadGameSettings(storage);
    expect(migrated.volumes).toEqual({
      master: 0.6,
      voice: 0.8,
      ambience: 0.3,
      effects: 0.8,
    });
    saveGameSettings(migrated, storage);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();
  });
});

describe('bounded bilingual Measure narration', () => {
  it('has exact EN/ES parity with 44 active cues per language', () => {
    expect(NARRATIVE_CUE_ORDER).toHaveLength(44);
    expect(Object.keys(NARRATIVE_CATALOGS.en.cues)).toEqual(
      Object.keys(NARRATIVE_CATALOGS.es.cues),
    );
    expect(NARRATIVE_CATALOGS.en.cues.start.text).toContain('Look.');
    expect(NARRATIVE_CATALOGS.es.cues.start.text).toContain('Mira.');
  });

  it('enforces cooldown, deterministic pools and the 22-intervention ceiling', () => {
    const events = { onMessage: vi.fn(), onSubtitle: vi.fn() };
    const director = new NarrativeDirector(events, NARRATIVE_CATALOGS.en);
    expect(director.playPool('distance', 42, true, 0)).not.toBeNull();
    expect(director.playPool('attention', 42, true, 1)).toBeNull();
    expect(
      director.playPool('attention', 42, true, NARRATIVE_COOLDOWN_MS),
    ).not.toBeNull();
    let time = NARRATIVE_COOLDOWN_MS * 2;
    for (const cueId of NARRATIVE_CUE_ORDER) {
      director.play(cueId, false, time);
      time += NARRATIVE_COOLDOWN_MS;
    }
    expect(director.playedCueIds()).toHaveLength(MAX_NARRATIVE_CUES_PER_RUN);
    const first = new NarrativeDirector(
      { onMessage: vi.fn(), onSubtitle: vi.fn() },
      NARRATIVE_CATALOGS.en,
    );
    const second = new NarrativeDirector(
      { onMessage: vi.fn(), onSubtitle: vi.fn() },
      NARRATIVE_CATALOGS.en,
    );
    expect(first.playPool('risk', 0xa91f42c0, true, 0)).toBe(
      second.playPool('risk', 0xa91f42c0, true, 0),
    );
  });

  it('drops a contextual comment whose condition is no longer valid', () => {
    const onMessage = vi.fn();
    const director = new NarrativeDirector(
      { onMessage, onSubtitle: vi.fn() },
      NARRATIVE_CATALOGS.es,
    );
    expect(director.playPool('stalled', 7, false, 0)).toBeNull();
    expect(onMessage).not.toHaveBeenCalled();
  });
});

describe('generated local audio assets', () => {
  it('matches every manifest hash and stays inside the pre-video budget', async () => {
    const manifest = JSON.parse(
      await readFile(
        resolve('public/assets/audio/audio-manifest.json'),
        'utf8',
      ),
    ) as AudioAssetManifest;
    expect(
      manifest.assets.filter(
        (asset) =>
          asset.kind === 'voice' &&
          asset.locale === 'en' &&
          asset.id !== 'briefing',
      ),
    ).toHaveLength(45);
    expect(
      manifest.assets.filter(
        (asset) =>
          asset.kind === 'voice' &&
          asset.locale === 'es' &&
          asset.id !== 'briefing',
      ),
    ).toHaveLength(45);
    expect(
      manifest.assets.filter(
        (asset) => asset.kind === 'voice' && asset.id === 'missionComplete',
      ),
    ).toHaveLength(2);
    expect(
      manifest.assets.filter((asset) => asset.kind === 'ambience'),
    ).toHaveLength(5);
    expect(manifest.totalCostUsd).toBeGreaterThan(0);
    expect(manifest.totalCostUsd).toBeLessThan(1);
    let bytes = 0;
    for (const asset of manifest.assets) {
      const file = await readFile(
        resolve('public', asset.path.replace(/^\//u, '')),
      );
      bytes += file.byteLength;
      expect(file.subarray(0, 3).toString('ascii')).toBe('ID3');
      expect(createHash('sha256').update(file).digest('hex')).toBe(
        asset.sha256,
      );
      expect(asset.durationSeconds).toBeGreaterThan(1);
    }
    expect(bytes).toBeLessThan(8_000_000);
  });

  it('contains no production references to the removed song, SAPI or old records', async () => {
    const source = `${await productionText(resolve('src'))}\n${await productionText(resolve('scripts'))}`;
    expect(source).not.toMatch(
      /la-funcion-que-nos-mira|SAPI\.SpVoice|CollapsadorRecordDirector|custom-song/iu,
    );
  });
});
