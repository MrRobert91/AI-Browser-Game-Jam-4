import {
  describeAgentUpdate,
  formatRunResult,
  type RunResult,
} from '../gameplay/ending';
import {
  downloadPanorama,
  type LocalPanoramaGallery,
  type PanoramaRecord,
} from '../gameplay/panorama';

const LAST_RESULT_KEY = 'ultima-observacion:last-result';
const BEST_PORTRAIT_KEY = 'ultima-observacion:best-portrait';

function portraitBreadth(result: RunResult): number {
  return (
    result.portrait.fixedCells +
    result.portrait.uniqueTerrainTiles * 4 +
    result.portrait.uniqueFeatureTiles * 3 +
    result.portrait.unlockedPacks.length * 12
  );
}

export function persistRunResult(result: RunResult): void {
  localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(result));
  const previous = localStorage.getItem(BEST_PORTRAIT_KEY);
  let shouldReplace = true;
  if (previous) {
    try {
      const parsed = JSON.parse(previous) as RunResult;
      shouldReplace = portraitBreadth(result) > portraitBreadth(parsed);
    } catch {
      shouldReplace = true;
    }
  }
  if (shouldReplace) {
    localStorage.setItem(BEST_PORTRAIT_KEY, JSON.stringify(result));
  }
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

export class ResultsPanel {
  constructor(
    private readonly root: HTMLElement,
    private readonly onRestart: () => void,
    private readonly panorama?: {
      readonly capture: (result: RunResult) => Promise<PanoramaRecord>;
      readonly gallery: LocalPanoramaGallery;
    },
  ) {}

  show(result: RunResult): void {
    persistRunResult(result);
    this.root.replaceChildren();
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'EXPEDIENTE DE ACTUALIZACIÓN DEL AGENTE';
    const title = document.createElement('h2');
    title.id = 'agent-update-title';
    title.textContent =
      'Creías que La Medida estaba registrando el mundo. Estaba registrando qué clase de mundo eras capaz de hacer real.';
    const closure = document.createElement('p');
    closure.className = 'slice-result__closure';
    closure.textContent = `${result.closure} · ${result.reading}`;
    const profile = document.createElement('p');
    profile.textContent = `Perfil: ${result.profile}`;
    const interpretation = document.createElement('p');
    interpretation.className = 'slice-result__interpretation';
    interpretation.textContent = describeAgentUpdate(result);
    const metrics = document.createElement('dl');
    metrics.className = 'slice-result__metrics';
    const metricEntries = [
      ['RESULTADOS', String(result.portrait.fixedCells)],
      [
        'FORMAS',
        String(
          result.portrait.uniqueTerrainTiles +
            result.portrait.uniqueFeatureTiles,
        ),
      ],
      ['INTERVENCIONES', String(result.portrait.unlockedPacks.length)],
      ['DISTANCIA', `${result.portrait.maxDistance.toFixed(1)} m`],
    ] as const;
    for (const [label, value] of metricEntries) {
      const group = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      group.append(term, detail);
      metrics.append(group);
    }
    const poem = document.createElement('blockquote');
    poem.textContent = result.haiku.lines.join('\n');
    const seed = document.createElement('strong');
    seed.textContent = `SEED ${result.seedLabel}`;
    const note = document.createElement('p');
    note.className = 'slice-result__agency-note';
    note.textContent =
      'AGENCIA // Expediente cerrado sin reconocimiento de causalidad cosmológica ni derecho automático a reembolso corporal.';
    const actions = document.createElement('div');
    actions.className = 'slice-result__actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copiar registro';
    copy.addEventListener('click', () => {
      void copyText(formatRunResult(result)).then(() => {
        copy.textContent = 'Registro copiado';
      });
    });
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.textContent = 'Nueva observación';
    restart.addEventListener('click', this.onRestart);
    actions.append(copy);
    const galleryRegion = document.createElement('section');
    galleryRegion.className = 'slice-result__gallery';
    galleryRegion.hidden = true;
    galleryRegion.setAttribute('aria-live', 'polite');
    if (this.panorama) {
      const download = document.createElement('button');
      download.type = 'button';
      download.disabled = true;
      download.dataset.panoramaDownload = 'true';
      download.textContent = 'Preparando panorama…';
      const gallery = document.createElement('button');
      gallery.type = 'button';
      gallery.dataset.panoramaGallery = 'true';
      gallery.textContent = 'Galería local';
      gallery.addEventListener('click', () => {
        galleryRegion.hidden = !galleryRegion.hidden;
        if (!galleryRegion.hidden) void this.#renderGallery(galleryRegion);
      });
      actions.append(download, gallery);
      void this.panorama
        .capture(result)
        .then(async (record) => {
          download.disabled = false;
          download.textContent = 'Descargar panorama PNG';
          download.addEventListener('click', () => downloadPanorama(record));
          const persisted = await this.panorama!.gallery.save(record).catch(
            () => false,
          );
          download.dataset.gallerySaved = String(persisted);
          if (!galleryRegion.hidden) await this.#renderGallery(galleryRegion);
        })
        .catch(() => {
          download.textContent = 'Panorama no disponible';
          download.dataset.panoramaError = 'true';
        });
    }
    actions.append(restart);
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', title.id);
    this.root.tabIndex = -1;
    this.root.append(
      eyebrow,
      title,
      closure,
      profile,
      interpretation,
      metrics,
      poem,
      seed,
      note,
      actions,
      galleryRegion,
    );
    this.root.hidden = false;
    this.root.focus();
  }

  async #renderGallery(region: HTMLElement): Promise<void> {
    if (!this.panorama) return;
    const records = await this.panorama.gallery.list();
    const title = document.createElement('h3');
    title.textContent = `Galería local · ${records.length}/5`;
    const note = document.createElement('p');
    note.textContent =
      'Solo en este navegador. Cada entrada conserva PNG, seed, perfil y haiku.';
    const list = document.createElement('ol');
    for (const record of records) {
      const item = document.createElement('li');
      const summary = document.createElement('span');
      summary.textContent = `${record.seedLabel} · ${record.profile} · ${record.haiku.join(' / ')}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.textContent = 'Descargar';
      download.addEventListener('click', () => downloadPanorama(record));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Borrar';
      remove.addEventListener('click', () => {
        void this.panorama!.gallery.remove(record.id).then(() =>
          this.#renderGallery(region),
        );
      });
      item.append(summary, download, remove);
      list.append(item);
    }
    region.replaceChildren(title, note, list);
  }
}
