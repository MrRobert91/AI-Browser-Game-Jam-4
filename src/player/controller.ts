import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import type * as Rapier from '@dimforge/rapier3d-compat';
import type { PerspectiveCamera } from 'three';

import type { LookDelta, MovementIntent, PlayerInputSettings } from './input';

export const WALK_SPEED_METERS_PER_SECOND = 4.2;
export const RUN_SPEED_METERS_PER_SECOND = 6.2;
export const MAX_SLOPE_DEGREES = 38;
export const PLAYER_HEIGHT_METERS = 1.7;
export const PLAYER_CAPSULE_RADIUS_METERS = 0.35;
export const PLAYER_CAPSULE_HALF_HEIGHT_METERS =
  (PLAYER_HEIGHT_METERS - PLAYER_CAPSULE_RADIUS_METERS * 2) / 2;
export const PLAYER_CAPSULE_CENTER_HEIGHT_METERS = PLAYER_HEIGHT_METERS / 2;
export const GRAVITY_METERS_PER_SECOND_SQUARED = 22;
export const JUMP_HEIGHT_METERS = 1.1;
export const JUMP_SPEED_METERS_PER_SECOND = Math.sqrt(
  2 * GRAVITY_METERS_PER_SECOND_SQUARED * JUMP_HEIGHT_METERS,
);
export const ACCELERATION_METERS_PER_SECOND_SQUARED = 30;
export const BRAKING_METERS_PER_SECOND_SQUARED = 36;

export interface PlanarVelocity {
  readonly x: number;
  readonly z: number;
}

export interface CharacterControllerConfigurationTarget {
  setSlideEnabled(enabled: boolean): void;
  enableAutostep(
    maxHeight: number,
    minWidth: number,
    includeDynamicBodies: boolean,
  ): void;
  enableSnapToGround(distance: number): void;
  setMaxSlopeClimbAngle(angle: number): void;
  setMinSlopeSlideAngle(angle: number): void;
  setApplyImpulsesToDynamicBodies(enabled: boolean): void;
}

export interface PlayerControllerInput {
  readonly paused: boolean;
  readonly settings: PlayerInputSettings;
  movementIntent(): MovementIntent;
  consumeLookDelta(): LookDelta;
  consumeJump(): boolean;
}

export class PlayerController {
  readonly #world: World;
  readonly #body: RigidBody;
  readonly #collider: Collider;
  readonly #characterController: KinematicCharacterController;
  readonly #camera: PerspectiveCamera;
  readonly #input: PlayerControllerInput;
  #velocity: PlanarVelocity = { x: 0, z: 0 };
  #verticalVelocity = 0;
  #grounded = false;
  #headBobDistance = 0;

