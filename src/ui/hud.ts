import type { Locale } from '../contracts/localization';
import { uiCopy } from '../i18n';

export interface GameHudElements {
  readonly time: HTMLElement;
}

export class GameHud {
  readonly onboarding: HTMLElement;
  readonly subtitle: HTMLElement;
  private subtitlesEnabled = true;
  private displayedTime = '';
  private countdownState = '';

  constructor(
    private readonly parent: HTMLElement,
    private readonly elements: GameHudElements,
    locale: Locale,
  ) {
    this.onboarding = document.createElement('p');
    this.onboarding.className = 'onboarding-prompt';
    this.onboarding.textContent = uiCopy(locale).look;
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
    const displayedTime = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
    if (displayedTime !== this.displayedTime) {
      this.displayedTime = displayedTime;
      this.elements.time.textContent = displayedTime;
    }
    const countdownState =
      totalSeconds <= 30
        ? 'critical'
        : totalSeconds <= 60
          ? 'warning'
          : 'normal';
    if (countdownState !== this.countdownState) {
      this.countdownState = countdownState;
      this.parent.dataset.countdown = countdownState;
    }
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
