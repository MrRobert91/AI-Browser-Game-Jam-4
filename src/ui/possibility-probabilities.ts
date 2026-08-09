import {
  normalizeCandidatePercentages,
  type ProxyFamily,
  type SuperpositionCell,
  type SuperpositionQuality,
} from '../render/superposition';

const FAMILY_LABELS: Readonly<Record<ProxyFamily, string>> = {
  ground: 'Terreno',
  organic: 'Orgánico',
  mineral: 'Mineral',
  structure: 'Estructura',
};

export class PossibilityProbabilities {
  readonly element: HTMLElement;
  readonly #items: readonly HTMLLIElement[];
  #signature = '';

  constructor(parent: HTMLElement) {
    this.element = document.createElement('section');
    this.element.className = 'possibility-probabilities';
    this.element.setAttribute('aria-label', 'Probabilidades de superposición');
    this.element.hidden = true;
    const heading = document.createElement('p');
    heading.textContent = 'SUPERPOSICIÓN';
    const list = document.createElement('ol');
    this.#items = Array.from({ length: 3 }, () => {
      const item = document.createElement('li');
      list.append(item);
      return item;
    });
    this.element.append(heading, list);
    parent.append(this.element);
  }

  update(cell: SuperpositionCell | null, quality: SuperpositionQuality): void {
    const probabilities = cell
      ? normalizeCandidatePercentages(cell.candidates, quality)
      : [];
    const signature = probabilities
      .map(({ tileId, percentage }) => `${tileId}:${percentage}`)
      .join('|');
    if (signature === this.#signature && this.element.hidden === !cell) return;
    this.#signature = signature;
    this.element.hidden = probabilities.length === 0;

    this.#items.forEach((item, index) => {
      const probability = probabilities[index];
      item.hidden = probability === undefined;
      if (!probability) return;
      item.textContent = `${probability.label ?? FAMILY_LABELS[probability.family]} ${probability.percentage}%`;
    });
  }

  destroy(): void {
    this.element.remove();
  }
}