  constructor(
    world: World,
    camera: PerspectiveCamera,
    input: PlayerControllerInput,
    rapier: typeof Rapier,
  ) {
    this.#world = world;
    this.#camera = camera;
    this.#input = input;
    this.#body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(
        64,
        PLAYER_CAPSULE_CENTER_HEIGHT_METERS,
        64,
      ),
    );
    this.#collider = world.createCollider(
      rapier.ColliderDesc.capsule(
        PLAYER_CAPSULE_HALF_HEIGHT_METERS,
        PLAYER_CAPSULE_RADIUS_METERS,
      ).setFriction(0),
      this.#body,
    );
    this.#characterController = world.createCharacterController(0.01);
    configureCharacterController(this.#characterController);
  }

  get grounded(): boolean {
    return this.#grounded;
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be a finite non-negative number');
    }
    const delta = Math.min(deltaSeconds, 0.05);
    this.#updateLook();
    const intent = this.#input.paused
      ? { x: 0, forward: 0, sprint: false }
      : this.#input.movementIntent();
    const speed = intent.sprint
      ? RUN_SPEED_METERS_PER_SECOND
      : WALK_SPEED_METERS_PER_SECOND;
    const yaw = this.#camera.rotation.y;
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const target = {
      x: (rightX * intent.x + forwardX * intent.forward) * speed,
      z: (rightZ * intent.x + forwardZ * intent.forward) * speed,
    };
    this.#velocity = approachPlanarVelocity(this.#velocity, target, delta);

    if (this.#grounded && this.#input.consumeJump() && !this.#input.paused) {
      this.#verticalVelocity = JUMP_SPEED_METERS_PER_SECOND;
      this.#grounded = false;
    } else {
      this.#verticalVelocity -= GRAVITY_METERS_PER_SECOND_SQUARED * delta;
    }

    this.#characterController.computeColliderMovement(this.#collider, {
      x: this.#velocity.x * delta,
      y: this.#verticalVelocity * delta,
      z: this.#velocity.z * delta,
    });
    const movement = this.#characterController.computedMovement();
    const translation = this.#body.translation();
    this.#body.setNextKinematicTranslation({
      x: translation.x + movement.x,
      y: translation.y + movement.y,
      z: translation.z + movement.z,
    });
    this.#grounded = this.#characterController.computedGrounded();
    if (this.#grounded && this.#verticalVelocity < 0)
      this.#verticalVelocity = 0;
    this.#world.timestep = Math.max(1 / 240, delta);
    this.#world.step();
    this.#syncCamera(delta);
  }

  dispose(): void {
    this.#world.removeCharacterController(this.#characterController);
    this.#world.removeRigidBody(this.#body);
  }

  #updateLook(): void {
    const look = this.#input.consumeLookDelta();
    const settings = this.#input.settings;
    this.#camera.rotation.y -= look.x * settings.mouseSensitivity;
    const verticalDirection = settings.invertY ? 1 : -1;
    this.#camera.rotation.x +=
      look.y * settings.mouseSensitivity * verticalDirection;
    const pitchLimit = Math.PI / 2 - 0.01;
    this.#camera.rotation.x = Math.max(
      -pitchLimit,
      Math.min(pitchLimit, this.#camera.rotation.x),
    );
  }

  #syncCamera(deltaSeconds: number): void {
    const translation = this.#body.translation();
    const planarSpeed = Math.hypot(this.#velocity.x, this.#velocity.z);
    if (this.#grounded && planarSpeed > 0.2) {
      this.#headBobDistance += planarSpeed * deltaSeconds;
    }
    const headBob = this.#input.settings.headBobEnabled
      ? Math.sin(this.#headBobDistance * 8) * 0.015
      : 0;
    this.#camera.position.set(
      translation.x,
      translation.y +
        PLAYER_HEIGHT_METERS -
        PLAYER_CAPSULE_CENTER_HEIGHT_METERS +
        headBob,
      translation.z,
    );
  }
}

export function configureCharacterController(
  controller: CharacterControllerConfigurationTarget,
): void {
  const maxSlopeRadians = (MAX_SLOPE_DEGREES * Math.PI) / 180;
  controller.setSlideEnabled(true);
  controller.enableAutostep(0.3, 0.25, false);
  controller.enableSnapToGround(0.2);
  controller.setMaxSlopeClimbAngle(maxSlopeRadians);
  controller.setMinSlopeSlideAngle(maxSlopeRadians);
  controller.setApplyImpulsesToDynamicBodies(true);
}

export function approachPlanarVelocity(
  current: PlanarVelocity,
  target: PlanarVelocity,
  deltaSeconds: number,
): PlanarVelocity {
  const targetMagnitude = Math.hypot(target.x, target.z);
  const acceleration =
    targetMagnitude > 0
      ? ACCELERATION_METERS_PER_SECOND_SQUARED
      : BRAKING_METERS_PER_SECOND_SQUARED;
  const deltaX = target.x - current.x;
  const deltaZ = target.z - current.z;
  const difference = Math.hypot(deltaX, deltaZ);
  const maximumChange = acceleration * deltaSeconds;
  if (difference <= maximumChange || difference === 0) return target;
  const scale = maximumChange / difference;
  return { x: current.x + deltaX * scale, z: current.z + deltaZ * scale };
}
