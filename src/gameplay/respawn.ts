import type { WorldVector3 } from '../contracts/world';

export const DEATH_FREEZE_SECONDS = 0.12;
export const DEATH_DISSOLVE_SECONDS = 0.7;
export const DEATH_FADE_SECONDS = 0.18;
export const RESPAWN_INVULNERABILITY_SECONDS = 1.5;
export const RESPAWN_POSITION: WorldVector3 = [64, 1.7, 64];
export const FIRST_DEATH_LINE = 'El mundo recuerda mejor que tú.';

export type RespawnPhase =
  'ALIVE' | 'FROZEN' | 'DISSOLVING' | 'FADING' | 'INVULNERABLE';

export interface DeathRequest {
  readonly cause: 'HAZARD' | 'UNCERTAINTY' | 'VOID';
}

export interface RespawnSnapshot {
  readonly phase: RespawnPhase;
  readonly deaths: number;
  readonly phaseElapsedSeconds: number;
  readonly invulnerabilityRemainingSeconds: number;
  readonly inputLocked: boolean;
}

export type RespawnEvent =
  | {
      readonly type: 'DEATH_STARTED';
      readonly cause: DeathRequest['cause'];
      readonly firstDeath: boolean;
      readonly narrativeLine: string | null;
    }
  | { readonly type: 'DISSOLVE_STARTED' }
  | { readonly type: 'FADE_STARTED' }
  | { readonly type: 'RESPAWNED'; readonly position: WorldVector3 }
  | { readonly type: 'INVULNERABILITY_ENDED' };

export interface RespawnOptions {
  readonly isRespawnWalkable: (position: WorldVector3) => boolean;
  readonly ensureRespawnGround: (position: WorldVector3) => void;
  readonly teleportPlayer: (position: WorldVector3) => void;
  readonly onEvent?: (event: RespawnEvent) => void;
}

/**
 * Owns only the player's death timeline. World, progression and run clock are
 * intentionally external and therefore cannot be reset by this system.
 */
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
    if (this.phase !== 'ALIVE') return false;
    this.phase = 'FROZEN';
    this.phaseElapsedSeconds = 0;
    this.deaths += 1;
    this.emit({
      type: 'DEATH_STARTED',
      cause: request.cause,
      firstDeath: this.deaths === 1,
      narrativeLine: this.deaths === 1 ? FIRST_DEATH_LINE : null,
    });
    return true;
  }

  update(deltaSeconds: number): readonly RespawnEvent[] {
    const events: RespawnEvent[] = [];
    let remainingDelta = Math.max(0, deltaSeconds);
    while (remainingDelta > 0 && this.phase !== 'ALIVE') {
      const duration = this.currentPhaseDuration();
      const untilTransition = duration - this.phaseElapsedSeconds;
      const consumed = Math.min(remainingDelta, untilTransition);
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
    return this.phase === 'ALIVE';
  }

  snapshot(): RespawnSnapshot {
    return {
      phase: this.phase,
      deaths: this.deaths,
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
        this.phase === 'FADING',
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
        this.options.ensureRespawnGround(RESPAWN_POSITION);
        this.options.teleportPlayer(RESPAWN_POSITION);
        this.phase = 'INVULNERABLE';
        return { type: 'RESPAWNED', position: RESPAWN_POSITION };
      case 'INVULNERABLE':
        this.phase = 'ALIVE';
        return { type: 'INVULNERABILITY_ENDED' };
      case 'ALIVE':
        return null;
    }
  }

  private emit(event: RespawnEvent): void {
    this.options.onEvent?.(event);
  }
}
