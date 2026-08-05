import { bench, describe } from 'vitest';
import { BoxGeometry, Matrix4, MeshBasicMaterial } from 'three';

import { InstancedFamily } from '../../src/world/instancing';

describe('1,000-instance matrix upload preparation', () => {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const family = new InstancedFamily('benchmark', geometry, material, 1_000);
  const matrix = new Matrix4();

  bench('updates 1,000 matrices in a single InstancedMesh', () => {
    for (let index = 0; index < 1_000; index += 1) {
      family.setInstance(
        `instance:${index}`,
        matrix.makeTranslation(index % 50, 0, Math.floor(index / 50)),
      );
    }
    family.flush();
  });
});
