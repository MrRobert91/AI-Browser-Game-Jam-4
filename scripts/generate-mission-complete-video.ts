import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = resolve(ROOT, 'public/assets/mission-complete');
const SOURCE_ROOT = resolve(OUTPUT_ROOT, 'source');
const MANIFEST_PATH = resolve(OUTPUT_ROOT, 'video-production-manifest.json');
const MODEL = 'google/veo-3.1-lite';
const MAX_PROJECT_GENERATION_COST_USD = 5;
const DURATION_SECONDS = 8;
const SEED_BASE = 0x474f4f44;
const PROMPTS = [
  'The image contains absolutely no writing, labels, typography, symbols, interfaces or screens. Retrofuturist 1970s corporate science documentary inside a vast white and dark-metal orbital laboratory. A replaceable field body calmly overlooks a fully materialized warm landscape while four distinct plain geometric luminous seed spheres without labels are incorporated into four elegant blank archival instruments. Cyan and violet light gradually turns gold, slow symmetrical precise camera, institutional melancholy and dry bureaucratic visual humor. Every surface is blank and unmarked: no text, no letterlike shapes, no numbers, no logos, no display panels, no readable screens, no signs, no watermarks, no audio, no real people, no existing characters or performers.',
  'The image contains absolutely no writing, labels, typography, symbols, interfaces, screens, gauges, paper or records. Retrofuturist 1970s institutional science documentary, macro view of completely blank sculptural analog instruments converting cold cyan and violet layers of uncertain landscape into a warm stable golden physical form. White ceramic laboratory and dark metal, precise mechanical motion, slow controlled lateral camera, melancholy corporate ceremony and dry bureaucratic visual comedy. Every surface is smooth and unmarked: no text, no letterlike shapes, no numbers, no logos, no readable screens, no signage, no watermarks, no audio, no real people, no existing characters or performers.',
  'Retrofuturist 1970s corporate orbital laboratory observing several distant Probability Condensates appearing beyond a window in deep space while solemn unmarked institutional machinery catalogs them with absurdly careful mechanical filing motions. White and dark-metal architecture, cyan violet light shifting toward gold, slow symmetrical precise camera, institutional melancholy and restrained bureaucratic visual humor, no text, no letters, no numbers, no logos, no readable screens, no signs, no watermarks, no audio, no real people, no existing characters or performers.',
  'Retrofuturist corporate science documentary finale: a slow cosmic ascent from a complete warmly illuminated observed world toward a vast white and dark-metal orbital laboratory, while a solitary replaceable field body remains symbolically waiting beside unmarked Agency machinery. Cyan and violet remnants resolve into gold, majestic symmetrical precise camera, melancholy institutional stillness and dry bureaucratic visual humor, no text, no letters, no numbers, no logos, no readable screens, no signs, no watermarks, no audio, no real people, no existing characters or performers.',
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
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-1_500)}`));
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
      'X-Title': 'La Ultima Observacion mission complete production',
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 800)}`);
  }
  return (await response.json()) as T;
}

