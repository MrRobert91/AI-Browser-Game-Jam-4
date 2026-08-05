import {
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import type { Scene } from 'three';

import type { QualityProfile } from './quality';

export interface Atmosphere {
  readonly group: Group;
  readonly sun: DirectionalLight;
  applyQuality(profile: QualityProfile): void;
  dispose(): void;
}

export function createAtmosphere(
  scene: Scene,
  profile: QualityProfile,
): Atmosphere {
  scene.background = new Color(0x071018);
  const group = new Group();
  group.name = 'world-atmosphere';

  const hemisphere = new HemisphereLight(0xb8fff3, 0x142016, 1.35);
  group.add(hemisphere);

  const sun = new DirectionalLight(0xfff1d0, 3.2);
  sun.position.set(34, 48, 18);
  sun.target.position.set(64, 0, 64);
  group.add(sun, sun.target);

  const groundGeometry = new PlaneGeometry(128, 128, 1, 1);
  const groundMaterial = new MeshStandardMaterial({
    color: 0x183b34,
    roughness: 0.92,
    metalness: 0,
  });
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.name = 'safe-origin-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(64, 0, 64);
  ground.receiveShadow = true;
  group.add(ground);

  const grid = new GridHelper(128, 64, 0x6ccab8, 0x24554d);
  grid.position.set(64, 0.01, 64);
  const gridMaterials = Array.isArray(grid.material)
    ? grid.material
    : [grid.material];
  for (const material of gridMaterials) {
    material.transparent = true;
    material.opacity = 0.18;
  }
  group.add(grid);
  scene.add(group);

  const applyQuality = (nextProfile: QualityProfile): void => {
    scene.fog = new Fog(0x0b1820, nextProfile.fogNear, nextProfile.fogFar);
    sun.castShadow = nextProfile.shadows;
    sun.shadow.mapSize.set(
      nextProfile.shadowMapSize,
      nextProfile.shadowMapSize,
    );
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 95;
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.bias = -0.0004;
  };
  applyQuality(profile);

  return {
    group,
    sun,
    applyQuality,
    dispose: () => {
      scene.remove(group);
      groundGeometry.dispose();
      groundMaterial.dispose();
      for (const material of gridMaterials) material.dispose();
    },
  };
}
