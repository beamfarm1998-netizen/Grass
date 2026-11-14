// src/components/3d/FarmTrees.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from '../../utils/glbLoaderSetup';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PlacedTree, TreeType, TREE_DEFINITIONS } from '../../types/game';
import { isMobileViewportOrTouch } from '../../utils/glbValidator';

/**
 * FarmTrees3D
 * ระบบเรนเดอร์ต้นไม้ 3 มิติบนผืนดินเกาะฟาร์ม พร้อมลำดับขั้นการเติบโต (Growth Stages)
 * รองรับโมเดล GLB แท้ (รวมถึง SkinnedMesh Armature เช่น lemon_tree_.glb)
 * และระบบ Procedural 3D Fallback ระดับสมจริงสำหรับไม้ผลทุกชนิด รวมถึงต้นมะพร้าว (Coconut Palm)
 *
 * ── v2 Ready/Revive Badge overhaul ──
 *  • Ready star (rotating Octahedron) replaced with billboarded emoji Sprite
 *  • Revive ring (blue Torus)  replaced with billboarded 💧 emoji Sprite
 *  • No background, no border — icon-only emoji (128×128 canvas, 100px)
 *  • Always faces camera · depthTest:false + renderOrder:10 (not occluded by foliage)
 *  • Floats gently (sin(elapsed*3)*0.08)
 *  • Override via setTreeIconResolver((treeType, isRevive) => emoji)
 *  • CanvasTexture released in disposeTreeGroup() — full memory teardown
 */

export class FarmTrees3D {
  public group: THREE.Group;
  public interactiveMeshes: THREE.Mesh[] = [];
  private treeMeshes: Map<string, THREE.Group> = new Map();
  private treeParts: Map<string, { content: THREE.Group; star: THREE.Sprite | null }> = new Map();
  private treeStageKeys: Map<string, string> = new Map();
  private treeHitByTreeId: Map<string, THREE.Mesh> = new Map();
  private hitMeshes: Map<THREE.Mesh, string> = new Map();
  private isMobileDevice: boolean;

  // Shared Geometries & Hit Materials
  private sharedBasinGeo: THREE.BufferGeometry;
  private sharedHitGeo: THREE.BufferGeometry;
  private sharedGeos: Set<THREE.BufferGeometry>;
  private sharedHitMat: THREE.MeshBasicMaterial;

  // Shared Materials for high performance
  private barkWoodMat: THREE.MeshStandardMaterial;
  private pineBarkMat: THREE.MeshStandardMaterial;
  private oakBarkMat: THREE.MeshStandardMaterial;
  private coconutTrunkMat: THREE.MeshStandardMaterial;

  private appleFoliageMat: THREE.MeshStandardMaterial;
  private orangeFoliageMat: THREE.MeshStandardMaterial;
  private peachFoliageMat: THREE.MeshStandardMaterial;
  private cherryFoliageMat: THREE.MeshStandardMaterial;
  private pineFoliageMat: THREE.MeshStandardMaterial;
  private oakFoliageMat: THREE.MeshStandardMaterial;
  private lemonFoliageMat: THREE.MeshStandardMaterial;
  private coconutFrondMat: THREE.MeshStandardMaterial;
  private witheredFoliageMat: THREE.MeshStandardMaterial;

  private appleFruitMat: THREE.MeshStandardMaterial;
  private orangeFruitMat: THREE.MeshStandardMaterial;
  private peachFruitMat: THREE.MeshStandardMaterial;
  private cherryFruitMat: THREE.MeshStandardMaterial;
  private lemonFruitMat: THREE.MeshStandardMaterial;
  private coconutNutMat: THREE.MeshStandardMaterial;

  private drySoilMat: THREE.MeshStandardMaterial;
  private wetSoilMat: THREE.MeshStandardMaterial;
  private saplingMat: THREE.MeshStandardMaterial;

  // Shake animation map: treeId -> shakeEndTime
  private shakeTimers: Map<string, number> = new Map();

  // 👇 สำหรับทำ anisotropy ของ CanvasTexture ของ badge
  private renderer?: THREE.WebGLRenderer;

  // 👇 ตัวแปลง tree → emoji (override ด้วย setTreeIconResolver())
  private treeIconResolver: (treeType: TreeType, isRevive: boolean) => string = (
    type,
    isRevive
  ) => {
    if (isRevive) return '💧';
    const map: Record<TreeType, string> = {
      apple: '🍎',
      orange: '🍊',
      peach: '🍑',
      cherry: '🍒',
      lemon: '🍋',
      coconut: '🥥',
      pine: '🌲',
      oak: '🌳',
    };
    return map[type] ?? '🌳';
  };

