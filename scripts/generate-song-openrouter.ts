import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LYRICS_PATH = resolve('docs/audio/la-funcion-que-nos-mira.md');
const OUTPUT_BASENAME = resolve('public/assets/audio/la-funcion-que-nos-mira');

interface AudioDelta {
  readonly data?: string;
  readonly transcript?: string;
}

interface StreamChunk {
  readonly id?: string;
  readonly model?: string;
  readonly choices?: readonly {
    readonly delta?: {
      readonly audio?: AudioDelta;
    };
  }[];
}

function parseEventLine(
  line: string,
  audioChunks: string[],
  transcripts: string[],
): { generationId: string | undefined; model: string | undefined } {
  if (!line.startsWith('data: ')) {
    return { generationId: undefined, model: undefined };
  }
  const data = line.slice(6).trim();
  if (data.length === 0 || data === '[DONE]') {
    return { generationId: undefined, model: undefined };
  }
  const chunk = JSON.parse(data) as StreamChunk;
  const audio = chunk.choices?.[0]?.delta?.audio;
  if (audio?.data) audioChunks.push(audio.data);
  if (audio?.transcript) transcripts.push(audio.transcript);
  return { generationId: chunk.id, model: chunk.model };
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not available.');

  const lyricsDocument = await readFile(LYRICS_PATH, 'utf8');
  const lyrics = lyricsDocument.split('## Letra\n\n')[1]?.trim();
  if (!lyrics) throw new Error('The generated lyrics section is empty.');

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'La Ultima Observacion Song Production',
    },
    body: JSON.stringify({
      model: 'google/lyria-3-pro-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Create a complete original Spanish song titled "La función que nos mira".',
                'Duration: 2 to 3 minutes. Style: ethereal ambient electronica, cinematic but intimate, clear and warm lead vocal, subtle granular textures, soft organic percussion, restrained bass, spacious harmonies.',
                'The chorus must be memorable and calm enough to loop during gameplay. Avoid piercing beeps, sustained sine-wave whines, harsh high frequencies, jump-scare dynamics, artist imitation, and references to existing songs.',
                'Use the supplied lyrics exactly, preserving Spanish pronunciation and section order.',
                'Build a short instrumental atmospheric intro and a gentle resolving outro whose ambience can crossfade back to the intro.',
                'Mix for background gameplay: vocals intelligible but not overpowering, moderate dynamic range, no clipping.',
                '',
                'LYRICS:',
                lyrics,
              ].join('\n'),
            },
          ],
        },
      ],
      modalities: ['text', 'audio'],
      audio: { format: 'wav' },
      stream: true,
      seed: -1590705472,
      temperature: 0.85,
    }),
  });

  if (!response.ok || !response.body) {
    const errorPayload = (await response.json().catch(() => null)) as {
      readonly error?: {
        readonly message?: string;
        readonly metadata?: unknown;
      };
    } | null;
    const message =
      errorPayload?.error?.message ?? 'No error message returned.';
    const metadata = JSON.stringify(errorPayload?.error?.metadata ?? null)
      .replaceAll(apiKey, '[redacted]')
      .replace(/sk-or-v1-[A-Za-z0-9_-]+/gu, '[redacted]');
    throw new Error(
      `OpenRouter music request failed with HTTP ${response.status}: ${message}; metadata=${metadata}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const audioChunks: string[] = [];
  const transcripts: string[] = [];
  let buffered = '';
  let generationId: string | undefined;
  let responseModel: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    const lines = buffered.split(/\r?\n/u);
    buffered = done ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      const metadata = parseEventLine(line, audioChunks, transcripts);
      generationId = metadata.generationId ?? generationId;
      responseModel = metadata.model ?? responseModel;
    }
    if (done) break;
  }

  if (buffered) {
    const metadata = parseEventLine(buffered, audioChunks, transcripts);
    generationId = metadata.generationId ?? generationId;
    responseModel = metadata.model ?? responseModel;
  }
  if (audioChunks.length === 0) {
    throw new Error('OpenRouter returned no audio chunks.');
  }

  const audio = Buffer.concat(
    audioChunks.map((chunk) => Buffer.from(chunk, 'base64')),
  );
  await mkdir(dirname(OUTPUT_BASENAME), { recursive: true });
  const header = audio.subarray(0, 4).toString('ascii');
  const extension =
    audio.length >= 44 && header === 'RIFF'
      ? '.wav'
      : header.startsWith('ID3') ||
          (audio[0] === 0xff && ((audio[1] ?? 0) & 0xe0) === 0xe0)
        ? '.mp3'
        : header === 'OggS'
          ? '.ogg'
          : '.raw';
  const outputPath = `${OUTPUT_BASENAME}${extension}`;
  await writeFile(outputPath, audio);

  process.stdout.write(
    JSON.stringify({
      generated: true,
      model: responseModel ?? 'google/lyria-3-pro-preview',
      generationId: generationId ?? null,
      bytes: audio.length,
      chunks: audioChunks.length,
      headerHex: audio.subarray(0, 12).toString('hex'),
      transcriptCharacters: transcripts.join('').length,
      output: outputPath,
    }),
  );
}

await main();
