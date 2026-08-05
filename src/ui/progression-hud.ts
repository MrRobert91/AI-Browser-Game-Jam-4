import type { UnlockablePackId } from '../contracts/tiles';
import {
  SEED_PACK_ORDER,
  type ProgressionSnapshot,
} from '../gameplay/progression';

const PACK_LABELS: Readonly<Record<UnlockablePackId, string>> = {
  water: 'Agua',
  forest: 'Bosque',
  ruin: 'Ruina',
  storm: 'Tormenta',
};

export class ProgressionHud {
  readonly element: HTMLElement;
  private readonly items = new Map<UnlockablePackId, HTMLLIElement>();

  constructor(parent: HTMLElement) {
    this.element = document.createElement('aside');
    this.element.className = 'progression-hud';
    this.element.setAttribute('aria-label', 'Semillas de Posibilidad');
    const list = document.createElement('ol');
    for (const packId of SEED_PACK_ORDER) {
      const item = document.createElement('li');
      item.dataset.pack = packId;
      item.dataset.state = 'LOCKED';
      item.title = PACK_LABELS[packId];
      item.setAttribute('aria-label', `${PACK_LABELS[packId]}: bloqueada`);
      item.innerHTML = `<span aria-hidden="true"></span><strong>${PACK_LABELS[packId]}</strong>`;
      list.append(item);
      this.items.set(packId, item);
    }
    this.element.append(list);
    parent.append(this.element);
  }

  update(snapshot: ProgressionSnapshot): void {
    for (const packId of SEED_PACK_ORDER) {
      const item = this.items.get(packId)!;
      const state = snapshot.packStates[packId];
      item.dataset.state = state;
      item.setAttribute(
        'aria-label',
        `${PACK_LABELS[packId]}: ${state.toLocaleLowerCase('es')}`,
      );
    }
  }

  destroy(): void {
    this.element.remove();
    this.items.clear();
  }
}
