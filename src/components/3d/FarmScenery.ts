// src/components/3d/FarmScenery.ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadValidatedGLTF, isMobileViewportOrTouch } from '../../utils/glbValidator';
import { checkModelBudget, TOTAL_BUDGETS } from '../../utils/modelBudget';
import { isTerrainBlocked } from '../../data/terrainFeatures';

export interface SceneryItem {
  file: string;
  count: number;
  height: number;
  scaleJitter?: number;
  fixed?: { x: number; z: number; rotY?: number }[];
  yOffset?: number;
  sizeBudgetKB?: number;
  trisBudget?: number;
  forceLoad?: boolean;
  allowOverBudgetRatio?: number;
}

export interface SceneryZone { xMin: number; xMax: number; zMin: number; zMax: number }

export const DEFAULT_ZONES: SceneryZone[] = [
  { xMin: 56, xMax: 98, zMin: -60, zMax: 60 },
  { xMin: -34, xMax: 56, zMin: 42, zMax: 70 },
  { xMin: -34, xMax: 56, zMin: -70, zMax: -42 },
];

export const DEFAULT_SCENERY: SceneryItem[] = [
  { file: '/windmill.glb',               count: 1, height: 12, fixed: [{ x: 70, z: -45, rotY: 0.6 }],       sizeBudgetKB: 4000, trisBudget: 20000 },
  { file: '/water-tower.glb',            count: 1, height: 10, fixed: [{ x: 66, z: 40, rotY: -0.4 }],        sizeBudgetKB: 4500, trisBudget: 18000 },
  { file: '/two-story-timber-house.glb', count: 1, height: 7,  fixed: [{ x: 80, z: 5,  rotY: Math.PI / 2 }], sizeBudgetKB: 3000, trisBudget: 40000 },
  { file: '/utility-pole.glb',           count: 6, height: 7,  fixed: [0,1,2,3,4,5].map((i) => ({ x: 58, z: -30 + i * 12, rotY: 0 })) },

  { file: '/pine_tree.glb',     count: 20, height: 9,  scaleJitter: 0.25, sizeBudgetKB: 1500, trisBudget: 6000 },
  { file: '/lemon_tree_.glb',   count: 6,  height: 5,  scaleJitter: 0.2,  sizeBudgetKB: 800,  trisBudget: 15000, forceLoad: true },
  { file: '/lcoconut tree.glb', count: 5,  height: 10, scaleJitter: 0.2,  sizeBudgetKB: 1500, trisBudget: 8000 },

  { file: '/grass.glb',         count: 25, height: 1.2, scaleJitter: 0.4, sizeBudgetKB: 1200, trisBudget: 10000 },
  { file: '/river_rock.glb',    count: 8,  height: 1.6, scaleJitter: 0.4, sizeBudgetKB: 1200, trisBudget: 5000 },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScenerySummary {
  placed: { file: string; count: number; tris: number; overBudget?: boolean }[];
  skipped: { file: string; reason: string }[];
  totalTris: number;
  triBudget: number;
}

interface BudgetDecision { skip: boolean; overBudget: boolean; message: string }

function decideBudget(item: SceneryItem, sizeBytes: number, tris: number): BudgetDecision {
  const sizeKB = sizeBytes / 1024;
  const base = checkModelBudget(item.file, sizeBytes, tris);
  const hasOverride = item.sizeBudgetKB != null || item.trisBudget != null;

  if (!hasOverride && !item.forceLoad) {
    if (base.verdict === 'reject') return { skip: true, overBudget: true, message: `เกินงบมาก: ${base.message}` };
    return { skip: false, overBudget: base.verdict === 'warn', message: base.message };
  }

  const overSize = item.sizeBudgetKB != null && sizeKB > item.sizeBudgetKB;
  const overTris = item.trisBudget != null && tris > item.trisBudget;

  if (item.forceLoad) {
    const d: string[] = [];
    if (overSize) d.push(`${sizeKB.toFixed(0)}KB>${item.sizeBudgetKB}KB`);
    if (overTris) d.push(`${tris}>${item.trisBudget}tris`);
    return { skip: false, overBudget: d.length > 0, message: d.length ? `${item.file}: ${d.join(',')}` : `${item.file} OK` };
  }

  const ratio = item.allowOverBudgetRatio ?? 1.5;
  const sizeR = item.sizeBudgetKB ? sizeKB / item.sizeBudgetKB : 0;
  const trisR = item.trisBudget ? tris / item.trisBudget : 0;
  if (sizeR > ratio || trisR > ratio) {
    return { skip: true, overBudget: true, message: `เกิน ${ratio}x (size=${sizeR.toFixed(1)}x, tris=${trisR.toFixed(1)}x)` };
  }
  return { skip: false, overBudget: overSize || overTris, message: item.file };
}

export class FarmScenery3D {
  public group = new THREE.Group();
  private disposables = new Set<{ dispose: () => void }>();
  private disposed = false;

  public readonly huaHinSignPos = { x: 15.5, z: -8.5 };
  public readonly huaHinSignRotY = 2.2;

  public readonly huaHinSignGlb = {
    file: '/hua-hin-sign.glb',
    height: 3.2,
    rotOffset: 0,
    yOffset: 0,
  };

  constructor(private zones: SceneryZone[] = DEFAULT_ZONES, private seed = 20261109) {
    this.group.name = 'FarmScenery';
  }

  private createHuaHinSign(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'HuaHinSign';
    g.position.set(this.huaHinSignPos.x, 0, this.huaHinSignPos.z);
    g.rotation.y = this.huaHinSignRotY;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), poleMat);
    pole.position.set(0, 1.1, -0.2);
    pole.castShadow = true;
    pole.receiveShadow = true;
    g.add(pole);

    const boardMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 0.15), boardMat);
    board.position.y = 2.2;
    board.castShadow = true;
    board.receiveShadow = true;
    g.add(board);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#dcb37b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(92, 58, 33, 0.2)';
    ctx.lineWidth = 4;
    for (let i = 0; i < canvas.height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    ctx.strokeStyle = '#5c3a21';
    ctx.lineWidth = 24;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

    ctx.fillStyle = '#2e1a0d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.font = 'bold 90px "Prompt", "Kanit", sans-serif';
    ctx.fillText('ไปสะพานปลา', canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.font = 'bold 70px "Prompt", "Kanit", sans-serif';
    ctx.fillStyle = '#1f8fb5';
    ctx.fillText('หัวหิน ➔', canvas.width / 2, canvas.height / 2 + 60);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const textMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 });
    const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.25), textMat);
    textPlane.position.set(0, 2.2, 0.08);
    g.add(textPlane);

    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.15, side: THREE.BackSide });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.2), glowMat);
    glow.position.set(0, 2.2, 0);
    g.add(glow);

    this.disposables.add(poleMat);
    this.disposables.add(boardMat);
    this.disposables.add(texture);
    this.disposables.add(textMat);
    this.disposables.add(glowMat);
    this.disposables.add(pole.geometry);
    this.disposables.add(board.geometry);
    this.disposables.add(textPlane.geometry);
    this.disposables.add(glow.geometry);

    return g;
  }

  private async upgradeHuaHinSignToGlb(fallback: THREE.Group): Promise<void> {
    const cfg = this.huaHinSignGlb;
    try {
      const { gltf } = await loadValidatedGLTF(cfg.file);
      if (this.disposed) return;
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      if (size.y < 1e-6) return;
      const k = cfg.height / size.y;
      model.scale.multiplyScalar(k);
      box.setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;
      model.position.y += cfg.yOffset;

      const holder = new THREE.Group();
      holder.name = 'HuaHinSignGlb';
      holder.position.set(this.huaHinSignPos.x, 0, this.huaHinSignPos.z);
      holder.rotation.y = this.huaHinSignRotY + cfg.rotOffset;
      holder.add(model);

      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        this.disposables.add(m.geometry);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => this.disposables.add(mat));
      });

      this.group.remove(fallback);
      this.group.add(holder);
    } catch (err) {
      console.info('[FarmScenery] ไม่พบ/โหลด hua-hin-sign.glb ไม่ได้ — ใช้ป้ายจากโค้ดแทน', err);
    }
  }

  // ✅ ฟังก์ชันสร้างหญ้าจำลอง (Fallback) 
  private createProceduralGrassFallback(
    item: SceneryItem,
    rand: () => number,
    occupied: { x: number; z: number; r: number }[],
    summary: ScenerySummary
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(32, 64);
    ctx.quadraticCurveTo(10, 30, 20, 0);
    ctx.quadraticCurveTo(40, 30, 32, 64);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const plane1 = new THREE.PlaneGeometry(1, 1);
    const plane2 = new THREE.PlaneGeometry(1, 1);
    plane2.rotateY(Math.PI / 2);
    const geo = mergeGeometries([plane1, plane2]);
    if (geo) geo.translate(0, 0.5, 0); 

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.8,
    });

    const spots: { x: number; z: number; rotY: number; s: number }[] = [];
    const count = item.count || 25;
    let tries = 0;
    while (spots.length < count && tries++ < count * 40) {
      const zone = this.zones[Math.floor(rand() * this.zones.length)];
      const x = zone.xMin + rand() * (zone.xMax - zone.xMin);
      const z = zone.zMin + rand() * (zone.zMax - zone.zMin);
      if (isTerrainBlocked(x, z).blocked) continue;
      const s = 1 + (rand() * 2 - 1) * (item.scaleJitter ?? 0.4);
      const r = 0.5 * s;
      if (occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r)) continue;
      occupied.push({ x, z, r });
      spots.push({ x, z, rotY: rand() * Math.PI * 2, s: s * item.height }); 
    }

    if (!spots.length || !geo) return;

    const im = new THREE.InstancedMesh(geo, mat, spots.length);
    im.castShadow = true;
    im.receiveShadow = false;

    const dummy = new THREE.Object3D();
    spots.forEach((sp, i) => {
      dummy.position.set(sp.x, 0, sp.z);
      dummy.rotation.y = sp.rotY;
      dummy.scale.set(sp.s, sp.s, sp.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;

    this.group.add(im);
    this.disposables.add(geo);
    this.disposables.add(mat);
    this.disposables.add(tex);

    summary.placed.push({ file: 'Procedural Grass (Fallback)', count: spots.length, tris: spots.length * 4 });
    console.info('🌿 [FarmScenery] สร้างหญ้าจำลอง (Procedural) สำเร็จ!');
  }

  async build(items: SceneryItem[] = DEFAULT_SCENERY): Promise<ScenerySummary> {
    const mobile = isMobileViewportOrTouch();
    const triBudget = mobile ? TOTAL_BUDGETS.sceneryTrisMobile : TOTAL_BUDGETS.sceneryTrisDesktop;
    const rand = mulberry32(this.seed);
    const occupied: { x: number; z: number; r: number }[] = [];
    const summary: ScenerySummary = { placed: [], skipped: [], totalTris: 0, triBudget };

    const signGroup = this.createHuaHinSign();
    this.group.add(signGroup);
    void this.upgradeHuaHinSignToGlb(signGroup);
    occupied.push({ x: this.huaHinSignPos.x, z: this.huaHinSignPos.z, r: 3 });

    for (const item of items) {
      if (this.disposed) break;

      // ✅ [จุดที่แก้ไข] บังคับวาดหญ้าจำลองเลย! ไม่ต้องพยายามโหลด grass.glb ให้ปวดหัว
      if (item.file === '/grass.glb') {
        this.createProceduralGrassFallback(item, rand, occupied, summary);
        continue; // ข้ามการโหลด GLB ไปเลย
      }

      try {
        const { gltf, inspection } = await loadValidatedGLTF(item.file);
        const decision = decideBudget(item, inspection.byteLength, inspection.triangleCount);
        if (decision.skip) {
          summary.skipped.push({ file: item.file, reason: decision.message });
          console.warn('[Scenery] skip', decision.message);
          continue;
        }
        if (decision.overBudget) console.warn('[Scenery] over budget', decision.message);

        const root = gltf.scene;
        let skinned = false;
        root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
        if (skinned) { summary.skipped.push({ file: item.file, reason: 'มี skeleton' }); continue; }

        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        if (!isFinite(size.y) || size.y <= 0) { summary.skipped.push({ file: item.file, reason: 'bbox ผิดปกติ' }); continue; }

        const baseScale = item.height / size.y;
        const footprint = (Math.max(size.x, size.z) * baseScale) / 2 * 0.8;
        const trisPer = Math.max(1, inspection.triangleCount);
        const wanted = mobile && !item.fixed ? Math.ceil(item.count * 0.5) : item.count;
        const room = Math.max(0, Math.floor((triBudget - summary.totalTris) / trisPer));
        const count = Math.min(wanted, room);
        if (count <= 0) { summary.skipped.push({ file: item.file, reason: 'งบรวมเต็ม' }); continue; }

        const spots: { x: number; z: number; rotY: number; s: number }[] = [];
        if (item.fixed) {
          for (const f of item.fixed.slice(0, count)) {
            spots.push({ x: f.x, z: f.z, rotY: f.rotY ?? 0, s: 1 });
            occupied.push({ x: f.x, z: f.z, r: footprint });
          }
        } else {
          let tries = 0;
          while (spots.length < count && tries++ < count * 40) {
            const zone = this.zones[Math.floor(rand() * this.zones.length)];
            const x = zone.xMin + rand() * (zone.xMax - zone.xMin);
            const z = zone.zMin + rand() * (zone.zMax - zone.zMin);
            if (isTerrainBlocked(x, z).blocked) continue;
            const s = 1 + (rand() * 2 - 1) * (item.scaleJitter ?? 0);
            const r = footprint * s;
            if (occupied.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r)) continue;
            occupied.push({ x, z, r });
            spots.push({ x, z, rotY: rand() * Math.PI * 2, s });
          }
        }
        if (!spots.length) { summary.skipped.push({ file: item.file, reason: 'หาตำแหน่งไม่ได้' }); continue; }

        const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
        const clonedGeos: THREE.BufferGeometry[] = [];
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
          clonedGeos.push(geo);
          const mat = Array.isArray(m.material) ? m.material[0] : m.material;
          if (!mat) return;
          if (!byMaterial.has(mat)) byMaterial.set(mat, []);
          byMaterial.get(mat)!.push(geo);
        });

        const base = new THREE.Matrix4()
          .makeScale(baseScale, baseScale, baseScale)
          .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y + (item.yOffset ?? 0) / baseScale, -center.z));

        const inst = new THREE.Matrix4();
        const tmp = new THREE.Matrix4();
        const tmpPos = new THREE.Vector3();
        const tmpScale = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        const usedGeos = new Set<THREE.BufferGeometry>();

        byMaterial.forEach((geos, mat) => {
          const merged = geos.length > 1 ? mergeGeometries(geos) : geos[0];
          if (!merged) return;
          usedGeos.add(merged);

          const im = new THREE.InstancedMesh(merged, mat, spots.length);
          im.castShadow = (item.height >= 8) || (!mobile && item.height >= 4);
          im.receiveShadow = false;
          im.frustumCulled = true;
          im.instanceMatrix.setUsage(THREE.StaticDrawUsage);

          spots.forEach((sp, i) => {
            q.setFromAxisAngle(up, sp.rotY);
            tmpPos.set(sp.x, 0, sp.z);
            tmpScale.set(sp.s, sp.s, sp.s);
            inst.compose(tmpPos, q, tmpScale);
            tmp.copy(base).multiply(inst);
            im.setMatrixAt(i, tmp);
          });
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.matrixAutoUpdate = false;
          im.updateMatrix();

          this.group.add(im);

          this.disposables.add(merged);
          this.disposables.add(mat);
          Object.values(mat).forEach((v) => {
            if (v && (v as THREE.Texture).isTexture) this.disposables.add(v as THREE.Texture);
          });
        });

        for (const g of clonedGeos) {
          if (!usedGeos.has(g)) g.dispose();
        }

        const tris = trisPer * spots.length;
        summary.totalTris += tris;
        summary.placed.push({ file: item.file, count: spots.length, tris, overBudget: decision.overBudget });
      } catch (e) {
        summary.skipped.push({ file: item.file, reason: (e as Error).message });
        console.warn('[Scenery] load failed', item.file, e);
      }
    }

    const logMsg = `[Scenery] วางแล้ว ${summary.placed.length} ชนิด รวม ${summary.totalTris}/${triBudget} tris`;
    if (import.meta.env.DEV) console.info(logMsg, summary);
    else console.info(logMsg);

    return summary;
  }

  dispose() {
    this.disposed = true;
    this.group.removeFromParent();
    this.disposables.forEach((d) => d.dispose());
    this.disposables.clear();
    this.group.clear();
  }
}