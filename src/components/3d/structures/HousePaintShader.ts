// src/components/3d/structures/HousePaintShader.ts
import * as THREE from 'three';
import {
  HOUSE_DEFS,
  HOUSE_PART_KEYS,
  type HousePartKey,
  type PartStyleConfig,
  type PlacedHouse,
} from '../../../types/game';
import type { CoopMaterials } from './ChickenCoop';
import {
  buildPicketYardFence,
  HouseMeshBuilder,
  type HouseMaterials,
} from './HouseMeshBuilder';

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

export interface MultiPartHouseUniforms {
  uMeshToHouse: { value: THREE.Matrix4 };
  uHouseBoxMin: { value: THREE.Vector3 };
  uHouseBoxSize: { value: THREE.Vector3 };

  uRoofMode: { value: number };
  uRoofColor: { value: THREE.Color };
  uRoofRepeat: { value: number };
  uRoofTex: { value: THREE.Texture };

  uWallMode: { value: number };
  uWallColor: { value: THREE.Color };
  uWallRepeat: { value: number };
  uWallTex: { value: THREE.Texture };

  uFenceMode: { value: number };
  uFenceColor: { value: THREE.Color };
  uFenceRepeat: { value: number };
  uFenceTex: { value: THREE.Texture };

  uFloorMode: { value: number };
  uFloorColor: { value: THREE.Color };
  uFloorRepeat: { value: number };
  uFloorTex: { value: THREE.Texture };

  uChimneyMode: { value: number };
  uChimneyColor: { value: THREE.Color };
  uChimneyRepeat: { value: number };
  uChimneyTex: { value: THREE.Texture };
}

export interface HousePaintRuntimeState {
  appliedSignature?: string;
  addonSignature?: string;
  addonGroup?: THREE.Group;
  partTexUrls: Partial<Record<HousePartKey, string>>;
  partTexObjs: Partial<Record<HousePartKey, THREE.Texture>>;
  loadSeq: number;
  clonedMaterials: THREE.Material[];
  directPartBindings: Array<{
    part: HousePartKey;
    origMat: THREE.Material;
    clonedMat: THREE.MeshStandardMaterial;
  }>;
  multiPartUniforms: MultiPartHouseUniforms[];
  uvClonedGeos: THREE.BufferGeometry[];
  structureKey?: string;
}

export interface HousePaintContext {
  houseMaterials: HouseMaterials;
  coopMaterials: CoopMaterials;
  hitProxyMat: THREE.Material;
  paintedWoodTex: THREE.Texture;
  isDisposed: () => boolean;
  isEntryAlive: (houseId: string) => boolean;
}

const ADDON_ELIGIBLE_TYPES = new Set<number>([
  0, 1, 2, 3, 4, 8, 12, 15, 16, 17, 18, 20, 29,
]);

export function resolveEffectiveHouseParts(
  house: PlacedHouse
): Record<HousePartKey, PartStyleConfig> {
  const baseColor = house.customColor?.trim() || undefined;
  const baseTex = house.customTexture?.trim() || undefined;
  const baseRep = Math.max(1, Math.min(8, house.customTextureRepeat ?? 1));

  const out = {} as Record<HousePartKey, PartStyleConfig>;
  for (const part of HOUSE_PART_KEYS) {
    const sp = house.partStyles?.[part];
    const spCol = sp?.color?.trim() || undefined;
    const spTex = sp?.textureDataUrl?.trim() || undefined;
    if (spCol || spTex) {
      out[part] = {
        color: spCol,
        textureDataUrl: spTex,
        textureRepeat: Math.max(1, Math.min(8, sp?.textureRepeat ?? 1)),
      };
    } else {
      out[part] = {
        color: baseColor,
        textureDataUrl: baseTex,
        textureRepeat: baseRep,
      };
    }
  }
  return out;
}

export function hasAnyHouseCustomization(house: PlacedHouse): boolean {
  if (house.customColor?.trim() || house.customTexture?.trim()) return true;
  if (!house.partStyles) return false;
  for (const part of HOUSE_PART_KEYS) {
    const sp = house.partStyles[part];
    if (sp?.color?.trim() || sp?.textureDataUrl?.trim()) return true;
  }
  return false;
}

export function serializeHouseStyleSignature(house: PlacedHouse): string {
  const resolved = resolveEffectiveHouseParts(house);
  return HOUSE_PART_KEYS.map((k) => {
    const r = resolved[k];
    const texKey = r.textureDataUrl
      ? `${r.textureDataUrl.length}:${r.textureDataUrl.slice(-36)}:${r.textureRepeat ?? 1}`
      : '';
    return `${k}=${r.color ?? ''}|${texKey}`;
  }).join(';');
}

