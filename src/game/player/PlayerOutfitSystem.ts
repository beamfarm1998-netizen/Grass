// src/game/player/PlayerOutfitSystem.ts
import * as THREE from 'three';
import {
  DEFAULT_PLAYER_OUTFIT,
  FARMER_CHARACTERS,
  type AccessoryStyleId,
  type FarmerGender,
  type HatStyleId,
  type OutfitPartKey,
  type PartStyleConfig,
  type PlayerOutfitConfig,
} from '../../types/game';
import {
  hydrateOutfitTexturesFromIdb,
  packOutfitForStorage,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  unpackOutfitFromStorageSync,
} from '../../utils/farmAutoSave';
import { isSaveSuppressed } from '../../utils/saveReset';
import type { ProceduralFarmerRig } from './PlayerMesh';

export const PLAYER_OUTFIT_STORAGE_KEY = 'beam_farm_player_outfit_v1';

let _whiteFallbackTex: THREE.DataTexture | null = null;
function getWhiteFallbackTexture(): THREE.DataTexture {
  if (!_whiteFallbackTex) {
    const data = new Uint8Array([255, 255, 255, 255]);
    _whiteFallbackTex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    _whiteFallbackTex.colorSpace = THREE.SRGBColorSpace;
    _whiteFallbackTex.needsUpdate = true;
  }
  return _whiteFallbackTex;
}

export function loadSavedPlayerOutfit(): PlayerOutfitConfig {
  try {
    const raw = safeGetLocalStorageItem(PLAYER_OUTFIT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_OUTFIT, parts: {} };
    const parsed = JSON.parse(raw) as Partial<PlayerOutfitConfig>;
    const normalized: PlayerOutfitConfig = {
      hatStyle: parsed.hatStyle ?? DEFAULT_PLAYER_OUTFIT.hatStyle,
      accessoryStyle: parsed.accessoryStyle ?? DEFAULT_PLAYER_OUTFIT.accessoryStyle,
      parts: parsed.parts && typeof parsed.parts === 'object' ? parsed.parts : {},
    };
    return unpackOutfitFromStorageSync(normalized).config;
  } catch {
    return { ...DEFAULT_PLAYER_OUTFIT, parts: {} };
  }
}

