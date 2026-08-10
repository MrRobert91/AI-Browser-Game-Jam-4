import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RectAreaLight,
  VideoTexture,
  Vector3,
  type BufferGeometry,
  type Material,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from 'three';

import type { GamePhase, Locale } from '../contracts/localization';

export const PROLOGUE_ROOM_WIDTH = 14;
export const PROLOGUE_ROOM_DEPTH = 12;
export const PROLOGUE_ROOM_HEIGHT = 4.5;
export const PROLOGUE_BUTTON_POSITION = new Vector3(64, 1.05, 64);
export const PROLOGUE_ROOM_SPAWN = { x: 64, y: 0.85, z: 68 } as const;
export const PROLOGUE_PORTAL_Z = 58.55;

function canvasTexture(
  title: string,
  body: string,
  accent = '#84f4f1',
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#071018';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = accent;
  context.lineWidth = 12;
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  context.fillStyle = accent;
  context.font = '700 54px monospace';
  context.fillText(title, 82, 130);
  context.fillStyle = '#d9eeee';
  context.font = '32px sans-serif';
  const words = body.split(' ');
  let line = '';
  let y = 230;
  for (const word of words) {
    const candidate = `${line}${word} `;
    if (context.measureText(candidate).width > 1080) {
      context.fillText(line, 82, y);
      line = `${word} `;
      y += 54;
    } else line = candidate;
  }
  context.fillText(line, 82, y);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = 'srgb';
  return texture;
}

export class AgencyRoom {
  readonly root = new Group();
  readonly screen: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly button: Mesh<CylinderGeometry, MeshStandardMaterial>;
  private screenTexture: Texture | null = null;
  private readonly forward = new Vector3();
  private readonly targetDirection = new Vector3();

