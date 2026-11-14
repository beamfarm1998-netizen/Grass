// src/fishing/systems/world/LakeEnvironmentBuilder.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WaterPhysics } from '../physics/water/WaterPhysics';
import { AssetLoaderAndValidator } from '../../engine/animation/AssetLoaderAndValidator';

interface RippleInstance {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  maxAge: number;
  maxScale: number;
}

function createTerrainGrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#d8dee4';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = 185 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgb(${shade},${shade + 3},${shade - 2})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(28, 28);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWoodPlankTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#6e5039';
    ctx.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 128; y += 3) {
      const delta = Math.floor(Math.sin(y * 0.25) * 10 + (Math.random() - 0.5) * 12);
      ctx.fillStyle = `rgb(${108 + delta}, ${78 + delta}, ${55 + Math.floor(delta * 0.7)})`;
      ctx.fillRect(0, y, 256, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function toNormalizedRgbGeometry(mesh: THREE.Mesh): THREE.BufferGeometry | null {
  const src = mesh.geometry;
  if (!src?.attributes?.position) return null;

  const nonIndexed = src.index ? src.toNonIndexed() : src.clone();
  nonIndexed.applyMatrix4(mesh.matrixWorld);

  const posAttr = nonIndexed.attributes.position;
  const vertCount = posAttr.count;
  if (vertCount === 0) {
    nonIndexed.dispose();
    return null;
  }

  if (!nonIndexed.attributes.normal) {
    nonIndexed.computeVertexNormals();
  }

  const rgb = new Float32Array(vertCount * 3);
  const srcColor = nonIndexed.attributes.color;
  const matColor =
    (mesh.material as THREE.MeshStandardMaterial)?.color instanceof THREE.Color
      ? (mesh.material as THREE.MeshStandardMaterial).color
      : new THREE.Color(0x2f6f4e);

  if (srcColor) {
    for (let i = 0; i < vertCount; i++) {
      rgb[i * 3] = srcColor.getX(i);
      rgb[i * 3 + 1] = srcColor.getY(i);
      rgb[i * 3 + 2] = srcColor.getZ(i);
    }
  } else {
    for (let i = 0; i < vertCount; i++) {
      rgb[i * 3] = matColor.r;
      rgb[i * 3 + 1] = matColor.g;
      rgb[i * 3 + 2] = matColor.b;
    }
  }

  const clean = new THREE.BufferGeometry();
  clean.setAttribute('position', nonIndexed.attributes.position);
  clean.setAttribute('normal', nonIndexed.attributes.normal);
  clean.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  nonIndexed.dispose();
  return clean;
}

export class LakeEnvironmentBuilder {
  private waterUniforms = {
    uTime: { value: 0 },
    uWindScale: { value: 1.0 },
  };
  private readonly ripples: RippleInstance[] = [];
  private nextRippleIdx = 0;
  private rainRippleAcc = 0;
  private readonly tempRipplePos = new THREE.Vector3();

  build(
    environmentGroup: THREE.Group,
    waterGroup: THREE.Group,
    effectsGroup: THREE.Group,
    maxAnisotropy: number,
    isSoftwareGl: boolean,
    assetLoader: AssetLoaderAndValidator
  ): void {
    this.buildBasinTerrain(environmentGroup, maxAnisotropy, isSoftwareGl);
    this.buildWoodenPier(environmentGroup, maxAnisotropy, isSoftwareGl);
    this.buildInstancedForestAndRocks(environmentGroup, assetLoader, isSoftwareGl);
    this.buildWaterSurface(waterGroup, isSoftwareGl);
    this.buildRipplePool(effectsGroup);
    this.buildUnderwaterGLBScenery(environmentGroup, assetLoader, isSoftwareGl);
  }

  private buildBasinTerrain(group: THREE.Group, maxAnisotropy: number, isSoftwareGl: boolean): void {
    const size = 190;
    const segs = isSoftwareGl ? 72 : 112;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = WaterPhysics.terrainHeightAt(x, z);
      pos.setY(i, y);

      if (y < -2.2) {
        c.setHex(0x132a2e);
      } else if (y < -0.25) {
        c.setHex(0x284b47);
      } else if (y < 0.45) {
        c.setHex(0x7c725e);
      } else if (y < 3.6) {
        c.setHex(0x3a5a38);
      } else if (y < 8.5) {
        c.setHex(0x2d4732);
      } else {
        c.setHex(0x525b61);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const grainTex = createTerrainGrainTexture(maxAnisotropy);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: grainTex,
      roughness: 0.9,
      metalness: 0.03,
    });

    const terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = !isSoftwareGl;
    group.add(terrainMesh);
  }

  private buildWoodenPier(group: THREE.Group, maxAnisotropy: number, isSoftwareGl: boolean): void {
    const pierGroup = new THREE.Group();
    const woodTex = createWoodPlankTexture(maxAnisotropy);

    const plankMatA = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0xccb8a3,
      roughness: 0.84,
      metalness: 0.04,
    });
    const plankMatB = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0xb59e88,
      roughness: 0.62,
      metalness: 0.06,
    });
    const pilingMat = new THREE.MeshStandardMaterial({
      color: 0x3e2d21,
      roughness: 0.92,
      metalness: 0.04,
    });

    const pilingGeo = new THREE.CylinderGeometry(0.13, 0.15, 3.6, 10);
    for (const z of [14.2, 16.8, 19.4, 22.0, 24.4]) {
      for (const x of [-1.42, 1.42]) {
        const post = new THREE.Mesh(pilingGeo, pilingMat);
        post.position.set(x, -0.35, z);
        post.castShadow = !isSoftwareGl;
        post.receiveShadow = !isSoftwareGl;
        pierGroup.add(post);
      }
    }

    const beamGeo = new THREE.BoxGeometry(0.18, 0.22, 11.4);
    for (const x of [-1.25, 0, 1.25]) {
      const beam = new THREE.Mesh(beamGeo, pilingMat);
      beam.position.set(x, 0.96, 19.3);
      pierGroup.add(beam);
    }

    const plankGeo = new THREE.BoxGeometry(3.2, 0.08, 0.44);
    for (let i = 0; i < 22; i++) {
      const z = 13.95 + i * 0.5;
      const plank = new THREE.Mesh(plankGeo, i % 2 === 0 ? plankMatA : plankMatB);
      plank.position.set(0, 1.11, z);
      plank.castShadow = !isSoftwareGl;
      plank.receiveShadow = !isSoftwareGl;
      pierGroup.add(plank);
    }

    const curbGeo = new THREE.BoxGeometry(3.2, 0.12, 0.14);
    const curb = new THREE.Mesh(curbGeo, plankMatB);
    curb.position.set(0, 1.21, 13.82);
    pierGroup.add(curb);

    group.add(pierGroup);
  }

  private buildInstancedForestAndRocks(
    group: THREE.Group,
    assetLoader: AssetLoaderAndValidator,
    isSoftwareGl: boolean
  ): void {
    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. Shoreline Ponderosa Pine Forest (instanced from real_forest.glb without duplicating its 260m ground sheet)
    let builtGlbForest = false;
    const forestRef = assetLoader.getModelSceneRef('real_forest');
    if (forestRef) {
      forestRef.updateMatrixWorld(true);
      let branchMesh: THREE.Mesh | null = null;
      let foliageMesh: THREE.Mesh | null = null;

      forestRef.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const matName = (mat?.name || '').toLowerCase();
        const nodeName = (mesh.name || mesh.parent?.name || '').toLowerCase();
        if (!branchMesh && (matName.includes('branch') || nodeName.includes('branch'))) {
          branchMesh = mesh;
        } else if (
          !foliageMesh &&
          (matName.includes('leaves') || matName.includes('foliage') || nodeName.includes('foliage'))
        ) {
          foliageMesh = mesh;
        }
      });

      if (branchMesh && foliageMesh) {
        const bMesh = branchMesh as THREE.Mesh;
        const fMesh = foliageMesh as THREE.Mesh;
        const branchGeo = bMesh.geometry.clone();
        branchGeo.applyMatrix4(bMesh.matrixWorld);
        const foliageGeo = fMesh.geometry.clone();
        foliageGeo.applyMatrix4(fMesh.matrixWorld);

        branchGeo.computeBoundingBox();
        foliageGeo.computeBoundingBox();
        const combinedBox = new THREE.Box3();
        if (branchGeo.boundingBox) combinedBox.union(branchGeo.boundingBox);
        if (foliageGeo.boundingBox) combinedBox.union(foliageGeo.boundingBox);

        const cx = (combinedBox.min.x + combinedBox.max.x) * 0.5;
        const cz = (combinedBox.min.z + combinedBox.max.z) * 0.5;
        const baseY = combinedBox.min.y;
        branchGeo.translate(-cx, -baseY, -cz);
        foliageGeo.translate(-cx, -baseY, -cz);

        const rawBranchMat = (Array.isArray(bMesh.material) ? bMesh.material[0] : bMesh.material) as THREE.Material;
        const rawFoliageMat = (Array.isArray(fMesh.material) ? fMesh.material[0] : fMesh.material) as THREE.MeshStandardMaterial;
        const branchMat = rawBranchMat.clone();
        const foliageMat = rawFoliageMat.clone();
        foliageMat.side = THREE.DoubleSide;
        if (foliageMat.alphaTest > 0 || foliageMat.transparent) {
          foliageMat.alphaTest = Math.max(0.35, foliageMat.alphaTest || 0.4);
          foliageMat.transparent = false;
          foliageMat.depthWrite = true;
        }

        const maxTrees = isSoftwareGl ? 42 : 76;
        const trunks = new THREE.InstancedMesh(branchGeo, branchMat, maxTrees);
        const crowns = new THREE.InstancedMesh(foliageGeo, foliageMat, maxTrees);

        let treeIdx = 0;
        for (let attempt = 0; attempt < 260 && treeIdx < maxTrees; attempt++) {
          const angle = rand() * Math.PI * 2;
          const dist = 36.5 + rand() * 38;
          const x = Math.cos(angle) * dist;
          const z = -14 + Math.sin(angle) * dist;
          // Keep pier walkway & camera sightline clear
          if (Math.abs(x) < 7.5 && z > 8) continue;

          const groundY = WaterPhysics.terrainHeightAt(x, z);
          if (groundY > 0.65) {
            dummy.position.set(x, groundY - 0.35, z);
            dummy.rotation.set(0, rand() * Math.PI * 2, 0);
            const s = 0.58 + rand() * 0.42;
            dummy.scale.set(s, s * (0.9 + rand() * 0.25), s);
            dummy.updateMatrix();
            trunks.setMatrixAt(treeIdx, dummy.matrix);
            crowns.setMatrixAt(treeIdx, dummy.matrix);
            treeIdx++;
          }
        }

        trunks.count = treeIdx;
        crowns.count = treeIdx;
        trunks.instanceMatrix.needsUpdate = true;
        crowns.instanceMatrix.needsUpdate = true;
        trunks.computeBoundingSphere();
        crowns.computeBoundingSphere();
        trunks.castShadow = !isSoftwareGl;
        crowns.castShadow = !isSoftwareGl;
        crowns.receiveShadow = !isSoftwareGl;

        group.add(trunks, crowns);
        builtGlbForest = true;
      }
    }

    if (!builtGlbForest) {
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 7);
      trunkGeo.translate(0, 1.3, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.92 });
      const foliageGeo = new THREE.ConeGeometry(1.65, 5.4, 8);
      foliageGeo.translate(0, 4.4, 0);
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0x23442a, roughness: 0.85 });

      const maxTrees = 60;
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, maxTrees);
      const crowns = new THREE.InstancedMesh(foliageGeo, foliageMat, maxTrees);
      let idx = 0;
      for (let i = 0; i < 200 && idx < maxTrees; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = 36 + rand() * 36;
        const x = Math.cos(angle) * dist;
        const z = -14 + Math.sin(angle) * dist;
        if (Math.abs(x) < 7 && z > 8) continue;
        const gy = WaterPhysics.terrainHeightAt(x, z);
        if (gy > 0.65) {
          dummy.position.set(x, gy - 0.15, z);
          dummy.rotation.set(0, rand() * Math.PI * 2, 0);
          dummy.scale.setScalar(0.85 + rand() * 0.65);
          dummy.updateMatrix();
          trunks.setMatrixAt(idx, dummy.matrix);
          crowns.setMatrixAt(idx, dummy.matrix);
          idx++;
        }
      }
      trunks.count = idx;
      crowns.count = idx;
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      trunks.computeBoundingSphere();
      crowns.computeBoundingSphere();
      group.add(trunks, crowns);
    }

    // 2. Instanced Shoreline Boulders
    const rockGeo = new THREE.DodecahedronGeometry(0.68, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x626970,
      roughness: 0.88,
      flatShading: true,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 56);
    let rockIdx = 0;
    for (let i = 0; i < 180 && rockIdx < 56; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 32 + rand() * 8.5;
      const x = Math.cos(angle) * dist;
      const z = -14 + Math.sin(angle) * dist;
      if (Math.abs(x) < 4.5 && z > 11) continue;
      const gy = WaterPhysics.terrainHeightAt(x, z);
      if (gy > -0.35 && gy < 1.2) {
        dummy.position.set(x, gy + 0.12, z);
        dummy.rotation.set(rand() * 0.5, rand() * Math.PI, rand() * 0.5);
        dummy.scale.set(0.7 + rand() * 1.1, 0.45 + rand() * 0.55, 0.7 + rand() * 1.0);
        dummy.updateMatrix();
        rocks.setMatrixAt(rockIdx, dummy.matrix);
        color.setRGB(0.35 + rand() * 0.2, 0.37 + rand() * 0.2, 0.39 + rand() * 0.2);
        rocks.setColorAt(rockIdx, color);
        rockIdx++;
      }
    }
    rocks.count = rockIdx;
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
    rocks.receiveShadow = !isSoftwareGl;
    group.add(rocks);

    // 3. Instanced Shoreline Cattail Reeds
    const reedGeo = new THREE.CylinderGeometry(0.015, 0.028, 1.35, 5);
    reedGeo.translate(0, 0.65, 0);
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x5d7a3a, roughness: 0.8 });
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, 110);
    let reedIdx = 0;
    for (let i = 0; i < 320 && reedIdx < 110; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 30.5 + rand() * 5.2;
      const x = Math.cos(angle) * dist;
      const z = -14 + Math.sin(angle) * dist;
      if (Math.abs(x) < 4.2 && z > 10) continue;
      const gy = WaterPhysics.terrainHeightAt(x, z);
      if (gy > -0.55 && gy < 0.12) {
        dummy.position.set(x, gy, z);
        dummy.rotation.set((rand() - 0.5) * 0.18, rand() * Math.PI, (rand() - 0.5) * 0.18);
        dummy.scale.setScalar(0.8 + rand() * 0.45);
        dummy.updateMatrix();
        reeds.setMatrixAt(reedIdx++, dummy.matrix);
      }
    }
    reeds.count = reedIdx;
    reeds.instanceMatrix.needsUpdate = true;
    reeds.computeBoundingSphere();
    group.add(reeds);
  }

  private buildUnderwaterGLBScenery(
    group: THREE.Group,
    assetLoader: AssetLoaderAndValidator,
    isSoftwareGl: boolean
  ): void {
    let seed = 9911;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // 1. Submerged Lakebed Rocks (rock.glb with baked world orientation & normalized scale)
    const rockRef = assetLoader.getModelSceneRef('uw_rock');
    if (rockRef) {
      rockRef.updateMatrixWorld(true);
      let srcMesh: THREE.Mesh | null = null;
      rockRef.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !srcMesh) {
          srcMesh = child as THREE.Mesh;
        }
      });

      if (srcMesh) {
        const mesh = srcMesh as THREE.Mesh;
        const rockGeo = mesh.geometry.clone();
        rockGeo.applyMatrix4(mesh.matrixWorld);
        rockGeo.computeBoundingBox();
        if (rockGeo.boundingBox) {
          const box = rockGeo.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);
          const cx = (box.min.x + box.max.x) * 0.5;
          const cz = (box.min.z + box.max.z) * 0.5;
          rockGeo.translate(-cx, -box.min.y, -cz);
          const normScale = 1 / Math.max(0.01, Math.max(size.x, size.z));
          rockGeo.scale(normScale, normScale, normScale);
        }

        const baseMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
        const rockMat = baseMat.clone();

        const count = isSoftwareGl ? 36 : 56;
        const instancedRocks = new THREE.InstancedMesh(rockGeo, rockMat, count);
        let idx = 0;
        for (let i = 0; i < 300 && idx < count; i++) {
          const rx = (rand() - 0.5) * 40;
          const rz = 12 - rand() * 42;
          if (Math.abs(rx) < 6 && rz > 6) continue;

          const gy = WaterPhysics.terrainHeightAt(rx, rz);
          if (gy < -1.1 && gy > -4.6) {
            dummy.position.set(rx, gy - 0.12, rz);
            dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, (rand() - 0.5) * 0.25);
            const s = 0.75 + rand() * 1.35;
            dummy.scale.set(s, s * (0.65 + rand() * 0.45), s);
            dummy.updateMatrix();
            instancedRocks.setMatrixAt(idx, dummy.matrix);

            color.setHSL(0.42 + rand() * 0.08, 0.22, 0.48 + rand() * 0.22);
            instancedRocks.setColorAt(idx, color);
            idx++;
          }
        }
        instancedRocks.count = idx;
        instancedRocks.instanceMatrix.needsUpdate = true;
        if (instancedRocks.instanceColor) instancedRocks.instanceColor.needsUpdate = true;
        instancedRocks.receiveShadow = !isSoftwareGl;
        instancedRocks.computeBoundingSphere();
        group.add(instancedRocks);
      }
    }

    // 2. Underwater Seaweed & Kelp Clumps (all sub-meshes merged upright + current sway shader)
    const seaweedRef = assetLoader.getModelSceneRef('uw_seaweed');
    if (seaweedRef) {
      seaweedRef.updateMatrixWorld(true);
      const parts: THREE.BufferGeometry[] = [];
      seaweedRef.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if ((mat?.name || '').toLowerCase().includes('bubble')) return;
        const part = toNormalizedRgbGeometry(mesh);
        if (part) parts.push(part);
      });

      if (parts.length > 0) {
        const merged = mergeGeometries(parts, false);
        for (const p of parts) p.dispose();

        if (merged) {
          merged.computeBoundingBox();
          let plantHeight = 1.0;
          if (merged.boundingBox) {
            const box = merged.boundingBox;
            const size = new THREE.Vector3();
            box.getSize(size);
            const cx = (box.min.x + box.max.x) * 0.5;
            const cz = (box.min.z + box.max.z) * 0.5;
            merged.translate(-cx, -box.min.y, -cz);
            const normScale = 1 / Math.max(0.05, size.y);
            merged.scale(normScale, normScale, normScale);
            plantHeight = 1.0;
          }

          const uniforms = this.waterUniforms;
          const swMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.68,
            metalness: 0.05,
            side: THREE.DoubleSide,
          });
          swMat.customProgramCacheKey = () => 'uw_seaweed_sway_v2';
          swMat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = uniforms.uTime;
            shader.vertexShader =
              `uniform float uTime;\n` +
              shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                float bendFactor = clamp(position.y / ${plantHeight.toFixed(2)}, 0.0, 1.0);
                #ifdef USE_INSTANCING
                  float phase = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.5;
                #else
                  float phase = 0.0;
                #endif
                transformed.x += sin(uTime * 1.8 + phase) * 0.16 * bendFactor * bendFactor;
                transformed.z += cos(uTime * 1.4 + phase) * 0.12 * bendFactor * bendFactor;
                `
              );
          };

          const count = isSoftwareGl ? 36 : 68;
          const instancedSeaweed = new THREE.InstancedMesh(merged, swMat, count);
          let idx = 0;
          for (let i = 0; i < 320 && idx < count; i++) {
            const sx = (rand() - 0.5) * 38;
            const sz = 11 - rand() * 38;
            const gy = WaterPhysics.terrainHeightAt(sx, sz);
            if (gy < -0.85 && gy > -4.0) {
              dummy.position.set(sx, gy - 0.04, sz);
              dummy.rotation.set(0, rand() * Math.PI * 2, 0);
              const hScale = 0.55 + rand() * 0.95;
              dummy.scale.set(hScale * 0.85, hScale, hScale * 0.85);
              dummy.updateMatrix();
              instancedSeaweed.setMatrixAt(idx, dummy.matrix);
              idx++;
            }
          }
          instancedSeaweed.count = idx;
          instancedSeaweed.instanceMatrix.needsUpdate = true;
          instancedSeaweed.computeBoundingSphere();
          group.add(instancedSeaweed);
        }
      }
    }

    // 3. Submerged Fallen Timber Habitat (fallen_tree.glb centered on pivot so logs rest on lakebed)
    const treeRef = assetLoader.getModelSceneRef('uw_fallen_tree');
    if (treeRef && !isSoftwareGl) {
      treeRef.updateMatrixWorld(true);
      const refBox = new THREE.Box3().setFromObject(treeRef);
      const refCenter = new THREE.Vector3();
      const refSize = new THREE.Vector3();
      refBox.getCenter(refCenter);
      refBox.getSize(refSize);
      const maxSpan = Math.max(0.1, Math.max(refSize.x, refSize.y, refSize.z));
      const targetScale = 3.2 / maxSpan;

      const count = 3;
      for (let i = 0; i < count; i++) {
        let tx = 0;
        let tz = 0;
        let gy = 0;
        let attempts = 0;
        do {
          tx = (rand() - 0.5) * 28;
          tz = 5 - rand() * 28;
          gy = WaterPhysics.terrainHeightAt(tx, tz);
          attempts++;
        } while ((gy > -1.35 || gy < -3.5 || (Math.abs(tx) < 5 && tz > 2)) && attempts < 24);

        if (gy > -1.35 || gy < -3.5) continue;

        const clonedTree = assetLoader.cloneModelScene('uw_fallen_tree');
        if (!clonedTree) continue;

        const holder = new THREE.Group();
        clonedTree.position.set(-refCenter.x, -refBox.min.y, -refCenter.z);
        clonedTree.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = false;
            m.receiveShadow = true;
          }
        });
        holder.add(clonedTree);
        holder.position.set(tx, gy - 0.18, tz);
        holder.rotation.set((rand() - 0.5) * 0.14, rand() * Math.PI * 2, (rand() - 0.5) * 0.14);
        holder.scale.setScalar(targetScale * (0.85 + rand() * 0.35));
        group.add(holder);
      }
    }
  }

  private buildWaterSurface(waterGroup: THREE.Group, isSoftwareGl: boolean): void {
    const segs = isSoftwareGl ? 56 : 96;
    const waterGeo = new THREE.PlaneGeometry(115, 115, segs, segs);
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x165b68,
      roughness: 0.11,
      metalness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.35,
    });

    const uniforms = this.waterUniforms;
    waterMat.customProgramCacheKey = () => 'lake_water_waves_v1';
    waterMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWindScale = uniforms.uWindScale;
      shader.vertexShader =
        `
        uniform float uTime;
        uniform float uWindScale;
        ` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vec4 worldCoord = modelMatrix * vec4(transformed, 1.0);
          float w1 = sin(worldCoord.x * 0.42 + uTime * 1.65) * 0.045;
          float w2 = cos(worldCoord.z * 0.55 - uTime * 1.28) * 0.038;
          float w3 = sin((worldCoord.x + worldCoord.z) * 0.85 + uTime * 2.3) * 0.018;
          transformed.y += (w1 + w2 + w3) * uWindScale;
          `
        );
    };

    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, 0, -12);
    waterMesh.receiveShadow = !isSoftwareGl;
    waterMesh.renderOrder = 2;
    waterGroup.add(waterMesh);
  }

  private buildRipplePool(effectsGroup: THREE.Group): void {
    const ringGeo = new THREE.RingGeometry(0.14, 0.21, 28);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 20; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      effectsGroup.add(mesh);

      this.ripples.push({
        mesh,
        material: mat,
        active: false,
        age: 0,
        maxAge: 1.2,
        maxScale: 4.5,
      });
    }
  }

  spawnRipple(position: THREE.Vector3, intensity = 0.7): void {
    const slot = this.ripples[this.nextRippleIdx];
    this.nextRippleIdx = (this.nextRippleIdx + 1) % this.ripples.length;
    if (!slot) return;

    slot.active = true;
    slot.age = 0;
    slot.maxAge = 0.9 + intensity * 0.75;
    slot.maxScale = 2.2 + intensity * 4.8;
    slot.mesh.position.set(position.x, 0.045, position.z);
    slot.mesh.scale.setScalar(0.35);
    slot.material.opacity = Math.min(0.85, 0.4 + intensity * 0.45);
    slot.mesh.visible = true;
  }

  update(dt: number, elapsed: number, windScale: number, isRaining = false): void {
    this.waterUniforms.uTime.value = elapsed;
    this.waterUniforms.uWindScale.value = windScale;

    if (isRaining) {
      this.rainRippleAcc += dt * 7.5;
      while (this.rainRippleAcc >= 1) {
        this.rainRippleAcc -= 1;
        const rx = (Math.random() - 0.5) * 28;
        const rz = 11 - Math.random() * 30;
        if (WaterPhysics.waterDepthAt(rx, rz) > 0.25) {
          this.tempRipplePos.set(rx, 0.045, rz);
          this.spawnRipple(this.tempRipplePos, 0.14 + Math.random() * 0.14);
        }
      }
    }

    for (const r of this.ripples) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const p = r.age / r.maxAge;
      const scale = 0.35 + p * r.maxScale;
      r.mesh.scale.setScalar(scale);
      r.material.opacity = (1 - p) * 0.65;
    }
  }
}