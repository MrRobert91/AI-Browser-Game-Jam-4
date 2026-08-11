import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import type {
  AudioAssetEntry,
  AudioAssetManifest,
} from '../src/contracts/localization';

const ROOT = resolve(import.meta.dirname, '..');
const DIRECTORY = resolve(ROOT, 'public/assets/audio/ambience');
const MANIFEST_PATH = resolve(ROOT, 'public/assets/audio/audio-manifest.json');
const DURATION_SECONDS = 20;

const SCENES = {
  room: 'highpass=f=38,lowpass=f=420,volume=0.34,tremolo=f=0.12:d=0.18',
  base: 'highpass=f=700,lowpass=f=8200,volume=0.20,tremolo=f=0.16:d=0.32',
  water: 'highpass=f=90,lowpass=f=3400,volume=0.28,tremolo=f=0.31:d=0.38',
  ruin: 'highpass=f=120,lowpass=f=2400,aecho=0.55:0.35:1800:0.22,volume=0.24',
  storm: 'highpass=f=45,lowpass=f=1500,tremolo=f=0.55:d=0.62,volume=0.36',
} as const;

async function run(command: string, args: readonly string[]): Promise<string> {
  return await new Promise((accept, reject) => {
    const child = spawn(command, [...args], { cwd: ROOT, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) accept(stdout.trim());
      else
        reject(
          new Error(`${command} failed (${code}): ${stderr.slice(-1200)}`),
        );
    });
  });
}

await mkdir(DIRECTORY, { recursive: true });
const manifest = JSON.parse(
  await readFile(MANIFEST_PATH, 'utf8'),
) as AudioAssetManifest;
const voiceAssets = manifest.assets.filter((asset) => asset.kind === 'voice');
const ambienceAssets: AudioAssetEntry[] = [];
for (const [scene, filter] of Object.entries(SCENES)) {
  const destination = resolve(DIRECTORY, `${scene}.mp3`);
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `anoisesrc=color=pink:sample_rate=44100:duration=${DURATION_SECONDS}:seed=${scene.length * 7919}`,
    '-af',
    `${filter},afade=t=in:st=0:d=0.08,afade=t=out:st=19.92:d=0.08,loudnorm=I=-24:TP=-3:LRA=5`,
    '-t',
    String(DURATION_SECONDS),
    '-ac',
    '1',
    '-ar',
    '44100',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '64k',
    destination,
  ]);
  const bytes = await readFile(destination);
  const durationSeconds = Number(
    await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      destination,
    ]),
  );
  ambienceAssets.push({
    id: scene,
    locale: 'none',
    path: `/assets/audio/ambience/${scene}.mp3`,
    kind: 'ambience',
    provider: 'local-ffmpeg',
    model: 'lavfi-anoisesrc',
    voice: null,
    style:
      'Non-musical procedural ambience loop; no speech and no runtime oscillator.',
    generationId: null,
    generatedAt: new Date().toISOString(),
    text: null,
    textSha256: null,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    durationSeconds,
    bytes: bytes.byteLength,
    loudnessLufs: -24,
    truePeakDbtp: -3,
    costUsd: 0,
  });
  process.stdout.write(
    `${scene} ${durationSeconds.toFixed(2)}s ${bytes.byteLength}B\n`,
  );
}
await writeFile(
  MANIFEST_PATH,
  `${JSON.stringify({ ...manifest, assets: [...voiceAssets, ...ambienceAssets] }, null, 2)}\n`,
  'utf8',
);
