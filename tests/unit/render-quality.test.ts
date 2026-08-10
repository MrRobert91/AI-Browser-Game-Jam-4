import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  FIRST_PERSON_FOV_DEGREES,
  PLAYER_EYE_HEIGHT_METERS,
  createFirstPersonCamera,
} from '../../src/player/camera';
import {
  DynamicResolutionController,
  autoPreset,
  nextLowerQuality,
  resolveQualityProfile,
} from '../../src/render/quality';

describe('quality presets', () => {
  it('selects stable auto tiers from browser hardware hints', () => {
    expect(autoPreset({ hardwareConcurrency: 4, deviceMemoryGb: 8 })).toBe(
      'low',
    );
    expect(autoPreset({ hardwareConcurrency: 8, deviceMemoryGb: 8 })).toBe(
      'low',
    );
    expect(autoPreset({ hardwareConcurrency: 12, deviceMemoryGb: 16 })).toBe(
      'medium',
    );
    expect(autoPreset({ hardwareConcurrency: 16, deviceMemoryGb: 16 })).toBe(
      'high',
    );
  });

  it('reacts to emergency frames and stays inside the normative 0.35-1.0 range', () => {
    const controller = new DynamicResolutionController(
      resolveQualityProfile('high'),
    );
    for (let frame = 0; frame < 3; frame += 1) controller.sampleFrame(80);
    expect(controller.scale).toBeCloseTo(0.7);
    for (let frame = 0; frame < 1_600; frame += 1) controller.sampleFrame(10);
    expect(controller.scale).toBe(1);

    const low = new DynamicResolutionController(resolveQualityProfile('low'));
    for (let frame = 0; frame < 4; frame += 1) low.sampleFrame(80);
    expect(low.scale).toBeCloseTo(0.35);
  });

  it('makes low quality legible without shadows or three-candidate proxies', () => {
    expect(resolveQualityProfile('low')).toMatchObject({
      fogFar: 45,
      shadows: false,
      maxDevicePixelRatio: 1,
      maxSuperpositionCandidates: 2,
      aggressiveLod: true,
    });
  });

  it('degrades automatic effects in the documented order', () => {
    expect(nextLowerQuality('high')).toBe('medium');
    expect(nextLowerQuality('medium')).toBe('low');
    expect(nextLowerQuality('low')).toBe('low');
  });
});

describe('first-person camera and WebGL route', () => {
  it('uses the normative FOV and eye height', () => {
    const camera = createFirstPersonCamera(1920, 1080);
    expect(FIRST_PERSON_FOV_DEGREES).toBe(70);
    expect(PLAYER_EYE_HEIGHT_METERS).toBe(1.7);
    expect(camera.fov).toBe(70);
    expect(camera.position.y).toBe(1.7);
    expect(camera.aspect).toBeCloseTo(16 / 9);
  });

  it('requires WebGL2 and never references WebGPU', async () => {
    const source = await readFile('src/render/renderer.ts', 'utf8');
    expect(source).toContain("getContext('webgl2'");
    expect(source).not.toMatch(/WebGPU/u);
  });
});
