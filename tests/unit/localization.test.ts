import { describe, expect, it } from 'vitest';

import { UI_COPY, loadLocale, saveLocale, uiCopy } from '../../src/i18n';
import { generateHaiku } from '../../src/gameplay/haiku';
import type { AttentionPortrait } from '../../src/gameplay/portrait';

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

const PORTRAIT: AttentionPortrait = {
  fixedCells: 90,
  uniqueTerrainTiles: 8,
  uniqueFeatureTiles: 6,
  unlockedPacks: ['water', 'forest'],
  deaths: 1,
  dangerExposureSeconds: 12,
  averageGazeDwell: 1.2,
  revisitRatio: 0.2,
  maxDistance: 28,
  waterRatio: 0.25,
  forestRatio: 0.3,
  ruinRatio: 0,
  unresolvedVisibleCells: 8,
};

describe('bilingual localization', () => {
  it('defaults to English and persists a valid explicit choice', () => {
    const storage = new MemoryStorage();
    expect(loadLocale(storage)).toBe('en');
    saveLocale('es', storage);
    expect(loadLocale(storage)).toBe('es');
    storage.setItem('ultima-observacion.locale.v1', 'fr');
    expect(loadLocale(storage)).toBe('en');
  });

  it('keeps EN and ES catalog structures in exact parity', () => {
    expect(Object.keys(UI_COPY.en).sort()).toEqual(
      Object.keys(UI_COPY.es).sort(),
    );
    expect(Object.keys(UI_COPY.en.packLabels).sort()).toEqual(
      Object.keys(UI_COPY.es.packLabels).sort(),
    );
    expect(Object.keys(UI_COPY.en.uncertaintyStates).sort()).toEqual(
      Object.keys(UI_COPY.es.uncertaintyStates).sort(),
    );
    expect(uiCopy('en').title).toBe('The Last Observation');
    expect(uiCopy('es').title).toBe('La Última Observación');
  });

  it('uses a native English haiku bank rather than translating Spanish output', () => {
    const english = generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo', 'en');
    const spanish = generateHaiku(0xa91f42c0, PORTRAIT, 'Cartógrafo', 'es');
    expect(english.lines).toHaveLength(3);
    expect(english.lines).not.toEqual(spanish.lines);
    expect(english.lines.join(' ')).toMatch(/[A-Za-z]/u);
  });

  it('contains no common UTF-8 mojibake markers in production copy', () => {
    expect(JSON.stringify(UI_COPY)).not.toMatch(/Ã|Â|â€™|â€œ|â€|�/u);
  });
});
