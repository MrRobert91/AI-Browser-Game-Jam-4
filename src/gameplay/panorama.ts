import type { Locale } from '../contracts/localization';

export const MAX_LOCAL_PANORAMAS = 5;
export const MAX_LOCAL_PANORAMA_BYTES = 5 * 1024 * 1024;
export const PANORAMA_GAME_URL = 'rustyroboz.itch.io/the-last-observation';
export const PANORAMA_WORLD_CELLS = 64 * 64;
const PANORAMA_WORDMARK_PATH = '/assets/branding/title-wordmark.png';

const DATABASE_NAME = 'ultima-observacion-local-gallery';
const STORE_NAME = 'panoramas';

export interface PanoramaRecord {
  readonly id: string;
  readonly createdAt: number;
  readonly seedLabel: string;
  readonly profile: string;
  readonly haiku: readonly [string, string, string];
  readonly width: number;
  readonly height: number;
  readonly completionPercent: number;
  readonly collectedSeeds: number;
  readonly deaths: number;
  readonly png: Blob;
}

export interface PanoramaCardMetrics {
  readonly completionPercent: number;
  readonly collectedSeeds: number;
  readonly deaths: number;
}

export interface PanoramaResultSummary {
  readonly seedLabel: string;
  readonly profile: string;
  readonly haiku: { readonly lines: readonly [string, string, string] };
  readonly finalFixedCells: number;
  readonly livesRemaining: number;
  readonly collectedPacks?: readonly string[];
  readonly portrait: {
    readonly unlockedPacks: readonly string[];
    readonly deaths: number;
  };
}

