import recordSource from '../content/collapsador-records.json';

export const MAX_COLLAPSADOR_RECORD_QUEUE = 2;

export interface CollapsadorRecord {
  readonly id: string;
  readonly speaker: string;
  readonly subtitle: string;
  readonly durationMs: number;
  readonly priority: number;
  readonly trigger: {
    readonly fixedCells: number;
    readonly seeds: number;
    readonly maxDistance: number;
  };
}

export interface CollapsadorRecordFrame {
  readonly deltaMs: number;
  readonly fixedCells: number;
  readonly seeds: number;
  readonly maxDistance: number;
  readonly blocked: boolean;
}

export interface CollapsadorRecordEvents {
  readonly onPlay: (record: CollapsadorRecord) => void;
  readonly onInterrupt?: (record: CollapsadorRecord) => void;
  readonly onOmit?: (record: CollapsadorRecord) => void;
}

export const COLLAPSADOR_RECORDS: readonly CollapsadorRecord[] = recordSource;

function eligible(
  record: CollapsadorRecord,
  frame: CollapsadorRecordFrame,
): boolean {
  return (
    frame.fixedCells >= record.trigger.fixedCells &&
    frame.seeds >= record.trigger.seeds &&
    frame.maxDistance >= record.trigger.maxDistance
  );
}

/** Deterministic, bounded narrative queue that never changes gameplay state. */
export class CollapsadorRecordDirector {
  private readonly discovered = new Set<string>();
  private readonly completed = new Set<string>();
  private readonly omitted = new Set<string>();
  private readonly queue: CollapsadorRecord[] = [];
  private active: { record: CollapsadorRecord; elapsedMs: number } | null =
    null;

  constructor(private readonly events: CollapsadorRecordEvents) {}

  update(frame: CollapsadorRecordFrame): void {
    if (!Number.isFinite(frame.deltaMs) || frame.deltaMs < 0) {
      throw new RangeError('Record delta must be a finite positive duration.');
    }
    this.discover(frame);
    if (frame.blocked) {
      if (this.active) {
        this.omitted.add(this.active.record.id);
        this.events.onInterrupt?.(this.active.record);
        this.active = null;
      }
      while (this.queue.length > 0) {
        const record = this.queue.shift()!;
        this.omitted.add(record.id);
        this.events.onOmit?.(record);
      }
      return;
    }

    if (!this.active) {
      const record = this.queue.shift();
      if (record) {
        this.active = { record, elapsedMs: 0 };
        this.events.onPlay(record);
      }
    }
    if (!this.active) return;
    this.active.elapsedMs += frame.deltaMs;
    if (this.active.elapsedMs >= this.active.record.durationMs) {
      this.completed.add(this.active.record.id);
      this.active = null;
    }
  }

  snapshot(): {
    readonly activeId: string | null;
    readonly queuedIds: readonly string[];
    readonly completedIds: readonly string[];
    readonly omittedIds: readonly string[];
  } {
    return {
      activeId: this.active?.record.id ?? null,
      queuedIds: this.queue.map((record) => record.id),
      completedIds: [...this.completed],
      omittedIds: [...this.omitted],
    };
  }

  private discover(frame: CollapsadorRecordFrame): void {
    const candidates = COLLAPSADOR_RECORDS.filter(
      (record) => !this.discovered.has(record.id) && eligible(record, frame),
    ).sort((left, right) => right.priority - left.priority);
    for (const record of candidates) {
      this.discovered.add(record.id);
      if (this.queue.length >= MAX_COLLAPSADOR_RECORD_QUEUE) {
        this.omitted.add(record.id);
        this.events.onOmit?.(record);
      } else {
        this.queue.push(record);
      }
    }
  }
}
