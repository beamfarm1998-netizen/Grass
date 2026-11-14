// src/game/player/PlayerTools.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createGLTFLoader } from '../../utils/glbLoaderSetup';
import type { ToolType } from '../../types/game';
import { buildHeldToolNormalizer, HELD_TOOL_SPECS, type HeldToolSpec } from './HeldToolRig';

// ─── Module-level GLTF Cache for Player Tools ───
const _toolGltfLoader = createGLTFLoader();
const _toolGlbTemplates = new Map<string, THREE.Group>();
const _toolGlbFailed = new Set<string>();

interface ToolGlbOptions {
  targetHeight: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  posY?: number;
  held?: HeldToolSpec;
}

/**
 * โหลดโมเดล GLB ของเครื่องมือทำฟาร์มแบบอะซิงโครนัส
 * - options.held: ใช้ระบบ "จับจริง" (HeldToolRig) จัดทิศ/จุดจับ/ขนาดเป็นเมตรให้อัตโนมัติ (ใช้กับตัวละคร GLB)
 * - ไม่ใส่ held: ใช้การปรับขนาดแบบเดิม (ใช้กับร่าง Procedural)
 * หากยังไม่มีไฟล์ (404) จะแสดง Procedural Fallback ต่อไปอย่างราบรื่นโดยไม่ error
 */
function prepareToolMaterials(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m.side = THREE.DoubleSide;
          });
        } else {
          child.material.side = THREE.DoubleSide;
        }
      }
    }
  });
}

function tryAttachToolGlb(
  toolPath: string,
  glbContainer: THREE.Group,
  proceduralContainer: THREE.Group,
  options: ToolGlbOptions
): void {
  // แยก cache ระหว่างโหมดจับจริงกับโหมดเดิม เพราะจัดทิศ/ขนาดไม่เหมือนกัน
  const cacheKey = options.held ? `${toolPath}#held` : toolPath;
  const cached = _toolGlbTemplates.get(cacheKey);
  if (cached) {
    glbContainer.add(cached.clone(true));
    proceduralContainer.visible = false;
    return;
  }
  if (_toolGlbFailed.has(cacheKey)) {
    return;
  }

  _toolGltfLoader.load(
    encodeURI(toolPath),
    (gltf) => {
      const scene = gltf.scene;
      const template = new THREE.Group();
      template.name = `Template_${cacheKey}`;

      if (options.held) {
        prepareToolMaterials(scene);
        template.add(buildHeldToolNormalizer(scene, options.held));
      } else {
        // วัดขนาดโมเดลและปรับสเกลมาตรฐานให้เหมาะกับมือคนถือ (~0.6 - 1.0m)
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.01);
        const scale = options.targetHeight / maxDim;
        scene.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(scene);
        const center = scaledBox.getCenter(new THREE.Vector3());
        scene.position.x -= center.x;
        scene.position.z -= center.z;
        scene.position.y -= scaledBox.min.y;
        if (options.posY) {
          scene.position.y += options.posY;
        }
        if (options.rotX) scene.rotation.x = options.rotX;
        if (options.rotY) scene.rotation.y = options.rotY;
        if (options.rotZ) scene.rotation.z = options.rotZ;

        prepareToolMaterials(scene);
        template.add(scene);
      }

      _toolGlbTemplates.set(cacheKey, template);
      glbContainer.add(template.clone(true));
      proceduralContainer.visible = false;
    },
    undefined,
    () => {
      // หากยังไม่มีไฟล์ GLB หรือโหลดไม่สำเร็จ ให้ใช้ procedural fallback ต่อไป
      _toolGlbFailed.add(cacheKey);
    }
  );
}

/**
 * สร้างโมเดลเครื่องมือทำฟาร์ม 3D ในมือของตัวละคร (จอบ บัวรดน้ำ เคียว ขวาน ต้นกล้า/ถุงเมล็ด)
 * รองรับโมเดลจริงจาก /hoe.glb, /wateringcan.glb, /sickle.glb, /ax_.glb
 */
