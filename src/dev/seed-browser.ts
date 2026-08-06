export function requestedSeedFromLocation(
  location: Pick<Location, 'search'> = window.location,
): number | null {
  const value = new URLSearchParams(location.search).get('seed');
  if (!value) return null;
  const parsed = Number.parseInt(value.replace('-', ''), 16);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xffff_ffff
    ? parsed >>> 0
    : null;
}

export function seedBrowserUrl(seed: number, replay = 'canonical'): string {
  const params = new URLSearchParams({
    seed: seed.toString(16).padStart(8, '0'),
    replay,
  });
  return `?${params.toString()}`;
}