export async function hydrateSavedPlayerOutfitIfNeeded(): Promise<PlayerOutfitConfig | null> {
  try {
    const raw = safeGetLocalStorageItem(PLAYER_OUTFIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerOutfitConfig>;
    const normalized: PlayerOutfitConfig = {
      hatStyle: parsed.hatStyle ?? DEFAULT_PLAYER_OUTFIT.hatStyle,
      accessoryStyle: parsed.accessoryStyle ?? DEFAULT_PLAYER_OUTFIT.accessoryStyle,
      parts: parsed.parts && typeof parsed.parts === 'object' ? parsed.parts : {},
    };
    const syncRes = unpackOutfitFromStorageSync(normalized);
    if (!syncRes.needsAsyncHydration) return null;
    return await hydrateOutfitTexturesFromIdb(normalized);
  } catch {
    return null;
  }
}

export function savePlayerOutfit(config: PlayerOutfitConfig): void {
  if (isSaveSuppressed()) return;
  const packed = packOutfitForStorage(config);
  safeSetLocalStorageItem(PLAYER_OUTFIT_STORAGE_KEY, JSON.stringify(packed));
}

interface OutfitShaderUniforms {
  uOutfitBindMin: { value: THREE.Vector3 };
  uOutfitBindSize: { value: THREE.Vector3 };
  uBoneOutfitCat: { value: Float32Array };
  uHasNamedBones: { value: number };
  uShirtMode: { value: number };
  uShirtColor: { value: THREE.Color };
  uShirtRepeat: { value: number };
  uShirtTex: { value: THREE.Texture };
  uBottomMode: { value: number };
  uBottomColor: { value: THREE.Color };
  uBottomRepeat: { value: number };
  uBottomTex: { value: THREE.Texture };
  uShoesMode: { value: number };
  uShoesColor: { value: THREE.Color };
  uShoesRepeat: { value: number };
  uShoesTex: { value: THREE.Texture };
}

interface GlbAttachmentRig {
  wrapper: THREE.Group;
  gender: FarmerGender;
  hatAnchor: THREE.Group;
  accessoryAnchor: THREE.Group;
  hatMat: THREE.MeshStandardMaterial;
  hatAccentMat: THREE.MeshStandardMaterial;
  accessoryMat: THREE.MeshStandardMaterial;
  currentHatStyle: HatStyleId | null;
  currentAccessoryStyle: AccessoryStyleId | null;
  shaderUniformsList: OutfitShaderUniforms[];
  clonedMaterials: THREE.Material[];
}

function classifyBoneForOutfit(boneName: string): number {
  const n = boneName.toLowerCase();
  if (/head|neck|jaw|eye|hair|ear|brow|lowerarm|forearm|hand|finger|thumb|index|middle|ring|pinky|wrist/.test(n)) {
    return 0;
  }
  if (/foot|toe|ankle|heel|boot|shoe/.test(n)) {
    return 3;
  }
  if (/hips|pelvis|upperleg|lowerleg|thigh|calf|shin|knee|leg/.test(n)) {
    return 2;
  }
  if (/spine|chest|torso|rib|shoulder|clavicle|upperarm|arm/.test(n)) {
    return 1;
  }
  return 0;
}

function populateHatGeometry(
  group: THREE.Group,
  style: HatStyleId,
  mainMat: THREE.MeshStandardMaterial,
  accentMat: THREE.MeshStandardMaterial
): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).geometry?.dispose();
    }
  }
  if (style === 'none') {
    group.visible = false;
    return;
  }
  group.visible = true;

  if (style === 'straw') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.31, 0.024, 20), mainMat);
    brim.castShadow = true;
    group.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.13, 18), mainMat);
    crown.position.y = 0.072;
    crown.castShadow = true;
    group.add(crown);

    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.164, 0.036, 18), accentMat);
    ribbon.position.y = 0.028;
    group.add(ribbon);
  } else if (style === 'cap') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mainMat
    );
    dome.position.y = -0.01;
    dome.castShadow = true;
    group.add(dome);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.16), mainMat);
    visor.position.set(0, 0.005, 0.14);
    visor.rotation.x = 0.14;
    visor.castShadow = true;
    group.add(visor);

    const topBtn = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), accentMat);
    topBtn.position.y = 0.145;
    group.add(topBtn);
  } else if (style === 'cowboy') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.30, 0.022, 20), mainMat);
    brim.scale.set(0.92, 1, 1.08);
    brim.castShadow = true;
    group.add(brim);

    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.42), mainMat);
      wing.position.set(s * 0.23, 0.024, 0);
      wing.rotation.z = -s * 0.42;
      group.add(wing);
    }

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.155, 0.15, 16), mainMat);
    crown.position.y = 0.08;
    crown.scale.set(0.92, 1, 1.12);
    crown.castShadow = true;
    group.add(crown);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.157, 0.159, 0.03, 16), accentMat);
    band.position.y = 0.024;
    band.scale.set(0.93, 1, 1.13);
    group.add(band);
  } else if (style === 'bucket') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.065, 20), mainMat);
    brim.position.y = 0.01;
    brim.castShadow = true;
    group.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.17, 0.11, 20), mainMat);
    crown.position.y = 0.085;
    crown.castShadow = true;
    group.add(crown);

    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.171, 0.173, 0.025, 20), accentMat);
    stripe.position.y = 0.045;
    group.add(stripe);
  } else if (style === 'crown') {
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.75 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 8, 20), vineMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.036, 8, 8),
        i % 2 === 0 ? mainMat : accentMat
      );
      flower.position.set(Math.cos(ang) * 0.16, 0.026, Math.sin(ang) * 0.16);
      group.add(flower);
    }
  }

  group.traverse((o) => {
    o.userData.isOutfitAttachment = true;
  });
}

