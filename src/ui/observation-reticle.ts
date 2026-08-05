export class ObservationReticle {
  readonly element: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'observation-reticle';
    this.element.setAttribute('aria-hidden', 'true');
    this.setCharge(0);
    parent.append(this.element);
  }

  setCharge(charge: number): void {
    const clamped = Math.min(1, Math.max(0, charge));
    this.element.style.setProperty('--observation-charge', `${clamped}`);
  }

  destroy(): void {
    this.element.remove();
  }
}
