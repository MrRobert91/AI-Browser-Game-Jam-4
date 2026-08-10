import { createHash } from 'node:crypto';
import { copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import type { AudioAssetManifest } from '../src/contracts/localization';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST_PATH = resolve(ROOT, 'public/assets/audio/audio-manifest.json');
const requestedId = process.argv
  .find((value) => value.startsWith('--id='))
  ?.split('=')[1];
const requestedLocale = process.argv
  .find((value) => value.startsWith('--locale='))
  ?.split('=')[1];
const limiter =
  process.argv.find((value) => value.startsWith('--limiter='))?.split('=')[1] ??
  '0.7943';

async function run(
  args: readonly string[],
): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((accept, reject) => {
    const child = spawn('ffmpeg', [...args], { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) accept({ stdout, stderr });
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-1200)}`));
    });
  });
}

function loudnessJson(stderr: string): {
  input_i: string;
} {
  const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/u);
  if (!match) throw new Error('FFmpeg did not return loudness JSON.');
  return JSON.parse(match[0]) as ReturnType<typeof loudnessJson>;
}

const manifest = JSON.parse(
  await readFile(MANIFEST_PATH, 'utf8'),
) as AudioAssetManifest;
const assets = [];
for (const asset of manifest.assets) {
  if (
    asset.kind !== 'voice' ||
    (requestedId && asset.id !== requestedId) ||
    (requestedLocale && asset.locale !== requestedLocale)
  ) {
    assets.push(asset);
    continue;
  }
  const destination = resolve(ROOT, 'public', asset.path.replace(/^\//u, ''));
  const temporary = `${destination}.normalized.mp3`;
  const firstPass = await run([
    '-hide_banner',
    '-nostats',
    '-i',
    destination,
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json',
    '-f',
    'null',
    'NUL',
  ]);
  const measured = loudnessJson(firstPass.stderr);
  const correctionDb = -16 - Number(measured.input_i);
  const filter = `volume=${correctionDb.toFixed(2)}dB,alimiter=limit=${limiter}:attack=5:release=80:level=false`;
  await run([
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    destination,
    '-af',
    filter,
    '-ac',
    '1',
    '-ar',
    '44100',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '64k',
    temporary,
  ]);
  await copyFile(temporary, destination);
  await rm(temporary, { force: true });
  const bytes = await readFile(destination);
  assets.push({
    ...asset,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    loudnessLufs: -16,
    truePeakDbtp: -1.5,
  });
  process.stdout.write(`${asset.locale}/${asset.id}\n`);
}
await writeFile(
  MANIFEST_PATH,
  `${JSON.stringify({ ...manifest, assets }, null, 2)}\n`,
  'utf8',
);
