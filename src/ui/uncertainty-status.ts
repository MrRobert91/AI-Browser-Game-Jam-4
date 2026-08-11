import type { UncertaintyState } from '../gameplay/uncertainty-enemy';
import type { Locale } from '../contracts/localization';
import { uiCopy } from '../i18n';

export function uncertaintyStatusText(
  state: UncertaintyState,
  locale: Locale = 'es',
): string {
  const copy = uiCopy(locale);
  const label = copy.uncertaintyStates[state];
  return state === 'FIXED_STATUE'
    ? `${copy.reconciledPrefix} // ${label}`
    : `${copy.uncertaintyPrefix} // ${label}`;
}
