import type { UncertaintyState } from '../gameplay/uncertainty-enemy';

const STATE_LABELS: Readonly<Record<UncertaintyState, string>> = {
  DORMANT: 'INFORME LATENTE',
  STALKING: 'DESCRIPCIÓN NO OBSERVADA',
  SEEN: 'REVISIÓN EN CURSO',
  PETRIFYING: 'RECONCILIANDO',
  CONTACT: 'CONFLICTO DE EXPEDIENTE',
  FIXED_STATUE: 'RESULTADO RECONCILIADO',
};

export function uncertaintyStatusText(state: UncertaintyState): string {
  return state === 'FIXED_STATUE'
    ? `REGISTRO COMÚN // ${STATE_LABELS[state]}`
    : `INCIDENCIA DE ACTUALIZACIÓN PENDIENTE // ${STATE_LABELS[state]}`;
}