function computeStructureKey(
  resolved: Record<HousePartKey, PartStyleConfig>,
  addonSig: string
): string {
  const texMask = HOUSE_PART_KEYS.map((k) => (resolved[k].textureDataUrl ? '1' : '0')).join('');
  return `${texMask}|${addonSig}`;
}

function isExcludedObject(obj: THREE.Object3D, root: THREE.Object3D): boolean {
  if ((obj as THREE.SkinnedMesh).isSkinnedMesh) return true;
  let cur: THREE.Object3D | null = obj;
  while (cur && cur !== root) {
    const nm = cur.name || '';
    if (
      cur.userData?.isHitProxy ||
      cur.userData?.isCoopChicken ||
      cur.userData?.excludeFromPaint ||
      nm === 'CoopDucks' ||
      nm === 'DuckWadingPond' ||
      nm === 'BrewerySmokeStack' ||
      nm === 'OvenConveyorAndBasket' ||
      nm === 'OvenSmokeStack' ||
      nm === 'FeedMillParticles' ||
      nm === 'FeedAutoFloatGroup' ||
      nm === 'FishShopCelebrationGroup'
    ) {
      return true;
    }
    if (/flower|leaf|leaves|foliage|plant|tree_crown|window_glass|lamp_glow|glint/i.test(nm)) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function isExcludedMaterial(
  mat: THREE.Material,
  explicitPart: HousePartKey | undefined,
  ctx: HousePaintContext
): boolean {
  const m = ctx.houseMaterials;
  const cm = ctx.coopMaterials;
  if (
    mat === m.dirt ||
    mat === m.glass ||
    mat === cm.groundMat ||
    mat === cm.wireMat ||
    mat === cm.strawMat ||
    mat === cm.nailMat ||
    mat === ctx.hitProxyMat
  ) {
    return true;
  }
  // Allow stone on explicitly tagged chimneys & floors!
  if (mat === m.stone && explicitPart !== 'chimney' && explicitPart !== 'floor') {
    return true;
  }
  const mName = mat.name || '';
  if (/glass|glow|glint|flower|leaves|leaf|foliage|water/i.test(mName)) {
    return true;
  }
  if (mat.transparent && mat.opacity < 0.92) return true;
  const std = mat as THREE.MeshStandardMaterial;
  if (std.color && std.color.getHex() === 0xfefce8 && std.roughness === 0.35) {
    return true;
  }
  return false;
}

function inferExplicitPart(
  mesh: THREE.Mesh,
  mat: THREE.Material,
  houseType: number,
  ctx: HousePaintContext
): HousePartKey | undefined {
  const tagged = mesh.userData?.housePart as HousePartKey | undefined;
  if (tagged) return tagged;
  if (houseType === 19) return 'fence';

  const combinedName = `${mesh.name || ''} ${mesh.parent?.name || ''} ${mat.name || ''}`;
  if (/chimney|flue|smokestack|hearth/i.test(combinedName)) return 'chimney';
  if (/fence|railing|balustrade|paling|picket|gate|balcony/i.test(combinedName)) return 'fence';
  if (/roof|shingle|gable|thatch|canopy|awning/i.test(combinedName)) return 'roof';
  if (/floor|patio|porch|deck|plaza|platform|stairs|step/i.test(combinedName)) return 'floor';

  if (mat === ctx.houseMaterials.roofBrown || mat === ctx.houseMaterials.roofRed || mat === ctx.coopMaterials.roofMat) {
    return 'roof';
  }
  if (mat === ctx.houseMaterials.fence) {
    return 'fence';
  }
  return undefined;
}

function createBoxProjectedGeometry(srcGeo: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = srcGeo.clone();
  const pos = geo.attributes.position;
  if (!pos) return geo;

  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  const norm = geo.attributes.normal;
  geo.computeBoundingBox();
  const box =
    geo.boundingBox ?? new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const sx = Math.max(0.4, box.max.x - box.min.x);
  const sy = Math.max(0.4, box.max.y - box.min.y);
  const sz = Math.max(0.4, box.max.z - box.min.z);

  const uvArr = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ax = norm ? Math.abs(norm.getX(i)) : 0;
    const ay = norm ? Math.abs(norm.getY(i)) : 1;
    const az = norm ? Math.abs(norm.getZ(i)) : 0;

    let u = 0;
    let v = 0;
    if (ax >= ay && ax >= az) {
      u = (pz - box.min.z) / sz;
      v = (py - box.min.y) / sy;
    } else if (az >= ax && az >= ay) {
      u = (px - box.min.x) / sx;
      v = (py - box.min.y) / sy;
    } else {
      u = (px - box.min.x) / sx;
      v = (pz - box.min.z) / sz;
    }
    uvArr[i * 2] = u;
    uvArr[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  return geo;
}

function applyDirectStyleToMaterial(
  origMat: THREE.Material,
  cMat: THREE.MeshStandardMaterial,
  cfg: PartStyleConfig,
  tex: THREE.Texture | undefined,
  ctx: HousePaintContext
): void {
  const oMat = origMat as THREE.MeshStandardMaterial;
  if (!cMat.color) return;

  let targetColor: THREE.Color | null = null;
  let targetHsl: { h: number; s: number; l: number } | null = null;
  if (cfg.color) {
    try {
      const col = new THREE.Color(cfg.color);
      targetColor = col;
      targetHsl = { h: 0, s: 0, l: 0.5 };
      col.getHSL(targetHsl);
    } catch {
      targetColor = null;
    }
  }

  if (tex) {
    const rep = Math.max(1, Math.min(8, cfg.textureRepeat ?? 1));
    tex.repeat.set(rep, rep);
    cMat.map = tex;
    cMat.vertexColors = false;
    if (targetColor) {
      cMat.color.copy(targetColor);
    } else {
      cMat.color.setHex(0xffffff);
    }
    if (cMat.emissive) {
      cMat.emissive.setHex(0x000000);
      cMat.emissiveIntensity = 0;
    }
    cMat.roughness = Math.min(0.82, Math.max(0.42, oMat.roughness ?? 0.65));
    cMat.metalness = Math.min(0.18, oMat.metalness ?? 0.05);
    cMat.needsUpdate = true;
    return;
  }

  // Restore original map if no custom texture
  cMat.map = oMat.map ?? null;
  if (!targetColor || !targetHsl) {
    if (oMat.color) cMat.color.copy(oMat.color);
    if (cMat.emissive && oMat.emissive) {
      cMat.emissive.copy(oMat.emissive);
      cMat.emissiveIntensity = oMat.emissiveIntensity ?? 0;
    }
    cMat.needsUpdate = true;
    return;
  }

  const m = ctx.houseMaterials;
  if (
    origMat === m.wood ||
    origMat === m.woodLight ||
    origMat === m.fence ||
    origMat === m.stone
  ) {
    cMat.map = ctx.paintedWoodTex;
    cMat.color.copy(targetColor);
    cMat.needsUpdate = true;
    return;
  }
  if (
    origMat === m.woodDark ||
    origMat === m.log ||
    origMat === m.roofBrown ||
    origMat === m.roofRed
  ) {
    cMat.map = ctx.paintedWoodTex;
    cMat.color.setHSL(
      targetHsl.h,
      Math.min(1, targetHsl.s * 1.05),
      THREE.MathUtils.clamp(targetHsl.l - 0.1, 0.12, 0.88)
    );
    cMat.needsUpdate = true;
    return;
  }
  if (origMat === ctx.coopMaterials.woodLight) {
    cMat.color.copy(targetColor);
    return;
  }
  if (origMat === ctx.coopMaterials.woodDark || origMat === ctx.coopMaterials.roofMat) {
    cMat.color.setHSL(
      targetHsl.h,
      Math.min(1, targetHsl.s * 1.06),
      THREE.MathUtils.clamp(targetHsl.l - 0.12, 0.1, 0.85)
    );
    return;
  }
  if (oMat.map) {
    cMat.color.setHSL(
      targetHsl.h,
      targetHsl.s,
      THREE.MathUtils.clamp(Math.max(0.42, targetHsl.l * 1.08), 0.22, 0.96)
    );
    if (cMat.emissive && oMat.emissive && (oMat.emissiveIntensity ?? 0) < 0.45) {
      cMat.emissive.copy(targetColor);
      cMat.emissiveIntensity = 0.18;
    }
    return;
  }
  const origHsl = { h: 0, s: 0, l: 0.5 };
  if (oMat.color) oMat.color.getHSL(origHsl);
  const blendedL = THREE.MathUtils.clamp(targetHsl.l * 0.78 + origHsl.l * 0.22, 0.12, 0.94);
  cMat.color.setHSL(targetHsl.h, targetHsl.s, blendedL);
}

function updateMultiPartUniforms(
  u: MultiPartHouseUniforms,
  resolved: Record<HousePartKey, PartStyleConfig>,
  texObjs: Partial<Record<HousePartKey, THREE.Texture>>
): void {
  const fallback = getWhiteFallbackTexture();
  const applySlot = (
    part: HousePartKey,
    modeUniform: { value: number },
    colUniform: { value: THREE.Color },
    repUniform: { value: number },
    texUniform: { value: THREE.Texture }
  ) => {
    const cfg = resolved[part];
    const tex = cfg.textureDataUrl ? texObjs[part] : undefined;
    if (tex) {
      modeUniform.value = 2;
      texUniform.value = tex;
      repUniform.value = Math.max(1, Math.min(8, cfg.textureRepeat ?? 1));
      if (cfg.color) {
        try {
          colUniform.value.set(cfg.color);
        } catch {
          colUniform.value.setHex(0xffffff);
        }
      } else {
        colUniform.value.setHex(0xffffff);
      }
    } else if (cfg.color) {
      modeUniform.value = 1;
      texUniform.value = fallback;
      repUniform.value = 1;
      try {
        colUniform.value.set(cfg.color);
      } catch {
        modeUniform.value = 0;
      }
    } else {
      modeUniform.value = 0;
      texUniform.value = fallback;
      colUniform.value.setHex(0xffffff);
      repUniform.value = 1;
    }
  };

  applySlot('roof', u.uRoofMode, u.uRoofColor, u.uRoofRepeat, u.uRoofTex);
  applySlot('wall', u.uWallMode, u.uWallColor, u.uWallRepeat, u.uWallTex);
  applySlot('fence', u.uFenceMode, u.uFenceColor, u.uFenceRepeat, u.uFenceTex);
  applySlot('floor', u.uFloorMode, u.uFloorColor, u.uFloorRepeat, u.uFloorTex);
  applySlot('chimney', u.uChimneyMode, u.uChimneyColor, u.uChimneyRepeat, u.uChimneyTex);
}

function createMultiPartStyledMaterial(
  srcMat: THREE.Material,
  meshToHouse: THREE.Matrix4,
  houseBoxMin: THREE.Vector3,
  houseBoxSize: THREE.Vector3
): { mat: THREE.MeshStandardMaterial; uniforms: MultiPartHouseUniforms } {
  let stdMat: THREE.MeshStandardMaterial;
  if (srcMat instanceof THREE.MeshStandardMaterial) {
    stdMat = srcMat.clone();
  } else {
    const anyMat = srcMat as THREE.MeshLambertMaterial;
    stdMat = new THREE.MeshStandardMaterial({
      map: anyMat.map ?? null,
      color: anyMat.color ? anyMat.color.clone() : new THREE.Color(0xffffff),
      roughness: 0.72,
      metalness: 0.06,
    });
  }

  const fb = getWhiteFallbackTexture();
  const uniforms: MultiPartHouseUniforms = {
    uMeshToHouse: { value: meshToHouse.clone() },
    uHouseBoxMin: { value: houseBoxMin.clone() },
    uHouseBoxSize: { value: houseBoxSize.clone() },

    uRoofMode: { value: 0 },
    uRoofColor: { value: new THREE.Color(0xffffff) },
    uRoofRepeat: { value: 1 },
    uRoofTex: { value: fb },

    uWallMode: { value: 0 },
    uWallColor: { value: new THREE.Color(0xffffff) },
    uWallRepeat: { value: 1 },
    uWallTex: { value: fb },

    uFenceMode: { value: 0 },
    uFenceColor: { value: new THREE.Color(0xffffff) },
    uFenceRepeat: { value: 1 },
    uFenceTex: { value: fb },

    uFloorMode: { value: 0 },
    uFloorColor: { value: new THREE.Color(0xffffff) },
    uFloorRepeat: { value: 1 },
    uFloorTex: { value: fb },

    uChimneyMode: { value: 0 },
    uChimneyColor: { value: new THREE.Color(0xffffff) },
    uChimneyRepeat: { value: 1 },
    uChimneyTex: { value: fb },
  };

  stdMat.customProgramCacheKey = () => 'house_multipart_paint_v1';
  stdMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
uniform mat4 uMeshToHouse;
varying vec3 vHouseLocalPos;
varying vec3 vHouseLocalNorm;
`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vHouseLocalPos = (uMeshToHouse * vec4(transformed, 1.0)).xyz;
#ifdef USE_NORMAL
vHouseLocalNorm = normalize(mat3(uMeshToHouse) * objectNormal);
#else
vHouseLocalNorm = vec3(0.0, 1.0, 0.0);
#endif
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform vec3 uHouseBoxMin;
uniform vec3 uHouseBoxSize;

uniform int uRoofMode;
uniform vec3 uRoofColor;
uniform float uRoofRepeat;
uniform sampler2D uRoofTex;

uniform int uWallMode;
uniform vec3 uWallColor;
uniform float uWallRepeat;
uniform sampler2D uWallTex;

uniform int uFenceMode;
uniform vec3 uFenceColor;
uniform float uFenceRepeat;
uniform sampler2D uFenceTex;

uniform int uFloorMode;
uniform vec3 uFloorColor;
uniform float uFloorRepeat;
uniform sampler2D uFloorTex;

uniform int uChimneyMode;
uniform vec3 uChimneyColor;
uniform float uChimneyRepeat;
uniform sampler2D uChimneyTex;

varying vec3 vHouseLocalPos;
varying vec3 vHouseLocalNorm;
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
{
  vec3 hRel = clamp((vHouseLocalPos - uHouseBoxMin) / max(uHouseBoxSize, vec3(0.25)), 0.0, 1.0);
  vec3 nAbs = abs(normalize(vHouseLocalNorm + vec3(0.0, 0.0001, 0.0)));
  float edgeDist = max(abs(hRel.x - 0.5), abs(hRel.z - 0.5)) * 2.0;

  // Part IDs: 0=roof, 1=wall, 2=fence, 3=floor, 4=chimney
  int partId = 1;
  if (hRel.y < 0.14 || (hRel.y < 0.25 && vHouseLocalNorm.y > 0.72)) {
    partId = 3;
  } else if (hRel.y > 0.84 && nAbs.y < 0.45 && edgeDist > 0.20) {
    partId = 4;
  } else if ((hRel.y > 0.55 && vHouseLocalNorm.y > 0.22) || hRel.y > 0.78) {
    partId = 0;
  } else if (hRel.y >= 0.13 && hRel.y <= 0.50 && edgeDist > 0.84) {
    partId = 2;
  }

  vec2 triUv;
  if (nAbs.x >= nAbs.y && nAbs.x >= nAbs.z) {
    triUv = vHouseLocalPos.zy * 0.36;
  } else if (nAbs.z >= nAbs.x && nAbs.z >= nAbs.y) {
    triUv = vHouseLocalPos.xy * 0.36;
  } else {
    triUv = vHouseLocalPos.xz * 0.36;
  }

  float lum = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.20, 1.0);
  float shadeSolid = mix(1.0, lum * 1.45, 0.34);
  float shadeTex = mix(1.0, lum * 1.25, 0.20);

  if (partId == 0 && uRoofMode > 0) {
    if (uRoofMode == 2) {
      diffuseColor.rgb = texture2D(uRoofTex, triUv * uRoofRepeat).rgb * uRoofColor * shadeTex;
    } else {
      diffuseColor.rgb = uRoofColor * shadeSolid;
    }
  } else if (partId == 1 && uWallMode > 0) {
    if (uWallMode == 2) {
      diffuseColor.rgb = texture2D(uWallTex, triUv * uWallRepeat).rgb * uWallColor * shadeTex;
    } else {
      diffuseColor.rgb = uWallColor * shadeSolid;
    }
  } else if (partId == 2 && uFenceMode > 0) {
    if (uFenceMode == 2) {
      diffuseColor.rgb = texture2D(uFenceTex, triUv * uFenceRepeat).rgb * uFenceColor * shadeTex;
    } else {
      diffuseColor.rgb = uFenceColor * shadeSolid;
    }
  } else if (partId == 3 && uFloorMode > 0) {
    if (uFloorMode == 2) {
      diffuseColor.rgb = texture2D(uFloorTex, triUv * uFloorRepeat).rgb * uFloorColor * shadeTex;
    } else {
      diffuseColor.rgb = uFloorColor * shadeSolid;
    }
  } else if (partId == 4 && uChimneyMode > 0) {
    if (uChimneyMode == 2) {
      diffuseColor.rgb = texture2D(uChimneyTex, triUv * uChimneyRepeat).rgb * uChimneyColor * shadeTex;
    } else {
      diffuseColor.rgb = uChimneyColor * shadeSolid;
    }
  }
}
`
    );
  };

  return { mat: stdMat, uniforms };
}

function measureHouseLocalBounds(group: THREE.Group, dirtMat: THREE.Material): THREE.Box3 {
  const savedPos = group.position.clone();
  const savedRot = group.rotation.clone();
  const savedVis = group.visible;

  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.visible = true;
  group.updateMatrixWorld(true);

  const box = new THREE.Box3();
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (
      mesh.isMesh &&
      mesh.material !== dirtMat &&
      !mesh.userData?.isHitProxy &&
      !mesh.userData?.isCustomPartAddon
    ) {
      box.expandByObject(mesh);
    }
  });

  group.position.copy(savedPos);
  group.rotation.copy(savedRot);
  group.visible = savedVis;
  group.updateMatrixWorld(true);

  if (box.isEmpty()) {
    box.set(new THREE.Vector3(-2.5, 0, -2.5), new THREE.Vector3(2.5, 4.0, 2.5));
  }
  return box;
}

