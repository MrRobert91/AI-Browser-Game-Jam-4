import manifestSource from '../content/mission-complete.json';
import type { Locale } from '../contracts/localization';

interface MissionChapter {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly caption: string;
}

interface MissionManifest {
  readonly durationSeconds: number;
  readonly skipAfterSeconds: number;
  readonly videoPath: string;
  readonly audioPaths: Readonly<Record<Locale, string>>;
  readonly fallbacks: readonly string[];
  readonly chapters: Readonly<Record<Locale, readonly MissionChapter[]>>;
}

const manifest = manifestSource as MissionManifest;

export interface MissionCompletePlaybackOptions {
  readonly locale: Locale;
  readonly onSkip: () => void;
  readonly onFinished: () => void;
}

export class MissionCompletePlayback {
  private readonly root: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly audio: HTMLAudioElement;
  private readonly fallback: HTMLImageElement;
  private readonly caption: HTMLElement;
  private readonly skip: HTMLButtonElement;
  private started = false;
  private fallbackActive = false;

  constructor(
    shell: HTMLElement,
    private readonly options: MissionCompletePlaybackOptions,
  ) {
    this.root = required(shell, '[data-mission-complete]');
    this.video = required(shell, '[data-mission-video]');
    this.audio = required(shell, '[data-mission-audio]');
    this.fallback = required(shell, '[data-mission-fallback]');
    this.caption = required(shell, '[data-mission-caption]');
    this.skip = required(shell, '[data-mission-skip]');
    this.video.src = manifest.videoPath;
    this.audio.src = manifest.audioPaths[options.locale];
    this.fallback.src = manifest.fallbacks[0]!;
    this.video.preload = 'auto';
    this.video.muted = true;
    this.video.playsInline = true;
    this.audio.preload = 'auto';
    this.skip.textContent = options.locale === 'en' ? 'Skip' : 'Omitir';
    this.skip.addEventListener('click', () => {
      if (!this.skip.disabled) options.onSkip();
    });
    this.video.addEventListener('error', () => this.activateFallback());
    this.audio.addEventListener('error', () => {
      this.root.dataset.voice = 'fallback';
    });
    this.video.addEventListener('ended', options.onFinished);
  }

  /** Called synchronously from the initial calibration gesture. */
  authorizeFromGesture(): void {
    this.audio.muted = true;
    const videoAuthorization = this.video.play();
    const audioAuthorization = this.audio.play();
    this.video.pause();
    this.audio.pause();
    this.video.currentTime = 0;
    this.audio.currentTime = 0;
    this.audio.muted = false;
    void videoAuthorization.catch(() => undefined);
    void audioAuthorization.catch(() => undefined);
  }

  start(
    masterVolume: number,
    voiceVolume: number,
    voicesEnabled: boolean,
  ): void {
    if (this.started) return;
    this.started = true;
    this.root.hidden = false;
    this.root.dataset.media = 'video';
    this.root.dataset.voice = voicesEnabled ? 'playing' : 'muted';
    this.audio.volume = voicesEnabled
      ? Math.max(0, Math.min(1, masterVolume * voiceVolume))
      : 0;
    this.video.currentTime = 0;
    this.audio.currentTime = 0;
    void this.video.play().catch(() => this.activateFallback());
    void this.audio.play().catch(() => {
      this.root.dataset.voice = 'fallback';
    });
    this.update(0);
  }

  update(elapsedSeconds: number): void {
    if (!this.started) return;
    const elapsed = Math.max(
      0,
      Math.min(manifest.durationSeconds, elapsedSeconds),
    );
    this.root.dataset.elapsed = elapsed.toFixed(3);
    if (
      !this.fallbackActive &&
      Math.abs(this.video.currentTime - elapsed) > 0.35
    ) {
      this.video.currentTime = elapsed;
    }
    if (
      this.root.dataset.voice === 'playing' &&
      Math.abs(this.audio.currentTime - elapsed) > 0.35
    ) {
      this.audio.currentTime = elapsed;
    }
    const chapters = manifest.chapters[this.options.locale];
    const chapterIndex = Math.min(chapters.length - 1, Math.floor(elapsed / 8));
    const chapter = chapters[chapterIndex]!;
    this.caption.textContent = chapter.caption;
    this.root.dataset.chapter = chapter.id;
    if (this.fallbackActive) {
      this.fallback.src = manifest.fallbacks[chapterIndex]!;
    }
    this.skip.disabled = elapsed < manifest.skipAfterSeconds;
    this.skip.setAttribute('aria-disabled', String(this.skip.disabled));
  }

  stop(): void {
    if (!this.started) return;
    this.video.pause();
    this.audio.pause();
    this.root.hidden = true;
    this.started = false;
  }

  dispose(): void {
    this.stop();
    this.video.removeAttribute('src');
    this.audio.removeAttribute('src');
  }

  private activateFallback(): void {
    this.fallbackActive = true;
    this.video.hidden = true;
    this.fallback.hidden = false;
    this.root.dataset.media = 'fallback';
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing mission-complete element: ${selector}`);
  return value;
}