  // ───── GLB Loading & Shared Cache ─────
  private static gltfLoader: GLTFLoader = createGLTFLoader();
  private static glbCache: Map<string, THREE.Object3D> = new Map();
  private static glbFailed: Set<string> = new Set();
  private static preloadStarted = false;
  private static onLoadedListeners: (() => void)[] = [];
  private modelLoadedCallback: (() => void) | null = null;

  constructor(renderer?: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'FarmTrees';
    this.isMobileDevice = isMobileViewportOrTouch();

    // ลำต้นเปลือกไม้
    this.barkWoodMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.9, metalness: 0.05 });
    this.pineBarkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.95 });
    this.oakBarkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.88 });
    this.coconutTrunkMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.85 });

    // พุ่มใบไม้แต่ละสายพันธุ์
    this.appleFoliageMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.72 });
    this.orangeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.7 });
    this.peachFoliageMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.68 });
    this.cherryFoliageMat = new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.65 });
    this.pineFoliageMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.85 });
    this.oakFoliageMat = new THREE.MeshStandardMaterial({ color: 0x256029, roughness: 0.75 });
    this.lemonFoliageMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.6 });
    this.coconutFrondMat = new THREE.MeshStandardMaterial({ color: 0x1e6f24, roughness: 0.65 });
    this.witheredFoliageMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.92 });

    // ผลไม้สุกสีสดฉ่ำ
    this.appleFruitMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.25, metalness: 0.1 });
    this.orangeFruitMat = new THREE.MeshStandardMaterial({ color: 0xff9800, roughness: 0.35, metalness: 0.05 });
    this.peachFruitMat = new THREE.MeshStandardMaterial({ color: 0xff7043, roughness: 0.3, metalness: 0.05 });
    this.cherryFruitMat = new THREE.MeshStandardMaterial({ color: 0xc2185b, roughness: 0.2, metalness: 0.12 });
    this.lemonFruitMat = new THREE.MeshStandardMaterial({ color: 0xfdd835, roughness: 0.28, metalness: 0.15 });
    this.coconutNutMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.55 });

    // ฐานดินโคนต้น
    this.drySoilMat = new THREE.MeshStandardMaterial({ color: 0x5a3d31, roughness: 0.95 });
    this.wetSoilMat = new THREE.MeshStandardMaterial({ color: 0x241711, roughness: 0.45, metalness: 0.1 });

    // ต้นกล้าเล็ก
    this.saplingMat = new THREE.MeshStandardMaterial({ color: 0x8bc34a, roughness: 0.5 });

    // Shared geometries & helper materials
    this.sharedBasinGeo = new THREE.CircleGeometry(0.85, 16);
    this.sharedBasinGeo.rotateX(-Math.PI / 2);

    this.sharedHitGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.2, 8);
    this.sharedHitGeo.translate(0, 2.1, 0);

    this.sharedGeos = new Set([this.sharedBasinGeo, this.sharedHitGeo]);

    this.sharedHitMat = new THREE.MeshBasicMaterial({ visible: false });

    // เริ่ม preload GLB พร้อมส่ง trigger
    FarmTrees3D.preloadAllGLBs(() => {
      this.modelLoadedCallback?.();
    });
  }

  /**
   * ต่อกับระบบ icon ของเกม (override emoji default)
   *   farm.setTreeIconResolver((type, isRevive) =>
   *     isRevive ? '💧' : TREE_ICONS[type]);
   */
  public setTreeIconResolver(
    fn: (treeType: TreeType, isRevive: boolean) => string
  ) {
    this.treeIconResolver = fn;
  }

  /**
   * ลงทะเบียน callback เมื่อ GLB โหลดเสร็จ (ให้ FarmScene เรียก refreshAllTrees)
   */
  public setOnModelLoaded(cb: () => void) {
    this.modelLoadedCallback = cb;
    FarmTrees3D.onLoadedListeners.push(cb);
    if (FarmTrees3D.glbCache.size > 0) {
      cb();
    }
  }

  /**
   * บังคับ rebuild ต้นไม้ทั้งหมด (ใช้หลัง GLB โหลดเสร็จ)
   */
  public refreshAllTrees(trees: PlacedTree[]) {
    this.treeStageKeys.clear();
    this.updateTrees(trees);
  }

  private static preloadAllGLBs(onAllLoaded?: () => void) {
    if (onAllLoaded) {
      FarmTrees3D.onLoadedListeners.push(onAllLoaded);
    }
    if (FarmTrees3D.preloadStarted) return;
    FarmTrees3D.preloadStarted = true;

    const paths = new Set<string>();
    for (const def of Object.values(TREE_DEFINITIONS)) {
      if (def.modelPath) paths.add(def.modelPath);
    }
    if (paths.size === 0) return;

    let remaining = paths.size;
    const notifyListeners = () => {
      const listeners = [...FarmTrees3D.onLoadedListeners];
      listeners.forEach((fn) => {
        try { fn(); } catch (err) { console.warn('[FarmTrees] Listener error:', err); }
      });
    };

    paths.forEach((path) => {
      FarmTrees3D.loadGLB(path)
        .then(() => {
          if (--remaining === 0) notifyListeners();
        })
        .catch((err) => {
          console.warn(`[FarmTrees] preload ${path} failed → procedural fallback`, err);
          FarmTrees3D.glbFailed.add(path);
          if (--remaining === 0) notifyListeners();
        });
    });
  }

  public static isModelLoaded(path: string): boolean {
    return FarmTrees3D.glbCache.has(path);
  }

  private static loadGLB(path: string): Promise<THREE.Object3D> {
    const cached = FarmTrees3D.glbCache.get(path);
    if (cached) return Promise.resolve(cached);
    if (FarmTrees3D.glbFailed.has(path)) {
      return Promise.reject(new Error('cached fail: ' + path));
    }

    return new Promise((resolve, reject) => {
      FarmTrees3D.gltfLoader.load(
        encodeURI(path),
        (gltf) => {
          const scene = gltf.scene;

          const tempBox = new THREE.Box3().setFromObject(scene);
          const size = tempBox.getSize(new THREE.Vector3());
          const targetHeight = 3.5;
          const currentHeight = Math.max(size.y, 0.01);
          const autoScale = targetHeight / currentHeight;
          scene.scale.setScalar(autoScale);

          const finalBox = new THREE.Box3().setFromObject(scene);
          scene.position.y -= finalBox.min.y;

          scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              o.userData.isSharedGlbGeometry = true;
              if (o.material) {
                if (Array.isArray(o.material)) {
                  o.material.forEach((m) => {
                    m.side = THREE.DoubleSide;
                    m.shadowSide = THREE.DoubleSide;
                  });
                } else {
                  o.material.side = THREE.DoubleSide;
                  o.material.shadowSide = THREE.DoubleSide;
                }
              }
            }
          });

          FarmTrees3D.glbCache.set(path, scene);
          resolve(scene);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  private buildTreeMeshFromGLB(
    tree: PlacedTree,
    template: THREE.Object3D
  ): { root: THREE.Group; hitMesh: THREE.Mesh; content: THREE.Group; star: THREE.Sprite | null } {
    const def = TREE_DEFINITIONS[tree.type];

    const root = new THREE.Group();
    root.name = `Tree_${tree.id}_GLB`;
    root.position.set(tree.worldX, 0, tree.worldZ);

    const basinMat = tree.isWatered ? this.wetSoilMat : this.drySoilMat;
    const basin = new THREE.Mesh(this.sharedBasinGeo, basinMat);
    basin.position.y = 0.022;
    basin.receiveShadow = !this.isMobileDevice;
    root.add(basin);

    const content = new THREE.Group();
    content.name = 'TreeContent';

    const yOffset = def?.modelYOffset ?? 0;
    content.position.y = yOffset;

    const cloned = SkeletonUtils.clone(template);
    cloned.name = `GlbTreeModel_${tree.type}`;

    const extraScale = def?.modelScale ?? 1.0;
    if (extraScale !== 1.0) {
      cloned.scale.multiplyScalar(extraScale);
    }

    if (tree.stage === 'withered') {
      cloned.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material && !o.userData.hasWitheredClone) {
          const mat = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
          if (mat && mat.color) {
            const wMat = mat.clone();
            wMat.color.lerp(new THREE.Color(0x8d6e63), 0.55);
            o.material = wMat;
            o.userData.hasWitheredClone = true;
          }
        }
      });
      content.rotation.z = 0.08;
    }

    content.add(cloned);
    root.add(content);

    const hitMesh = new THREE.Mesh(this.sharedHitGeo, this.sharedHitMat);
    hitMesh.name = `HitTree_${tree.id}`;
    root.add(hitMesh);

    let star: THREE.Sprite | null = null;
    if (tree.stage === 'ready') {
      star = this.createTreeBadgeSprite(tree.type, false, 4.3);
      content.add(star);
    } else if (tree.stage === 'withered' && tree.type === 'coconut' && tree.harvestsCount === 3) {
      star = this.createTreeBadgeSprite(tree.type, true, 4.2);
      content.add(star);
    }

    return { root, hitMesh, content, star };
  }

  public triggerShake(treeId: string, durationSeconds: number = 0.6) {
    this.shakeTimers.set(treeId, performance.now() + durationSeconds * 1000);
  }

  private disposeTreeGroup(group: THREE.Group) {
    const disposedGeo = new Set<THREE.BufferGeometry>();
    const disposedMat = new Set<THREE.Material>();
    const disposedTex = new Set<THREE.Texture>();

    group.traverse((obj) => {
      if (obj instanceof THREE.Sprite) {
        // ⚠️ ห้าม dispose sprite.geometry (three.js ใช้ geometry กลางร่วมกันทุก Sprite)
        const mat = obj.material as THREE.SpriteMaterial;
        if (mat && !disposedMat.has(mat)) {
          disposedMat.add(mat);
          if (mat.map && !disposedTex.has(mat.map)) {
            disposedTex.add(mat.map);
            mat.map.dispose();
          }
          mat.dispose();
        }
      } else if (obj instanceof THREE.Mesh && obj.geometry) {
        if (
          !this.sharedGeos.has(obj.geometry) &&
          !obj.userData?.isSharedGlbGeometry &&
          !disposedGeo.has(obj.geometry)
        ) {
          disposedGeo.add(obj.geometry);
          obj.geometry.dispose();
        }
      }
    });
  }

  private applyTreeGrowthScale(content: THREE.Group | undefined, tree: PlacedTree) {
    if (!content) return;
    const p = Math.max(0, Math.min(1, tree.growthProgress ?? 0));
    if (tree.stage === 'sapling') {
      const s = 0.8 + 0.35 * Math.min(1, p / 0.3);
      content.scale.setScalar(s);
    } else if (tree.stage === 'growing') {
      const t = Math.max(0, Math.min(1, (p - 0.3) / 0.4));
      content.scale.setScalar(0.62 + 0.26 * t);
    } else {
      content.scale.setScalar(1.0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  READY / REVIVE BADGE — bare tree/fruit emoji (no background, no border)
  // ═══════════════════════════════════════════════════════════════════════════

  private createTreeBadgeSprite(
    treeType: TreeType,
    isRevive: boolean,
    baseY: number
  ): THREE.Sprite {
    const tex = this.createTreeBadgeTexture(treeType, isRevive);

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,   // ✅ ไม่ถูกใบ/ผลบัง
      depthWrite: false,
      toneMapped: false,
    });

    const sprite = new THREE.Sprite(mat);
    sprite.name = isRevive ? 'ReviveBadge' : 'ReadyBadge';
    sprite.scale.set(0.55, 0.55, 1);
    sprite.position.set(0, baseY, 0);
    sprite.renderOrder = 10;
    sprite.userData.baseY = baseY;         // 👈 เก็บ baseY ไว้สำหรับ animation
    sprite.userData.isPerTreeBadge = true;
    return sprite;
  }

  private createTreeBadgeTexture(treeType: TreeType, isRevive: boolean): THREE.CanvasTexture {
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, S, S);

    // ── ไอคอนต้นไม้/ผลไม้ (emoji) กลาง canvas — ไม่มีพื้นหลัง ไม่มีขอบ ──
    const icon = this.treeIconResolver(treeType, isRevive);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font =
      '100px "Apple Color Emoji", "Segoe UI Emoji", ' +
      '"Noto Color Emoji", "Segoe UI Symbol", "Twemoji Mozilla", sans-serif';
    ctx.fillText(icon, S / 2, S / 2 + 4);

    // ── ขึ้น texture ─────────────────────────────────────────────
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    if (this.renderer) {
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    }
    tex.needsUpdate = true;
    return tex;
  }

  private buildTreeMesh(tree: PlacedTree): {
    root: THREE.Group;
    hitMesh: THREE.Mesh;
    content: THREE.Group;
    star: THREE.Sprite | null;
  } {
    const def = TREE_DEFINITIONS[tree.type];

    // GLB branch (ยกเว้น sapling)
    if (def?.modelPath && tree.stage !== 'sapling') {
      const template = FarmTrees3D.glbCache.get(def.modelPath);
      if (template) {
        return this.buildTreeMeshFromGLB(tree, template);
      }
    }

    const isMobile = this.isMobileDevice;
    let readyStar: THREE.Sprite | null = null;
    const root = new THREE.Group();
    root.name = `Tree_${tree.id}`;
    root.position.set(tree.worldX, 0, tree.worldZ);

    // ──────────────────────── 1. วงแหวนดินโคนต้นไม้ (Tree Basin) ────────────────────────
    const basinMat = tree.isWatered ? this.wetSoilMat : this.drySoilMat;
    const basin = new THREE.Mesh(this.sharedBasinGeo, basinMat);
    basin.position.y = 0.022;
    basin.receiveShadow = !isMobile;
    root.add(basin);

    // ──────────────────────── 2. โมเดลต้นไม้ตาม Stage ────────────────────────
    const content = new THREE.Group();
    content.name = 'TreeContent';

    if (tree.stage === 'sapling') {
      const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.45, 6);
      stemGeo.translate(0, 0.22, 0);
      const stem = new THREE.Mesh(stemGeo, this.saplingMat);
      stem.castShadow = true;
      content.add(stem);

      const leafCount = tree.type === 'coconut' ? 4 : 3;
      for (let i = 0; i < leafCount; i++) {
        const leafGeo = new THREE.SphereGeometry(0.12, 6, 6);
        leafGeo.scale(1.4, 0.25, 0.8);
        const leaf = new THREE.Mesh(leafGeo, this.saplingMat);
        const ang = (i * Math.PI * 2) / leafCount;
        leaf.position.set(Math.cos(ang) * 0.16, 0.4, Math.sin(ang) * 0.16);
        leaf.rotation.y = ang;
        leaf.rotation.z = 0.4;
        content.add(leaf);
      }
    } else if (tree.type === 'coconut') {
      // 🌴 ต้นมะพร้าว Procedural 3D คุณภาพสูง (เมื่อยังไม่มีไฟล์ GLB หรือระหว่างรอโหลด)
      const isWithered = tree.stage === 'withered';
      const frondMat = isWithered ? this.witheredFoliageMat : this.coconutFrondMat;

      const segments = 6;
      let currY = 0;
      let currX = 0;
      let currZ = 0;
      const leanAngle = 0.18;

      for (let s = 0; s < segments; s++) {
        const segH = 0.6;
        const rBottom = 0.24 - s * 0.015;
        const rTop = 0.22 - s * 0.015;
        const segGeo = new THREE.CylinderGeometry(rTop, rBottom, segH, 8);
        segGeo.translate(0, segH / 2, 0);

        const segMesh = new THREE.Mesh(segGeo, this.coconutTrunkMat);
        segMesh.position.set(currX, currY, currZ);
        segMesh.rotation.z = Math.sin(s * 0.4) * leanAngle;
        segMesh.castShadow = true;
        segMesh.receiveShadow = true;
        content.add(segMesh);

        currY += segH * 0.95;
        currX += Math.sin(s * 0.4) * 0.06;
      }

      const frondCount = 8;
      const crownY = currY;
      for (let f = 0; f < frondCount; f++) {
        const ang = (f * Math.PI * 2) / frondCount;
        const frondGroup = new THREE.Group();
        frondGroup.position.set(currX, crownY, currZ);
        frondGroup.rotation.y = ang;

        const ribGeo = new THREE.CylinderGeometry(0.03, 0.06, 1.8, 6);
        ribGeo.translate(0, 0.9, 0);
        const ribMesh = new THREE.Mesh(ribGeo, this.coconutTrunkMat);
        ribMesh.rotation.z = -Math.PI / 3 - (isWithered ? 0.25 : 0);
        frondGroup.add(ribMesh);

        const leafPanelGeo = new THREE.ConeGeometry(0.55, 1.7, 5);
        leafPanelGeo.scale(1, 0.12, 1);
        leafPanelGeo.translate(0, 0.85, 0);
        const leafPanel = new THREE.Mesh(leafPanelGeo, frondMat);
        leafPanel.rotation.z = -Math.PI / 3 - (isWithered ? 0.25 : 0);
        leafPanel.castShadow = true;
        leafPanel.receiveShadow = true;
        frondGroup.add(leafPanel);

        content.add(frondGroup);
      }

      if (tree.stage === 'ready') {
        const nutCount = 4;
        const nutGeo = new THREE.SphereGeometry(0.18, 8, 8);
        nutGeo.scale(1, 1.25, 0.95);

        for (let n = 0; n < nutCount; n++) {
          const nutAng = (n * Math.PI * 2) / nutCount;
          const nut = new THREE.Mesh(nutGeo, this.coconutNutMat);
          nut.position.set(
            currX + Math.cos(nutAng) * 0.25,
            crownY - 0.22,
            currZ + Math.sin(nutAng) * 0.25
          );
          nut.rotation.x = Math.PI / 5;
          nut.castShadow = !isMobile;
          content.add(nut);
        }

        const star = this.createTreeBadgeSprite(tree.type, false, crownY + 1.2);
        star.position.x = currX;
        star.position.z = currZ;
        content.add(star);
        readyStar = star;
      } else if (isWithered && tree.harvestsCount === 3) {
        const revive = this.createTreeBadgeSprite(tree.type, true, crownY + 1.0);
        revive.position.x = currX;
        revive.position.z = currZ;
        content.add(revive);
        readyStar = revive;
      }
    } else if (tree.type === 'pine') {
      const isMature = tree.stage === 'mature' || tree.stage === 'ready';
      const scale = tree.stage === 'growing' ? 0.65 : 1.0;
      content.scale.set(scale, scale, scale);

      const trunkH = isMature ? 3.6 : 2.4;
      const trunkGeo = new THREE.CylinderGeometry(0.12, 0.28, trunkH, 8);
      trunkGeo.translate(0, trunkH / 2, 0);
      const trunk = new THREE.Mesh(trunkGeo, this.pineBarkMat);
      trunk.castShadow = true;
      content.add(trunk);

      const tiers = [
        { y: 1.5, r: 1.45, h: 1.6 },
        { y: 2.3, r: 1.15, h: 1.4 },
        { y: 3.1, r: 0.8, h: 1.3 },
      ];

      tiers.forEach((t) => {
        const coneGeo = new THREE.ConeGeometry(t.r, t.h, 7);
        coneGeo.translate(0, t.h / 2, 0);
        const cone = new THREE.Mesh(coneGeo, this.pineFoliageMat);
        cone.position.y = t.y;
        cone.castShadow = true;
        cone.receiveShadow = true;
        content.add(cone);
      });

      if (tree.stage === 'ready') {
        const star = this.createTreeBadgeSprite(tree.type, false, 4.3);
        content.add(star);
        readyStar = star;
      }
    } else if (tree.type === 'oak') {
      const scale = tree.stage === 'growing' ? 0.65 : 1.0;
      content.scale.set(scale, scale, scale);

      const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 2.8, 8);
      trunkGeo.translate(0, 1.4, 0);
      const trunk = new THREE.Mesh(trunkGeo, this.oakBarkMat);
      trunk.castShadow = true;
      content.add(trunk);

      const clusters = [
        { x: 0, y: 3.2, z: 0, r: 1.8, sy: 1.2 },
        { x: -0.8, y: 2.6, z: 0.4, r: 1.3, sy: 1.0 },
        { x: 0.9, y: 2.7, z: -0.3, r: 1.35, sy: 1.0 },
        { x: 0.2, y: 2.5, z: 0.9, r: 1.2, sy: 0.9 },
        { x: -0.3, y: 3.8, z: -0.2, r: 1.2, sy: 1.1 },
      ];

      clusters.forEach((c) => {
        const geo = new THREE.DodecahedronGeometry(c.r, 1);
        geo.scale(1, c.sy, 1);
        const foliage = new THREE.Mesh(geo, this.oakFoliageMat);
        foliage.position.set(c.x, c.y, c.z);
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        content.add(foliage);
      });

      if (tree.stage === 'ready') {
        const star = this.createTreeBadgeSprite(tree.type, false, 4.3);
        content.add(star);
        readyStar = star;
      }
    } else {
      const scale = tree.stage === 'growing' ? 0.65 : 1.0;
      content.scale.set(scale, scale, scale);

      let foliageMat = this.appleFoliageMat;
      let fruitMat = this.appleFruitMat;

      if (tree.type === 'orange') {
        foliageMat = this.orangeFoliageMat;
        fruitMat = this.orangeFruitMat;
      } else if (tree.type === 'peach') {
        foliageMat = this.peachFoliageMat;
        fruitMat = this.peachFruitMat;
      } else if (tree.type === 'cherry') {
        foliageMat = this.cherryFoliageMat;
        fruitMat = this.cherryFruitMat;
      } else if (tree.type === 'lemon') {
        foliageMat = this.lemonFoliageMat;
        fruitMat = this.lemonFruitMat;
      }

      if (tree.stage === 'withered') {
        foliageMat = this.witheredFoliageMat;
      }

      const isLemon = tree.type === 'lemon';
      const trunkH = isLemon ? 2.8 : 2.5;

      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, trunkH, 8);
      trunkGeo.translate(0, trunkH / 2, 0);
      const trunk = new THREE.Mesh(trunkGeo, this.barkWoodMat);
      trunk.castShadow = true;
      content.add(trunk);

      const b1Geo = new THREE.CylinderGeometry(0.08, 0.12, 1.2, 6);
      b1Geo.translate(0, 0.6, 0);
      const b1 = new THREE.Mesh(b1Geo, this.barkWoodMat);
      b1.position.set(0, 1.8, 0);
      b1.rotation.z = -0.6;
      content.add(b1);

      const b2 = new THREE.Mesh(b1Geo, this.barkWoodMat);
      b2.position.set(0, 1.9, 0);
      b2.rotation.z = 0.55;
      b2.rotation.y = 1.6;
      content.add(b2);

      const canopyClusters = isLemon
        ? [
            { x: 0, y: 3.4, z: 0, r: 1.35, sy: 1.35 },
            { x: -0.65, y: 2.9, z: 0.3, r: 1.0, sy: 1.15 },
            { x: 0.7, y: 3.0, z: -0.2, r: 1.05, sy: 1.15 },
            { x: 0.1, y: 2.8, z: 0.7, r: 0.95, sy: 1.1 },
          ]
        : [
            { x: 0, y: 3.1, z: 0, r: 1.45, sy: 1.0 },
            { x: -0.7, y: 2.7, z: 0.3, r: 1.05, sy: 1.0 },
            { x: 0.75, y: 2.8, z: -0.2, r: 1.1, sy: 1.0 },
            { x: 0.1, y: 2.6, z: 0.75, r: 1.0, sy: 1.0 },
          ];

      canopyClusters.forEach((c) => {
        const geo = new THREE.DodecahedronGeometry(c.r, 1);
        if (c.sy !== 1.0) geo.scale(1, c.sy, 1);
        const foliage = new THREE.Mesh(geo, foliageMat);
        foliage.position.set(c.x, c.y, c.z);
        foliage.castShadow = true;
        foliage.receiveShadow = true;
        content.add(foliage);
      });

      if (tree.stage === 'ready') {
        const fruitPositions = isLemon
          ? [
              { x: -0.9, y: 2.5, z: 0.6 },
              { x: 0.9, y: 2.6, z: 0.5 },
              { x: -0.4, y: 2.7, z: -0.9 },
              { x: 0.7, y: 2.6, z: -0.7 },
              { x: 0.1, y: 2.3, z: 0.95 },
              { x: -0.8, y: 3.0, z: -0.3 },
              { x: 0.6, y: 3.1, z: 0.2 },
              { x: -0.1, y: 3.2, z: -0.4 },
              { x: 0.3, y: 2.8, z: 0.7 },
            ]
          : [
              { x: -0.8, y: 2.3, z: 0.6 },
              { x: 0.8, y: 2.4, z: 0.5 },
              { x: -0.3, y: 2.5, z: -0.9 },
              { x: 0.6, y: 2.3, z: -0.7 },
              { x: 0.0, y: 2.1, z: 0.95 },
            ];

        const fruitR = isLemon ? 0.22 : tree.type === 'cherry' ? 0.12 : 0.18;
        const fruitGeo = new THREE.SphereGeometry(fruitR, 10, 10);

        if (isLemon) {
          fruitGeo.scale(1, 1.18, 1);
        }

        fruitPositions.forEach((fp) => {
          const fruit = new THREE.Mesh(fruitGeo, fruitMat);
          fruit.position.set(fp.x, fp.y, fp.z);
          fruit.castShadow = !isMobile;
          content.add(fruit);
        });

        const star = this.createTreeBadgeSprite(tree.type, false, isLemon ? 4.6 : 4.3);
        content.add(star);
        readyStar = star;
      }
    }

    root.add(content);

    const hitMesh = new THREE.Mesh(this.sharedHitGeo, this.sharedHitMat);
    hitMesh.name = `HitTree_${tree.id}`;
    root.add(hitMesh);

    return { root, hitMesh, content, star: readyStar };
  }

  private syncInteractiveList() {
    this.interactiveMeshes = [];
    this.hitMeshes.clear();
    for (const [id, hitMesh] of this.treeHitByTreeId.entries()) {
      this.interactiveMeshes.push(hitMesh);
      this.hitMeshes.set(hitMesh, id);
    }
  }

  public updateTrees(trees: PlacedTree[]) {
    let hitListDirty = false;

    const currentIds = new Set(trees.map((t) => t.id));
    for (const [id, group] of this.treeMeshes.entries()) {
      if (!currentIds.has(id)) {
        this.group.remove(group);
        this.disposeTreeGroup(group);
        this.treeMeshes.delete(id);
        this.treeParts.delete(id);
        this.treeStageKeys.delete(id);
        this.treeHitByTreeId.delete(id);
        hitListDirty = true;
      }
    }

    for (const tree of trees) {
      const def = TREE_DEFINITIONS[tree.type];
      const hasGLB = !!(def?.modelPath && FarmTrees3D.glbCache.has(def.modelPath) && tree.stage !== 'sapling');
      const stageKey = `${tree.type}_${tree.stage}_${tree.isWatered}_${tree.harvestsCount}_${hasGLB}`;
      const existing = this.treeMeshes.get(tree.id);

      if (existing && this.treeStageKeys.get(tree.id) === stageKey) {
        existing.position.set(tree.worldX, 0, tree.worldZ);
        this.applyTreeGrowthScale(this.treeParts.get(tree.id)?.content, tree);
        continue;
      }

      if (existing) {
        this.group.remove(existing);
        this.disposeTreeGroup(existing);
      }

      const { root, hitMesh, content, star } = this.buildTreeMesh(tree);
      this.applyTreeGrowthScale(content, tree);
      this.treeMeshes.set(tree.id, root);
      this.treeParts.set(tree.id, { content, star });
      this.treeStageKeys.set(tree.id, stageKey);
      this.treeHitByTreeId.set(tree.id, hitMesh);
      this.group.add(root);
      hitListDirty = true;
    }

    if (hitListDirty) {
      this.syncInteractiveList();
    }
  }

  public pickTree(raycaster: THREE.Raycaster): string | null {
    if (this.interactiveMeshes.length === 0) return null;
    const hits = raycaster.intersectObjects(this.interactiveMeshes, false);
    if (hits.length > 0) {
      const mesh = hits[0].object as THREE.Mesh;
      return this.hitMeshes.get(mesh) || null;
    }
    return null;
  }

  public update(delta: number, elapsed: number) {
    const now = performance.now();

    for (const [id, group] of this.treeMeshes.entries()) {
      const parts = this.treeParts.get(id);
      if (!parts) continue;
      const { content, star } = parts;

      const phase = group.position.x * 0.7 + group.position.z * 0.5;
      const swayZ = Math.sin(elapsed * 1.6 + phase) * 0.025;
      const swayX = Math.cos(elapsed * 1.3 + phase) * 0.015;

      content.rotation.z = swayZ;
      content.rotation.x = swayX;

      if (star) {
        // ✅ Sprite หันหน้าจอเองโดยอัตโนมัติ — ไม่ต้อง rotate.y
        const baseY = (star.userData.baseY as number | undefined) ?? 4.3;
        star.position.y = baseY + Math.sin(elapsed * 3.0) * 0.08;
      }

      const shakeEnd = this.shakeTimers.get(id);
      if (shakeEnd) {
        if (now < shakeEnd) {
          const shakeFactor = (shakeEnd - now) / 600;
          content.rotation.z += Math.sin(now * 0.05) * 0.12 * shakeFactor;
          content.rotation.x += Math.cos(now * 0.04) * 0.08 * shakeFactor;
        } else {
          this.shakeTimers.delete(id);
        }
      }
    }
  }

  public dispose() {
    for (const group of this.treeMeshes.values()) {
      this.disposeTreeGroup(group);
      this.group.remove(group);
    }
    this.treeMeshes.clear();
    this.treeParts.clear();
    this.treeStageKeys.clear();
    this.treeHitByTreeId.clear();
    this.hitMeshes.clear();
    this.interactiveMeshes = [];
    this.sharedGeos.forEach((g) => g.dispose());
    this.sharedGeos.clear();
    this.sharedHitMat.dispose();
    this.barkWoodMat.dispose();
    this.pineBarkMat.dispose();
    this.oakBarkMat.dispose();
    this.coconutTrunkMat.dispose();
    this.appleFoliageMat.dispose();
    this.orangeFoliageMat.dispose();
    this.peachFoliageMat.dispose();
    this.cherryFoliageMat.dispose();
    this.pineFoliageMat.dispose();
    this.oakFoliageMat.dispose();
    this.lemonFoliageMat.dispose();
    this.coconutFrondMat.dispose();
    this.witheredFoliageMat.dispose();
    this.appleFruitMat.dispose();
    this.orangeFruitMat.dispose();
    this.peachFruitMat.dispose();
    this.cherryFruitMat.dispose();
    this.lemonFruitMat.dispose();
    this.coconutNutMat.dispose();
    this.drySoilMat.dispose();
    this.wetSoilMat.dispose();
    this.saplingMat.dispose();
    this.modelLoadedCallback = null;
  }
}