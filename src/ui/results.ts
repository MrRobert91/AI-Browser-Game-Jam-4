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
import { requestRemoteHaikuWithFallback } from '../gameplay/remote-haiku';
import type { Locale } from '../contracts/localization';
import { uiCopy } from '../i18n';

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
    private readonly remoteHaikuEndpoint: string | null = null,
    private readonly locale: Locale = 'es',
  ) {}

  show(result: RunResult): void {
    persistRunResult(result);
    const copy = uiCopy(this.locale);
    this.root.replaceChildren();
    const eyebrow = document.createElement('p');
    eyebrow.textContent = copy.resultEyebrow;
    const title = document.createElement('h2');
    title.id = 'agent-update-title';
    title.textContent = copy.resultTitle;
    const closure = document.createElement('p');
    closure.className = 'slice-result__closure';
    closure.textContent = `${copy.closures[result.closure] ?? result.closure} · ${copy.readings[result.reading] ?? result.reading}`;
    const profile = document.createElement('p');
    profile.textContent = `${copy.profile}: ${copy.profileLabels[result.profile] ?? result.profile}`;
    const interpretation = document.createElement('p');
    interpretation.className = 'slice-result__interpretation';
    interpretation.textContent = describeAgentUpdate(result, this.locale);
    const metrics = document.createElement('dl');
    metrics.className = 'slice-result__metrics';
    const metricEntries = [
      [copy.resultMetrics[0], String(result.portrait.fixedCells)],
      [
        copy.resultMetrics[1],
        String(
          result.portrait.uniqueTerrainTiles +
            result.portrait.uniqueFeatureTiles,
        ),
      ],
      [copy.resultMetrics[2], String(result.portrait.unlockedPacks.length)],
      [copy.resultMetrics[3], `${result.portrait.maxDistance.toFixed(1)} m`],
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
    const remote = this.#createRemoteHaikuControls(result);
    const seed = document.createElement('strong');
    seed.textContent =
      result.seedMode === 'daily' && result.dailyDateKey
        ? `${copy.dailySeed} ${result.dailyDateKey} · SEED ${result.seedLabel}`
        : `SEED ${result.seedLabel}`;
    const note = document.createElement('p');
    note.className = 'slice-result__agency-note';
    note.textContent = copy.agencyNote;
    const actions = document.createElement('div');
    actions.className = 'slice-result__actions';
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.textContent = copy.copyRecord;
    copyButton.addEventListener('click', () => {
      void copyText(formatRunResult(result, this.locale)).then(() => {
        copyButton.textContent = copy.copied;
      });
    });
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.textContent = uiCopy(this.locale).newObservation;
    restart.addEventListener('click', this.onRestart);
    actions.append(copyButton);
    const galleryRegion = document.createElement('section');
    galleryRegion.className = 'slice-result__gallery';
    galleryRegion.hidden = true;
    galleryRegion.setAttribute('aria-live', 'polite');
    if (this.panorama) {
      const download = document.createElement('button');
      download.type = 'button';
      download.disabled = true;
      download.dataset.panoramaDownload = 'true';
      download.textContent = uiCopy(this.locale).preparingPanorama;
      const gallery = document.createElement('button');
      gallery.type = 'button';
      gallery.dataset.panoramaGallery = 'true';
      gallery.textContent = uiCopy(this.locale).localGallery;
      gallery.addEventListener('click', () => {
        galleryRegion.hidden = !galleryRegion.hidden;
        if (!galleryRegion.hidden) void this.#renderGallery(galleryRegion);
      });
      actions.append(download, gallery);
      void this.panorama
        .capture(result)
        .then(async (record) => {
          download.disabled = false;
          download.textContent = uiCopy(this.locale).downloadPanorama;
          download.addEventListener('click', () => downloadPanorama(record));
          const persisted = await this.panorama!.gallery.save(record).catch(
            () => false,
          );
          download.dataset.gallerySaved = String(persisted);
          if (!galleryRegion.hidden) await this.#renderGallery(galleryRegion);
        })
        .catch(() => {
          download.textContent = uiCopy(this.locale).panoramaUnavailable;
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
      remote,
      seed,
      note,
      actions,
      galleryRegion,
    );
    this.root.hidden = false;
    this.root.focus();
  }

  #createRemoteHaikuControls(result: RunResult): HTMLElement {
    const copy = uiCopy(this.locale);
    const region = document.createElement('section');
    region.className = 'slice-result__remote-haiku';
    if (this.remoteHaikuEndpoint === null) {
      region.hidden = true;
      return region;
    }
    const consentId = 'remote-haiku-consent';
    const label = document.createElement('label');
    const consent = document.createElement('input');
    consent.type = 'checkbox';
    consent.id = consentId;
    consent.dataset.remoteHaikuConsent = 'true';
    label.htmlFor = consentId;
    label.append(consent, copy.remoteConsent);
    const disclosure = document.createElement('p');
    disclosure.textContent = copy.remoteDisclosure;
    const request = document.createElement('button');
    request.type = 'button';
    request.disabled = true;
    request.dataset.remoteHaikuRequest = 'true';
    request.textContent = copy.remoteCreate;
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const variant = document.createElement('blockquote');
    variant.hidden = true;
    consent.addEventListener('change', () => {
      request.disabled = !consent.checked;
    });
    request.addEventListener(
      'click',
      () => {
        request.disabled = true;
        consent.disabled = true;
        status.textContent = copy.remoteRequesting;
        void requestRemoteHaikuWithFallback({
          endpoint: this.remoteHaikuEndpoint,
          consent: consent.checked,
          result,
          local: result.haiku,
          locale: this.locale,
        }).then((response) => {
          if (response.source === 'remote') {
            variant.textContent = response.haiku.lines.join('\n');
            variant.hidden = false;
            status.textContent = copy.remoteReceived;
          } else {
            status.textContent = copy.remoteUnavailable;
          }
        });
      },
      { once: true },
    );
    region.append(label, disclosure, request, status, variant);
    return region;
  }

  async #renderGallery(region: HTMLElement): Promise<void> {
    if (!this.panorama) return;
    const copy = uiCopy(this.locale);
    const records = await this.panorama.gallery.list();
    const title = document.createElement('h3');
    title.textContent = `${copy.localGallery} · ${records.length}/5`;
    const note = document.createElement('p');
    note.textContent = copy.galleryOnlyLocal;
    const list = document.createElement('ol');
    for (const record of records) {
      const item = document.createElement('li');
      const summary = document.createElement('span');
      summary.textContent = `${record.seedLabel} · ${record.profile} · ${record.haiku.join(' / ')}`;
      const download = document.createElement('button');
      download.type = 'button';
      download.textContent = copy.download;
      download.addEventListener('click', () => downloadPanorama(record));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = copy.remove;
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
