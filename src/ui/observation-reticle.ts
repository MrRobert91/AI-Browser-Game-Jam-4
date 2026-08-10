export class ObservationReticle {
  readonly element: HTMLDivElement;
  private charge = -1;

  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'observation-reticle';
    this.element.setAttribute('aria-hidden', 'true');
    this.setCharge(0);
    parent.append(this.element);
  }

  setCharge(charge: number): void {
    const clamped = Math.min(1, Math.max(0, charge));
    if (Math.abs(clamped - this.charge) < 0.001) return;
    this.charge = clamped;
    this.element.style.setProperty('--observation-charge', `${clamped}`);
  }

  destroy(): void {
    this.element.remove();
  }
}
