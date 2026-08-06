export interface GameHudElements {
  readonly time: HTMLElement;
  readonly message: HTMLElement;
}

export class GameHud {
  readonly onboarding: HTMLElement;
  readonly subtitle: HTMLElement;
  private subtitlesEnabled = true;

  constructor(
    private readonly parent: HTMLElement,
    private readonly elements: GameHudElements,
  ) {
    this.onboarding = document.createElement('p');
    this.onboarding.className = 'onboarding-prompt';
    this.onboarding.textContent = 'MIRA';
    this.onboarding.setAttribute('aria-hidden', 'true');
    this.subtitle = document.createElement('p');
    this.subtitle.className = 'narrative-subtitle';
    this.subtitle.setAttribute('role', 'status');
    this.subtitle.setAttribute('aria-live', 'polite');
    this.subtitle.hidden = true;
    parent.append(this.onboarding, this.subtitle);
  }

  setTime(remainingSeconds: number): void {
    const totalSeconds = Math.max(0, Math.ceil(remainingSeconds));
    this.elements.time.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
    this.parent.dataset.countdown =
      totalSeconds <= 30
        ? 'critical'
        : totalSeconds <= 60
          ? 'warning'
          : 'normal';
  }

  setMessage(message: string): void {
    this.elements.message.textContent = message;
  }

  showSubtitle(message: string): void {
    this.subtitle.textContent = message;
    this.subtitle.hidden = !this.subtitlesEnabled;
  }

  setSubtitlesEnabled(enabled: boolean): void {
    this.subtitlesEnabled = enabled;
    this.subtitle.hidden = !enabled || this.subtitle.textContent === '';
  }

  setHighContrast(enabled: boolean): void {
    this.parent.dataset.highContrast = String(enabled);
  }

  notifyFirstCollapse(): void {
    this.onboarding.dataset.complete = 'true';
  }

  destroy(): void {
    this.onboarding.remove();
    this.subtitle.remove();
  }
}