  constructor(scene: Scene, locale: Locale) {
    this.root.name = 'agency-prologue-room';
    const agedWhite = new MeshStandardMaterial({
      color: 0xd7dcda,
      roughness: 0.78,
      metalness: 0.08,
    });
    const darkMetal = new MeshStandardMaterial({
      color: 0x111920,
      roughness: 0.45,
      metalness: 0.75,
    });
    const cyan = new MeshStandardMaterial({
      color: 0x16363e,
      emissive: 0x39d9e6,
      emissiveIntensity: 1.6,
      roughness: 0.35,
    });
    const coral = new MeshStandardMaterial({
      color: 0xff6f5c,
      emissive: 0x5d100c,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.25,
    });
    const addBox = (
      size: readonly [number, number, number],
      position: readonly [number, number, number],
      material: MeshStandardMaterial,
    ): Mesh => {
      const mesh = new Mesh(new BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    addBox([14, 0.18, 12], [64, -0.09, 64], darkMetal);
    addBox([14, 0.16, 12], [64, 4.5, 64], agedWhite);
    addBox([0.2, 4.5, 12], [57, 2.25, 64], agedWhite);
    addBox([0.2, 4.5, 12], [71, 2.25, 64], agedWhite);
    addBox([14, 4.5, 0.2], [64, 2.25, 70], agedWhite);
    addBox([14, 4.5, 0.2], [64, 2.25, 58], darkMetal);
    for (const x of [59, 61.5, 66.5, 69]) {
      addBox([0.06, 4.2, 0.12], [x, 2.2, 58.16], cyan);
    }
    addBox([2.1, 0.65, 2.1], [64, 0.325, 64], darkMetal);
    addBox([1.45, 0.18, 1.45], [64, 0.74, 64], agedWhite);
    this.button = new Mesh(new CylinderGeometry(0.72, 0.8, 0.34, 32), coral);
    this.button.position.copy(PROLOGUE_BUTTON_POSITION);
    this.button.castShadow = true;
    this.root.add(this.button);

    const screenMaterial = new MeshBasicMaterial({
      color: 0x071018,
      side: DoubleSide,
      toneMapped: false,
    });
    this.screen = new Mesh(new PlaneGeometry(8, 4.1), screenMaterial);
    this.screen.position.set(64, 2.35, 58.17);
    this.root.add(this.screen);
    addBox([8.6, 0.16, 0.18], [64, 4.47, 58.12], cyan);
    addBox([8.6, 0.16, 0.18], [64, 0.23, 58.12], cyan);
    addBox([0.16, 4.4, 0.18], [59.7, 2.35, 58.12], cyan);
    addBox([0.16, 4.4, 0.18], [68.3, 2.35, 58.12], cyan);

    const signTexture = canvasTexture(
      locale === 'en' ? 'AGENCY NOTICE 7-C' : 'AVISO DE AGENCIA 7-C',
      locale === 'en'
        ? 'A field body is equipment. Equipment does not receive bereavement leave.'
        : 'Un cuerpo de campo es equipamiento. El equipamiento no disfruta de permiso por duelo.',
      '#ff806f',
    );
    const sign = new Mesh(
      new PlaneGeometry(3.3, 1.85),
      new MeshBasicMaterial({ map: signTexture, toneMapped: false }),
    );
    sign.position.set(57.12, 2.1, 65.8);
    sign.rotation.y = Math.PI / 2;
    this.root.add(sign);

    const ceilingLight = new RectAreaLight(0xb8ffff, 5.5, 8, 2.2);
    ceilingLight.position.set(64, 4.25, 64);
    ceilingLight.rotation.x = -Math.PI / 2;
    const buttonLight = new PointLight(0xff715d, 7, 5, 2);
    buttonLight.position.set(64, 2.2, 64);
    this.root.add(ceilingLight, buttonLight);
    scene.add(this.root);
    this.setFallbackSlide(
      locale === 'en' ? 'MANDATORY ORIENTATION' : 'ORIENTACIÓN OBLIGATORIA',
      locale === 'en'
        ? 'Approach the coral control and press E or click.'
        : 'Acércate al control coral y pulsa E o haz clic.',
    );
  }

  isButtonFocused(camera: PerspectiveCamera): boolean {
    const distance = camera.position.distanceTo(PROLOGUE_BUTTON_POSITION);
    if (distance > 2.55) return false;
    camera.getWorldDirection(this.forward);
    this.targetDirection
      .copy(PROLOGUE_BUTTON_POSITION)
      .sub(camera.position)
      .normalize();
    return this.forward.dot(this.targetDirection) >= 0.91;
  }

  attachVideo(video: HTMLVideoElement): void {
    this.screenTexture?.dispose();
    this.screenTexture = new VideoTexture(video);
    this.screen.material.map = this.screenTexture;
    this.screen.material.color = new Color(0xffffff);
    this.screen.material.transparent = false;
    this.screen.material.opacity = 1;
    this.screen.material.needsUpdate = true;
  }

  setFallbackSlide(title: string, body: string): void {
    this.screenTexture?.dispose();
    this.screenTexture = canvasTexture(title, body);
    this.screen.material.map = this.screenTexture;
    this.screen.material.color = new Color(0xffffff);
    this.screen.material.transparent = false;
    this.screen.material.opacity = 1;
    this.screen.material.needsUpdate = true;
  }

  setPhase(phase: GamePhase): void {
    this.button.material.emissiveIntensity = phase === 'ROOM' ? 1.8 : 0.45;
    if (phase === 'PORTAL') {
      this.screen.material.map = null;
      this.screen.material.color = new Color(0x4df2e7);
      this.screen.material.transparent = true;
      this.screen.material.opacity = 0.42;
      this.screen.material.needsUpdate = true;
    }
  }

  update(elapsedSeconds: number, focused: boolean): void {
    const pulse = 1 + Math.sin(elapsedSeconds * 2.7) * 0.08;
    this.button.scale.setScalar(focused ? pulse * 1.05 : pulse);
    if (this.screen.material.transparent) {
      this.screen.material.opacity =
        0.34 + Math.sin(elapsedSeconds * 1.9) * 0.08;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.screenTexture?.dispose();
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    this.root.traverse((object) => {
      if (object instanceof Mesh) {
        geometries.add(object.geometry);
        const values = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of values) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      const map = 'map' in material ? material.map : null;
      if (map instanceof CanvasTexture) map.dispose();
      material.dispose();
    }
    this.root.clear();
  }
}
