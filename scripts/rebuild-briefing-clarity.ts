import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const VIDEO_ROOT = resolve(ROOT, 'public/assets/video');
const OUTPUT = resolve(VIDEO_ROOT, 'agency-briefing.webm');
const MANIFEST = resolve(VIDEO_ROOT, 'video-production-manifest.json');
const DURATIONS = [7, 7, 7, 7, 7, 7, 8] as const;

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
      else reject(new Error(`${command} failed (${code}): ${stderr}`));
    });
  });
}

const inputArguments = DURATIONS.flatMap((duration, index) => [
  '-loop',
  '1',
  '-t',
  String(duration),
  '-i',
  resolve(
    VIDEO_ROOT,
    `briefing-fallback-${String(index + 1).padStart(2, '0')}.webp`,
  ),
]);
const filters = DURATIONS.map((duration, index) => {
  const fadeOut = (duration - 0.2).toFixed(1);
  return `[${index}:v]scale=1920:1080:flags=lanczos,unsharp=5:5:0.75:3:3:0.25,setsar=1,fade=t=in:st=0:d=0.2,fade=t=out:st=${fadeOut}:d=0.2[v${index}]`;
});
const concat = `${DURATIONS.map((_, index) => `[v${index}]`).join('')}concat=n=7:v=1:a=0,fps=30,format=yuv420p[out]`;

await run('ffmpeg', [
  '-y',
  '-hide_banner',
  '-loglevel',
  'error',
  ...inputArguments,
  '-filter_complex',
  [...filters, concat].join(';'),
  '-map',
  '[out]',
  '-an',
  '-c:v',
  'libvpx-vp9',
  '-crf',
  '24',
  '-b:v',
  '0',
  '-deadline',
  'good',
  '-cpu-used',
  '2',
  '-row-mt',
  '1',
  OUTPUT,
]);

const probe = JSON.parse(
  await run('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    OUTPUT,
  ]),
) as {
  streams: readonly {
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
  }[];
  format: { duration: string };
};
const video = probe.streams.find((stream) => stream.codec_type === 'video');
if (
  video?.codec_name !== 'vp9' ||
  video.width !== 1920 ||
  video.height !== 1080 ||
  probe.streams.some((stream) => stream.codec_type === 'audio') ||
  Math.abs(Number(probe.format.duration) - 50) > 0.08
) {
  throw new Error(
    'Rebuilt briefing failed the 1080p VP9 silent timeline contract.',
  );
}

const bytes = await readFile(OUTPUT);
const prior = JSON.parse(await readFile(MANIFEST, 'utf8')) as Record<
  string,
  unknown
>;
await writeFile(
  MANIFEST,
  `${JSON.stringify(
    {
      ...prior,
      version: 2,
      generatedAt: new Date().toISOString(),
      resolution: '1920x1080',
      codec: 'vp9',
      clarityPipeline:
        'chapter-aligned local still montage, Lanczos upscale, unsharp 0.75, VP9 CRF 24',
      audioTracks: 0,
      durationSeconds: Number(probe.format.duration),
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    null,
    2,
  )}\n`,
  'utf8',
);
process.stdout.write(
  `Rebuilt ${bytes.byteLength}B chapter-aligned 1080p briefing from local stills.\n`,
);
