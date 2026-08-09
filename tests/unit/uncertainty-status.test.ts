import { describe, expect, it } from 'vitest';

import { uncertaintyStatusText } from '../../src/ui/uncertainty-status';
import {
  UNCERTAINTY_GAZE_GRACE_SECONDS,
  UNCERTAINTY_MAX_ACTIVE,
  UNCERTAINTY_MINIMUM_ORIGIN_DISTANCE_METERS,
  UNCERTAINTY_MINIMUM_PLAYER_DISTANCE_METERS,
  UNCERTAINTY_PETRIFY_SECONDS,
  UNCERTAINTY_REWARD_SECONDS,
} from '../../src/gameplay/uncertainty-enemy';

describe('Uncertainty narrative presentation', () => {
  it('renames the pending and reconciled records without changing mechanics', () => {
    expect(uncertaintyStatusText('STALKING')).toContain(
      'INCIDENCIA DE ACTUALIZACIÓN PENDIENTE',
    );
    expect(uncertaintyStatusText('FIXED_STATUE')).toBe(
      'REGISTRO COMÚN // RESULTADO RECONCILIADO',
    );
    expect({
      origin: UNCERTAINTY_MINIMUM_ORIGIN_DISTANCE_METERS,
      player: UNCERTAINTY_MINIMUM_PLAYER_DISTANCE_METERS,
      petrify: UNCERTAINTY_PETRIFY_SECONDS,
      grace: UNCERTAINTY_GAZE_GRACE_SECONDS,
      reward: UNCERTAINTY_REWARD_SECONDS,
      active: UNCERTAINTY_MAX_ACTIVE,
    }).toEqual({
      origin: 18,
      player: 8,
      petrify: 1.2,
      grace: 0.4,
      reward: 3,
      active: 4,
    });
  });
});
