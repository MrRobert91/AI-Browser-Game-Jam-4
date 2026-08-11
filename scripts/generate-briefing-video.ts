import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = resolve(ROOT, 'public/assets/video');
const SOURCE_ROOT = resolve(OUTPUT_ROOT, 'source');
const MANIFEST_PATH = resolve(OUTPUT_ROOT, 'video-production-manifest.json');
const MODEL = 'google/veo-3.1-lite';
const MAX_VIDEO_COST_USD = 5;
const DURATIONS = [8, 8, 8, 8, 6, 6, 6] as const;
const PROMPTS = [
  'Retrofuturist corporate training film, 1970s institutional science documentary in a vast white and dark-metal orbital laboratory, cyan practical lighting, a lonely replaceable humanoid field body entering a sealed perfectly smooth spherical chamber, every wall and door completely unmarked and blank, symmetrical wide shot, subtle film grain, slow precise dolly, melancholy and bureaucratic, no display panels, no signs, no logos, no letters, no numbers, no text, no audio.',
  'Retrofuturist scientific training film visualization of an isolated translucent volume suspended in black space, no particles or signals crossing its perfect boundary while external sensor arrays orbit at a respectful distance, cyan and violet coherent light, slow orbital camera, elegant physical realism, institutional documentary, no text, no symbols, no audio.',
  'Corporate science film macro journey inside a coherent Possibility Condensate: ghostly overlapping landscapes, geometric ruins, water, vegetation and faint potential organisms occupying the same volume without becoming distinct, beautiful cyan violet white superposition, slow forward movement, no horror, no text, no audio.',
  'Aged white institutional control room filled only with precise analog retrofuturist machinery: unmarked lenses project many luminous probability silhouettes into the air, then every mechanical arm stops just before selecting one, dry bureaucratic visual comedy, no screens, no gauges, no interface, no human faces, slow lateral camera, no signs, no letters, no numbers, no text, no audio.',
  'Retrofuturist corporate training demonstration: warm light inhabits the chest of a replaceable dark-metal field body, facing a compact cyan measuring instrument made only from a glowing lens and smooth unmarked metal, sealed laboratory chamber, measured slow push-in, elegant and cold, no screen, no interface, no written words, no logos, no audio.',
  'Abstract institutional science visualization: a narrow beam of attention from a field-body visor becomes a measurement basis, several translucent possibilities contract and one warm material landscape propagates in a clean wave across the environment, slow controlled camera, cyan to gold transformation, no equations, no text, no audio.',
  'Melancholy retrofuturist training-film finale: footprints, a long shadow and fading memory-like silhouettes become permanent luminous records across a newly materialized world, a circular chamber window slowly closing like a ten-minute clock, distant camera rising, beautiful warm landscape surrounded by dark unresolved grid, no text, no audio.',
] as const;

interface VideoModel {
  readonly id: string;
  readonly supported_resolutions: readonly string[];
  readonly supported_aspect_ratios: readonly string[];
  readonly supported_durations: readonly number[];
  readonly pricing_skus: Readonly<Record<string, string>>;
}

interface VideoJob {
  readonly id: string;
  readonly polling_url: string;
  readonly status: string;
  readonly generation_id?: string;
  readonly unsigned_urls?: readonly string[];
  readonly usage?: { readonly cost?: number };
  readonly error?: string;
}

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
          new Error(`${command} failed (${code}): ${stderr.slice(-1_500)}`),
        );
    });
  });
}

