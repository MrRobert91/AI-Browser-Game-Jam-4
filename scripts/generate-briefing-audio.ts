import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type {
  AudioAssetEntry,
  AudioAssetManifest,
  BriefingManifest,
  Locale,
} from '../src/contracts/localization';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = resolve(ROOT, 'public/assets/audio/briefing');
const AUDIO_MANIFEST_PATH = resolve(
  ROOT,
  'public/assets/audio/audio-manifest.json',
);
const PRODUCTION_MANIFEST_PATH = resolve(
  OUTPUT_ROOT,
  'production-manifest.json',
);
const TTS_ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';

const VOICES = {
  en: {
    model: 'microsoft/mai-voice-2',
    voice: 'en-US-Harper:MAI-Voice-2',
    format: 'mp3',
    provider: 'azure',
    style:
      'Firm, contained, mature institutional delivery with elegant dry wit; never imitate an existing character or performer.',
    input: (text: string) => text,
    speed: 0.98,
  },
  es: {
    model: 'google/gemini-3.1-flash-tts-preview',
    voice: 'Kore',
    format: 'pcm',
    provider: 'google',
    style:
      'Castellano peninsular, voz femenina madura, fría, institucional y precisa, con ritmo claro y ágil y sátira burocrática seca.',
    input: (text: string) =>
      `Habla en castellano de España, con voz femenina madura, precisa, institucional, fría y contenida. Mantén un ritmo claro y ágil. Usa sátira burocrática muy seca, sin caricatura y sin imitar personajes ni intérpretes existentes. Pronuncia exactamente este texto y nada más:\n\n${text}`,
    speed: undefined,
  },
} as const;

interface GenerationRecord {
  readonly id: string;
  readonly locale: Locale;
  readonly generationId: string | null;
  readonly durationSeconds: number;
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
      else
        reject(
          new Error(`${command} failed (${code}): ${stderr.slice(-1_500)}`),
        );
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
          'HTTP-Referer': 'https://github.com/MrRobert91/AI-Browser-Game-Jam-4',
          'X-Title': 'La Ultima Observacion briefing production',
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
      if (bytes.byteLength < 2_000)
        throw new Error('TTS response was too small.');
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
    if (attempt > 0)
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 750));
    const response = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) continue;
    const payload = (await response.json()) as {
      data?: { total_cost?: number };
    };
    if (typeof payload.data?.total_cost === 'number')
      return payload.data.total_cost;
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

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new Error(
      'OPENROUTER_API_KEY is required in the process environment.',
    );
  const briefing = JSON.parse(
    await readFile(resolve(ROOT, 'src/content/briefing.json'), 'utf8'),
  ) as BriefingManifest;
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const records: GenerationRecord[] = [];
  const finalAssets: AudioAssetEntry[] = [];

  for (const locale of ['en', 'es'] as const) {
    const localeDirectory = resolve(OUTPUT_ROOT, `segments-${locale}`);
    await mkdir(localeDirectory, { recursive: true });
    const chapterWavs: string[] = [];
    let localeCost = 0;
    for (const [index, chapter] of briefing.chapters[locale].entries()) {
      const voice = VOICES[locale];
      const rawPath = resolve(
        localeDirectory,
        `${String(index + 1).padStart(2, '0')}.raw.${voice.format}`,
      );
      const wavPath = resolve(
        localeDirectory,
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
          : Number(
              await run('ffprobe', [
                '-v',
                'error',
                '-show_entries',
                'format=duration',
                '-of',
                'default=noprint_wrappers=1:nokey=1',
                rawPath,
              ]),
            );
      const slotDuration = chapter.endSeconds - chapter.startSeconds;
      const speechWindow = slotDuration - 0.25;
      const tempo = Math.max(1, rawDuration / speechWindow);
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
        generationId: synthesized.generationId,
        durationSeconds: slotDuration,
        costUsd,
      });
      chapterWavs.push(wavPath);
      process.stdout.write(
        `${locale}/${chapter.id} ${rawDuration.toFixed(2)}s -> ${slotDuration}s $${costUsd.toFixed(6)}\n`,
      );
    }

    const concatList = resolve(localeDirectory, 'concat.txt');
    await writeFile(
      concatList,
      `${chapterWavs.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n')}\n`,
      'utf8',
    );
    const destination = resolve(OUTPUT_ROOT, `${locale}.mp3`);
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
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=7,atrim=duration=50',
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
    const durationSeconds = await mediaDuration(destination);
    if (Math.abs(durationSeconds - briefing.durationSeconds) > 0.08) {
      throw new Error(
        `${locale} briefing duration ${durationSeconds} is not 50 seconds.`,
      );
    }
    const bytes = await readFile(destination);
    const fullText = briefing.chapters[locale]
      .map((chapter) => chapter.caption)
      .join(' ');
    finalAssets.push({
      id: 'briefing',
      locale,
      path: `/assets/audio/briefing/${locale}.mp3`,
      kind: 'voice',
      provider: VOICES[locale].provider,
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
      loudnessLufs: -16,
      truePeakDbtp: -1.5,
      costUsd: localeCost,
    });
  }

  const audioManifest = JSON.parse(
    await readFile(AUDIO_MANIFEST_PATH, 'utf8'),
  ) as AudioAssetManifest;
  const retained = audioManifest.assets.filter(
    (asset) => asset.id !== 'briefing',
  );
  await writeFile(
    AUDIO_MANIFEST_PATH,
    `${JSON.stringify(
      {
        ...audioManifest,
        generatedAt: new Date().toISOString(),
        assets: [...retained, ...finalAssets],
        totalCostUsd:
          retained.reduce((total, asset) => total + asset.costUsd, 0) +
          finalAssets.reduce((total, asset) => total + asset.costUsd, 0),
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
        totalCostUsd: records.reduce(
          (total, record) => total + record.costUsd,
          0,
        ),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await Promise.all(
    (['en', 'es'] as const).map((locale) =>
      rm(resolve(OUTPUT_ROOT, `segments-${locale}`), {
        recursive: true,
        force: true,
      }),
    ),
  );
  process.stdout.write(`Generated two 50-second briefing tracks.\n`);
}

await main();
