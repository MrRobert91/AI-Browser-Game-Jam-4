import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GRAMMAR_SOURCE } from '../../src/content/grammar';
import { validateProxyAsset } from '../../src/content/asset-validator';

describe('validate:assets', () => {
  it('validates every referenced proxy, footprint and pivot', async () => {
    const issues: string[] = [];
    for (const [layer, definitions] of [
      ['terrain', GRAMMAR_SOURCE.terrain],
      ['feature', GRAMMAR_SOURCE.features],
    ] as const) {
      for (const definition of definitions) {
        if (definition.mesh === null) continue;
        const raw = JSON.parse(
          await readFile(resolve('public', definition.mesh.slice(1)), 'utf8'),
        ) as unknown;
        issues.push(
          ...validateProxyAsset(definition.mesh, raw, layer).map(
            (issue) => `${issue.path}: ${issue.message}`,
          ),
        );
      }
    }
    expect(issues).toEqual([]);
  });

  it('rejects wrong scale, pivot and remote paths', () => {
    const invalid = {
      version: 1,
      shape: 'bad',
      color: '#112233',
      accent: '#445566',
      bounds: { width: 3, height: 1, depth: 2 },
      pivot: 'centre',
    };
    const messages = validateProxyAsset(
      'https://remote/mesh.proxy.json',
      invalid,
      'terrain',
    ).map((issue) => issue.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/local/),
        expect.stringMatching(/Pivot/),
        expect.stringMatching(/2 x 2/),
      ]),
    );
  });
});