export function createFarmerToolModels(
  holder: THREE.Group,
  targetMap: Map<ToolType, THREE.Group>,
  opts: { heldSpec?: boolean } = {}
): void {
  const heldSpec = Boolean(opts.heldSpec);
  const ashWoodMat = new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0xb58a63 });
  const forgedIronMat = new THREE.MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.85,
    color: 0x546e7a,
  });
  const brassCanMat = new THREE.MeshStandardMaterial({
    roughness: 0.4,
    metalness: 0.7,
    color: 0x43a047,
  });

  // 1. HOE (จอบขุดดิน) -> รองรับ /hoe.glb
  const hoe = new THREE.Group();
  hoe.name = 'Tool_Hoe';
  const hoeProcedural = new THREE.Group();
  const hoeHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.025, 1.15, 8),
    ashWoodMat
  );
  hoeHandle.position.y = 0.35;
  hoeProcedural.add(hoeHandle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.025), forgedIronMat);
  blade.position.set(0, 0.88, 0.08);
  blade.rotation.x = 0.65;
  hoeProcedural.add(blade);
  hoe.add(hoeProcedural);

  const hoeGlb = new THREE.Group();
  hoeGlb.name = 'Hoe_GLB';
  hoe.add(hoeGlb);
  tryAttachToolGlb('/hoe.glb', hoeGlb, hoeProcedural, {
    held: heldSpec ? HELD_TOOL_SPECS.hoe : undefined,
    targetHeight: 0.95,
    rotX: 0.2,
    posY: 0.05,
  });

  hoe.visible = false;
  holder.add(hoe);
  targetMap.set('hoe', hoe);

  // 2. WATERING CAN (บัวรดน้ำ) -> รองรับ /wateringcan.glb
  const can = new THREE.Group();
  can.name = 'Tool_WateringCan';
  const canProcedural = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.34, 12),
    brassCanMat
  );
  canProcedural.add(body);
  const spout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.028, 0.4, 8),
    brassCanMat
  );
  spout.position.set(0, 0.14, 0.22);
  spout.rotation.x = 0.75;
  canProcedural.add(spout);
  const rose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.04, 0.06, 10),
    forgedIronMat
  );
  rose.position.set(0, 0.28, 0.36);
  rose.rotation.x = 0.75;
  canProcedural.add(rose);
  can.add(canProcedural);

  const canGlb = new THREE.Group();
  canGlb.name = 'WateringCan_GLB';
  can.add(canGlb);
  tryAttachToolGlb('/wateringcan.glb', canGlb, canProcedural, {
    held: heldSpec ? HELD_TOOL_SPECS.watering_can : undefined,
    targetHeight: 0.45,
    posY: -0.05,
  });

  can.visible = false;
  holder.add(can);
  targetMap.set('watering_can', can);

  // 3. SICKLE (เคียวเก็บเกี่ยว) -> รองรับ /sickle.glb
  const sickle = new THREE.Group();
  sickle.name = 'Tool_Sickle';
  const sickleProcedural = new THREE.Group();
  const sickleHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8),
    ashWoodMat
  );
  sickleHandle.position.y = 0.1;
  sickleProcedural.add(sickleHandle);
  const sickleBlade = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.025, 8, 16, Math.PI * 0.95),
    forgedIronMat
  );
  sickleBlade.position.set(0, 0.3, 0);
  sickleBlade.rotation.y = Math.PI / 2;
  sickleProcedural.add(sickleBlade);
  sickle.add(sickleProcedural);

  const sickleGlb = new THREE.Group();
  sickleGlb.name = 'Sickle_GLB';
  sickle.add(sickleGlb);
  tryAttachToolGlb('/sickle.glb', sickleGlb, sickleProcedural, {
    held: heldSpec ? HELD_TOOL_SPECS.sickle : undefined,
    targetHeight: 0.5,
    posY: 0.05,
  });

  sickle.visible = false;
  holder.add(sickle);
  targetMap.set('sickle', sickle);

  // 4. AXE & PICKAXE -> รองรับ /ax_.glb
  const axe = new THREE.Group();
  axe.name = 'Tool_Axe';
  const axeProcedural = new THREE.Group();
  const axeHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.03, 1.0, 8),
    ashWoodMat
  );
  axeHandle.position.y = 0.3;
  axeProcedural.add(axeHandle);
  const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.06), forgedIronMat);
  axeBlade.position.set(0, 0.75, 0.08);
  axeProcedural.add(axeBlade);
  axe.add(axeProcedural);

  const axeGlb = new THREE.Group();
  axeGlb.name = 'Axe_GLB';
  axe.add(axeGlb);
  tryAttachToolGlb('/ax_.glb', axeGlb, axeProcedural, {
    held: heldSpec ? HELD_TOOL_SPECS.axe : undefined,
    targetHeight: 0.85,
    posY: 0.1,
  });

  axe.visible = false;
  holder.add(axe);
  targetMap.set('axe', axe);
  targetMap.set('pickaxe', axe);

  // 5. TREE SAPLING & SEED BAG
  const saplingGroup = new THREE.Group();
  saplingGroup.name = 'Tool_Sapling';
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.16, 8), ashWoodMat);
  pot.position.y = 0.08;
  saplingGroup.add(pot);
  const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), brassCanMat);
  sprout.position.y = 0.22;
  saplingGroup.add(sprout);
  saplingGroup.visible = false;
  holder.add(saplingGroup);
  targetMap.set('tree_sapling', saplingGroup);
  targetMap.set('seed_bag', saplingGroup);
}

/**
 * อัปเดตการแสดงผลของเครื่องมือในมือทั้งร่าง Procedural, man.glb และ woman.glb
 */
export function syncFarmerToolVisibility(
  tool: ToolType,
  maps: Array<Map<ToolType, THREE.Group>>
): void {
  for (const map of maps) {
    map.forEach((mesh, key) => {
      mesh.visible = key === tool;
    });
  }
}
