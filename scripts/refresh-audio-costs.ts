import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AudioAssetManifest } from '../src/contracts/localization';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required.');
const manifestPath = resolve(
  import.meta.dirname,
  '../public/assets/audio/audio-manifest.json',
);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as AudioAssetManifest;
const updated = [];
for (const asset of manifest.assets) {
  let costUsd = asset.costUsd;
  if (asset.generationId) {
    const response = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(asset.generationId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) throw new Error(`Accounting failed for ${asset.id}: HTTP ${response.status}`);
    const payload = (await response.json()) as { data?: { total_cost?: number } };
    if (typeof payload.data?.total_cost !== 'number') {
      throw new Error(`Accounting is not ready for ${asset.locale}/${asset.id}`);
    }
    costUsd = payload.data.total_cost;
  }
  updated.push({ ...asset, costUsd });
}
const totalCostUsd = updated.reduce((total, asset) => total + asset.costUsd, 0);
await writeFile(
  manifestPath,
  `${JSON.stringify({ ...manifest, assets: updated, totalCostUsd }, null, 2)}\n`,
  'utf8',
);
process.stdout.write(`Refreshed ${updated.length} assets; total $${totalCostUsd.toFixed(6)}\n`);