async function authorizedJson<T>(
  apiKey: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/MrRobert91/AI-Browser-Game-Jam-4',
      'X-Title': 'La Ultima Observacion briefing video production',
      ...init?.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      `HTTP ${response.status}: ${(await response.text()).slice(0, 800)}`,
    );
  return (await response.json()) as T;
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new Error(
      'OPENROUTER_API_KEY is required in the process environment.',
    );
  await mkdir(SOURCE_ROOT, { recursive: true });
  const models = await authorizedJson<{ data: readonly VideoModel[] }>(
    apiKey,
    'https://openrouter.ai/api/v1/videos/models',
  );
  const model = models.data.find((candidate) => candidate.id === MODEL);
  if (!model)
    throw new Error(`${MODEL} is not currently offered by OpenRouter.`);
  if (!model.supported_resolutions.includes('720p'))
    throw new Error(`${MODEL} does not support 720p.`);
  if (!model.supported_aspect_ratios.includes('16:9'))
    throw new Error(`${MODEL} does not support 16:9.`);
  for (const duration of DURATIONS) {
    if (!model.supported_durations.includes(duration)) {
      throw new Error(`${MODEL} does not support ${duration}-second clips.`);
    }
  }
  const requestedArgument = process.argv
    .find((value) => value.startsWith('--shots='))
    ?.split('=')[1];
  const requestedIndices = requestedArgument
    ? requestedArgument.split(',').map((value) => Number(value) - 1)
    : PROMPTS.map((_, index) => index);
  if (
    requestedIndices.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= PROMPTS.length,
    )
  ) {
    throw new Error(
      '--shots must contain comma-separated shot numbers from 1 to 7.',
    );
  }
  const priorManifest = await readFile(MANIFEST_PATH, 'utf8')
    .then(
      (value) =>
        JSON.parse(value) as {
          actualCostUsd?: number;
          shots?: readonly Record<string, unknown>[];
        },
    )
    .catch(() => null);
  const rate = Number(model.pricing_skus.duration_seconds_without_audio_720p);
  const estimatedRunCostUsd =
    requestedIndices.reduce((total, index) => total + DURATIONS[index]!, 0) *
    rate;
  const estimatedCostUsd =
    (priorManifest?.actualCostUsd ?? 0) + estimatedRunCostUsd;
  if (!Number.isFinite(rate) || estimatedCostUsd > MAX_VIDEO_COST_USD) {
    throw new Error(
      `Cumulative estimated video cost $${estimatedCostUsd} exceeds $${MAX_VIDEO_COST_USD}.`,
    );
  }
  process.stdout.write(
    `Preflight: ${requestedIndices.length} shot(s) without audio, cumulative estimated $${estimatedCostUsd.toFixed(2)}.\n`,
  );

  const submitted: VideoJob[] = [];
  for (const index of requestedIndices) {
    const prompt = PROMPTS[index]!;
    const job = await authorizedJson<VideoJob>(
      apiKey,
      'https://openrouter.ai/api/v1/videos',
      {
        method: 'POST',
        body: JSON.stringify({
          model: MODEL,
          prompt,
          duration: DURATIONS[index],
          resolution: '720p',
          aspect_ratio: '16:9',
          generate_audio: false,
          seed: 0x4f425300 + index,
          provider: {
            options: {
              'google-vertex': {
                parameters: {
                  negativePrompt:
                    'text, words, letters, numbers, captions, subtitles, logos, labels, signage, display screens, watermarks',
                },
              },
            },
          },
        }),
      },
    );
    submitted.push(job);
    process.stdout.write(`Submitted shot ${index + 1}/7: ${job.id}\n`);
  }

  const completed: VideoJob[] = [];
  for (const [submittedIndex, submittedJob] of submitted.entries()) {
    const index = requestedIndices[submittedIndex]!;
    let job = submittedJob;
    for (let poll = 0; poll < 40; poll += 1) {
      if (job.status === 'completed') break;
      if (['failed', 'cancelled', 'expired'].includes(job.status)) {
        throw new Error(
          `Shot ${index + 1} ${job.status}: ${job.error ?? 'unknown error'}`,
        );
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 30_000));
      job = await authorizedJson<VideoJob>(apiKey, submittedJob.polling_url);
      process.stdout.write(`Shot ${index + 1}: ${job.status}\n`);
    }
    if (job.status !== 'completed')
      throw new Error(`Shot ${index + 1} did not complete before timeout.`);
    const contentUrl =
      job.unsigned_urls?.[0] ?? `${submittedJob.polling_url}/content?index=0`;
    const response = await fetch(contentUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok)
      throw new Error(
        `Shot ${index + 1} download failed: HTTP ${response.status}`,
      );
    const path = resolve(
      SOURCE_ROOT,
      `shot-${String(index + 1).padStart(2, '0')}.mp4`,
    );
    await writeFile(path, new Uint8Array(await response.arrayBuffer()));
    completed.push(job);
  }

  const actualRunCostUsd = completed.reduce(
    (total, job) => total + (job.usage?.cost ?? 0),
    0,
  );
  const actualCostUsd = (priorManifest?.actualCostUsd ?? 0) + actualRunCostUsd;
  if (actualCostUsd <= 0 || actualCostUsd > MAX_VIDEO_COST_USD) {
    throw new Error(
      `Reported video cost $${actualCostUsd} is outside the $0-$5 production budget.`,
    );
  }
  const concatList = resolve(SOURCE_ROOT, 'concat.txt');
  await writeFile(
    concatList,
    `${PROMPTS.map((_, index) => `file '${resolve(SOURCE_ROOT, `shot-${String(index + 1).padStart(2, '0')}.mp4`).replaceAll("'", "'\\''")}'`).join('\n')}\n`,
    'utf8',
  );
  const destination = resolve(OUTPUT_ROOT, 'agency-briefing.webm');
  await run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatList,
    '-an',
    '-vf',
    'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30',
    '-t',
    '50',
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '35',
    '-b:v',
    '850k',
    '-deadline',
    'good',
    '-cpu-used',
    '2',
    '-row-mt',
    '1',
    '-pix_fmt',
    'yuv420p',
    destination,
  ]);
  let offset = 0;
  for (const [index, duration] of DURATIONS.entries()) {
    const fallback = resolve(
      OUTPUT_ROOT,
      `briefing-fallback-${String(index + 1).padStart(2, '0')}.webp`,
    );
    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(offset + duration / 2),
      '-i',
      destination,
      '-frames:v',
      '1',
      '-vf',
      'scale=1280:720',
      '-quality',
      '82',
      fallback,
    ]);
    offset += duration;
  }
  const bytes = await readFile(destination);
  const probe = JSON.parse(
    await run('ffprobe', [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      destination,
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
  const videoStream = probe.streams.find(
    (stream) => stream.codec_type === 'video',
  );
  if (
    videoStream?.codec_name !== 'vp9' ||
    videoStream.width !== 1280 ||
    videoStream.height !== 720 ||
    probe.streams.some((stream) => stream.codec_type === 'audio') ||
    Math.abs(Number(probe.format.duration) - 50) > 0.08
  ) {
    throw new Error(
      'Final briefing video failed codec, dimensions, audio-track, or duration validation.',
    );
  }
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        model: MODEL,
        resolution: '1280x720',
        codec: 'vp9',
        audioTracks: 0,
        durationSeconds: Number(probe.format.duration),
        bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        estimatedCostUsd,
        actualCostUsd,
        shots: PROMPTS.map((prompt, index) => {
          const replacementIndex = requestedIndices.indexOf(index);
          const job =
            replacementIndex >= 0 ? completed[replacementIndex] : undefined;
          return job
            ? {
                id: `shot-${index + 1}`,
                durationSeconds: DURATIONS[index],
                prompt,
                jobId: job.id,
                generationId: job.generation_id ?? null,
                costUsd: job.usage?.cost ?? 0,
              }
            : priorManifest?.shots?.[index];
        }),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  process.stdout.write(
    `Generated ${bytes.byteLength}B VP9 briefing; reported OpenRouter video cost $${actualCostUsd.toFixed(2)}.\n`,
  );
}

await main();
