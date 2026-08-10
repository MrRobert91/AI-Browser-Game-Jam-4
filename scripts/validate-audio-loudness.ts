import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import type { AudioAssetManifest } from '../src/contracts/localization';

const ROOT = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  await readFile(
    resolve(ROOT, 'public/assets/audio/audio-manifest.json'),
    'utf8',
  ),
) as AudioAssetManifest;

async function measure(
  path: string,
): Promise<{ integratedLufs: number; truePeakDbtp: number }> {
  return await new Promise((accept, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-nostats',
        '-i',
        path,
        '-af',
        'loudnorm=print_format=json',
        '-f',
        'null',
        'NUL',
      ],
      { windowsHide: true },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed for ${path}`));
      const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/u);
      if (!match) return reject(new Error(`No loudness data for ${path}`));
      const values = JSON.parse(match[0]) as {
        input_i: string;
        input_tp: string;
      };
      accept({
        integratedLufs: Number(values.input_i),
        truePeakDbtp: Number(values.input_tp),
      });
    });
  });
}

const entries = [];
for (const asset of manifest.assets) {
  const values = await measure(
    resolve(ROOT, 'public', asset.path.replace(/^\//u, '')),
  );
  const target = asset.kind === 'voice' ? -16 : -24;
  const valid =
    Math.abs(values.integratedLufs - target) <= 1.2 &&
    values.truePeakDbtp <= -1.3;
  entries.push({
    id: asset.id,
    locale: asset.locale,
    kind: asset.kind,
    targetLufs: target,
    ...values,
    valid,
  });
  process.stdout.write(
    `${asset.locale}/${asset.id} ${values.integratedLufs.toFixed(1)} LUFS ${values.truePeakDbtp.toFixed(1)} dBTP\n`,
  );
}
await writeFile(
  resolve(ROOT, 'public/assets/audio/loudness-report.json'),
  `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), entries }, null, 2)}\n`,
  'utf8',
);
const invalid = entries.filter((entry) => !entry.valid);
if (invalid.length > 0)
  throw new Error(
    `Invalid loudness: ${invalid.map((entry) => `${entry.locale}/${entry.id}`).join(', ')}`,
  );
const measuredByAsset = new Map(
  entries.map((entry) => [`${entry.kind}:${entry.locale}:${entry.id}`, entry]),
);
await writeFile(
  resolve(ROOT, 'public/assets/audio/audio-manifest.json'),
  `${JSON.stringify(
    {
      ...manifest,
      assets: manifest.assets.map((asset) => {
        const measured = measuredByAsset.get(
          `${asset.kind}:${asset.locale}:${asset.id}`,
        )!;
        return {
          ...asset,
          loudnessLufs: measured.integratedLufs,
          truePeakDbtp: measured.truePeakDbtp,
        };
      }),
    },
    null,
    2,
  )}\n`,
  'utf8',
);
process.stdout.write(`Validated ${entries.length} audio assets.\n`);
