import { describe, expect, it, vi } from 'vitest';

import { planSeedAnchors } from '../../src/gameplay/anchors';
import { ProgressionSystem } from '../../src/gameplay/progression';
import {
  DEATH_DISSOLVE_SECONDS,
  DEATH_FADE_SECONDS,
  DEATH_FREEZE_SECONDS,
  FIRST_DEATH_LINE,
  RESPAWN_INVULNERABILITY_SECONDS,
  RespawnSystem,
} from '../../src/gameplay/respawn';
import { WorldState, cellCoordinatesToId } from '../../src/world/world-state';

describe('RespawnSystem integration', () => {
  it('preserves FIXED world, seeds and an externally advancing clock', () => {
    const world = new WorldState();
    const fixedCellId = cellCoordinatesToId({ x: 32, z: 32 });
    world.commitFixed({
      cellId: fixedCellId,
      terrainTileId: 7,
      featureTileId: 2,
      terrainRotationQuarterTurns: 3,
    });
    const progression = new ProgressionSystem(planSeedAnchors(42), {
      unlockPack: () => 1,
    });
    progression.collectAt(progression.getSeedCell('water'));
    let runClockSeconds = 60;
    const teleportPlayer = vi.fn();
    const respawn = new RespawnSystem({
      ensureRespawnGround: vi.fn(),
      isRespawnWalkable: () => true,
      teleportPlayer,
    });

    expect(respawn.requestDeath({ cause: 'HAZARD' })).toBe(true);
    const deathDuration =
      DEATH_FREEZE_SECONDS + DEATH_DISSOLVE_SECONDS + DEATH_FADE_SECONDS;
    runClockSeconds -= deathDuration;
    respawn.update(deathDuration);

    expect(teleportPlayer).toHaveBeenCalledTimes(1);
    expect(world.getCell(fixedCellId)).toMatchObject({
      phase: 'FIXED',
      terrainTileId: 7,
      featureTileId: 2,
      terrainRotationQuarterTurns: 3,
    });
    expect(progression.hasCollected('water')).toBe(true);
    expect(runClockSeconds).toBe(59);
    expect(respawn.snapshot()).toMatchObject({
      phase: 'INVULNERABLE',
      deaths: 1,
    });
  });

  it('emits the first death line once and blocks chained deaths for 1.5 seconds', () => {
    const events: unknown[] = [];
    const respawn = new RespawnSystem({
      ensureRespawnGround: () => undefined,
      isRespawnWalkable: () => true,
      teleportPlayer: () => undefined,
      onEvent: (event) => events.push(event),
    });
    const deathDuration =
      DEATH_FREEZE_SECONDS + DEATH_DISSOLVE_SECONDS + DEATH_FADE_SECONDS;

    respawn.requestDeath({ cause: 'UNCERTAINTY' });
    expect(events[0]).toMatchObject({
      type: 'DEATH_STARTED',
      firstDeath: true,
      narrativeLine: FIRST_DEATH_LINE,
    });
    respawn.update(deathDuration);
    expect(respawn.isInvulnerable()).toBe(true);
    expect(respawn.requestDeath({ cause: 'HAZARD' })).toBe(false);
    respawn.update(RESPAWN_INVULNERABILITY_SECONDS - 0.01);
    expect(respawn.requestDeath({ cause: 'HAZARD' })).toBe(false);
    respawn.update(0.01);
    expect(respawn.canTakeDamage()).toBe(true);

    respawn.requestDeath({ cause: 'HAZARD' });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'DEATH_STARTED',
        firstDeath: false,
        narrativeLine: null,
      }),
    );
  });

  it('fails closed if the monolith respawn is not walkable', () => {
    expect(
      () =>
        new RespawnSystem({
          ensureRespawnGround: () => undefined,
          isRespawnWalkable: () => false,
          teleportPlayer: () => undefined,
        }),
    ).toThrow('Respawn position must be walkable.');
  });
});
