import type { UnlockablePackId } from '../contracts/tiles';
import type { Locale } from '../contracts/localization';
import {
  SEED_PACK_ORDER,
  type ProgressionSnapshot,
} from '../gameplay/progression';
import { uiCopy } from '../i18n';

export class ProgressionHud {
  readonly element: HTMLElement;
  private readonly items = new Map<UnlockablePackId, HTMLLIElement>();
  private readonly states = new Map<UnlockablePackId, string>();

  constructor(
    parent: HTMLElement,
    private readonly locale: Locale,
  ) {
    const copy = uiCopy(locale);
    this.element = document.createElement('aside');
    this.element.className = 'progression-hud';
    this.element.setAttribute('aria-label', copy.seedsAria);
    const list = document.createElement('ol');
    for (const packId of SEED_PACK_ORDER) {
      const item = document.createElement('li');
      item.dataset.pack = packId;
      item.dataset.state = 'LOCKED';
      item.title = copy.packLabels[packId];
      item.setAttribute(
        'aria-label',
        `${copy.packLabels[packId]}: ${copy.packStates.LOCKED}`,
      );
      item.innerHTML = `<span aria-hidden="true"></span><strong>${copy.packLabels[packId]}</strong>`;
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
      if (this.states.get(packId) === state) continue;
      this.states.set(packId, state);
      item.dataset.state = state;
      item.setAttribute(
        'aria-label',
        `${uiCopy(this.locale).packLabels[packId]}: ${uiCopy(this.locale).packStates[state] ?? state.toLocaleLowerCase(this.locale)}`,
      );
    }
  }

  destroy(): void {
    this.element.remove();
    this.items.clear();
    this.states.clear();
  }
}
