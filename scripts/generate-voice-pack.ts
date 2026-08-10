import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

import type {
  AudioAssetEntry,
  AudioAssetManifest,
} from '../src/contracts/localization';

interface CatalogEntry {
  readonly id: string;
  readonly en: string;
  readonly es: string;
  readonly category: string;
}

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = resolve(ROOT, 'public/assets/audio/voice');
const MANIFEST_PATH = resolve(ROOT, 'public/assets/audio/audio-manifest.json');
const ENDPOINT = 'https://openrouter.ai/api/v1/audio/speech';
const CONFIG = {
  en: {
    locale: 'en' as const,
    model: 'microsoft/mai-voice-2',
    voice: 'en-US-Harper:MAI-Voice-2',
    style: 'Firm, contained, mature institutional delivery with elegant dry wit; never imitate an existing character or performer.',
    responseFormat: 'mp3' as const,
    input: (text: string) => text,
    provider: undefined,
    speed: 0.94,
  },
  es: {
    locale: 'es' as const,
    model: 'google/gemini-3.1-flash-tts-preview',
    voice: 'Kore',
    style: 'Castellano peninsular neutral, voz femenina madura, precisión institucional, fría y contenida, con sátira burocrática muy seca; sin imitar personajes o intérpretes existentes.',
    responseFormat: 'pcm' as const,
    input: (text: string) =>
      `Habla en castellano de España, con voz femenina madura, precisa, institucional, fría y contenida. Introduce una sátira burocrática muy seca sin caricatura y sin imitar a ningún personaje o intérprete existente. Pronuncia exactamente este texto y nada más:\n\n${text}`,
    provider: undefined,
    speed: undefined,
  },
};

function argument(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
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
      else reject(new Error(`${command} failed (${code}): ${stderr.slice(-1200)}`));
    });
  });
}

async function synthesize(
  apiKey: string,
  locale: 'en' | 'es',
  entry: CatalogEntry,
): Promise<{ bytes: Uint8Array; generationId: string | null }> {
  const config = CONFIG[locale];
  const body = {
    model: config.model,
    input: config.input(entry[locale]),
    voice: config.voice,
    response_format: config.responseFormat,
    ...(config.speed === undefined ? {} : { speed: config.speed }),
    ...(config.provider === undefined ? {} : { provider: config.provider }),
  };
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/MrRobert91/AI-Browser-Game-Jam-4',
          'X-Title': 'La Ultima Observacion asset production',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
      }
      const contentType = response.headers.get('content-type') ?? '';
      const expectedType = config.responseFormat === 'mp3' ? 'audio/mpeg' : 'audio/pcm';
      if (!contentType.includes(expectedType)) {
        throw new Error(`Unexpected content type ${contentType}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 2_000) throw new Error('TTS response was too small');
      return {
        bytes,
        generationId: response.headers.get('x-generation-id'),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_500));
    }
  }
  throw lastError;
}

async function generationCost(apiKey: string, generationId: string | null): Promise<number> {
  if (!generationId) return 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      if (attempt > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
      const response = await fetch(
        `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!response.ok) continue;
      const payload = (await response.json()) as { data?: { total_cost?: number } };
      if (typeof payload.data?.total_cost === 'number') return payload.data.total_cost;
    } catch {
      // Generation accounting is eventually consistent; retry briefly.
    }
  }
  return 0;
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required in the process environment.');
  const requested = argument('--locale') ?? 'all';
  if (!['all', 'en', 'es'].includes(requested)) throw new Error('--locale must be all, en, or es');
  const limit = Number(argument('--limit') ?? Number.POSITIVE_INFINITY);
  const force = process.argv.includes('--force');
  const catalog = JSON.parse(
    await readFile(resolve(ROOT, 'src/content/narrative.catalog.json'), 'utf8'),
  ) as CatalogEntry[];
  if (catalog.length !== 44) throw new Error(`Expected 44 narrative cues, found ${catalog.length}.`);
  const locales = (requested === 'all' ? ['en', 'es'] : [requested]) as ('en' | 'es')[];
  const assets: AudioAssetEntry[] = [];
  let totalCostUsd = 0;
  for (const locale of locales) {
    const config = CONFIG[locale];
    const directory = resolve(OUTPUT_ROOT, locale);
    await mkdir(directory, { recursive: true });
    for (const entry of catalog.slice(0, limit)) {
      const destination = resolve(directory, `${entry.id}.mp3`);
      const raw = resolve(
        directory,
        `${entry.id}.raw.${config.responseFormat === 'mp3' ? 'mp3' : 'pcm'}`,
      );
      let generationId: string | null = null;
      if (force) await rm(destination, { force: true });
      try {
        await readFile(destination);
      } catch {
        const synthesized = await synthesize(apiKey, locale, entry);
        generationId = synthesized.generationId;
        await writeFile(raw, synthesized.bytes);
        const inputArguments =
          config.responseFormat === 'pcm'
            ? ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', raw]
            : ['-i', raw];
        await run('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y', ...inputArguments,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=7', '-ac', '1', '-ar', '44100',
          '-codec:a', 'libmp3lame', '-b:a', '64k', destination,
        ]);
        await rm(raw, { force: true });
      }
      const bytes = await readFile(destination);
      const duration = Number(
        await run('ffprobe', [
          '-v', 'error', '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1', destination,
        ]),
      );
      if (!Number.isFinite(duration) || duration < 1 || duration > 18) {
        throw new Error(`${locale}/${entry.id} duration ${duration} is outside 1-18 s.`);
      }
      const costUsd = await generationCost(apiKey, generationId);
      totalCostUsd += costUsd;
      assets.push({
        id: entry.id,
        kind: 'voice',
        locale,
        path: `/assets/audio/voice/${locale}/${entry.id}.mp3`,
        text: entry[locale],
        textSha256: createHash('sha256').update(entry[locale]).digest('hex'),
        provider: locale === 'en' ? 'azure' : 'google',
        model: config.model,
        voice: config.voice,
        style: config.style,
        generationId,
        generatedAt: new Date().toISOString(),
        durationSeconds: duration,
        bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        loudnessLufs: -16,
        truePeakDbtp: -1.5,
        costUsd,
      });
      process.stdout.write(`${locale}/${entry.id} ${duration.toFixed(2)}s ${bytes.byteLength}B\n`);
    }
  }
  await mkdir(resolve(ROOT, 'public/assets/audio'), { recursive: true });
  const manifest: AudioAssetManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    assets,
    totalCostUsd,
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`Generated ${assets.length} assets; reported cost $${totalCostUsd.toFixed(4)}\n`);
}

await main();
