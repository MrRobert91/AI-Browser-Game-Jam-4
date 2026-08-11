import briefingSource from '../content/briefing.json';
import type {
  BriefingChapter,
  BriefingManifest,
  Locale,
} from '../contracts/localization';

export const BRIEFING_MANIFEST = briefingSource as BriefingManifest;

export interface BriefingPlaybackOptions {
  readonly createVideo?: () => HTMLVideoElement;
  readonly createAudio?: () => HTMLAudioElement;
  readonly onComplete?: () => void;
  readonly onFallbackChapter?: (chapter: BriefingChapter) => void;
  readonly onMediaState?: (
    state: 'playing' | 'paused' | 'fallback' | 'error',
  ) => void;
}

export class BriefingPlayback {
  readonly video: HTMLVideoElement;
  readonly audio: HTMLAudioElement;
  readonly captions: HTMLElement;
  private elapsedSeconds = 0;
  private playing = false;
  private fallback = false;
  private completed = false;
  private chapterId: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly locale: Locale,
    private readonly options: BriefingPlaybackOptions = {},
  ) {
    this.video = options.createVideo?.() ?? document.createElement('video');
    this.video.src = BRIEFING_MANIFEST.videoPath;
    this.video.preload = 'auto';
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.crossOrigin = 'anonymous';
    this.video.addEventListener('error', () => this.enableFallback());
    this.audio = options.createAudio?.() ?? new Audio();
    this.audio.src = BRIEFING_MANIFEST.voicePath[locale];
    this.audio.preload = 'auto';
    this.audio.addEventListener('error', () => {
      this.options.onMediaState?.('error');
    });
    this.captions = document.createElement('section');
    this.captions.className = 'briefing-captions';
    this.captions.setAttribute('aria-live', 'polite');
    this.captions.hidden = true;
    parent.append(this.captions);
  }

  get currentTime(): number {
    return this.elapsedSeconds;
  }

  get usingFallback(): boolean {
    return this.fallback;
  }

  setVolume(master: number, voice: number): void {
    this.audio.volume = Math.max(0, Math.min(1, master * voice));
  }

  start(): void {
    this.elapsedSeconds = 0;
    this.completed = false;
    this.playing = true;
    this.chapterId = null;
    this.video.currentTime = 0;
    this.audio.currentTime = 0;
    this.captions.hidden = false;
    if (!this.fallback) {
      void this.video.play().catch(() => this.enableFallback());
    }
    void this.audio.play().catch(() => {
      this.options.onMediaState?.('error');
    });
    this.options.onMediaState?.(this.fallback ? 'fallback' : 'playing');
    this.renderChapter();
  }

  update(deltaSeconds: number): void {
    if (!this.playing || this.completed) return;
    this.elapsedSeconds = Math.min(
      BRIEFING_MANIFEST.durationSeconds,
      this.elapsedSeconds + Math.max(0, deltaSeconds),
    );
    this.renderChapter();
    if (this.elapsedSeconds >= BRIEFING_MANIFEST.durationSeconds) {
      this.finish();
    }
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.video.pause();
    this.audio.pause();
    this.options.onMediaState?.('paused');
  }

  resume(): void {
    if (this.completed) return;
    this.playing = true;
    if (!this.fallback)
      void this.video.play().catch(() => this.enableFallback());
    void this.audio.play().catch(() => this.options.onMediaState?.('error'));
    this.options.onMediaState?.(this.fallback ? 'fallback' : 'playing');
  }

  skip(): void {
    this.finish();
  }

  dispose(): void {
    this.playing = false;
    this.video.pause();
    this.audio.pause();
    this.video.removeAttribute('src');
    this.audio.removeAttribute('src');
    this.video.load();
    this.audio.load();
    this.captions.remove();
  }

  private currentChapter(): BriefingChapter {
    const chapters = BRIEFING_MANIFEST.chapters[this.locale];
    return (
      chapters.find(
        (chapter) =>
          this.elapsedSeconds >= chapter.startSeconds &&
          this.elapsedSeconds < chapter.endSeconds,
      ) ?? chapters.at(-1)!
    );
  }

  private renderChapter(): void {
    const chapter = this.currentChapter();
    if (this.chapterId === chapter.id) return;
    this.chapterId = chapter.id;
    this.captions.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = chapter.title;
    const caption = document.createElement('span');
    caption.textContent = chapter.caption;
    this.captions.append(title, caption);
    if (this.fallback) this.options.onFallbackChapter?.(chapter);
  }

  private enableFallback(): void {
    this.fallback = true;
    this.video.pause();
    this.options.onMediaState?.('fallback');
    this.options.onFallbackChapter?.(this.currentChapter());
  }

  private finish(): void {
    if (this.completed) return;
    this.completed = true;
    this.playing = false;
    this.elapsedSeconds = BRIEFING_MANIFEST.durationSeconds;
    this.video.pause();
    this.audio.pause();
    this.captions.hidden = true;
    this.options.onComplete?.();
  }
}
