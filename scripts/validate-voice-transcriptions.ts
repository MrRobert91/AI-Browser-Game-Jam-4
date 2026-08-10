import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { AudioAssetManifest } from '../src/contracts/localization';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST_PATH = resolve(ROOT, 'public/assets/audio/audio-manifest.json');
const REPORT_PATH = resolve(ROOT, 'public/assets/audio/transcription-report.json');
const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required.');
const limitRaw = process.argv.find((value) => value.startsWith('--limit='))?.split('=')[1];
const limit = limitRaw ? Number(limitRaw) : Number.POSITIVE_INFINITY;
const locale = process.argv.find((value) => value.startsWith('--locale='))?.split('=')[1];

function words(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9 ]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean);
}

function similarity(expected: string, actual: string): number {
  const left = words(expected);
  const right = words(actual);
  const table = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let x = 1; x <= left.length; x += 1) {
    for (let y = 1; y <= right.length; y += 1) {
      table[x]![y] =
        left[x - 1] === right[y - 1]
          ? table[x - 1]![y - 1]! + 1
          : Math.max(table[x - 1]![y]!, table[x]![y - 1]!);
    }
  }
  return table[left.length]![right.length]! / Math.max(1, left.length, right.length);
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as AudioAssetManifest;
const report = [];
let totalCostUsd = 0;
for (const asset of manifest.assets
  .filter(
    (entry) =>
      entry.kind === 'voice' && (!locale || entry.locale === locale),
  )
  .slice(0, limit)) {
  const file = await readFile(resolve(ROOT, 'public', asset.path.replace(/^\//u, '')));
  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/MrRobert91/AI-Browser-Game-Jam-4',
      'X-Title': 'La Ultima Observacion asset validation',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini-transcribe',
      input_audio: { data: file.toString('base64'), format: 'mp3' },
      language: asset.locale,
      temperature: 0,
    }),
  });
  if (!response.ok) throw new Error(`${asset.locale}/${asset.id}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`);
  const payload = (await response.json()) as {
    text: string;
    usage?: { cost?: number };
  };
  const score = similarity(asset.text ?? '', payload.text);
  const costUsd = payload.usage?.cost ?? 0;
  totalCostUsd += costUsd;
  report.push({
    id: asset.id,
    locale: asset.locale,
    expected: asset.text,
    transcription: payload.text,
    similarity: score,
    costUsd,
  });
  process.stdout.write(`${asset.locale}/${asset.id} ${(score * 100).toFixed(1)}%\n`);
}
const failures = report.filter((entry) => entry.similarity < 0.72);
await writeFile(
  REPORT_PATH,
  `${JSON.stringify({
    version: 1,
    model: 'openai/gpt-4o-mini-transcribe',
    generatedAt: new Date().toISOString(),
    totalCostUsd,
    minimumSimilarity: Math.min(...report.map((entry) => entry.similarity)),
    entries: report,
  }, null, 2)}\n`,
  'utf8',
);
if (failures.length > 0) {
  throw new Error(
    `Transcription validation failed: ${failures.map((entry) => `${entry.locale}/${entry.id}=${entry.similarity.toFixed(2)}`).join(', ')}`,
  );
}
process.stdout.write(`Validated ${report.length} clips; STT cost $${totalCostUsd.toFixed(6)}\n`);
