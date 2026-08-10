export const STORM_PULSE_SECONDS = 2.5;

export function stormEmissiveIntensity(
  elapsedSeconds: number,
  reducedFlashes: boolean,
): number {
  if (reducedFlashes) return 0.35;
  const phase =
    ((elapsedSeconds % STORM_PULSE_SECONDS) + STORM_PULSE_SECONDS) %
    STORM_PULSE_SECONDS;
  const eased = (1 - Math.cos((phase / STORM_PULSE_SECONDS) * Math.PI * 2)) / 2;
  return 0.35 + eased * 0.3;
}