export function panoramaCardMetrics(
  result: Pick<
    PanoramaResultSummary,
    'finalFixedCells' | 'livesRemaining' | 'collectedPacks' | 'portrait'
  >,
): PanoramaCardMetrics {
  const completionPercent =
    Math.round(
      (Math.max(0, Math.min(PANORAMA_WORLD_CELLS, result.finalFixedCells)) /
        PANORAMA_WORLD_CELLS) *
        1_000,
    ) / 10;
  return {
    completionPercent,
    collectedSeeds:
      result.collectedPacks?.length ?? result.portrait.unlockedPacks.length,
    deaths: Math.max(result.portrait.deaths, 3 - result.livesRemaining),
  };
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/u, '')}%`;
}

let wordmarkPromise: Promise<HTMLImageElement> | null = null;

function loadWordmark(): Promise<HTMLImageElement> {
  wordmarkPromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The title wordmark did not load.'));
    image.src = PANORAMA_WORDMARK_PATH;
  });
  return wordmarkPromise;
}

function drawTitleFallback(context: CanvasRenderingContext2D): void {
  context.save();
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.shadowColor = 'rgb(83 224 255 / 70%)';
  context.shadowBlur = 18;
  context.font = '900 32px "Arial Black", "Trebuchet MS", sans-serif';
  context.letterSpacing = '0.24em';
  context.fillStyle = '#dffaff';
  context.fillText('THE LAST', 72, 61);

  const titleGradient = context.createLinearGradient(72, 72, 930, 150);
  titleGradient.addColorStop(0, '#e9fbff');
  titleGradient.addColorStop(0.28, '#55ddff');
  titleGradient.addColorStop(0.54, '#fff0a8');
  titleGradient.addColorStop(0.78, '#b989ff');
  titleGradient.addColorStop(1, '#f2f8ff');
  context.font = '900 82px "Arial Black", "Trebuchet MS", sans-serif';
  context.letterSpacing = '-0.035em';
  context.lineWidth = 12;
  context.strokeStyle = 'rgb(3 12 24 / 92%)';
  context.strokeText('OBSERVATION', 68, 139, 980);
  context.lineWidth = 3;
  context.strokeStyle = '#d9f8ff';
  context.strokeText('OBSERVATION', 68, 139, 980);
  context.fillStyle = titleGradient;
  context.fillText('OBSERVATION', 68, 139, 980);
  context.restore();
}

function drawTitleWordmark(
  context: CanvasRenderingContext2D,
  wordmark: HTMLImageElement | null,
): void {
  if (wordmark === null) {
    drawTitleFallback(context);
    return;
  }
  context.save();
  context.shadowColor = 'rgb(83 224 255 / 55%)';
  context.shadowBlur = 20;
  context.drawImage(
    wordmark,
    0,
    wordmark.naturalHeight * 0.24,
    wordmark.naturalWidth,
    wordmark.naturalHeight * 0.54,
    54,
    10,
    630,
    193,
  );
  context.restore();
}

function drawMetric(
  context: CanvasRenderingContext2D,
  x: number,
  label: string,
  value: string,
): void {
  context.save();
  context.fillStyle = 'rgb(8 19 32 / 80%)';
  context.strokeStyle = 'rgb(105 233 255 / 55%)';
  context.lineWidth = 2;
  context.fillRect(x, 758, 360, 96);
  context.strokeRect(x, 758, 360, 96);
  context.fillStyle = '#91efff';
  context.font = '700 18px "Courier New", monospace';
  context.letterSpacing = '0.16em';
  context.fillText(label, x + 24, 789);
  context.fillStyle = '#fff8dc';
  context.font = '900 42px "Arial Black", "Trebuchet MS", sans-serif';
  context.letterSpacing = '0';
  context.fillText(value, x + 24, 837);
  context.restore();
}

export async function composePanoramaCard(
  worldCanvas: HTMLCanvasElement,
  result: PanoramaResultSummary,
  locale: Locale,
): Promise<HTMLCanvasElement> {
  const wordmark = await loadWordmark().catch(() => null);
  const card = document.createElement('canvas');
  card.width = 1600;
  card.height = 900;
  const context = card.getContext('2d');
  if (!context) throw new Error('The browser could not compose the panorama.');

  context.fillStyle = '#030a13';
  context.fillRect(0, 0, card.width, card.height);
  context.drawImage(worldCanvas, 0, 0, card.width, card.height);

  const vignette = context.createRadialGradient(800, 430, 220, 800, 430, 920);
  vignette.addColorStop(0, 'rgb(2 8 15 / 0%)');
  vignette.addColorStop(0.62, 'rgb(2 8 15 / 12%)');
  vignette.addColorStop(1, 'rgb(2 8 15 / 72%)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, card.width, card.height);

  const topShade = context.createLinearGradient(0, 0, 0, 205);
  topShade.addColorStop(0, 'rgb(2 7 17 / 95%)');
  topShade.addColorStop(0.72, 'rgb(2 7 17 / 66%)');
  topShade.addColorStop(1, 'rgb(2 7 17 / 0%)');
  context.fillStyle = topShade;
  context.fillRect(0, 0, card.width, 220);

  const bottomShade = context.createLinearGradient(0, 680, 0, 900);
  bottomShade.addColorStop(0, 'rgb(2 7 17 / 0%)');
  bottomShade.addColorStop(0.35, 'rgb(2 7 17 / 72%)');
  bottomShade.addColorStop(1, 'rgb(2 7 17 / 98%)');
  context.fillStyle = bottomShade;
  context.fillRect(0, 670, card.width, 230);

  context.fillStyle = '#56e2ff';
  context.fillRect(0, 0, 12, 900);
  context.fillStyle = '#aa6cff';
  context.fillRect(12, 0, 5, 900);
  context.fillStyle = '#ffcf69';
  context.fillRect(17, 0, 3, 900);
  drawTitleWordmark(context, wordmark);

  context.save();
  context.textAlign = 'right';
  context.fillStyle = '#9ceeff';
  context.font = '700 21px "Courier New", monospace';
  context.letterSpacing = '0.08em';
  context.fillText(PANORAMA_GAME_URL, 1528, 61);
  context.fillStyle = '#fff0b5';
  context.font = '700 18px "Courier New", monospace';
  context.fillText(`SEED ${result.seedLabel}`, 1528, 96);
  context.restore();

  const metrics = panoramaCardMetrics(result);
  const labels =
    locale === 'en'
      ? ['WORLD OBSERVED', 'SEEDS RECOVERED', 'DEATHS']
      : ['MUNDO OBSERVADO', 'SEMILLAS', 'MUERTES'];
  drawMetric(context, 72, labels[0]!, formatPercent(metrics.completionPercent));
  drawMetric(context, 456, labels[1]!, `${metrics.collectedSeeds}/4`);
  drawMetric(context, 840, labels[2]!, String(metrics.deaths));

  context.save();
  context.textAlign = 'right';
  context.fillStyle = '#f6b5ff';
  context.font = '700 18px "Courier New", monospace';
  context.letterSpacing = '0.09em';
  context.fillText(
    locale === 'en'
      ? 'YOUR ATTENTION MADE THIS REAL'
      : 'TU ATENCIÓN HIZO ESTO REAL',
    1528,
    810,
  );
  context.fillStyle = '#a9c8cf';
  context.font = '16px "Courier New", monospace';
  context.letterSpacing = '0.04em';
  context.fillText(
    locale === 'en'
      ? 'A LOCAL RECORD · NOTHING WAS UPLOADED'
      : 'EXPEDIENTE LOCAL · NO SE HA SUBIDO NADA',
    1528,
    840,
  );
  context.restore();

  card.dataset.panoramaCard = 'true';
  card.dataset.completionPercent = String(metrics.completionPercent);
  card.dataset.collectedSeeds = String(metrics.collectedSeeds);
  card.dataset.deaths = String(metrics.deaths);
  return card;
}

export async function capturePanoramaPng(
  canvas: HTMLCanvasElement,
  result: PanoramaResultSummary,
  now = Date.now(),
): Promise<PanoramaRecord> {
  await Promise.resolve();
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob?.type === 'image/png') resolve(blob);
      else reject(new Error('El navegador no pudo crear el panorama PNG.'));
    }, 'image/png');
  });
  return {
    id: `${result.seedLabel}-${now}`,
    createdAt: now,
    seedLabel: result.seedLabel,
    profile: result.profile,
    haiku: result.haiku.lines,
    width: canvas.width,
    height: canvas.height,
    ...panoramaCardMetrics(result),
    png,
  };
}

export function retainedPanoramaIds(
  records: readonly Pick<PanoramaRecord, 'id' | 'createdAt'>[],
): readonly string[] {
  return [...records]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_LOCAL_PANORAMAS)
    .map((record) => record.id);
}

export function downloadPanorama(record: PanoramaRecord): void {
  const url = URL.createObjectURL(record.png);
  const link = document.createElement('a');
  link.href = url;
  link.download = `la-ultima-observacion-${record.seedLabel.toLowerCase()}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class LocalPanoramaGallery {
  async save(record: PanoramaRecord): Promise<boolean> {
    if (record.png.size > MAX_LOCAL_PANORAMA_BYTES) return false;
    const database = await openDatabase();
    const existing = await getAll(database);
    const keep = new Set(retainedPanoramaIds([...existing, record]));
    await transactionDone(database, 'readwrite', (store) => {
      store.put(record);
      for (const item of existing) {
        if (!keep.has(item.id)) store.delete(item.id);
      }
    });
    return true;
  }

  async list(): Promise<readonly PanoramaRecord[]> {
    const records = await getAll(await openDatabase());
    return records.sort((left, right) => right.createdAt - left.createdAt);
  }

  async remove(id: string): Promise<void> {
    await transactionDone(await openDatabase(), 'readwrite', (store) => {
      store.delete(id);
    });
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('No se pudo abrir la galería local.'));
  });
}

function getAll(database: IDBDatabase): Promise<PanoramaRecord[]> {
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => resolve(request.result as PanoramaRecord[]);
    request.onerror = () =>
      reject(request.error ?? new Error('No se pudo leer la galería local.'));
  });
}

function transactionDone(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  mutate: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    mutate(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error('No se pudo actualizar la galería.'),
      );
    transaction.onabort = transaction.onerror;
  });
}
