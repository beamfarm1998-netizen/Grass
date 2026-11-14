import * as THREE from 'three';
import { AssetLoaderAndValidator } from '../../engine/animation/AssetLoaderAndValidator';
import { ActiveEquipmentLoadout } from '../equipment/EquipmentManager';
import { FishController } from '../fish/FishController';
import { FishSpeciesSpec } from '../fish/data/FishCatalog';
import { FishingSession } from '../fishing/FishingSession';
import { FishingState } from '../fishing/FishingState';
import { RodPhysics } from '../physics/rod/RodPhysics';

interface ArticulatedFishRig {
  root: THREE.Group;
  tailPivot: THREE.Group | null;
  pectoralL: THREE.Mesh | null;
  pectoralR: THREE.Mesh | null;
  mixer: THREE.AnimationMixer;
  ownedGeometries: THREE.BufferGeometry[];
  ownedMaterials: THREE.Material[];
}

const _segMid = new THREE.Vector3();
const _segDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _segQuat = new THREE.Quaternion();
const _linePoint = new THREE.Vector3();

function createFishScaleTexture(species: FishSpeciesSpec, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const dorsal = new THREE.Color(species.bodyColorHex);
    const belly = new THREE.Color(species.bellyColorHex);
    const stripe = new THREE.Color(species.accentStripeHex);

    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, `#${dorsal.getHexString()}`);
    grad.addColorStop(0.52, `#${stripe.getHexString()}`);
    grad.addColorStop(1, `#${belly.getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);

    // Subtle diamond scale pattern
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 128; y += 10) {
      for (let x = (y % 20 === 0 ? 0 : 5); x < 256; x += 10) {
        ctx.beginPath();
        ctx.arc(x, y, 5, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCorkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#c89d6c';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#a87d4e' : '#deb887';
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export class FishingRig3D {
  public readonly rodTipWorldPos = new THREE.Vector3(0, 2.6, 12.2);
  private readonly buttWorldPos = new THREE.Vector3(0.46, 1.92, 15.35);
  private readonly rodSegmentPoints: THREE.Vector3[] = [];
  private readonly rodSegmentMeshes: THREE.Mesh[] = [];
  private readonly guideRingMeshes: THREE.Mesh[] = [];
  private rodBlankMat!: THREE.MeshStandardMaterial;
  private reelSpoolMat!: THREE.MeshStandardMaterial;
  private reelRotorGroup!: THREE.Group;
  private reelHandleGroup!: THREE.Group;

  private lineGeometry!: THREE.BufferGeometry;
  private linePositions!: Float32Array;
  private lineMaterial!: THREE.LineBasicMaterial;

  private bobberGroup!: THREE.Group;
  private bobberCapMat!: THREE.MeshStandardMaterial;

  // Pooled Underwater Fight Bubbles (zero GC in render loop)
  private readonly bubbles: Array<{
    mesh: THREE.Mesh;
    active: boolean;
    age: number;
    maxAge: number;
    vx: number;
    vy: number;
    vz: number;
  }> = [];
  private nextBubbleIdx = 0;
  private bubbleSpawnAcc = 0;
  private readonly hookedMouthPos = new THREE.Vector3();

  private readonly fishRigs = new Map<string, ArticulatedFishRig>();
  private readonly scaleTextureCache = new Map<string, THREE.CanvasTexture>();
  private readonly maxAnisotropy: number;
  private readonly assetLoader: AssetLoaderAndValidator;
  private readonly fishGroup: THREE.Group;

  constructor(
    rigGroup: THREE.Group,
    fishGroup: THREE.Group,
    assetLoader: AssetLoaderAndValidator,
    maxAnisotropy: number
  ) {
    this.fishGroup = fishGroup;
    this.assetLoader = assetLoader;
    this.maxAnisotropy = maxAnisotropy;

    for (let i = 0; i < 11; i++) {
      this.rodSegmentPoints.push(new THREE.Vector3());
    }

    this.buildCompositeRodAndReel(rigGroup);
    this.buildFishingLine(rigGroup);
    this.buildCompositeBobber(rigGroup);
    this.buildBubblePool(rigGroup);
  }

  private buildBubblePool(rigGroup: THREE.Group): void {
    const geo = new THREE.SphereGeometry(0.026, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    for (let i = 0; i < 28; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      rigGroup.add(mesh);
      this.bubbles.push({
        mesh,
        active: false,
        age: 0,
        maxAge: 1.0,
        vx: 0,
        vy: 0.45,
        vz: 0,
      });
    }
  }

  private spawnUnderwaterBubble(x: number, y: number, z: number, scale: number): void {
    const b = this.bubbles[this.nextBubbleIdx];
    this.nextBubbleIdx = (this.nextBubbleIdx + 1) % this.bubbles.length;
    if (!b) return;
    b.active = true;
    b.age = 0;
    b.maxAge = 0.75 + Math.random() * 0.65;
    b.vx = (Math.random() - 0.5) * 0.25;
    b.vy = 0.42 + Math.random() * 0.38;
    b.vz = (Math.random() - 0.5) * 0.25;
    b.mesh.position.set(x, y, z);
    b.mesh.scale.setScalar(scale);
    b.mesh.visible = true;
  }

  private buildCompositeRodAndReel(rigGroup: THREE.Group): void {
    const corkTex = createCorkTexture(this.maxAnisotropy);
    const corkMat = new THREE.MeshStandardMaterial({
      map: corkTex,
      roughness: 0.84,
      metalness: 0.04,
    });
    const machinedMetalMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.24,
      metalness: 0.88,
    });
    const darkGraphiteMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.36,
      metalness: 0.55,
    });
    this.rodBlankMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.28,
      metalness: 0.62,
    });
    this.reelSpoolMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.86,
    });

    // Handle & Spinning Reel assembly anchored near buttWorldPos
    const handleAssembly = new THREE.Group();
    handleAssembly.name = 'CompositeRodHandle';

    const buttCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.04, 12), machinedMetalMat);
    buttCap.rotation.x = Math.PI / 2;
    buttCap.position.set(0, 0, 0.22);

    const rearCork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.28, 14), corkMat);
    rearCork.rotation.x = Math.PI / 2;
    rearCork.position.set(0, 0, 0.06);

    const reelSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.02, 0.16, 14), darkGraphiteMat);
    reelSeat.rotation.x = Math.PI / 2;
    reelSeat.position.set(0, 0, -0.15);

    const foreCork = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.14, 14), corkMat);
    foreCork.rotation.x = Math.PI / 2;
    foreCork.position.set(0, 0, -0.29);

    // Multi-part Spinning Reel suspended under the reel seat
    const reelRoot = new THREE.Group();
    reelRoot.position.set(0, -0.065, -0.16);

    const reelStem = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.075, 0.028), darkGraphiteMat);
    reelStem.position.set(0, 0.035, 0);

    const reelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.085, 14), darkGraphiteMat);
    reelBody.rotation.x = Math.PI / 2;

    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.065, 16), this.reelSpoolMat);
    spool.rotation.x = Math.PI / 2;
    spool.position.set(0, 0.012, -0.055);

    this.reelRotorGroup = new THREE.Group();
    this.reelRotorGroup.position.set(0, 0.012, -0.045);
    const bailWire = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.003, 8, 20, Math.PI * 1.15),
      machinedMetalMat
    );
    this.reelRotorGroup.add(bailWire);

    this.reelHandleGroup = new THREE.Group();
    this.reelHandleGroup.position.set(-0.034, 0, -0.005);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.065, 0.012), machinedMetalMat);
    crankArm.position.set(-0.01, -0.025, 0);
    const tKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.036, 10), corkMat);
    tKnob.rotation.z = Math.PI / 2;
    tKnob.position.set(-0.028, -0.052, 0);
    this.reelHandleGroup.add(crankArm, tKnob);

    reelRoot.add(reelStem, reelBody, spool, this.reelRotorGroup, this.reelHandleGroup);
    handleAssembly.add(buttCap, rearCork, reelSeat, foreCork, reelRoot);
    handleAssembly.position.copy(this.buttWorldPos);
    rigGroup.add(handleAssembly);
    (this as unknown as { handleAssembly: THREE.Group }).handleAssembly = handleAssembly;

    // 10 progressive carbon rod segments + ceramic guide rings
    for (let i = 0; i < 10; i++) {
      const r0 = 0.013 * (1 - i * 0.082);
      const r1 = 0.013 * (1 - (i + 1) * 0.082);
      const segGeo = new THREE.CylinderGeometry(Math.max(0.0022, r1), Math.max(0.0028, r0), 1, 10);
      const segMesh = new THREE.Mesh(segGeo, this.rodBlankMat);
      rigGroup.add(segMesh);
      this.rodSegmentMeshes.push(segMesh);

      if (i >= 2 && (i % 2 === 0 || i === 9)) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(Math.max(0.006, 0.018 - i * 0.0012), 0.002, 6, 12),
          machinedMetalMat
        );
        rigGroup.add(ring);
        this.guideRingMeshes.push(ring);
      }
    }
  }

  private buildFishingLine(rigGroup: THREE.Group): void {
    const pointCount = 24;
    this.linePositions = new Float32Array(pointCount * 3);
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(this.lineGeometry, this.lineMaterial);
    line.frustumCulled = false;
    line.renderOrder = 5;
    rigGroup.add(line);
  }

  private buildCompositeBobber(rigGroup: THREE.Group): void {
    this.bobberGroup = new THREE.Group();

    const lowerBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.08 })
    );
    lowerBulb.scale.set(1, 1.25, 1);

    this.bobberCapMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.28,
      roughness: 0.22,
    });
    const upperCap = new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.14, 14), this.bobberCapMat);
    upperCap.position.y = 0.11;

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.011, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.35 })
    );
    antenna.position.y = 0.22;

    const brassSwivel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8),
      new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.85, roughness: 0.3 })
    );
    brassSwivel.position.y = -0.11;

    const hookCurve = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.004, 6, 12, Math.PI * 1.35),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 })
    );
    hookCurve.position.set(0, -0.32, 0);

    this.bobberGroup.add(lowerBulb, upperCap, antenna, brassSwivel, hookCurve);
    rigGroup.add(this.bobberGroup);
  }

  private getOrCreateFishRig(fish: FishController): ArticulatedFishRig {
    let rig = this.fishRigs.get(fish.id);
    if (rig) return rig;

    const root = new THREE.Group();
    const species = fish.species;
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];

    const isSkinnedBase = this.assetLoader.hasSkinnedMesh('fish_base');
    const baseClips = this.assetLoader.getAnimations('fish_base');
    const clonedGlb = this.assetLoader.cloneModelScene('fish_base');

    // Path A: Rigged & UV-textured SkinnedMesh GLB (e.g. lake_fish.glb)
    if (clonedGlb && isSkinnedBase) {
      // Align carp GLB snout (-X) to face +Z forward along swim vector
      clonedGlb.rotation.y = Math.PI / 2;
      clonedGlb.scale.setScalar(1.55);

      const tintTarget = new THREE.Color(species.bodyColorHex);
      clonedGlb.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh || !m.material) return;
        const srcMats = Array.isArray(m.material) ? m.material : [m.material];
        const nextMats = srcMats.map((srcMat) => {
          const clonedMat = srcMat.clone() as THREE.MeshStandardMaterial;
          if (clonedMat.color) {
            clonedMat.color.lerp(tintTarget, 0.36);
          }
          ownedMaterials.push(clonedMat);
          return clonedMat;
        });
        m.material = Array.isArray(m.material) ? nextMats : nextMats[0];
      });

      root.add(clonedGlb);
      const mixer = new THREE.AnimationMixer(clonedGlb);
      if (baseClips.length > 0) {
        mixer.clipAction(baseClips[0]).play();
      } else {
        const rollTrack = new THREE.NumberKeyframeTrack(
          '.rotation[z]',
          [0, 0.5, 1.0],
          [-0.05, 0.05, -0.05]
        );
        mixer.clipAction(new THREE.AnimationClip('SwimUndulate', 1.0, [rollTrack])).play();
      }

      this.fishGroup.add(root);
      rig = {
        root,
        tailPivot: null,
        pectoralL: null,
        pectoralR: null,
        mixer,
        ownedGeometries,
        ownedMaterials,
      };
      this.fishRigs.set(fish.id, rig);
      return rig;
    }

    // Path B: Static base mesh or procedural articulated fusiform fallback
    let scaleTex = this.scaleTextureCache.get(species.id);
    if (!scaleTex) {
      scaleTex = createFishScaleTexture(species, this.maxAnisotropy);
      this.scaleTextureCache.set(species.id, scaleTex);
    }

    const bodyMat = new THREE.MeshPhysicalMaterial({
      map: scaleTex,
      roughness: 0.22,
      metalness: 0.28,
      clearcoat: 0.92,
      clearcoatRoughness: 0.14,
    });
    const finMat = new THREE.MeshStandardMaterial({
      color: species.finColorHex,
      roughness: 0.48,
      metalness: 0.12,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    ownedMaterials.push(bodyMat, finMat);

    if (clonedGlb) {
      clonedGlb.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.material = bodyMat;
        }
      });
      root.add(clonedGlb);
    } else {
      const fallbackGeo = new THREE.SphereGeometry(0.18, 16, 12);
      ownedGeometries.push(fallbackGeo);
      const fallbackBody = new THREE.Mesh(fallbackGeo, bodyMat);
      fallbackBody.scale.set(0.65, 1.0, 2.6);
      root.add(fallbackBody);
    }

    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.quadraticCurveTo(-0.08, 0.16, -0.24, 0.11);
    dorsalShape.lineTo(-0.2, 0);
    const dorsalGeo = new THREE.ShapeGeometry(dorsalShape);
    dorsalGeo.rotateY(Math.PI / 2);
    ownedGeometries.push(dorsalGeo);
    const dorsalFin = new THREE.Mesh(dorsalGeo, finMat);
    dorsalFin.position.set(0, 0.15, 0.08);
    root.add(dorsalFin);

    const pecGeo = new THREE.ConeGeometry(0.065, 0.18, 4);
    pecGeo.rotateX(-Math.PI / 2);
    ownedGeometries.push(pecGeo);
    const pectoralL = new THREE.Mesh(pecGeo, finMat);
    pectoralL.position.set(0.09, -0.06, 0.14);
    pectoralL.rotation.z = -0.6;
    const pectoralR = new THREE.Mesh(pecGeo, finMat);
    pectoralR.position.set(-0.09, -0.06, 0.14);
    pectoralR.rotation.z = 0.6;
    root.add(pectoralL, pectoralR);

    const tailPivot = new THREE.Group();
    tailPivot.name = 'TailPivot';
    tailPivot.position.set(0, 0, -0.45);

    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.24, 0.18);
    tailShape.lineTo(-0.15, 0);
    tailShape.lineTo(-0.24, -0.18);
    tailShape.closePath();
    const tailGeo = new THREE.ShapeGeometry(tailShape);
    tailGeo.rotateY(-Math.PI / 2);
    ownedGeometries.push(tailGeo);
    const tailMesh = new THREE.Mesh(tailGeo, finMat);
    tailPivot.add(tailMesh);
    root.add(tailPivot);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.08, metalness: 0.4 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.25 });
    const irisGeo = new THREE.SphereGeometry(0.024, 8, 8);
    const pupilGeo = new THREE.SphereGeometry(0.015, 8, 8);
    ownedMaterials.push(eyeMat, irisMat);
    ownedGeometries.push(irisGeo, pupilGeo);
    for (const side of [-1, 1]) {
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.set(side * 0.068, 0.04, 0.33);
      const pupil = new THREE.Mesh(pupilGeo, eyeMat);
      pupil.position.set(side * 0.078, 0.04, 0.34);
      root.add(iris, pupil);
    }

    const mixer = new THREE.AnimationMixer(root);
    const rollTrack = new THREE.NumberKeyframeTrack(
      '.rotation[z]',
      [0, 0.5, 1.0],
      [-0.04, 0.04, -0.04]
    );
    const clip = new THREE.AnimationClip('SwimUndulate', 1.0, [rollTrack]);
    mixer.clipAction(clip).play();

    this.fishGroup.add(root);
    rig = { root, tailPivot, pectoralL, pectoralR, mixer, ownedGeometries, ownedMaterials };
    this.fishRigs.set(fish.id, rig);
    return rig;
  }

  update(
    dt: number,
    elapsed: number,
    session: FishingSession,
    loadout: ActiveEquipmentLoadout,
    spoolAngleRad: number,
    fishes: IterableIterator<FishController>,
    dockTip: { x: number; y: number; z: number }
  ): void {
    const state = session.getState();

    // Update equipment visual colors
    this.rodBlankMat.color.setHex(loadout.rod.primaryColorHex);
    this.reelSpoolMat.color.setHex(loadout.reel.accentColorHex);
    this.bobberCapMat.color.setHex(loadout.bait.bobberColorHex);
    this.bobberCapMat.emissive.setHex(loadout.bait.bobberColorHex);

    // Spin reel rotor & crank handle
    this.reelRotorGroup.rotation.z = spoolAngleRad;
    this.reelHandleGroup.rotation.x = spoolAngleRad;

    // Determine rod orientation & progressive bend (including Left Joystick pull & pump)
    const pullYawOffset = session.rodPullX * 0.34;
    const pullPumpPitch = session.rodPullY * 0.24;
    const aimRad = THREE.MathUtils.degToRad(session.aimAngleDeg) + pullYawOffset;
    const castBackAngle = session.isChargingCast ? session.castPower * 0.48 : 0;
    const fightPumpPitch =
      state === FishingState.FIGHTING || state === FishingState.REELING ? 0.68 : 0.46;
    const elevationPitch = THREE.MathUtils.clamp(
      fightPumpPitch + castBackAngle + pullPumpPitch,
      0.18,
      1.26
    );

    const handleAssembly = (this as unknown as { handleAssembly?: THREE.Group }).handleAssembly;
    if (handleAssembly) {
      handleAssembly.position.set(
        this.buttWorldPos.x + Math.sin(aimRad) * 0.14 + session.rodPullX * 0.08,
        this.buttWorldPos.y + Math.max(-0.04, session.rodPullY * 0.06),
        this.buttWorldPos.z
      );
      handleAssembly.rotation.set(elevationPitch, -aimRad, -session.rodPullX * 0.16, 'YXZ');
    }

    RodPhysics.computeSegmentPositions(
      handleAssembly ? handleAssembly.position : this.buttWorldPos,
      aimRad,
      elevationPitch,
      loadout.rod.lengthM,
      loadout.rod.strengthRatingN,
      loadout.rod.flexibility,
      session.lineTensionN,
      session.bobberPosition,
      this.rodSegmentPoints
    );

    this.rodTipWorldPos.copy(this.rodSegmentPoints[this.rodSegmentPoints.length - 1]);

    // Orient 10 blank cylinders along computed curve
    let guideIdx = 0;
    for (let i = 0; i < this.rodSegmentMeshes.length; i++) {
      const p0 = this.rodSegmentPoints[i];
      const p1 = this.rodSegmentPoints[i + 1];
      _segMid.copy(p0).add(p1).multiplyScalar(0.5);
      _segDir.copy(p1).sub(p0);
      const len = _segDir.length();
      if (len > 0.0001) {
        _segDir.divideScalar(len);
        _segQuat.setFromUnitVectors(_upAxis, _segDir);
      }

      const mesh = this.rodSegmentMeshes[i];
      mesh.position.copy(_segMid);
      mesh.quaternion.copy(_segQuat);
      mesh.scale.set(1, len, 1);

      if (i >= 2 && (i % 2 === 0 || i === 9) && guideIdx < this.guideRingMeshes.length) {
        const ring = this.guideRingMeshes[guideIdx++];
        ring.position.copy(p1).addScaledVector(_upAxis, -0.014);
        ring.quaternion.copy(_segQuat);
      }
    }

    const isFightPhase =
      state === FishingState.HOOKED ||
      state === FishingState.FIGHTING ||
      state === FishingState.REELING;

    // Sync 3D Articulated Fish Rigs (or custom GLB fish) so we know exact hooked fish jaw world position
    let hasHookedMouth = false;
    const activeProceduralIds = new Set<string>();
    for (const fish of fishes) {
      const isTrophyPose =
        (state === FishingState.LANDED || state === FishingState.RESULT) &&
        fish.id === session.activeFishId;
      const headShake =
        isFightPhase && fish.id === session.activeFishId
          ? Math.sin(elapsed * 19.5) * (fish.brain.isBursting ? 0.14 : 0.06)
          : 0;
      const effectiveYaw = fish.headingYawRad + headShake;

      if (!isTrophyPose && isFightPhase && fish.id === session.activeFishId) {
        // Local nose/jaw is at +0.39 along fish forward axis
        const noseDist = 0.39 * fish.scaleFactor;
        const cosPitch = Math.cos(fish.pitchRad);
        const fwdX = Math.sin(effectiveYaw) * cosPitch;
        const fwdY = -Math.sin(fish.pitchRad);
        const fwdZ = Math.cos(effectiveYaw) * cosPitch;

        this.hookedMouthPos.set(
          fish.position.x + fwdX * noseDist,
          fish.position.y + fwdY * noseDist - 0.015 * fish.scaleFactor,
          fish.position.z + fwdZ * noseDist
        );
        hasHookedMouth = true;

        // Emit underwater cavitation & gill bubbles as the fish sprints
        const speed = Math.hypot(fish.velocity.x, fish.velocity.z);
        this.bubbleSpawnAcc += dt * (5.5 + speed * 5.2 + (fish.brain.isBursting ? 9 : 0));
        while (this.bubbleSpawnAcc >= 1) {
          this.bubbleSpawnAcc -= 1;
          const fromTail = Math.random() < 0.58;
          const offsetSign = fromTail ? -0.52 * fish.scaleFactor : noseDist;
          const bx = fish.position.x + fwdX * offsetSign + (Math.random() - 0.5) * 0.08;
          const by = fish.position.y + fwdY * offsetSign + (Math.random() - 0.5) * 0.06;
          const bz = fish.position.z + fwdZ * offsetSign + (Math.random() - 0.5) * 0.08;
          if (by < -0.08) {
            this.spawnUnderwaterBubble(bx, by, bz, 0.65 + Math.random() * 0.85);
          }
        }
      }

      // Custom per-species GLB model path (no duplicate procedural rig)
      if (fish.isGlbModel && fish.mesh) {
        const yawOffset = fish.species.modelYawOffset ?? 0;
        const yOffset = fish.species.modelYOffset ?? 0;
        const baseScale = fish.scaleFactor * (fish.species.modelScale ?? 1);
        const proceduralSway = fish.swimAction ? 0 : Math.sin(fish.tailPhase) * 0.09;
        if (isTrophyPose) {
          fish.mesh.position.set(
            dockTip.x,
            dockTip.y + 0.96 + Math.sin(elapsed * 2) * 0.03,
            dockTip.z - 1.15
          );
          fish.mesh.rotation.set(
            0.06,
            Math.PI * 0.5 + yawOffset + Math.sin(elapsed * 0.85) * 0.38,
            0,
            'YXZ'
          );
          fish.mesh.scale.setScalar(baseScale * 1.12);
        } else {
          fish.mesh.position.set(fish.position.x, fish.position.y + yOffset, fish.position.z);
          fish.mesh.rotation.set(
            fish.pitchRad,
            effectiveYaw + yawOffset + proceduralSway,
            proceduralSway * 0.45,
            'YXZ'
          );
          fish.mesh.scale.setScalar(baseScale);
        }
        continue;
      }

      activeProceduralIds.add(fish.id);
      const rig = this.getOrCreateFishRig(fish);

      if (isTrophyPose) {
        rig.root.position.set(
          dockTip.x,
          dockTip.y + 0.96 + Math.sin(elapsed * 2) * 0.03,
          dockTip.z - 1.15
        );
        rig.root.rotation.set(0.06, Math.PI * 0.5 + Math.sin(elapsed * 0.85) * 0.38, 0);
        rig.root.scale.setScalar(fish.scaleFactor * 1.12);
      } else {
        rig.root.position.copy(fish.position);
        rig.root.rotation.set(fish.pitchRad, effectiveYaw, 0, 'YXZ');
        rig.root.scale.setScalar(fish.scaleFactor);
      }

      if (rig.tailPivot && rig.pectoralL && rig.pectoralR) {
        const tailSwing =
          Math.sin(fish.tailPhase) *
          (isFightPhase && fish.id === session.activeFishId ? 0.48 : 0.36);
        rig.tailPivot.rotation.y = tailSwing;
        rig.pectoralL.rotation.y = Math.sin(fish.tailPhase * 0.5) * 0.24;
        rig.pectoralR.rotation.y = -Math.sin(fish.tailPhase * 0.5) * 0.24;
      }
      rig.mixer.update(dt * (0.6 + fish.tailFrequencyHz * 0.25));
    }

    // Clean up despawned fish rigs & free GPU buffers without touching shared GLB/scale textures
    for (const [id, rig] of this.fishRigs.entries()) {
      if (!activeProceduralIds.has(id)) {
        rig.mixer.stopAllAction();
        rig.mixer.uncacheRoot(rig.root);
        for (const geo of rig.ownedGeometries) geo.dispose();
        for (const mat of rig.ownedMaterials) mat.dispose();
        this.fishGroup.remove(rig.root);
        this.fishRigs.delete(id);
      }
    }

    // Advance pooled underwater bubbles
    for (const b of this.bubbles) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.maxAge || b.mesh.position.y >= -0.03) {
        b.active = false;
        b.mesh.visible = false;
        continue;
      }
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
    }

    // Update 24-segment catenary fishing line
    const tensionRatio =
      loadout.line.breakStrengthN > 0 ? session.lineTensionN / loadout.line.breakStrengthN : 0;
    const sagAmount = Math.max(0, (1 - Math.min(1, tensionRatio * 2.4)) * 0.42);

    if (tensionRatio > 0.85) {
      this.lineMaterial.color.setHex(0xf87171);
    } else if (tensionRatio > 0.55) {
      this.lineMaterial.color.setHex(0xfbbf24);
    } else {
      this.lineMaterial.color.setHex(0xe2e8f0);
    }

    const lineEnd =
      state === FishingState.LINE_BROKEN
        ? _linePoint.set(
            this.rodTipWorldPos.x,
            this.rodTipWorldPos.y - 1.35,
            this.rodTipWorldPos.z - 0.4
          )
        : hasHookedMouth
        ? this.hookedMouthPos
        : session.bobberPosition;

    const vertices = 24;
    for (let i = 0; i < vertices; i++) {
      const t = i / (vertices - 1);
      const parabola = 4 * t * (1 - t);
      const x = THREE.MathUtils.lerp(this.rodTipWorldPos.x, lineEnd.x, t);
      const y = THREE.MathUtils.lerp(this.rodTipWorldPos.y, lineEnd.y, t) - parabola * sagAmount;
      const z = THREE.MathUtils.lerp(this.rodTipWorldPos.z, lineEnd.z, t);
      this.linePositions[i * 3] = x;
      this.linePositions[i * 3 + 1] = y;
      this.linePositions[i * 3 + 2] = z;
    }
    (this.lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Update Bobber visibility & position (during underwater fight, float sits 1.15m up the leader line)
    const hideBobber =
      state === FishingState.LANDED ||
      state === FishingState.RESULT ||
      state === FishingState.LINE_BROKEN;
    this.bobberGroup.visible = !hideBobber;
    if (!hideBobber) {
      if (hasHookedMouth) {
        const totalLineLen = Math.max(1.5, this.rodTipWorldPos.distanceTo(this.hookedMouthPos));
        const leaderFraction = Math.min(0.45, 1.15 / totalLineLen);
        this.bobberGroup.position.lerpVectors(this.hookedMouthPos, this.rodTipWorldPos, leaderFraction);
        this.bobberGroup.rotation.z = Math.sin(elapsed * 8.5) * 0.18;
      } else {
        this.bobberGroup.position.copy(session.bobberPosition);
        this.bobberGroup.rotation.z = Math.sin(elapsed * 2.5) * 0.08;
      }
    }
  }

  dispose(): void {
    for (const rig of this.fishRigs.values()) {
      rig.mixer.stopAllAction();
      rig.mixer.uncacheRoot(rig.root);
      for (const geo of rig.ownedGeometries) geo.dispose();
      for (const mat of rig.ownedMaterials) mat.dispose();
      this.fishGroup.remove(rig.root);
    }
    this.fishRigs.clear();
    for (const tex of this.scaleTextureCache.values()) {
      tex.dispose();
    }
    this.scaleTextureCache.clear();
  }
}