function syncMissingPartAddons(
  group: THREE.Group,
  house: PlacedHouse,
  resolved: Record<HousePartKey, PartStyleConfig>,
  state: HousePaintRuntimeState,
  ctx: HousePaintContext
): boolean {
  const eligible = ADDON_ELIGIBLE_TYPES.has(house.type);
  const existingExplicit = new Set<HousePartKey>();

  if (eligible) {
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData?.isCustomPartAddon || mesh.userData?.isHitProxy) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        const p = inferExplicitPart(mesh, mat, house.type, ctx);
        if (p) existingExplicit.add(p);
      }
    });
  }

  const wantFence =
    eligible &&
    !existingExplicit.has('fence') &&
    Boolean(resolved.fence.color || resolved.fence.textureDataUrl);
  const wantChimney =
    eligible &&
    !existingExplicit.has('chimney') &&
    Boolean(resolved.chimney.color || resolved.chimney.textureDataUrl);
  const wantFloor =
    eligible &&
    !existingExplicit.has('floor') &&
    Boolean(resolved.floor.color || resolved.floor.textureDataUrl);

  const nextAddonSig = `${wantFence ? 'F' : ''}${wantChimney ? 'C' : ''}${wantFloor ? 'L' : ''}`;
  if (state.addonSignature === nextAddonSig) {
    return false;
  }

  if (state.addonGroup) {
    state.addonGroup.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        mesh.geometry.dispose();
      }
    });
    group.remove(state.addonGroup);
    state.addonGroup = undefined;
  }
  state.addonSignature = nextAddonSig;

  if (!nextAddonSig) {
    return true;
  }

  const localBox = measureHouseLocalBounds(group, ctx.houseMaterials.dirt);
  const size = new THREE.Vector3();
  localBox.getSize(size);
  const defYard = HOUSE_DEFS[house.type]?.yard ?? 7;

  const b = new HouseMeshBuilder();
  if (wantFence) {
    const span = Math.max(defYard, Math.max(size.x, size.z) + 1.1);
    buildPicketYardFence(b, ctx.houseMaterials, span);
  }
  if (wantChimney) {
    b.setPart('chimney');
    const chX = localBox.min.x + size.x * 0.74;
    const chZ = localBox.min.z + size.z * 0.34;
    const baseY = Math.max(0.6, localBox.min.y + size.y * 0.56);
    const topY = localBox.max.y + 0.65;
    const chH = Math.max(1.0, topY - baseY);
    b.box(0.56, chH, 0.56, ctx.houseMaterials.stone, chX, baseY + chH * 0.5, chZ);
    b.box(0.7, 0.14, 0.7, ctx.houseMaterials.woodDark, chX, topY + 0.06, chZ);
  }
  if (wantFloor) {
    b.setPart('floor');
    const padW = Math.max(2.4, size.x + 0.7);
    const padD = Math.max(2.4, size.z + 1.1);
    const cz = (localBox.min.z + localBox.max.z) * 0.5 + 0.2;
    const cx = (localBox.min.x + localBox.max.x) * 0.5;
    b.box(padW, 0.09, padD, ctx.houseMaterials.stone, cx, 0.045, cz);
  }

  const addonGroup = b.build(
    new Set<THREE.Material>([ctx.houseMaterials.stone, ctx.houseMaterials.woodDark]),
    new Set<THREE.Material>([ctx.houseMaterials.fence]),
    ctx.houseMaterials.fence
  );
  addonGroup.name = 'CustomHousePartAddons';
  addonGroup.userData.isCustomPartAddon = true;
  addonGroup.traverse((o) => {
    o.userData.isCustomPartAddon = true;
  });
  group.add(addonGroup);
  state.addonGroup = addonGroup;
  return true;
}

