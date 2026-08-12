import type { WorldVector3 } from '../contracts/world';
import type { NarrativeCueId } from './narrative';

export const DEATH_FREEZE_SECONDS = 0.12;
export const DEATH_DISSOLVE_SECONDS = 0.7;
export const DEATH_FADE_SECONDS = 0.18;
export const RESPAWN_INVULNERABILITY_SECONDS = 1.5;
export const MAXIMUM_LIVES = 3;
export const RESPAWN_POSITION: WorldVector3 = [64, 1.7, 64];
export type RespawnPhase =
  'ALIVE' | 'FROZEN' | 'DISSOLVING' | 'FADING' | 'INVULNERABLE' | 'TERMINAL';

export interface DeathRequest {
  readonly cause: 'CONSCIOUSNESS_BOMB';
}

export interface RespawnSnapshot {
  readonly phase: RespawnPhase;
  readonly deaths: number;
  readonly maximumLives: 3;
  readonly livesRemaining: number;
  readonly terminal: boolean;
  readonly phaseElapsedSeconds: number;
  readonly invulnerabilityRemainingSeconds: number;
  readonly inputLocked: boolean;
}

export type RespawnEvent =
  | {
      readonly type: 'DEATH_STARTED';
      readonly cause: DeathRequest['cause'];
      readonly firstDeath: boolean;
      readonly terminal: boolean;
      readonly narrativeCueId: NarrativeCueId | null;
    }
  | { readonly type: 'DISSOLVE_STARTED' }
  | { readonly type: 'FADE_STARTED' }
  | { readonly type: 'RESPAWNED'; readonly position: WorldVector3 }
  | { readonly type: 'INVULNERABILITY_ENDED' }
  | { readonly type: 'LIVES_EXHAUSTED' };

export interface RespawnOptions {
  readonly isRespawnWalkable: (position: WorldVector3) => boolean;
  readonly ensureRespawnGround: (position: WorldVector3) => void;
  readonly teleportPlayer: (position: WorldVector3) => void;
  readonly onEvent?: (event: RespawnEvent) => void;
}

/** Three-life timeline. Only consciousness-bomb contact can enter it. */
export class RespawnSystem {
  private phase: RespawnPhase = 'ALIVE';
  private phaseElapsedSeconds = 0;
  private deaths = 0;

  constructor(private readonly options: RespawnOptions) {
    options.ensureRespawnGround(RESPAWN_POSITION);
    if (!options.isRespawnWalkable(RESPAWN_POSITION)) {
      throw new Error('Respawn position must be walkable.');
    }
  }

  requestDeath(request: DeathRequest): boolean {
    if (this.phase !== 'ALIVE' || this.deaths >= MAXIMUM_LIVES) return false;
    this.phase = 'FROZEN';
    this.phaseElapsedSeconds = 0;
    this.deaths += 1;
    this.emit({
      type: 'DEATH_STARTED',
      cause: request.cause,
      firstDeath: this.deaths === 1,
      terminal: this.deaths === MAXIMUM_LIVES,
      narrativeCueId: this.deaths === 1 ? 'firstDeath' : null,
    });
    return true;
  }

  update(deltaSeconds: number): readonly RespawnEvent[] {
    const events: RespawnEvent[] = [];
    let remainingDelta = Math.max(0, deltaSeconds);
    while (
      remainingDelta > 0 &&
      this.phase !== 'ALIVE' &&
      this.phase !== 'TERMINAL'
    ) {
      const duration = this.currentPhaseDuration();
      const consumed = Math.min(
        remainingDelta,
        duration - this.phaseElapsedSeconds,
      );
      this.phaseElapsedSeconds += consumed;
      remainingDelta -= consumed;
      if (this.phaseElapsedSeconds + 1e-9 < duration) break;
      this.phaseElapsedSeconds = 0;
      const event = this.advancePhase();
      if (event) {
        events.push(event);
        this.emit(event);
      }
    }
    return events;
  }

  isInvulnerable(): boolean {
    return this.phase === 'INVULNERABLE';
  }

  canTakeDamage(): boolean {
    return this.phase === 'ALIVE' && this.deaths < MAXIMUM_LIVES;
  }

  snapshot(): RespawnSnapshot {
    return {
      phase: this.phase,
      deaths: this.deaths,
      maximumLives: MAXIMUM_LIVES,
      livesRemaining: Math.max(0, MAXIMUM_LIVES - this.deaths),
      terminal: this.phase === 'TERMINAL',
      phaseElapsedSeconds: this.phaseElapsedSeconds,
      invulnerabilityRemainingSeconds:
        this.phase === 'INVULNERABLE'
          ? Math.max(
              0,
              RESPAWN_INVULNERABILITY_SECONDS - this.phaseElapsedSeconds,
            )
          : 0,
      inputLocked:
        this.phase === 'FROZEN' ||
        this.phase === 'DISSOLVING' ||
        this.phase === 'FADING' ||
        this.phase === 'TERMINAL',
    };
  }

  private currentPhaseDuration(): number {
    switch (this.phase) {
      case 'FROZEN':
        return DEATH_FREEZE_SECONDS;
      case 'DISSOLVING':
        return DEATH_DISSOLVE_SECONDS;
      case 'FADING':
        return DEATH_FADE_SECONDS;
      case 'INVULNERABLE':
        return RESPAWN_INVULNERABILITY_SECONDS;
      case 'ALIVE':
      case 'TERMINAL':
        return 0;
    }
  }

  private advancePhase(): RespawnEvent | null {
    switch (this.phase) {
      case 'FROZEN':
        this.phase = 'DISSOLVING';
        return { type: 'DISSOLVE_STARTED' };
      case 'DISSOLVING':
        this.phase = 'FADING';
        return { type: 'FADE_STARTED' };
      case 'FADING':
        if (this.deaths >= MAXIMUM_LIVES) {
          this.phase = 'TERMINAL';
          return { type: 'LIVES_EXHAUSTED' };
        }
        this.options.ensureRespawnGround(RESPAWN_POSITION);
        this.options.teleportPlayer(RESPAWN_POSITION);
        this.phase = 'INVULNERABLE';
        return { type: 'RESPAWNED', position: RESPAWN_POSITION };
      case 'INVULNERABLE':
        this.phase = 'ALIVE';
        return { type: 'INVULNERABILITY_ENDED' };
      case 'ALIVE':
      case 'TERMINAL':
        return null;
    }
  }

  private emit(event: RespawnEvent): void {
    this.options.onEvent?.(event);
  }
}
