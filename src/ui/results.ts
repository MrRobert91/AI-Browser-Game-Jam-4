import {
  describeAgentUpdate,
  formatRunResult,
  type RunResult,
} from '../gameplay/ending';

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
    actions.append(copy, restart);
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
    );
    this.root.hidden = false;
    this.root.focus();
  }
}
