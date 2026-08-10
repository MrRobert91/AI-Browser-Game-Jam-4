export type Locale = 'en' | 'es';

export type GamePhase =
  | 'LANGUAGE_SELECT'
  | 'ROOM'
  | 'BRIEFING'
  | 'PORTAL'
  | 'RUN'
  | 'ENDING';

export interface LocalizedCatalog<T> {
  readonly en: T;
  readonly es: T;
}

export interface BriefingChapter {
  readonly id: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly title: string;
  readonly caption: string;
}

export interface BriefingManifest {
  readonly version: 1;
  readonly durationSeconds: number;
  readonly videoPath: string;
  readonly fallbackFramePaths: readonly string[];
  readonly voicePath: Readonly<Record<Locale, string>>;
  readonly chapters: Readonly<Record<Locale, readonly BriefingChapter[]>>;
}

export interface AudioAssetEntry {
  readonly id: string;
  readonly locale: Locale | 'none';
  readonly path: string;
  readonly kind: 'voice' | 'ambience';
  readonly provider: string;
  readonly model: string;
  readonly voice: string | null;
  readonly generationId: string | null;
  readonly textSha256: string | null;
  readonly fileSha256: string;
  readonly durationSeconds: number;
  readonly bytes: number;
  readonly integratedLufs: number | null;
}

export interface AudioAssetManifest {
  readonly version: 1;
  readonly generatedAt: string;
  readonly assets: readonly AudioAssetEntry[];
}
