import type { UnlockablePackId } from '../contracts/tiles';
import type { WorldVector3 } from '../contracts/world';

export interface DebugSnapshot {
  readonly seed: string;
  readonly tick: number;
  readonly position: WorldVector3;
  readonly gridCell: string;
  readonly neighborDomains: readonly string[];
  readonly phase: string;
  readonly entropy: number;
  readonly domainSize: number;
  readonly observationRadius: number;
  readonly occluded: boolean;
  readonly queueLength: number;
  readonly chunkId: number;
  readonly paletteEpoch: number;
  readonly fallbackCount: number;
  readonly recentEvents: readonly string[];
}

export interface DebugOverlayOptions {
  readonly getSnapshot: () => DebugSnapshot;
  readonly unlockNextPack: () => UnlockablePackId | null;
}

export class DebugOverlay {
  private readonly element: HTMLElement;
  private visible = false;

  constructor(private readonly options: DebugOverlayOptions) {
    this.element = document.createElement('pre');
    this.element.className = 'debug-overlay';
    this.element.hidden = true;
    document.body.append(this.element);
    window.addEventListener('keydown', this.onKeyDown);
  }

  update(): void {
    if (!this.visible) return;
    const state = this.options.getSnapshot();
    this.element.textContent = [
      `seed ${state.seed} | tick ${state.tick}`,
      `pos ${state.position.map((value) => value.toFixed(1)).join(', ')}`,
      `grid ${state.gridCell} | neighbors ${state.neighborDomains.join(' | ')}`,
      `phase ${state.phase} | entropy ${state.entropy.toFixed(3)} | domain ${state.domainSize}`,
      `radius ${state.observationRadius.toFixed(1)} | occluded ${state.occluded}`,
      `queue ${state.queueLength} | chunk ${state.chunkId} | epoch ${state.paletteEpoch}`,
      `fallbacks ${state.fallbackCount}`,
      ...state.recentEvents.slice(-20),
    ].join('\n');
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.element.remove();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'F2') {
      event.preventDefault();
      this.visible = !this.visible;
      this.element.hidden = !this.visible;
      this.update();
    } else if (event.code === 'F3') {
      event.preventDefault();
      this.options.unlockNextPack();
    } else if (event.code === 'F4') {
      event.preventDefault();
      const snapshot = this.options.getSnapshot();
      void navigator.clipboard?.writeText(
        JSON.stringify(
          { ...snapshot, recentEvents: snapshot.recentEvents.slice(-20) },
          null,
          2,
        ),
      );
    }
  };
}

export function debugToolsAvailable(): boolean {
  return import.meta.env.DEV;
}
