import { PerspectiveCamera } from 'three';

export const FIRST_PERSON_FOV_DEGREES = 70;
export const PLAYER_EYE_HEIGHT_METERS = 1.7;

export function createFirstPersonCamera(
  viewportWidth: number,
  viewportHeight: number,
): PerspectiveCamera {
  const camera = new PerspectiveCamera(
    FIRST_PERSON_FOV_DEGREES,
    safeAspect(viewportWidth, viewportHeight),
    0.1,
    180,
  );
  camera.position.set(64, PLAYER_EYE_HEIGHT_METERS, 64);
  camera.rotation.order = 'YXZ';
  return camera;
}

export function updateCameraAspect(
  camera: PerspectiveCamera,
  viewportWidth: number,
  viewportHeight: number,
): void {
  camera.aspect = safeAspect(viewportWidth, viewportHeight);
  camera.updateProjectionMatrix();
}

function safeAspect(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError('viewport dimensions must be finite');
  }
  return Math.max(1, width) / Math.max(1, height);
}