export function disposeHousePaintRuntime(
  group: THREE.Group,
  state: HousePaintRuntimeState | undefined,
  disposeTextures = true
): void {
  if (!state) return;

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.__origMaterial) {
      mesh.material = mesh.userData.__origMaterial;
    }
    if (mesh.userData.__origGeometry) {
      mesh.geometry = mesh.userData.__origGeometry;
      delete mesh.userData.__origGeometry;
    }
  });

  state.clonedMaterials.forEach((m) => m.dispose());
  state.clonedMaterials = [];
  state.directPartBindings = [];
  state.multiPartUniforms = [];

  state.uvClonedGeos.forEach((g) => g.dispose());
  state.uvClonedGeos = [];
  state.structureKey = undefined;
  state.appliedSignature = undefined;

  if (disposeTextures) {
    if (state.addonGroup) {
      state.addonGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          mesh.geometry.dispose();
        }
      });
      group.remove(state.addonGroup);
      state.addonGroup = undefined;
      state.addonSignature = undefined;
    }
    for (const part of HOUSE_PART_KEYS) {
      state.partTexObjs[part]?.dispose();
    }
    state.partTexObjs = {};
    state.partTexUrls = {};
  }
}

export function syncEntryHousePaint(
  group: THREE.Group,
  house: PlacedHouse,
  existingState: HousePaintRuntimeState | undefined,
  ctx: HousePaintContext
): HousePaintRuntimeState | undefined {
  const sig = serializeHouseStyleSignature(house);
  if (existingState && existingState.appliedSignature === sig) {
    return existingState;
  }

  if (!hasAnyHouseCustomization(house)) {
    disposeHousePaintRuntime(group, existingState, true);
    return undefined;
  }

  const state: HousePaintRuntimeState = existingState ?? {
    partTexUrls: {},
    partTexObjs: {},
    loadSeq: 0,
    clonedMaterials: [],
    directPartBindings: [],
    multiPartUniforms: [],
    uvClonedGeos: [],
  };

  const resolved = resolveEffectiveHouseParts(house);

  // Sync async textures for any part whose dataURL changed
  let pendingLoads = 0;
  const loader = new THREE.TextureLoader();
  const nextSeq = state.loadSeq + 1;
  let startedNewLoad = false;

  for (const part of HOUSE_PART_KEYS) {
    const wantedUrl = resolved[part].textureDataUrl;
    const curUrl = state.partTexUrls[part];
    if (!wantedUrl && curUrl) {
      state.partTexObjs[part]?.dispose();
      delete state.partTexObjs[part];
      delete state.partTexUrls[part];
    } else if (wantedUrl && wantedUrl !== curUrl) {
      startedNewLoad = true;
      pendingLoads++;
    } else if (wantedUrl && wantedUrl === curUrl && state.partTexObjs[part]) {
      const rep = Math.max(1, Math.min(8, resolved[part].textureRepeat ?? 1));
      state.partTexObjs[part]!.repeat.set(rep, rep);
      state.partTexObjs[part]!.needsUpdate = true;
    }
  }

  if (startedNewLoad) {
    state.loadSeq = nextSeq;
    for (const part of HOUSE_PART_KEYS) {
      const wantedUrl = resolved[part].textureDataUrl;
      if (wantedUrl && wantedUrl !== state.partTexUrls[part]) {
        loader.load(
          wantedUrl,
          (tex) => {
            if (ctx.isDisposed() || state.loadSeq !== nextSeq || !ctx.isEntryAlive(house.id)) {
              tex.dispose();
              return;
            }
            const rep = Math.max(1, Math.min(8, resolved[part].textureRepeat ?? 1));
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(rep, rep);
            tex.anisotropy = 4;
            tex.needsUpdate = true;

            state.partTexObjs[part]?.dispose();
            state.partTexObjs[part] = tex;
            state.partTexUrls[part] = wantedUrl;

            pendingLoads--;
            if (pendingLoads <= 0) {
              // Force full material refresh with newly decoded texture(s)
              state.structureKey = undefined;
              state.appliedSignature = undefined;
              applyResolvedStateToMeshes(group, house, resolved, state, ctx);
              state.appliedSignature = serializeHouseStyleSignature(house);
            }
          },
          undefined,
          () => {
            pendingLoads--;
            if (pendingLoads <= 0 && !ctx.isDisposed() && ctx.isEntryAlive(house.id)) {
              applyResolvedStateToMeshes(group, house, resolved, state, ctx);
              state.appliedSignature = serializeHouseStyleSignature(house);
            }
          }
        );
      }
    }
  }

  applyResolvedStateToMeshes(group, house, resolved, state, ctx);
  if (!startedNewLoad) {
    state.appliedSignature = sig;
  }
  return state;
}

