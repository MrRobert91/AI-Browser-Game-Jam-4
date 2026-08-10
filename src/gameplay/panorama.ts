export const MAX_LOCAL_PANORAMAS = 5;
export const MAX_LOCAL_PANORAMA_BYTES = 5 * 1024 * 1024;

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
  readonly png: Blob;
}

export async function capturePanoramaPng(
  canvas: HTMLCanvasElement,
  result: {
    readonly seedLabel: string;
    readonly profile: string;
    readonly haiku: { readonly lines: readonly [string, string, string] };
  },
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
