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
  readonly onFallbackFrame?: (path: string) => void;
}

export class MissionCompletePlayback {
  private readonly root: HTMLElement;
  readonly video: HTMLVideoElement;
  private readonly audio: HTMLAudioElement;
  private readonly fallback: HTMLImageElement;
  private readonly caption: HTMLElement;
  private readonly skip: HTMLButtonElement;
  private started = false;
  private fallbackActive = false;
  private videoSettled = false;
  private audioSettled = false;
  private finished = false;
  private fallbackIndex = 0;
  private lastWallElapsedSeconds = 0;
  private lastVideoTimeSeconds = 0;
  private lastVideoProgressAtSeconds = 0;
  private lastAudioTimeSeconds = 0;
  private lastAudioProgressAtSeconds = 0;

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
    this.audio.addEventListener('error', () => this.settleAudioAsFallback());
    this.video.addEventListener('ended', () => this.settleVideo());
    this.audio.addEventListener('ended', () => this.settleAudio());
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
    this.finished = false;
    this.videoSettled = this.fallbackActive;
    this.audioSettled = !voicesEnabled;
    this.root.hidden = false;
    this.root.dataset.media = 'video';
    this.root.dataset.voice = voicesEnabled ? 'playing' : 'muted';
    this.audio.volume = voicesEnabled
      ? Math.max(0, Math.min(1, masterVolume * voiceVolume))
      : 0;
    this.video.currentTime = 0;
    this.audio.currentTime = 0;
    void this.video.play().catch(() => this.activateFallback());
    if (voicesEnabled) {
      void this.audio.play().catch(() => this.settleAudioAsFallback());
    }
    if (this.fallbackActive) {
      this.options.onFallbackFrame?.(manifest.fallbacks[this.fallbackIndex]!);
    }
    this.update(0);
  }

  update(elapsedSeconds: number): void {
    if (!this.started) return;
    const wallElapsed = Math.max(0, elapsedSeconds);
    this.lastWallElapsedSeconds = wallElapsed;
    const videoTime = Number.isFinite(this.video.currentTime)
      ? this.video.currentTime
      : 0;
    const audioTime = Number.isFinite(this.audio.currentTime)
      ? this.audio.currentTime
      : 0;
    if (videoTime > this.lastVideoTimeSeconds + 0.01) {
      this.lastVideoTimeSeconds = videoTime;
      this.lastVideoProgressAtSeconds = wallElapsed;
    }
    if (audioTime > this.lastAudioTimeSeconds + 0.01) {
      this.lastAudioTimeSeconds = audioTime;
      this.lastAudioProgressAtSeconds = wallElapsed;
    }
    const mediaElapsed =
      !this.fallbackActive && videoTime > 0
        ? videoTime
        : this.root.dataset.voice === 'playing' && audioTime > 0
          ? audioTime
          : wallElapsed;
    const elapsed = Math.min(
      manifest.durationSeconds,
      mediaElapsed > 0 ? mediaElapsed : wallElapsed,
    );
    this.root.dataset.elapsed = elapsed.toFixed(3);
    const chapters = manifest.chapters[this.options.locale];
    const chapterIndex = Math.min(chapters.length - 1, Math.floor(elapsed / 8));
    const chapter = chapters[chapterIndex]!;
    this.caption.textContent = chapter.caption;
    this.root.dataset.chapter = chapter.id;
    if (this.fallbackActive) {
      const nextPath = manifest.fallbacks[chapterIndex]!;
      this.fallback.src = nextPath;
      if (chapterIndex !== this.fallbackIndex) {
        this.fallbackIndex = chapterIndex;
        this.options.onFallbackFrame?.(nextPath);
      }
    }
    this.skip.disabled = wallElapsed < manifest.skipAfterSeconds;
    this.skip.setAttribute('aria-disabled', String(this.skip.disabled));
    if (
      !this.videoSettled &&
      wallElapsed >= manifest.durationSeconds + 1 &&
      wallElapsed - this.lastVideoProgressAtSeconds >= 2
    ) {
      this.activateFallback();
    }
    if (
      !this.audioSettled &&
      wallElapsed >= manifest.durationSeconds + 8 &&
      wallElapsed - this.lastAudioProgressAtSeconds >= 4
    ) {
      this.settleAudioAsFallback();
    }
    this.finishWhenSettled();
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
    this.videoSettled = true;
    this.video.pause();
    this.video.hidden = true;
    this.fallback.hidden = false;
    this.root.dataset.media = 'fallback';
    this.options.onFallbackFrame?.(manifest.fallbacks[this.fallbackIndex]!);
    this.finishWhenSettled();
  }

  private settleVideo(): void {
    if (this.video.currentTime + 0.25 < manifest.durationSeconds) {
      this.activateFallback();
      return;
    }
    this.videoSettled = true;
    this.finishWhenSettled();
  }

  private settleAudio(): void {
    this.audioSettled = true;
    this.finishWhenSettled();
  }

  private settleAudioAsFallback(): void {
    this.root.dataset.voice = 'fallback';
    this.audioSettled = true;
    this.finishWhenSettled();
  }

  private finishWhenSettled(): void {
    if (
      !this.started ||
      this.finished ||
      !this.videoSettled ||
      !this.audioSettled ||
      this.lastWallElapsedSeconds < manifest.durationSeconds
    ) {
      return;
    }
    this.finished = true;
    this.options.onFinished();
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Missing mission-complete element: ${selector}`);
  return value;
}