function applyResolvedStateToMeshes(
  group: THREE.Group,
  house: PlacedHouse,
  resolved: Record<HousePartKey, PartStyleConfig>,
  state: HousePaintRuntimeState,
  ctx: HousePaintContext
): void {
  const addonsChanged = syncMissingPartAddons(group, house, resolved, state, ctx);
  const nextStructKey = computeStructureKey(resolved, state.addonSignature ?? '');

  // Fast path: update existing cloned materials & shader uniforms in-place (0 allocations while dragging color picker!)
  if (
    !addonsChanged &&
    state.structureKey === nextStructKey &&
    (state.directPartBindings.length > 0 || state.multiPartUniforms.length > 0)
  ) {
    for (const binding of state.directPartBindings) {
      const cfg = resolved[binding.part];
      const tex = cfg.textureDataUrl ? state.partTexObjs[binding.part] : undefined;
      applyDirectStyleToMaterial(binding.origMat, binding.clonedMat, cfg, tex, ctx);
    }
    for (const u of state.multiPartUniforms) {
      updateMultiPartUniforms(u, resolved, state.partTexObjs);
    }
    return;
  }

  // Rebuild material bindings cleanly (preserving loaded textures & addonGroup)
  disposeHousePaintRuntime(group, state, false);

  const localBox = measureHouseLocalBounds(group, ctx.houseMaterials.dirt);
  const boxMin = localBox.min.clone();
  const boxSize = new THREE.Vector3();
  localBox.getSize(boxSize);
  boxSize.max(new THREE.Vector3(0.5, 0.5, 0.5));

  group.updateMatrixWorld(true);
  const invGroupWorld = group.matrixWorld.clone().invert();

  const directCache = new Map<string, { origMat: THREE.Material; clonedMat: THREE.MeshStandardMaterial; part: HousePartKey }>();

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (isExcludedObject(mesh, group)) return;

    if (!mesh.userData.__origMaterial) {
      mesh.userData.__origMaterial = mesh.material;
    }

    const orig = mesh.userData.__origMaterial as THREE.Material | THREE.Material[];
    const origArr = Array.isArray(orig) ? orig : [orig];

    // Check if this mesh uses direct single-part styling and needs box-projected UVs for a PNG texture
    let needsBoxUv = false;
    for (const m of origArr) {
      if (!m) continue;
      const part = inferExplicitPart(mesh, m, house.type, ctx);
      if (part && resolved[part].textureDataUrl && state.partTexObjs[part]) {
        needsBoxUv = true;
      }
    }

    const vertCount = mesh.geometry?.attributes?.position?.count ?? 0;
    if (needsBoxUv && mesh.geometry && !mesh.userData.__origGeometry && vertCount <= 60_000) {
      mesh.userData.__origGeometry = mesh.geometry;
      const projected = createBoxProjectedGeometry(mesh.geometry);
      mesh.geometry = projected;
      state.uvClonedGeos.push(projected);
    }

    const meshToHouse = new THREE.Matrix4().multiplyMatrices(invGroupWorld, mesh.matrixWorld);

    const mapOne = (origMat: THREE.Material): THREE.Material => {
      const explicitPart = inferExplicitPart(mesh, origMat, house.type, ctx);
      if (isExcludedMaterial(origMat, explicitPart, ctx)) return origMat;

      if (explicitPart) {
        const cfg = resolved[explicitPart];
        const tex = cfg.textureDataUrl ? state.partTexObjs[explicitPart] : undefined;
        if (!cfg.color && !tex) {
          return origMat;
        }
        const cacheKey = `${origMat.uuid}:${explicitPart}`;
        let cached = directCache.get(cacheKey);
        if (!cached) {
          const cloned = (origMat instanceof THREE.MeshStandardMaterial
            ? origMat.clone()
            : new THREE.MeshStandardMaterial({
                map: (origMat as THREE.MeshLambertMaterial).map ?? null,
                color: (origMat as THREE.MeshLambertMaterial).color?.clone() ?? new THREE.Color(0xffffff),
                roughness: 0.72,
                metalness: 0.05,
              }));
          applyDirectStyleToMaterial(origMat, cloned, cfg, tex, ctx);
          state.clonedMaterials.push(cloned);
          const binding = { part: explicitPart, origMat, clonedMat: cloned };
          state.directPartBindings.push(binding);
          cached = binding;
          directCache.set(cacheKey, cached);
        }
        return cached.clonedMat;
      }

      // Combined untagged GLB / multi-part mesh -> WebGL2 multi-part shader!
      const { mat, uniforms } = createMultiPartStyledMaterial(origMat, meshToHouse, boxMin, boxSize);
      updateMultiPartUniforms(uniforms, resolved, state.partTexObjs);
      state.clonedMaterials.push(mat);
      state.multiPartUniforms.push(uniforms);
      return mat;
    };

    if (Array.isArray(orig)) {
      mesh.material = orig.map((m) => mapOne(m));
    } else {
      mesh.material = mapOne(orig);
    }
  });

  state.structureKey = nextStructKey;
}