async function existingProjectCost(): Promise<{
  readonly baseCostUsd: number;
  readonly priorMissionCostUsd: number;
  readonly priorMissionManifest: Record<string, unknown> | null;
}> {
  const video = JSON.parse(
    await readFile(resolve(ROOT, 'public/assets/video/video-production-manifest.json'), 'utf8'),
  ) as { actualCostUsd?: number };
  const audio = JSON.parse(
    await readFile(resolve(ROOT, 'public/assets/audio/audio-manifest.json'), 'utf8'),
  ) as { totalCostUsd?: number };
  const priorMissionManifest = await readFile(MANIFEST_PATH, 'utf8')
    .then((value) => JSON.parse(value) as Record<string, unknown>)
    .catch(() => null);
  return {
    baseCostUsd: (video.actualCostUsd ?? 0) + (audio.totalCostUsd ?? 0),
    priorMissionCostUsd:
      typeof priorMissionManifest?.actualCostUsd === 'number'
        ? priorMissionManifest.actualCostUsd
        : 0,
    priorMissionManifest,
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required.');
  await mkdir(SOURCE_ROOT, { recursive: true });
  const models = await authorizedJson<{ data: readonly VideoModel[] }>(
    apiKey,
    'https://openrouter.ai/api/v1/videos/models',
  );
  const model = models.data.find((candidate) => candidate.id === MODEL);
  if (!model) throw new Error(`${MODEL} is not currently offered by OpenRouter.`);
  if (!model.supported_resolutions.includes('720p')) throw new Error(`${MODEL} does not support 720p.`);
  if (!model.supported_aspect_ratios.includes('16:9')) throw new Error(`${MODEL} does not support 16:9.`);
  if (!model.supported_durations.includes(DURATION_SECONDS)) throw new Error(`${MODEL} does not support eight-second clips.`);
  const rate = Number(model.pricing_skus.duration_seconds_without_audio_720p);
  const priorCosts = await existingProjectCost();
  const requestedArgument = process.argv
    .find((value) => value.startsWith('--chapters='))
    ?.split('=')[1];
  const requestedIndices = requestedArgument
    ? requestedArgument.split(',').map((value) => Number(value) - 1)
    : PROMPTS.map((_, index) => index);
  if (
    requestedIndices.length === 0 ||
    requestedIndices.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= PROMPTS.length,
    )
  ) {
    throw new Error('--chapters must list chapter numbers from 1 to 4.');
  }
  const priorProjectCostUsd =
    priorCosts.baseCostUsd + priorCosts.priorMissionCostUsd;
  const estimatedCostUsd =
    rate * DURATION_SECONDS * requestedIndices.length;
  if (!Number.isFinite(rate) || priorProjectCostUsd + estimatedCostUsd > MAX_PROJECT_GENERATION_COST_USD) {
    throw new Error(`Estimated project generation cost $${(priorProjectCostUsd + estimatedCostUsd).toFixed(2)} exceeds $5.`);
  }
  process.stdout.write(`Preflight: ${MODEL}, 16:9, 720p, ${requestedIndices.length} x 8s, project estimate $${(priorProjectCostUsd + estimatedCostUsd).toFixed(2)}.\n`);

  const completed = new Map<number, VideoJob>();
  const sources = new Map<number, { bytes: number; sha256: string }>();
  for (const index of requestedIndices) {
    const prompt = PROMPTS[index]!;
    const submitted = await authorizedJson<VideoJob>(apiKey, 'https://openrouter.ai/api/v1/videos', {
      method: 'POST',
      body: JSON.stringify({
        model: MODEL,
        prompt,
        duration: DURATION_SECONDS,
        resolution: '720p',
        aspect_ratio: '16:9',
        generate_audio: false,
        seed: SEED_BASE + index,
        provider: {
          options: {
            'google-vertex': {
              parameters: {
                negativePrompt: 'text, words, letters, numbers, captions, subtitles, logos, labels, signs, readable screens, watermarks, audio, celebrity, actor, existing character',
              },
            },
          },
        },
      }),
    });
    process.stdout.write(`Submitted chapter ${index + 1}/4: ${submitted.id}\n`);
    let job = submitted;
    for (let poll = 0; poll < 40 && job.status !== 'completed'; poll += 1) {
      if (['failed', 'cancelled', 'expired'].includes(job.status)) {
        throw new Error(`Chapter ${index + 1} ${job.status}: ${job.error ?? 'unknown error'}`);
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 30_000));
      job = await authorizedJson<VideoJob>(apiKey, submitted.polling_url);
      process.stdout.write(`Chapter ${index + 1}: ${job.status}\n`);
    }
    if (job.status !== 'completed') throw new Error(`Chapter ${index + 1} timed out.`);
    const contentUrl = job.unsigned_urls?.[0] ?? `${submitted.polling_url}/content?index=0`;
    const response = await fetch(contentUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) throw new Error(`Chapter ${index + 1} download failed: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(resolve(SOURCE_ROOT, `chapter-${index + 1}.mp4`), bytes);
    sources.set(index, {
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    completed.set(index, job);
  }

  const destination = resolve(OUTPUT_ROOT, 'agency-mission-complete.webm');
  if (requestedIndices.length === PROMPTS.length) {
    const concatPath = resolve(SOURCE_ROOT, 'concat.txt');
    await writeFile(
      concatPath,
      `${PROMPTS.map((_, index) => `file '${resolve(SOURCE_ROOT, `chapter-${index + 1}.mp4`).replaceAll("'", "'\\''")}'`).join('\n')}\n`,
      'utf8',
    );
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-an', '-vf', 'scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,unsharp=5:5:0.4:5:5:0',
      '-t', '32', '-c:v', 'libvpx-vp9', '-crf', '45', '-b:v', '240k', '-maxrate', '280k', '-bufsize', '560k',
      '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', destination,
    ]);
  } else {
    if (priorCosts.priorMissionManifest === null) {
      throw new Error('Partial replacement requires a prior mission manifest.');
    }
    const priorMaster = resolve(SOURCE_ROOT, 'prior-master.webm');
    await copyFile(destination, priorMaster);
    const inputArgs = ['-i', priorMaster];
    for (const index of requestedIndices) {
      inputArgs.push('-i', resolve(SOURCE_ROOT, `chapter-${index + 1}.mp4`));
    }
    const filters = PROMPTS.map((_, index) => {
      const replacement = requestedIndices.indexOf(index);
      return replacement >= 0
        ? `[${replacement + 1}:v]scale=1920:1080:flags=lanczos:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,trim=duration=8,setpts=PTS-STARTPTS,unsharp=5:5:0.4:5:5:0[v${index}]`
        : `[0:v]trim=start=${index * 8}:end=${(index + 1) * 8},setpts=PTS-STARTPTS[v${index}]`;
    });
    filters.push('[v0][v1][v2][v3]concat=n=4:v=1:a=0[out]');
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', ...inputArgs,
      '-filter_complex', filters.join(';'), '-map', '[out]', '-an',
      '-c:v', 'libvpx-vp9', '-crf', '45', '-b:v', '240k', '-maxrate', '280k', '-bufsize', '560k',
      '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', destination,
    ]);
  }
  for (let index = 0; index < PROMPTS.length; index += 1) {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(index * 8 + 4), '-i', destination,
      '-frames:v', '1', '-vf', 'scale=1280:720:flags=lanczos,unsharp=5:5:0.35:5:5:0', '-quality', '72',
      resolve(OUTPUT_ROOT, `mission-fallback-${String(index + 1).padStart(2, '0')}.webp`),
    ]);
  }
  const probe = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', destination])) as {
    streams: readonly { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string }[];
    format: { duration: string };
  };
  const videoStream = probe.streams.find((stream) => stream.codec_type === 'video');
  if (
    videoStream?.codec_name !== 'vp9' || videoStream.width !== 1920 || videoStream.height !== 1080 ||
    videoStream.r_frame_rate !== '30/1' || probe.streams.some((stream) => stream.codec_type === 'audio') ||
    Math.abs(Number(probe.format.duration) - 32) > 0.08
  ) {
    throw new Error('Mission video failed VP9, 1080p, 30 fps, silent, or duration validation.');
  }
  const finalBytes = await readFile(destination);
  const generationRunCostUsd = [...completed.values()].reduce(
    (total, job) => total + (job.usage?.cost ?? 0),
    0,
  );
  const actualCostUsd =
    priorCosts.priorMissionCostUsd + generationRunCostUsd;
  const fallbacks = await Promise.all(
    PROMPTS.map(async (_, index) => {
      const path = resolve(OUTPUT_ROOT, `mission-fallback-${String(index + 1).padStart(2, '0')}.webp`);
      const bytes = await readFile(path);
      return { path: `/assets/mission-complete/mission-fallback-${String(index + 1).padStart(2, '0')}.webp`, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
    }),
  );
  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      provider: 'OpenRouter',
      model: MODEL,
      generatedResolution: '720p',
      finalResolution: '1920x1080',
      codec: 'vp9',
      frameRate: 30,
      pixelFormat: 'yuv420p',
      audioTracks: 0,
      durationSeconds: Number(probe.format.duration),
      path: '/assets/mission-complete/agency-mission-complete.webm',
      bytes: finalBytes.byteLength,
      sha256: createHash('sha256').update(finalBytes).digest('hex'),
      estimatedCostUsd,
      actualCostUsd,
      generationRunCostUsd,
      supersededGenerationCostUsd: priorCosts.priorMissionCostUsd,
      supersededGeneration:
        priorCosts.priorMissionManifest === null
          ? null
          : requestedIndices.length === PROMPTS.length
            ? {
                generatedAt:
                  priorCosts.priorMissionManifest.generatedAt ?? null,
                chapters: priorCosts.priorMissionManifest.chapters ?? null,
                rejectionReason:
                  'Visual QA found prohibited readable text in chapter 1.',
              }
            : (priorCosts.priorMissionManifest.supersededGeneration ?? null),
      priorProjectCostUsd: priorCosts.baseCostUsd,
      projectCumulativeCostUsd: priorCosts.baseCostUsd + actualCostUsd,
      transformations: 'FFmpeg concat; Lanczos 1920x1080 upscale; pad; 30 fps; unsharp; VP9 constrained VBR at 240 kbps target / 280 kbps max; source clips removed after validation.',
      provenance: 'Generated once through OpenRouter for local offline distribution; no runtime API dependency.',
      license: 'Distribution subject to the selected provider and OpenRouter terms at generation time.',
      replacementHistory: [
        ...((priorCosts.priorMissionManifest?.replacementHistory as readonly unknown[] | undefined) ?? []),
        ...(requestedIndices.length === PROMPTS.length
          ? []
          : [{
              generatedAt: new Date().toISOString(),
              replacedChapters: requestedIndices.map((index) => index + 1),
              rejectionReason:
                'Temporal visual QA found prohibited readable text in chapter 2.',
            }]),
      ],
      chapters: PROMPTS.map((prompt, index) => {
        const job = completed.get(index);
        const source = sources.get(index);
        if (!job || !source) {
          const priorChapters = priorCosts.priorMissionManifest?.chapters;
          if (!Array.isArray(priorChapters) || !priorChapters[index]) {
            throw new Error(`Missing prior manifest chapter ${index + 1}.`);
          }
          return priorChapters[index];
        }
        return {
          id: `chapter-${index + 1}`,
          durationSeconds: DURATION_SECONDS,
          prompt,
          seed: SEED_BASE + index,
          jobId: job.id,
          generationId: job.generation_id ?? null,
          costUsd: job.usage?.cost ?? 0,
          sourceBytes: source.bytes,
          sourceSha256: source.sha256,
        };
      }),
      fallbacks,
    }, null, 2)}\n`,
    'utf8',
  );
  await rm(SOURCE_ROOT, { recursive: true, force: true });
  process.stdout.write(`Generated ${finalBytes.byteLength}B silent VP9 mission video; project cost $${(priorCosts.baseCostUsd + actualCostUsd).toFixed(2)}.\n`);
}

await main();
