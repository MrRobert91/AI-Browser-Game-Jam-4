import type { ProxyAssetDescriptor } from '../contracts/tiles';

export interface AssetValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateProxyAsset(
  path: string,
  value: unknown,
  layer: 'terrain' | 'feature',
): readonly AssetValidationIssue[] {
  const issues: AssetValidationIssue[] = [];
  if (!path.startsWith('/assets/') || !path.endsWith('.proxy.json')) {
    issues.push({
      path,
      message: 'Proxy path must be local and end in .proxy.json.',
    });
  }
  if (!isRecord(value)) {
    return [
      ...issues,
      { path, message: 'Proxy descriptor must be a JSON object.' },
    ];
  }
  if (value.version !== 1)
    issues.push({ path, message: 'Proxy version must be 1.' });
  if (typeof value.shape !== 'string' || value.shape.length === 0) {
    issues.push({ path, message: 'Proxy shape must be a non-empty string.' });
  }
  for (const key of ['color', 'accent'] as const) {
    if (
      typeof value[key] !== 'string' ||
      !/^#[0-9a-f]{6}$/iu.test(value[key])
    ) {
      issues.push({ path, message: `${key} must be a six-digit hex color.` });
    }
  }
  if (value.pivot !== 'center-bottom') {
    issues.push({ path, message: 'Pivot must be center-bottom.' });
  }
  if (!isRecord(value.bounds)) {
    issues.push({ path, message: 'Bounds must be an object.' });
  } else {
    const { width, height, depth } = value.bounds;
    if (
      !isPositiveFinite(width) ||
      !isPositiveFinite(height) ||
      !isPositiveFinite(depth)
    ) {
      issues.push({
        path,
        message: 'Bounds must contain positive finite dimensions.',
      });
    } else if (layer === 'terrain' && (width !== 2 || depth !== 2)) {
      issues.push({
        path,
        message: 'Terrain proxy footprint must be exactly 2 x 2 metres.',
      });
    } else if (layer === 'feature' && (width > 2 || depth > 2)) {
      issues.push({
        path,
        message:
          'Feature proxy footprint must stay inside its 2 x 2 metre cell.',
      });
    }
  }
  return issues;
}

export function isProxyAssetDescriptor(
  value: unknown,
): value is ProxyAssetDescriptor {
  return (
    validateProxyAsset('/assets/descriptor.proxy.json', value, 'feature')
      .length === 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
