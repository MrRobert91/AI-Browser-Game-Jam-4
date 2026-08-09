import type { Collider, World } from '@dimforge/rapier3d-compat';
import type * as Rapier from '@dimforge/rapier3d-compat';
import {
  BackSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three';

export const WORLD_CENTER_METERS = 64;
export const WORLD_BOUNDARY_RADIUS_METERS = 62;
export const WORLD_BOUNDARY_SEGMENTS = 64;
export const WORLD_BOUNDARY_HEIGHT_METERS = 8;
export const WORLD_BOUNDARY_THICKNESS_METERS = 0.6;

/**
 * A continuous faceted equator for Rapier. The translucent Three.js sphere
 * below supplies the visual dome while these overlapping tangential segments
 * provide reliable character collision without relying on a hollow ball shape.
 */
export function createWorldBoundaryColliders(
  world: World,
  rapier: typeof Rapier,
): readonly Collider[] {
  const colliders: Collider[] = [];
  const halfHeight = WORLD_BOUNDARY_HEIGHT_METERS / 2;
  const halfThickness = WORLD_BOUNDARY_THICKNESS_METERS / 2;
  const centerRadius = WORLD_BOUNDARY_RADIUS_METERS + halfThickness;
  const halfSegmentLength =
    WORLD_BOUNDARY_RADIUS_METERS * Math.tan(Math.PI / WORLD_BOUNDARY_SEGMENTS) +
    0.08;

  for (let index = 0; index < WORLD_BOUNDARY_SEGMENTS; index += 1) {
    const angle = (index / WORLD_BOUNDARY_SEGMENTS) * Math.PI * 2;
    const rotation = angle + Math.PI / 2;
    colliders.push(
      world.createCollider(
        rapier.ColliderDesc.cuboid(halfSegmentLength, halfHeight, halfThickness)
          .setTranslation(
            WORLD_CENTER_METERS + Math.cos(angle) * centerRadius,
            halfHeight,
            WORLD_CENTER_METERS + Math.sin(angle) * centerRadius,
          )
          .setRotation({
            x: 0,
            y: Math.sin(rotation / 2),
            z: 0,
            w: Math.cos(rotation / 2),
          })
          .setFriction(0),
      ),
    );
  }
  return colliders;
}

export interface WorldBoundaryVisual {
  readonly root: Group;
  dispose(): void;
}

/** A subtle inside-facing sphere: legible near its edge, quiet from the origin. */
export function createWorldBoundaryVisual(): WorldBoundaryVisual {
  const root = new Group();
  root.name = 'world-boundary';
  const geometry = new SphereGeometry(
    WORLD_BOUNDARY_RADIUS_METERS + WORLD_BOUNDARY_THICKNESS_METERS,
    WORLD_BOUNDARY_SEGMENTS,
    24,
  );
  const material = new MeshBasicMaterial({
    color: 0x8feadb,
    transparent: true,
    opacity: 0.045,
    wireframe: true,
    side: BackSide,
    depthWrite: false,
    fog: true,
  });
  const dome = new Mesh(geometry, material);
  dome.name = 'world-boundary-sphere';
  dome.position.set(WORLD_CENTER_METERS, 0, WORLD_CENTER_METERS);
  root.add(dome);

  return {
    root,
    dispose: () => {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