function populateAccessoryGeometry(
  group: THREE.Group,
  style: AccessoryStyleId,
  mainMat: THREE.MeshStandardMaterial
): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).geometry?.dispose();
    }
  }
  if (style === 'none') {
    group.visible = false;
    return;
  }
  group.visible = true;

  if (style === 'bandana') {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.028, 8, 18), mainMat);
    collar.rotation.x = Math.PI / 2 + 0.15;
    collar.position.set(0, 0.16, 0.01);
    collar.castShadow = true;
    group.add(collar);

    const triangle = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.16, 4), mainMat);
    triangle.rotation.x = Math.PI;
    triangle.rotation.y = Math.PI / 4;
    triangle.scale.set(1.1, 1.0, 0.35);
    triangle.position.set(0, 0.09, 0.135);
    triangle.castShadow = true;
    group.add(triangle);
  } else if (style === 'apron') {
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.25, 0.025), mainMat);
    bib.position.set(0, 0.03, 0.145);
    bib.castShadow = true;
    group.add(bib);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.28, 0.028), mainMat);
    skirt.position.set(0, -0.22, 0.148);
    skirt.castShadow = true;
    group.add(skirt);

    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.014, 6, 16), mainMat);
    strap.rotation.x = Math.PI / 2 + 0.35;
    strap.position.set(0, 0.16, 0.04);
    group.add(strap);
  } else if (style === 'cape') {
    const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 18), mainMat);
    clasp.rotation.x = Math.PI / 2 + 0.1;
    clasp.position.set(0, 0.15, 0);
    group.add(clasp);

    const capePanel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.56, 0.024), mainMat);
    capePanel.position.set(0, -0.11, -0.15);
    capePanel.rotation.x = 0.16;
    capePanel.castShadow = true;
    group.add(capePanel);
  } else if (style === 'backpack') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.15), mainMat);
    pack.position.set(0, 0.0, -0.18);
    pack.castShadow = true;
    group.add(pack);

    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.09, 0.16), mainMat);
    flap.position.set(0, 0.13, -0.18);
    group.add(flap);

    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.28, 0.18), mainMat);
      strap.position.set(s * 0.095, 0.03, -0.02);
      group.add(strap);
    }
  }

  group.traverse((o) => {
    o.userData.isOutfitAttachment = true;
  });
}

