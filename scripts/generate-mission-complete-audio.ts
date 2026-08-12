import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  AudioAssetEntry,
  AudioAssetManifest,
  Locale,
} from '../src/contracts/localization';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = resolve(ROOT, 'public/assets/mission-complete');
const AUDIO_MANIFEST_PATH = resolve(
  ROOT,
  'public/assets/audio/audio-manifest.json',
);
const PRODUCTION_MANIFEST_PATH = resolve(
  OUTPUT_ROOT,
  'audio-production-manifest.json',
);
const PLAYBACK_MANIFEST_PATH = resolve(OUTPUT_ROOT, 'manifest.json');
const CONTENT_PATH = resolve(ROOT, 'src/content/mission-complete.json');
const VIDEO_MANIFEST_PATH = resolve(
  OUTPUT_ROOT,
  'video-production-manifest.json',
);
const TTS_ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';
const FAILED_PRODUCTION_COST_USD = 0.004004;

const VOICES = {
  en: {
    model: 'microsoft/mai-voice-2',
    voice: 'en-US-Harper:MAI-Voice-2',
    format: 'mp3',
    provider: 'azure',
    style:
      'Mature female institutional voice, cold, precise and contained, with dry bureaucratic satire; never imitate an existing character or performer.',
    input: (text: string) => text,
    speed: 1,
  },
  es: {
    model: 'google/gemini-3.1-flash-tts-preview',
    voice: 'Kore',
    format: 'pcm',
    provider: 'google',
    style:
      'Castellano peninsular, voz femenina madura, fría, precisa, institucional y contenida, con sátira burocrática seca.',
    input: (text: string) =>
      `Habla en castellano de España con voz femenina madura, fría, precisa, institucional y contenida. Mantén un ritmo claro y ágil, con sátira burocrática seca, sin imitar personajes ni intérpretes existentes. Pronuncia exactamente este texto y nada más:\n\n${text}`,
    speed: undefined,
  },
} as const;

interface MissionChapter {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly caption: string;
}

interface MissionManifest {
  readonly version: 1;
  readonly durationSeconds: number;
  readonly skipAfterSeconds: number;
  readonly videoPath: string;
  readonly audioPaths: Readonly<Record<Locale, string>>;
  readonly fallbacks: readonly string[];
  readonly chapters: Readonly<Record<Locale, readonly MissionChapter[]>>;
}

interface GenerationRecord {
  readonly id: string;
  readonly locale: Locale;
  readonly text: string;
  readonly textSha256: string;
  readonly generationId: string | null;
  readonly rawDurationSeconds: number;
  readonly finalDurationSeconds: number;
  readonly costUsd: number;
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
      else {
        reject(
          new Error(`${command} failed (${code}): ${stderr.slice(-1_500)}`),
        );
      }
    });
  });
}

async function synthesize(
  apiKey: string,
  locale: Locale,
  text: string,
): Promise<{ bytes: Uint8Array; generationId: string | null }> {
  const voice = VOICES[locale];
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            'https://github.com/MrRobert91/AI-Browser-Game-Jam-4',
          'X-Title': 'La Ultima Observacion mission complete voice production',
        },
        body: JSON.stringify({
          model: voice.model,
          input: voice.input(text),
          voice: voice.voice,
          response_format: voice.format,
          ...(voice.speed === undefined ? {} : { speed: voice.speed }),
        }),
      });
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 2_000) {
        throw new Error('TTS response was too small.');
      }
      return { bytes, generationId: response.headers.get('x-generation-id') };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolveDelay) =>
          setTimeout(resolveDelay, 1_500 * attempt),
        );
      }
    }
  }
  throw lastError;
}

async function generationCost(
  apiKey: string,
  generationId: string | null,
): Promise<number> {
  if (!generationId) return 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
    }
    const response = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) continue;
    const payload = (await response.json()) as {
      data?: { total_cost?: number };
    };
    if (typeof payload.data?.total_cost === 'number') {
      return payload.data.total_cost;
    }
  }
  return 0;
}

async function mediaDuration(path: string): Promise<number> {
  return Number(
    await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]),
  );
}

async function measureLoudness(
  path: string,
): Promise<{ loudnessLufs: number; truePeakDbtp: number }> {
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
      { cwd: ROOT, windowsHide: true },
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
        loudnessLufs: Number(values.input_i),
        truePeakDbtp: Number(values.input_tp),
      });
    });
  });
}