export class PlayerOutfitController {
  private currentConfig: PlayerOutfitConfig = loadSavedPlayerOutfit();
  private proceduralRig: ProceduralFarmerRig;
  private proceduralHatAnchor = new THREE.Group();
  private proceduralAccessoryAnchor = new THREE.Group();
  private procHatMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.82 });
  private procHatAccentMat = new THREE.MeshStandardMaterial({ color: 0x9b1d20, roughness: 0.65 });
  private procAccessoryMat = new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.78 });
  private procHatStyle: HatStyleId | null = null;
  private procAccessoryStyle: AccessoryStyleId | null = null;

  private glbRigs = new Map<FarmerGender, GlbAttachmentRig>();
  private loadedTextures = new Map<OutfitPartKey, { url: string; tex: THREE.Texture }>();
  private loadSeq = new Map<OutfitPartKey, number>();
  private isDisposed = false;

  constructor(proceduralRig: ProceduralFarmerRig) {
    this.proceduralRig = proceduralRig;

    this.proceduralHatAnchor.position.set(0, 0.35, 0.01);
    this.proceduralHatAnchor.rotation.x = -0.06;
    this.proceduralHatAnchor.scale.setScalar(1.65);
    this.proceduralRig.headGroup.add(this.proceduralHatAnchor);

    this.proceduralAccessoryAnchor.position.set(0, 0.17, 0);
    this.proceduralAccessoryAnchor.scale.setScalar(1.22);
    this.proceduralRig.chest.add(this.proceduralAccessoryAnchor);

    // Hide built-in procedural straw hat because proceduralHatAnchor renders all hat styles dynamically
    if (this.proceduralRig.hatGroup) {
      this.proceduralRig.hatGroup.visible = false;
    }

    this.applyCurrentConfigToAll();
  }

  public getConfig(): PlayerOutfitConfig {
    return this.currentConfig;
  }

  public registerGlbInstance(wrapper: THREE.Group, gender: FarmerGender): void {
    const prev = this.glbRigs.get(gender);
    if (prev) {
      prev.clonedMaterials.forEach((m) => m.dispose());
      this.glbRigs.delete(gender);
    }

    // Temporarily evaluate transforms with wrapper at local origin
    const savedVis = wrapper.visible;
    wrapper.visible = true;
    wrapper.updateMatrixWorld(true);
    const invWrapperWorld = wrapper.matrixWorld.clone().invert();

    let headBone: THREE.Object3D | null = null;
    let chestBone: THREE.Object3D | null = null;

    wrapper.traverse((obj) => {
      if (obj instanceof THREE.Bone) {
        const nl = obj.name.toLowerCase();
        if (!headBone && nl.includes('head') && !nl.includes('end') && !nl.includes('top')) {
          headBone = obj;
        }
        if (!chestBone && (nl.includes('chest') || nl === 'spine2' || nl === 'spine_02')) {
          chestBone = obj;
        }
      }
    });
    if (!chestBone) {
      wrapper.traverse((obj) => {
        if (!chestBone && obj instanceof THREE.Bone && obj.name.toLowerCase().includes('spine')) {
          chestBone = obj;
        }
      });
    }

    const hatMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.82 });
    const hatAccentMat = new THREE.MeshStandardMaterial({ color: 0x9b1d20, roughness: 0.65 });
    const accessoryMat = new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.78 });

    const hatAnchor = new THREE.Group();
    hatAnchor.name = `OutfitHatAnchor_${gender}`;
    const targetHeight = FARMER_CHARACTERS[gender].height;

    if (headBone) {
      const hb = headBone as THREE.Object3D;
      const boneWorldPos = new THREE.Vector3();
      const boneWorldScale = new THREE.Vector3();
      hb.getWorldPosition(boneWorldPos);
      boneWorldPos.applyMatrix4(invWrapperWorld);
      hb.getWorldScale(boneWorldScale);
      const wrapperWorldScale = new THREE.Vector3();
      wrapper.getWorldScale(wrapperWorldScale);
      const localMeterScale = wrapperWorldScale.y / Math.max(0.0001, boneWorldScale.y);
      const crownMeters = Math.max(0.11, (targetHeight - boneWorldPos.y) * 0.76);
      hatAnchor.scale.setScalar(localMeterScale);
      hatAnchor.position.set(0, crownMeters * localMeterScale, 0.01 * localMeterScale);
      hb.add(hatAnchor);
    } else {
      hatAnchor.position.set(0, targetHeight - 0.12, 0.01);
      wrapper.add(hatAnchor);
    }

    const accessoryAnchor = new THREE.Group();
    accessoryAnchor.name = `OutfitAccessoryAnchor_${gender}`;
    if (chestBone) {
      const cb = chestBone as THREE.Object3D;
      const boneWorldScale = new THREE.Vector3();
      cb.getWorldScale(boneWorldScale);
      const wrapperWorldScale = new THREE.Vector3();
      wrapper.getWorldScale(wrapperWorldScale);
      const localMeterScale = wrapperWorldScale.y / Math.max(0.0001, boneWorldScale.y);
      accessoryAnchor.scale.setScalar(localMeterScale);
      accessoryAnchor.position.set(0, 0.04 * localMeterScale, 0);
      cb.add(accessoryAnchor);
    } else {
      accessoryAnchor.position.set(0, targetHeight * 0.64, 0);
      wrapper.add(accessoryAnchor);
    }

    // Compute overall bind-pose bounding box across character meshes
    const overallBindBox = new THREE.Box3();
    const characterMeshes: THREE.Mesh[] = [];
    wrapper.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      let p: THREE.Object3D | null = mesh;
      while (p && p !== wrapper) {
        if (
          p.userData?.isOutfitAttachment ||
          p.name === 'ManToolHolder' ||
          p.name === 'WomanToolHolder'
        ) {
          return;
        }
        p = p.parent;
      }
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) {
        overallBindBox.union(mesh.geometry.boundingBox);
      }
      characterMeshes.push(mesh);
    });

    if (overallBindBox.isEmpty()) {
      overallBindBox.set(new THREE.Vector3(-0.4, 0, -0.3), new THREE.Vector3(0.4, 1.75, 0.3));
    }
    const bindMin = overallBindBox.min.clone();
    const bindSize = new THREE.Vector3();
    overallBindBox.getSize(bindSize);
    bindSize.max(new THREE.Vector3(0.05, 0.05, 0.05));

    const shaderUniformsList: OutfitShaderUniforms[] = [];
    const clonedMaterials: THREE.Material[] = [hatMat, hatAccentMat, accessoryMat];

    for (const mesh of characterMeshes) {
      const boneCat = new Float32Array(64);
      let matchedCount = 0;
      const skinned = mesh as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh && skinned.skeleton?.bones) {
        const bones = skinned.skeleton.bones;
        const limit = Math.min(64, bones.length);
        for (let i = 0; i < limit; i++) {
          const cat = classifyBoneForOutfit(bones[i].name || '');
          boneCat[i] = cat;
          if (cat > 0) matchedCount++;
        }
      }

      const wrapMat = (srcMat: THREE.Material): THREE.MeshStandardMaterial => {
        let stdMat: THREE.MeshStandardMaterial;
        if (srcMat instanceof THREE.MeshStandardMaterial) {
          stdMat = srcMat.clone();
        } else {
          const anyMat = srcMat as THREE.MeshLambertMaterial;
          stdMat = new THREE.MeshStandardMaterial({
            map: anyMat.map ?? null,
            color: anyMat.color ? anyMat.color.clone() : new THREE.Color(0xffffff),
            roughness: 0.78,
            metalness: 0.04,
          });
        }

        const uniforms: OutfitShaderUniforms = {
          uOutfitBindMin: { value: bindMin.clone() },
          uOutfitBindSize: { value: bindSize.clone() },
          uBoneOutfitCat: { value: boneCat },
          uHasNamedBones: { value: matchedCount >= 3 ? 1.0 : 0.0 },
          uShirtMode: { value: 0 },
          uShirtColor: { value: new THREE.Color(0xffffff) },
          uShirtRepeat: { value: 1 },
          uShirtTex: { value: getWhiteFallbackTexture() },
          uBottomMode: { value: 0 },
          uBottomColor: { value: new THREE.Color(0xffffff) },
          uBottomRepeat: { value: 1 },
          uBottomTex: { value: getWhiteFallbackTexture() },
          uShoesMode: { value: 0 },
          uShoesColor: { value: new THREE.Color(0xffffff) },
          uShoesRepeat: { value: 1 },
          uShoesTex: { value: getWhiteFallbackTexture() },
        };

        stdMat.customProgramCacheKey = () => 'farmer_outfit_skinned_v1';
        stdMat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms);

          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