async function analyzeLoudness(path: string): Promise<{
  readonly inputI: number;
  readonly inputTp: number;
  readonly inputLra: number;
  readonly inputThresh: number;
  readonly targetOffset: number;
}> {
  return await new Promise((accept, reject) => {
    const child = spawn(
      'ffmpeg',
      [
        '-hide_banner',
        '-nostats',
        '-i',
        path,
        '-af',
        'loudnorm=I=-16:TP=-3:LRA=7:print_format=json',
        '-f',
        'null',
        'NUL',
      ],
      { cwd: ROOT, windowsHide: true },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg failed for ${path}`));
      const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/u);
      if (!match) return reject(new Error(`No loudness data for ${path}`));
      const values = JSON.parse(match[0]) as Record<string, string>;
      accept({
        inputI: Number(values.input_i),
        inputTp: Number(values.input_tp),
        inputLra: Number(values.input_lra),
        inputThresh: Number(values.input_thresh),
        targetOffset: Number(values.target_offset),
      });
    });
  });
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required.');
  const mission = JSON.parse(
    await readFile(CONTENT_PATH, 'utf8'),
  ) as MissionManifest;
  const videoManifest = JSON.parse(
    await readFile(VIDEO_MANIFEST_PATH, 'utf8'),
  ) as { projectCumulativeCostUsd: number };
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const records: GenerationRecord[] = [];
  const finalAssets: AudioAssetEntry[] = [];

  for (const locale of ['en', 'es'] as const) {
    const workDirectory = resolve(OUTPUT_ROOT, `audio-source-${locale}`);
    await mkdir(workDirectory, { recursive: true });
    const chapterWavs: string[] = [];
    let localeCost = 0;
    for (const [index, chapter] of mission.chapters[locale].entries()) {
      const voice = VOICES[locale];
      const rawPath = resolve(
        workDirectory,
        `${String(index + 1).padStart(2, '0')}.raw.${voice.format}`,
      );
      const wavPath = resolve(
        workDirectory,
        `${String(index + 1).padStart(2, '0')}.wav`,
      );
      const synthesized = await synthesize(apiKey, locale, chapter.caption);
      await writeFile(rawPath, synthesized.bytes);
      const rawInput =
        voice.format === 'pcm'
          ? ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', rawPath]
          : ['-i', rawPath];
      const rawDuration =
        voice.format === 'pcm'
          ? synthesized.bytes.byteLength / (24_000 * 2)
          : await mediaDuration(rawPath);
      const slotDuration = chapter.endSeconds - chapter.startSeconds;
      const tempo = Math.max(1, rawDuration / (slotDuration - 0.25));
      if (tempo > 2) {
        throw new Error(
          `${locale}/${chapter.id} requires unsupported tempo ${tempo.toFixed(2)}.`,
        );
      }
      await run('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        ...rawInput,
        '-af',
        `atempo=${tempo.toFixed(6)},apad,atrim=duration=${slotDuration},loudnorm=I=-16:TP=-1.5:LRA=7`,
        '-ac',
        '1',
        '-ar',
        '44100',
        '-c:a',
        'pcm_s16le',
        wavPath,
      ]);
      await rm(rawPath, { force: true });
      const costUsd = await generationCost(apiKey, synthesized.generationId);
      localeCost += costUsd;
      records.push({
        id: chapter.id,
        locale,
        text: chapter.caption,
        textSha256: createHash('sha256')
          .update(chapter.caption)
          .digest('hex'),
        generationId: synthesized.generationId,
        rawDurationSeconds: rawDuration,
        finalDurationSeconds: slotDuration,
        costUsd,
      });
      chapterWavs.push(wavPath);
      process.stdout.write(
        `${locale}/${chapter.id} ${rawDuration.toFixed(2)}s -> ${slotDuration}s $${costUsd.toFixed(6)}\n`,
      );
    }

    const concatPath = resolve(workDirectory, 'concat.txt');
    await writeFile(
      concatPath,
      `${chapterWavs.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
      'utf8',
    );
    const destination = resolve(
      OUTPUT_ROOT,
      `agency-mission-complete.${locale}.mp3`,
    );
    const combinedWav = resolve(workDirectory, 'combined.wav');
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
      concatPath,
      '-af',
      'atrim=duration=32',
      '-ac',
      '1',
      '-ar',
      '44100',
      '-c:a',
      'pcm_s16le',
      combinedWav,
    ]);
    const analysis = await analyzeLoudness(combinedWav);
    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      combinedWav,
      '-af',
      `loudnorm=I=-16:TP=-3:LRA=7:measured_I=${analysis.inputI}:measured_TP=${analysis.inputTp}:measured_LRA=${analysis.inputLra}:measured_thresh=${analysis.inputThresh}:offset=${analysis.targetOffset}:linear=true,atrim=duration=32`,
      '-ac',
      '1',
      '-ar',
      '44100',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '64k',
      destination,
    ]);
    const firstMeasurement = await measureLoudness(destination);
    const correctionDb = -16 - firstMeasurement.loudnessLufs;
    if (Math.abs(correctionDb) > 0.15) {
      await run('ffmpeg', [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        combinedWav,
        '-af',
        `loudnorm=I=-16:TP=-3:LRA=7:measured_I=${analysis.inputI}:measured_TP=${analysis.inputTp}:measured_LRA=${analysis.inputLra}:measured_thresh=${analysis.inputThresh}:offset=${analysis.targetOffset}:linear=true,volume=${correctionDb.toFixed(3)}dB,atrim=duration=32`,
        '-ac',
        '1',
        '-ar',
        '44100',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        destination,
      ]);
    }
    const durationSeconds = await mediaDuration(destination);
    if (Math.abs(durationSeconds - mission.durationSeconds) > 0.08) {
      throw new Error(`${locale} duration ${durationSeconds} is not 32 seconds.`);
    }
    const loudness = await measureLoudness(destination);
    if (
      Math.abs(loudness.loudnessLufs - -16) > 0.4 ||
      loudness.truePeakDbtp > -1.5
    ) {
      throw new Error(
        `${locale} loudness ${loudness.loudnessLufs} LUFS / ${loudness.truePeakDbtp} dBTP is invalid.`,
      );
    }
    const bytes = await readFile(destination);
    const fullText = mission.chapters[locale]
      .map((chapter) => chapter.caption)
      .join(' ');
    finalAssets.push({
      id: 'missionComplete',
      locale,
      path: mission.audioPaths[locale],
      kind: 'voice',
      provider: voiceProvider(locale),
      model: VOICES[locale].model,
      voice: VOICES[locale].voice,
      style: VOICES[locale].style,
      generationId: null,
      generatedAt: new Date().toISOString(),
      text: fullText,
      textSha256: createHash('sha256').update(fullText).digest('hex'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      durationSeconds,
      bytes: bytes.byteLength,
      loudnessLufs: loudness.loudnessLufs,
      truePeakDbtp: loudness.truePeakDbtp,
      costUsd: localeCost,
    });
    await rm(workDirectory, { recursive: true, force: true });
  }

  const audioManifest = JSON.parse(
    await readFile(AUDIO_MANIFEST_PATH, 'utf8'),
  ) as AudioAssetManifest;
  const retained = audioManifest.assets.filter(
    (asset) => asset.id !== 'missionComplete',
  );
  const audioRunCostUsd = finalAssets.reduce(
    (total, asset) => total + asset.costUsd,
    0,
  );
  const projectCumulativeCostUsd =
    videoManifest.projectCumulativeCostUsd +
    FAILED_PRODUCTION_COST_USD +
    audioRunCostUsd;
  if (projectCumulativeCostUsd > 5) {
    throw new Error(
      `Project generation cost $${projectCumulativeCostUsd.toFixed(2)} exceeds $5.`,
    );
  }
  await writeFile(
    AUDIO_MANIFEST_PATH,
    `${JSON.stringify(
      {
        ...audioManifest,
        generatedAt: new Date().toISOString(),
        assets: [...retained, ...finalAssets],
        totalCostUsd:
          retained.reduce((total, asset) => total + asset.costUsd, 0) +
          audioRunCostUsd,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    PRODUCTION_MANIFEST_PATH,
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        records,
        finalAssets,
        audioRunCostUsd,
        failedProductionCostUsd: FAILED_PRODUCTION_COST_USD,
        failedProductionReason:
          'Two English assemblies were rejected before Spanish generation: -17.25 LUFS / -1.42 dBTP, then -16.82 LUFS / -1.94 dBTP. The first cost $0.004004; the second reported no additional cost.',
        projectCumulativeCostUsd,
        transformations:
          'Per-chapter tempo fit without word truncation; 8-second PCM slots; concat; two-pass EBU R128 loudness normalization to -16 LUFS with -2 dBTP processing ceiling; mono MP3 64 kbps.',
        provenance:
          'Generated once through OpenRouter for local offline distribution; raw responses removed after validation.',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    PLAYBACK_MANIFEST_PATH,
    `${JSON.stringify(
      {
        ...mission,
        generatedAt: new Date().toISOString(),
        finalAssets,
        projectCumulativeCostUsd,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  process.stdout.write(
    `Generated two 32-second mission tracks; project cost $${projectCumulativeCostUsd.toFixed(2)}.\n`,
  );
}

function voiceProvider(locale: Locale): string {
  return VOICES[locale].provider;
}

await main();