uniform vec3 uOutfitBindMin;
uniform vec3 uOutfitBindSize;
uniform float uBoneOutfitCat[64];
uniform float uHasNamedBones;
varying vec2 vOutfitClothUv;
varying vec3 vOutfitWeights;
`
          );

          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
vec3 outfitRel = clamp((position - uOutfitBindMin) / uOutfitBindSize, 0.0, 1.0);
vOutfitClothUv = vec2(outfitRel.x * 2.0, outfitRel.y * 3.0);
vec3 ow = vec3(0.0);
#ifdef USE_SKINNING
if (uHasNamedBones > 0.5) {
  int bi0 = clamp(int(skinIndex.x), 0, 63);
  int bi1 = clamp(int(skinIndex.y), 0, 63);
  int bi2 = clamp(int(skinIndex.z), 0, 63);
  int bi3 = clamp(int(skinIndex.w), 0, 63);
  float c0 = uBoneOutfitCat[bi0];
  float c1 = uBoneOutfitCat[bi1];
  float c2 = uBoneOutfitCat[bi2];
  float c3 = uBoneOutfitCat[bi3];
  if (abs(c0 - 1.0) < 0.2) ow.x += skinWeight.x;
  else if (abs(c0 - 2.0) < 0.2) ow.y += skinWeight.x;
  else if (abs(c0 - 3.0) < 0.2) ow.z += skinWeight.x;
  if (abs(c1 - 1.0) < 0.2) ow.x += skinWeight.y;
  else if (abs(c1 - 2.0) < 0.2) ow.y += skinWeight.y;
  else if (abs(c1 - 3.0) < 0.2) ow.z += skinWeight.y;
  if (abs(c2 - 1.0) < 0.2) ow.x += skinWeight.z;
  else if (abs(c2 - 2.0) < 0.2) ow.y += skinWeight.z;
  else if (abs(c2 - 3.0) < 0.2) ow.z += skinWeight.z;
  if (abs(c3 - 1.0) < 0.2) ow.x += skinWeight.w;
  else if (abs(c3 - 2.0) < 0.2) ow.y += skinWeight.w;
  else if (abs(c3 - 3.0) < 0.2) ow.z += skinWeight.w;
} else {
  if (outfitRel.y < 0.13) ow.z = 1.0;
  else if (outfitRel.y < 0.50) ow.y = 1.0;
  else if (outfitRel.y < 0.78 && abs(outfitRel.x - 0.5) < 0.34) ow.x = 1.0;
}
#else
if (outfitRel.y < 0.13) ow.z = 1.0;
else if (outfitRel.y < 0.50) ow.y = 1.0;
else if (outfitRel.y < 0.78 && abs(outfitRel.x - 0.5) < 0.34) ow.x = 1.0;
#endif
vOutfitWeights = clamp(ow, 0.0, 1.0);
`
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
uniform int uShirtMode;
uniform vec3 uShirtColor;
uniform float uShirtRepeat;
uniform sampler2D uShirtTex;
uniform int uBottomMode;
uniform vec3 uBottomColor;
uniform float uBottomRepeat;
uniform sampler2D uBottomTex;
uniform int uShoesMode;
uniform vec3 uShoesColor;
uniform float uShoesRepeat;
uniform sampler2D uShoesTex;
varying vec2 vOutfitClothUv;
varying vec3 vOutfitWeights;
`
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
{
  float lum = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.18, 1.0);
  float shadeKeep = mix(1.0, lum * 1.38, 0.30);
  vec3 outfitRgb = diffuseColor.rgb;
  if (uShirtMode > 0 && vOutfitWeights.x > 0.05) {
    vec3 targetRgb = uShirtColor * shadeKeep;
    if (uShirtMode == 2) {
      vec4 tCol = texture2D(uShirtTex, vOutfitClothUv * uShirtRepeat);
      targetRgb = tCol.rgb * uShirtColor * mix(1.0, lum * 1.25, 0.22);
    }
    outfitRgb = mix(outfitRgb, targetRgb, smoothstep(0.15, 0.65, vOutfitWeights.x));
  }
  if (uBottomMode > 0 && vOutfitWeights.y > 0.05) {
    vec3 targetRgb = uBottomColor * shadeKeep;
    if (uBottomMode == 2) {
      vec4 tCol = texture2D(uBottomTex, vOutfitClothUv * uBottomRepeat);
      targetRgb = tCol.rgb * uBottomColor * mix(1.0, lum * 1.25, 0.22);
    }
    outfitRgb = mix(outfitRgb, targetRgb, smoothstep(0.15, 0.65, vOutfitWeights.y));
  }
  if (uShoesMode > 0 && vOutfitWeights.z > 0.05) {
    vec3 targetRgb = uShoesColor * shadeKeep;
    if (uShoesMode == 2) {
      vec4 tCol = texture2D(uShoesTex, vOutfitClothUv * uShoesRepeat);
      targetRgb = tCol.rgb * uShoesColor * mix(1.0, lum * 1.25, 0.22);
    }
    outfitRgb = mix(outfitRgb, targetRgb, smoothstep(0.15, 0.65, vOutfitWeights.z));
  }
  diffuseColor.rgb = outfitRgb;
}
`
          );
        };

        shaderUniformsList.push(uniforms);
        clonedMaterials.push(stdMat);
        return stdMat;
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => wrapMat(m));
      } else if (mesh.material) {
        mesh.material = wrapMat(mesh.material);
      }
    }

    wrapper.visible = savedVis;

    const rigEntry: GlbAttachmentRig = {
      wrapper,
      gender,
      hatAnchor,
      accessoryAnchor,
      hatMat,
      hatAccentMat,
      accessoryMat,
      currentHatStyle: null,
      currentAccessoryStyle: null,
      shaderUniformsList,
      clonedMaterials,
    };

    this.glbRigs.set(gender, rigEntry);
    this.syncSingleGlbRig(rigEntry);
  }

  public setOutfit(config: PlayerOutfitConfig, gender: FarmerGender = 'male'): void {
    this.currentConfig = config;
    this.ensurePartTexturesLoaded();
    this.applyProceduralOutfit(gender);
    this.glbRigs.forEach((rig) => this.syncSingleGlbRig(rig));
  }

  public syncGenderProcedural(gender: FarmerGender): void {
    this.applyProceduralOutfit(gender);
  }

  private ensurePartTexturesLoaded(): void {
    const parts: OutfitPartKey[] = ['hat', 'shirt', 'bottom', 'shoes', 'accessory'];
    for (const part of parts) {
      const style = this.currentConfig.parts[part];
      const url = style?.textureDataUrl?.trim() || '';
      const existing = this.loadedTextures.get(part);

      if (!url) {
        if (existing) {
          existing.tex.dispose();
          this.loadedTextures.delete(part);
        }
        continue;
      }

      const rep = Math.max(1, Math.min(8, style?.textureRepeat ?? 1));
      if (existing && existing.url === url) {
        existing.tex.repeat.set(rep, rep);
        existing.tex.needsUpdate = true;
        continue;
      }

      const seq = (this.loadSeq.get(part) ?? 0) + 1;
      this.loadSeq.set(part, seq);

      new THREE.TextureLoader().load(
        url,
        (tex) => {
          if (this.isDisposed || this.loadSeq.get(part) !== seq) {
            tex.dispose();
            return;
          }
          const latestRep = Math.max(
            1,
            Math.min(8, this.currentConfig.parts[part]?.textureRepeat ?? 1)
          );
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(latestRep, latestRep);
          tex.anisotropy = 4;
          tex.needsUpdate = true;

          const prev = this.loadedTextures.get(part);
          if (prev) prev.tex.dispose();
          this.loadedTextures.set(part, { url, tex });

          this.applyCurrentConfigToAll();
        },
        undefined,
        () => {}
      );
    }
  }

  private applyMatStyle(
    mat: THREE.MeshStandardMaterial,
    style: PartStyleConfig | undefined,
    part: OutfitPartKey,
    defaultHex: number
  ): void {
    const texEntry = this.loadedTextures.get(part);
    const hasTex = Boolean(style?.textureDataUrl && texEntry);

    if (hasTex && texEntry) {
      mat.map = texEntry.tex;
      if (style?.color) {
        mat.color.set(style.color);
      } else {
        mat.color.setHex(0xffffff);
      }
    } else {
      mat.map = null;
      if (style?.color) {
        mat.color.set(style.color);
      } else {
        mat.color.setHex(defaultHex);
      }
    }
    mat.needsUpdate = true;
  }

  private applyProceduralOutfit(gender: FarmerGender): void {
    const cfg = this.currentConfig;
    const isFemale = gender === 'female' || gender === 'girl';

    if (this.procHatStyle !== cfg.hatStyle) {
      populateHatGeometry(
        this.proceduralHatAnchor,
        cfg.hatStyle,
        this.procHatMat,
        this.procHatAccentMat
      );
      this.procHatStyle = cfg.hatStyle;
    }

    if (this.procAccessoryStyle !== cfg.accessoryStyle) {
      populateAccessoryGeometry(
        this.proceduralAccessoryAnchor,
        cfg.accessoryStyle,
        this.procAccessoryMat
      );
      this.procAccessoryStyle = cfg.accessoryStyle;
    }

    this.applyMatStyle(this.procHatMat, cfg.parts.hat, 'hat', 0xf2c14e);
    this.procHatAccentMat.color.set(
      cfg.parts.accessory?.color || (isFemale ? '#ec4899' : '#9b1d20')
    );
    this.applyMatStyle(this.procAccessoryMat, cfg.parts.accessory, 'accessory', 0xd9483b);

    this.applyMatStyle(
      this.proceduralRig.shirtMat,
      cfg.parts.shirt,
      'shirt',
      isFemale ? 0xf472b6 : 0xdf382b
    );
    this.applyMatStyle(
      this.proceduralRig.overallsMat,
      cfg.parts.bottom,
      'bottom',
      isFemale ? 0x1d4ed8 : 0x245582
    );
    if (this.proceduralRig.bootMat) {
      this.applyMatStyle(this.proceduralRig.bootMat, cfg.parts.shoes, 'shoes', 0x3d271d);
    }
  }

  private syncSingleGlbRig(rig: GlbAttachmentRig): void {
    const cfg = this.currentConfig;

    if (rig.currentHatStyle !== cfg.hatStyle) {
      populateHatGeometry(rig.hatAnchor, cfg.hatStyle, rig.hatMat, rig.hatAccentMat);
      rig.currentHatStyle = cfg.hatStyle;
    }
    if (rig.currentAccessoryStyle !== cfg.accessoryStyle) {
      populateAccessoryGeometry(rig.accessoryAnchor, cfg.accessoryStyle, rig.accessoryMat);
      rig.currentAccessoryStyle = cfg.accessoryStyle;
    }

    this.applyMatStyle(rig.hatMat, cfg.parts.hat, 'hat', 0xf2c14e);
    rig.hatAccentMat.color.set(
      cfg.parts.accessory?.color || (rig.gender === 'female' || rig.gender === 'girl' ? '#ec4899' : '#9b1d20')
    );
    this.applyMatStyle(rig.accessoryMat, cfg.parts.accessory, 'accessory', 0xd9483b);

    const resolveShaderSlot = (part: 'shirt' | 'bottom' | 'shoes') => {
      const st = cfg.parts[part];
      const texEntry = this.loadedTextures.get(part);
      const hasTex = Boolean(st?.textureDataUrl && texEntry);
      const hasColor = Boolean(st?.color);
      const mode = hasTex ? 2 : hasColor ? 1 : 0;
      const color = new THREE.Color(st?.color || '#ffffff');
      const repeat = Math.max(1, Math.min(8, st?.textureRepeat ?? 1));
      const tex = hasTex && texEntry ? texEntry.tex : getWhiteFallbackTexture();
      return { mode, color, repeat, tex };
    };

    const shirt = resolveShaderSlot('shirt');
    const bottom = resolveShaderSlot('bottom');
    const shoes = resolveShaderSlot('shoes');

    for (const u of rig.shaderUniformsList) {
      u.uShirtMode.value = shirt.mode;
      u.uShirtColor.value.copy(shirt.color);
      u.uShirtRepeat.value = shirt.repeat;
      u.uShirtTex.value = shirt.tex;

      u.uBottomMode.value = bottom.mode;
      u.uBottomColor.value.copy(bottom.color);
      u.uBottomRepeat.value = bottom.repeat;
      u.uBottomTex.value = bottom.tex;

      u.uShoesMode.value = shoes.mode;
      u.uShoesColor.value.copy(shoes.color);
      u.uShoesRepeat.value = shoes.repeat;
      u.uShoesTex.value = shoes.tex;
    }
  }

  private applyCurrentConfigToAll(): void {
    this.applyProceduralOutfit('male');
    this.glbRigs.forEach((rig) => this.syncSingleGlbRig(rig));
  }

  public dispose(): void {
    this.isDisposed = true;
    this.loadedTextures.forEach(({ tex }) => tex.dispose());
    this.loadedTextures.clear();
    this.procHatMat.dispose();
    this.procHatAccentMat.dispose();
    this.procAccessoryMat.dispose();
    this.glbRigs.forEach((rig) => {
      rig.clonedMaterials.forEach((m) => m.dispose());
    });
    this.glbRigs.clear();
  }
}