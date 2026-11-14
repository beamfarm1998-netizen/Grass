// src/components/ui/HouseInteriorModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Moon,
  Coffee,
  Flame,
  Heart,
  Sparkles,
  LogOut,
  ChefHat,
  Utensils,
  AlertCircle,
  ChevronRight,
  Footprints,
  Eye,
  EyeOff,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { farmAudio } from '../../utils/audio';
import {
  CropType,
  TreeType,
  CROP_DEFINITIONS,
  TREE_DEFINITIONS,
  FarmerGender,
} from '../../types/game';
import {
  disposeHierarchySafely,
  isMobileViewportOrTouch,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../utils/glbValidator';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  getCropName,
  getTreeFruitName,
  RECIPE_DESC_EN,
} from '../../i18n/translations';

const MODEL_URL = '/bakery-interior.glb';

/* ------------------------------------------------------------------ */
/* Recipes Definition                                                  */
/* ------------------------------------------------------------------ */
export interface Recipe {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  description: string;
  staminaGain: number;
  xpGain: number;
  ingredients: {
    crops?: Partial<Record<CropType, number>>;
    fruits?: Partial<Record<TreeType, number>>;
    duckEggs?: number;
  };
}

export const FARM_RECIPES: Recipe[] = [
  {
    id: 'wheat_bread',
    name: 'ขนมปังข้าวสาลีอบเตาถ่าน',
    nameEn: 'Fresh Wood-Fired Bread',
    emoji: '🥖',
    description: 'ขนมปังกรอบนอกนุ่มใน หอมกรุ่นกลิ่นข้าวสาลีเพิ่งเก็บเกี่ยวจากไร่ อบสดใหม่จากเตา',
    staminaGain: 30,
    xpGain: 18,
    ingredients: { crops: { wheat: 2 } },
  },
  {
    id: 'veggie_soup',
    name: 'ซุปมะเขือเทศและแครอทหอมกรุ่น',
    nameEn: 'Cozy Veggie Soup',
    emoji: '🥣',
    description: 'ซุปผักต้มเคี่ยวร้อนๆ อุดมด้วยวิตามิน คลายความล้าหลังทำสวนตลอดทั้งวัน',
    staminaGain: 35,
    xpGain: 20,
    ingredients: { crops: { tomato: 1, carrot: 1 } },
  },
  {
    id: 'pumpkin_pie',
    name: 'พายฟักทองทองคำอบเนย',
    nameEn: 'Golden Pumpkin Pie',
    emoji: '🥧',
    description: 'พายฟักทองสีทองกรุบกรอบ หวานละมุนชุ่มฉ่ำ ฟื้นฟูพลังกายชาวไร่อย่างดีเยี่ยม',
    staminaGain: 50,
    xpGain: 35,
    ingredients: { crops: { pumpkin: 1, wheat: 1 } },
  },
  {
    id: 'grilled_corn',
    name: 'ข้าวโพดหวานย่างเนยกระทะร้อน',
    nameEn: 'Sizzling Butter Sweetcorn',
    emoji: '🌽',
    description: 'ข้าวโพดหวานย่างเนยแท้บนเตาถ่าน กลิ่นหอมฟุ้ง รสสัมผัสกรุบกรอบหวานฉ่ำ',
    staminaGain: 25,
    xpGain: 15,
    ingredients: { crops: { corn: 2 } },
  },
  {
    id: 'fruit_salad',
    name: 'สลัดสตรอว์เบอร์รีและผลไม้สด',
    nameEn: 'Strawberry Orchard Salad',
    emoji: '🥗',
    description: 'สตรอว์เบอร์รีหวานอมเปรี้ยวคู่กับผลไม้สวนฉ่ำน้ำ สดชื่นกระปรี้กระเปร่าทันที',
    staminaGain: 45,
    xpGain: 28,
    ingredients: { crops: { strawberry: 1 }, fruits: { apple: 1 } },
  },
  {
    id: 'warm_fruit_tea',
    name: 'ชากลีบส้มและผลไม้อุ่น',
    nameEn: 'Warm Citrus Tea',
    emoji: '🍵',
    description: 'ชาผลไม้หอมกรุ่นผสมกลีบส้มหวานฉ่ำ จิบคลายเครียดอบอุ่นร่างกายในบ้านพัก',
    staminaGain: 20,
    xpGain: 12,
    ingredients: { fruits: { orange: 1 } },
  },
  {
    id: 'crispy_duck_omelette',
    name: 'ไข่เจียวเป็ดฟูกรอบสมุนไพร',
    nameEn: 'Crispy Herb Duck Omelette',
    emoji: '🍳',
    description: 'ไข่เป็ดสดตีฟูทอดร้อนๆ ในกระทะเหล็ก หอมกรอบนอกนุ่มใน เพิ่มพลังกายสุดคุ้ม',
    staminaGain: 48,
    xpGain: 32,
    ingredients: { duckEggs: 1 },
  },
  {
    id: 'braised_duck_eggs',
    name: 'ไข่เป็ดพะโล้หอมกรุ่น',
    nameEn: 'Savory Braised Duck Eggs',
    emoji: '🥚',
    description: 'ไข่เป็ดต้มเคี่ยวน้ำซุปเครื่องเทศหวานกลมกล่อมคู่แครอทสดจากแปลง',
    staminaGain: 68,
    xpGain: 46,
    ingredients: { duckEggs: 2, crops: { carrot: 1 } },
  },
  {
    id: 'duck_custard_tart',
    name: 'ทาร์ตคัสตาร์ดไข่เป็ดอบเตาถ่าน',
    nameEn: 'Wood-Fired Duck Custard Tart',
    emoji: '🥧',
    description: 'ทาร์ตแป้งข้าวสาลีสอดไส้คัสตาร์ดไข่เป็ดเข้มข้นหอมมัน อบสดใหม่จากเตาไม้',
    staminaGain: 85,
    xpGain: 58,
    ingredients: { duckEggs: 2, crops: { wheat: 2 } },
  },
];

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */
interface HouseInteriorModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: number;
  stamina: number;
  maxStamina: number;
  onSleep: () => void;
  inventoryCrops: Record<CropType, number>;
  inventoryTreeFruits: Record<TreeType, number>;
  inventoryDuckEggs?: number;
  onCookDish: (
    dishName: string,
    ingredients: {
      crops?: Partial<Record<CropType, number>>;
      fruits?: Partial<Record<TreeType, number>>;
      duckEggs?: number;
    },
    staminaGain: number,
    xpGain: number
  ) => boolean;
  playerGender: FarmerGender;
  addNotice: (msg: string, color?: string) => void;
}

/* ------------------------------------------------------------------ */
/* Layout Constants & Collision Helpers                                */
/* ------------------------------------------------------------------ */
type PoiKey = 'kitchen' | 'fireplace' | 'table' | 'bed';

const POI_LOCATIONS: Record<PoiKey, THREE.Vector3> = {
  kitchen: new THREE.Vector3(0.85, 0, 0.45),
  fireplace: new THREE.Vector3(-1.7, 0, -1.3),
  table: new THREE.Vector3(1.4, 0, -1.1),
  bed: new THREE.Vector3(-1.4, 0, 1.3),
};

const PLAYER_RADIUS = 0.22;
const POI_OBSTACLE_RADII: Record<PoiKey, number> = {
  kitchen: 0.55,
  fireplace: 0.65,
  table: 0.55,
  bed: 0.7,
};

const collidesAt = (x: number, z: number): boolean => {
  for (const key of Object.keys(POI_LOCATIONS) as PoiKey[]) {
    const p = POI_LOCATIONS[key];
    const r = POI_OBSTACLE_RADII[key] + PLAYER_RADIUS;
    if (Math.hypot(x - p.x, z - p.z) < r) return true;
  }
  return false;
};

const approachPointFor = (key: PoiKey, from: THREE.Vector3): THREE.Vector3 => {
  const p = POI_LOCATIONS[key];
  const r = POI_OBSTACLE_RADII[key] + PLAYER_RADIUS + 0.15;
  let dx = from.x - p.x;
  let dz = from.z - p.z;
  let len = Math.hypot(dx, dz);
  if (len < 0.001) {
    dx = 0;
    dz = 1;
    len = 1;
  }
  return new THREE.Vector3(p.x + (dx / len) * r, 0, p.z + (dz / len) * r);
};

/* ------------------------------------------------------------------ */
/* 3D Interior Viewport with Character & Interactive Walk              */
/* ------------------------------------------------------------------ */
interface InteriorViewportProps {
  fireplaceWarmth: boolean;
  playerGender: FarmerGender;
  activePoi: PoiKey | null;
  onSelectPoi: (poi: PoiKey) => void;
  isCookingAnimation: boolean;
  loadingLabel: string;
}

const InteriorViewport: React.FC<InteriorViewportProps> = ({
  fireplaceWarmth,
  playerGender,
  activePoi,
  onSelectPoi,
  isCookingAnimation,
  loadingLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const pointLightRef = useRef<THREE.PointLight | null>(null);

  const playerGroupRef = useRef<THREE.Group | null>(null);
  const playerTargetRef = useRef<THREE.Vector3 | null>(null);
  const leftLegRef = useRef<THREE.Group | null>(null);
  const rightLegRef = useRef<THREE.Group | null>(null);
  const leftArmRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Group | null>(null);
  const walkPhaseRef = useRef(0);
  const shadowRef = useRef<THREE.Mesh | null>(null);

  const isCookingRef = useRef(isCookingAnimation);
  useEffect(() => {
    isCookingRef.current = isCookingAnimation;
  }, [isCookingAnimation]);

  const onSelectPoiRef = useRef(onSelectPoi);
  useEffect(() => {
    onSelectPoiRef.current = onSelectPoi;
  }, [onSelectPoi]);

  useEffect(() => {
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = fireplaceWarmth ? 0.9 : 0.45;
      ambientLightRef.current.color.set(fireplaceWarmth ? 0xffb070 : 0xb8c8ff);
    }
    if (pointLightRef.current) {
      pointLightRef.current.intensity = fireplaceWarmth ? 5.0 : 1.5;
    }
  }, [fireplaceWarmth]);

  useEffect(() => {
    if (activePoi && POI_LOCATIONS[activePoi]) {
      const from = playerGroupRef.current?.position ?? new THREE.Vector3();
      playerTargetRef.current = approachPointFor(activePoi, from);
    }
  }, [activePoi]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const isMobile = isMobileViewportOrTouch();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0805);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(0, 3.5, 6.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap ถูกถอดออกจาก three แล้ว
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRenderTarget.texture;
      pmremGenerator.dispose();
    } catch {}

    const ambientLight = new THREE.AmbientLight(
      fireplaceWarmth ? 0xffb070 : 0xb8c8ff,
      fireplaceWarmth ? 0.9 : 0.45
    );
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xfff3e0, 1.2);
    dirLight.position.set(6, 8, 4);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = isMobile ? 512 : 1024;
    dirLight.shadow.mapSize.height = isMobile ? 512 : 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xff7733, fireplaceWarmth ? 5.0 : 1.5, 10);
    pointLight.position.set(-1.8, 1.5, -1.3);
    scene.add(pointLight);
    pointLightRef.current = pointLight;

    const stoveLight = new THREE.PointLight(0xffaa44, 1.2, 5);
    stoveLight.position.set(0.85, 1.0, 0.45);
    scene.add(stoveLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 15.0;
    controls.minPolarAngle = Math.PI / 8;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.target.set(0, 0.8, 0);
    // มือถือ: ใช้ 1 นิ้วเลื่อนเพื่อขยับเดินตัวละคร และใช้ 2 นิ้วซูม/หมุนมุมกล้อง
    controls.touches = {
      ONE: null as unknown as THREE.TOUCH,
      TWO: THREE.TOUCH.DOLLY_ROTATE,
    };

    // --- ปรับพื้นเป็นกระจกใส ---
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      metalness: 0.8,
      transmission: 0.9, // ให้แสงลอดผ่านแบบกระจก
      thickness: 1,
      side: THREE.DoubleSide,
    });
    const raycastFloor = new THREE.Mesh(floorGeo, floorMat);
    raycastFloor.rotation.x = -Math.PI / 2;
    raycastFloor.receiveShadow = true;
    scene.add(raycastFloor);

    const poiGroup = new THREE.Group();
    scene.add(poiGroup);

    // --- ปรับ POI เป็นวงกลมเล็กๆ กระจกใส ---
    const createPoiMarker = (pos: THREE.Vector3, colorHex: number, label: PoiKey) => {
      const group = new THREE.Group();
      group.position.copy(pos);
      group.position.y = 0.02;

      // แผ่นกระจกวงกลม
      const circleGeo = new THREE.CircleGeometry(0.22, 32);
      const circleMat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.5,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.8,
        thickness: 0.3,
        side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(circleGeo, circleMat);
      circle.rotation.x = -Math.PI / 2;
      group.add(circle);

      // ขอบวงแหวนเรืองแสง
      const ringGeo = new THREE.RingGeometry(0.22, 0.26, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      group.userData = { label };
      poiGroup.add(group);
      return group;
    };

    const kitchenRing = createPoiMarker(POI_LOCATIONS.kitchen, 0xf59e0b, 'kitchen');
    const fpRing = createPoiMarker(POI_LOCATIONS.fireplace, 0xef4444, 'fireplace');
    const tableRing = createPoiMarker(POI_LOCATIONS.table, 0x10b981, 'table');
    const bedRing = createPoiMarker(POI_LOCATIONS.bed, 0x8b5cf6, 'bed');

    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, 0, 0);
    playerGroupRef.current = playerGroup;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfc4, roughness: 0.6 });
    const hairMat = new THREE.MeshStandardMaterial({
      color: playerGender === 'female' ? 0x8d5b4c : 0x4a2e1b,
      roughness: 0.8,
    });
    const clothesMat = new THREE.MeshStandardMaterial({
      color: playerGender === 'female' ? 0xd97706 : 0x2563eb,
      roughness: 0.7,
    });
    const overallsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.9 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3f271d, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.38, 12), overallsMat);
    torso.position.y = 0.46;
    torso.castShadow = true;
    playerGroup.add(torso);

    const shirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.18, 12), clothesMat);
    shirtMesh.position.y = 0.54;
    shirtMesh.castShadow = true;
    playerGroup.add(shirtMesh);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), skinMat);
    head.position.y = 0.82;
    head.castShadow = true;
    playerGroup.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      hairMat
    );
    hair.position.y = 0.85;
    hair.castShadow = true;
    playerGroup.add(hair);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 16), strawMat);
    hatBrim.position.y = 0.95;
    hatBrim.castShadow = true;
    playerGroup.add(hatBrim);

    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.18, 16), strawMat);
    hatCrown.position.y = 1.04;
    hatCrown.castShadow = true;
    playerGroup.add(hatCrown);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.09, 0.28, 0);
    const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.28, 10), overallsMat);
    leftLegMesh.position.y = -0.14;
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);
    const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.16), shoeMat);
    leftShoe.position.set(0, -0.26, 0.03);
    leftLeg.add(leftShoe);
    playerGroup.add(leftLeg);
    leftLegRef.current = leftLeg;

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.09, 0.28, 0);
    const rightLegMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.06, 0.28, 10),
      overallsMat
    );
    rightLegMesh.position.y = -0.14;
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);
    const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.16), shoeMat);
    rightShoe.position.set(0, -0.26, 0.03);
    rightLeg.add(rightShoe);
    playerGroup.add(rightLeg);
    rightLegRef.current = rightLeg;

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.24, 0.6, 0);
    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.3, 8), clothesMat);
    leftArmMesh.position.y = -0.14;
    leftArm.add(leftArmMesh);
    playerGroup.add(leftArm);
    leftArmRef.current = leftArm;

    const rightArm = new THREE.Group();
    rightArm.position.set(0.24, 0.6, 0);
    const rightArmMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.045, 0.3, 8),
      clothesMat
    );
    rightArmMesh.position.y = -0.14;
    rightArm.add(rightArmMesh);
    playerGroup.add(rightArm);
    rightArmRef.current = rightArm;

    scene.add(playerGroup);

    const shadowGeo = new THREE.CircleGeometry(0.3, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.01, 0);
    scene.add(shadow);
    shadowRef.current = shadow;

    let isDisposed = false;

    const buildFallbackRoom = () => {
      if (isDisposed) return;
      const roomGroup = new THREE.Group();

      const fGeo = new THREE.PlaneGeometry(6, 6);
      const fMat = new THREE.MeshStandardMaterial({ color: 0x4a2c17, roughness: 0.8 });
      const fl = new THREE.Mesh(fGeo, fMat);
      fl.rotation.x = -Math.PI / 2;
      fl.receiveShadow = true;
      roomGroup.add(fl);

      const wMat = new THREE.MeshStandardMaterial({ color: 0x331c10, roughness: 0.9 });
      const bw = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5), wMat);
      bw.position.set(0, 1.75, -3);
      bw.receiveShadow = true;
      roomGroup.add(bw);

      const stoveMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5 });
      const stove = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.7), stoveMat);
      stove.position.copy(POI_LOCATIONS.kitchen);
      stove.position.y = 0.45;
      stove.castShadow = true;
      roomGroup.add(stove);

      const fp = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.4, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x1f1f1f })
      );
      fp.position.copy(POI_LOCATIONS.fireplace);
      fp.position.y = 0.7;
      roomGroup.add(fp);

      scene.add(roomGroup);

      camera.position.set(0, 3.5, 6.5);
      controls.target.set(0, 1.0, 0);
      controls.maxDistance = 15;
      controls.update();

      setIsLoading(false);
    };

    /* Load Model via Validated GLB Pipeline */
    loadValidatedGLTF(MODEL_URL)
      .then(({ gltf, inspection }) => {
        if (isDisposed) {
          disposeHierarchySafely(gltf.scene);
          return;
        }
        const model = gltf.scene;
        optimizeGLTFSceneForDevice(model, inspection);

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);
        model.position.y += size.y / 2;
        scene.add(model);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fitDistance = Math.max(4.5, maxDim * 1.15);
        const camHeight = Math.max(2.5, size.y * 0.65 + maxDim * 0.1);
        camera.position.set(0, camHeight, fitDistance);
        controls.target.set(0, size.y * 0.25, 0);
        controls.maxDistance = Math.max(15, fitDistance * 1.5);
        controls.minDistance = Math.max(1.5, maxDim * 0.15);
        controls.update();

        setIsLoading(false);
      })
      .catch(() => {
        buildFallbackRoom();
      });

    /* Touch Slide-to-Walk (Mobile 1-finger slide) + Tap POI Selection */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let lastPickMs = 0;

    let activeTouchId: number | null = null;
    let slideOriginX = 0;
    let slideOriginY = 0;
    let slideCurrentX = 0;
    let slideCurrentY = 0;
    let isTouchSliding = false;
    let lastAutoPoi: PoiKey | null = null;
    const SLIDE_DEADZONE_PX = 10;
    const SLIDE_MAX_RADIUS_PX = 48;
    const _camFwd = new THREE.Vector3();

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        activeTouchId = null;
        isTouchSliding = false;
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        activeTouchId = t.identifier;
        slideOriginX = t.clientX;
        slideOriginY = t.clientY;
        slideCurrentX = t.clientX;
        slideCurrentY = t.clientY;
        isTouchSliding = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (activeTouchId === null) return;
      if (e.touches.length >= 2) {
        activeTouchId = null;
        isTouchSliding = false;
        return;
      }
      let tracked: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === activeTouchId) {
          tracked = e.touches[i];
          break;
        }
      }
      if (!tracked) return;

      slideCurrentX = tracked.clientX;
      slideCurrentY = tracked.clientY;
      const dx = slideCurrentX - slideOriginX;
      const dy = slideCurrentY - slideOriginY;
      const dist = Math.hypot(dx, dy);

      if (!isTouchSliding && dist >= SLIDE_DEADZONE_PX) {
        isTouchSliding = true;
        playerTargetRef.current = null;
      }
      if (dist > SLIDE_MAX_RADIUS_PX) {
        const pull = (dist - SLIDE_MAX_RADIUS_PX) / dist;
        slideOriginX += dx * pull;
        slideOriginY += dy * pull;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          activeTouchId = null;
          isTouchSliding = false;
          return;
        }
      }
      if (e.touches.length === 0) {
        activeTouchId = null;
        isTouchSliding = false;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const now = performance.now();
      if (now - lastPickMs < 80) return;
      lastPickMs = now;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const poiHits = raycaster.intersectObjects(poiGroup.children, true);
      if (poiHits.length > 0) {
        let hitObj = poiHits[0].object;
        while (hitObj && !hitObj.userData?.label && hitObj.parent) {
          hitObj = hitObj.parent;
        }
        const hitPoi = hitObj?.userData?.label as PoiKey;

        if (hitPoi && POI_LOCATIONS[hitPoi]) {
          const from = playerGroupRef.current?.position ?? new THREE.Vector3();
          playerTargetRef.current = approachPointFor(hitPoi, from);
          onSelectPoiRef.current(hitPoi);
          return;
        }
      }

      // บนมือถือให้ใช้การเลื่อนนิ้วเดินแทน ไม่จำเป็นต้องกดเดินบนพื้น
      if (event.pointerType === 'touch') {
        return;
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    let animationFrameId: number;
    // THREE.Clock ถูก deprecate → จับเวลาเองด้วย performance.now()
    const clockStart = performance.now();
    let clockLast = clockStart;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const delta = Math.min(0.1, (nowMs - clockLast) / 1000);
      clockLast = nowMs;
      const elapsed = (nowMs - clockStart) / 1000;

      const pulseScale = 1 + Math.sin(elapsed * 4) * 0.08;
      kitchenRing.scale.set(pulseScale, 1, pulseScale);
      fpRing.scale.set(pulseScale, 1, pulseScale);
      tableRing.scale.set(pulseScale, 1, pulseScale);
      bedRing.scale.set(pulseScale, 1, pulseScale);

      if (playerGroupRef.current) {
        const p = playerGroupRef.current;
        const target = playerTargetRef.current;

        const slideDx = slideCurrentX - slideOriginX;
        const slideDy = slideCurrentY - slideOriginY;
        const slideDist = Math.hypot(slideDx, slideDy);
        const usingSlideMove =
          isTouchSliding && activeTouchId !== null && slideDist >= SLIDE_DEADZONE_PX;

        if (usingSlideMove) {
          camera.getWorldDirection(_camFwd);
          _camFwd.y = 0;
          if (_camFwd.lengthSq() < 1e-5) {
            _camFwd.set(0, 0, -1);
          } else {
            _camFwd.normalize();
          }
          const rx = -_camFwd.z;
          const rz = _camFwd.x;
          const fwdAxis = -slideDy / slideDist;
          const rightAxis = slideDx / slideDist;

          const wx = _camFwd.x * fwdAxis + rx * rightAxis;
          const wz = _camFwd.z * fwdAxis + rz * rightAxis;
          const wLen = Math.hypot(wx, wz) || 1;
          const ux = wx / wLen;
          const uz = wz / wLen;

          const speedRatio =
            0.4 +
            0.6 *
              Math.min(
                1,
                Math.max(0, (slideDist - SLIDE_DEADZONE_PX) / (SLIDE_MAX_RADIUS_PX - SLIDE_DEADZONE_PX))
              );
          const step = 2.6 * speedRatio * delta;

          const targetHeading = Math.atan2(ux, uz);
          let angleDiff = targetHeading - p.rotation.y;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          p.rotation.y += angleDiff * Math.min(1, delta * 12);

          const nx = Math.max(-2.5, Math.min(2.5, p.position.x + ux * step));
          const nz = Math.max(-2.2, Math.min(2.2, p.position.z + uz * step));

          let moved = false;
          if (!collidesAt(nx, nz)) {
            p.position.x = nx;
            p.position.z = nz;
            moved = true;
          } else {
            if (!collidesAt(nx, p.position.z)) {
              p.position.x = nx;
              moved = true;
            }
            if (!collidesAt(p.position.x, nz)) {
              p.position.z = nz;
              moved = true;
            }
          }

          if (moved) {
            walkPhaseRef.current += delta * 12 * speedRatio;
            const swing = Math.sin(walkPhaseRef.current) * 0.45;
            if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
            if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
            if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7;
            if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7;
            p.position.y = Math.abs(Math.sin(walkPhaseRef.current * 2)) * 0.03;

            let nearPoi: PoiKey | null = null;
            let bestPoiDist = 1.05;
            for (const key of Object.keys(POI_LOCATIONS) as PoiKey[]) {
              const d = Math.hypot(POI_LOCATIONS[key].x - p.position.x, POI_LOCATIONS[key].z - p.position.z);
              if (d < bestPoiDist) {
                bestPoiDist = d;
                nearPoi = key;
              }
            }
            if (nearPoi && nearPoi !== lastAutoPoi) {
              lastAutoPoi = nearPoi;
              onSelectPoiRef.current(nearPoi);
            } else if (!nearPoi) {
              lastAutoPoi = null;
            }
          }
        } else if (target) {
          const dx = target.x - p.position.x;
          const dz = target.z - p.position.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0.08) {
            const targetHeading = Math.atan2(dx, dz);
            p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, targetHeading, 0.2);

            const moveSpeed = 2.4;
            const step = Math.min(dist, moveSpeed * delta);
            const ux = dx / dist;
            const uz = dz / dist;
            const nx = p.position.x + ux * step;
            const nz = p.position.z + uz * step;

            let moved = false;
            if (!collidesAt(nx, nz)) {
              p.position.x = nx;
              p.position.z = nz;
              moved = true;
            } else {
              if (!collidesAt(nx, p.position.z)) {
                p.position.x = nx;
                moved = true;
              }
              if (!collidesAt(p.position.x, nz)) {
                p.position.z = nz;
                moved = true;
              }
              if (!moved) {
                playerTargetRef.current = null;
              }
            }

            if (moved) {
              walkPhaseRef.current += delta * 12;
              const swing = Math.sin(walkPhaseRef.current) * 0.45;
              if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
              if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
              if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7;
              if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7;
              p.position.y = Math.abs(Math.sin(walkPhaseRef.current * 2)) * 0.03;
            }
          } else {
            playerTargetRef.current = null;
            p.position.y = 0;
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
            if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = 0;
              rightArmRef.current.rotation.z = 0;
            }
          }
        } else {
          p.position.y = Math.sin(elapsed * 2.5) * 0.015;
          if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
          if (rightLegRef.current) rightLegRef.current.rotation.x = 0;

          if (isCookingRef.current) {
            const cookSwing = Math.sin(elapsed * 10) * 0.5;
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = -0.8 + cookSwing * 0.2;
              rightArmRef.current.rotation.z = -0.3 + cookSwing * 0.3;
            }
            if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
          } else {
            if (rightArmRef.current) {
              rightArmRef.current.rotation.x = 0;
              rightArmRef.current.rotation.z = 0;
            }
            if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
          }
        }

        if (shadowRef.current) {
          shadowRef.current.position.x = p.position.x;
          shadowRef.current.position.z = p.position.z;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      controls.dispose();

      disposeHierarchySafely(scene);
      envRenderTarget?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      scene.clear();
    };
  }, [playerGender]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-pointer" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0f0805]/80 backdrop-blur-xs pointer-events-none">
          <div className="text-amber-300 text-xs font-medium tracking-wide whitespace-nowrap flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{loadingLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main House Interior Component                                       */
/* ------------------------------------------------------------------ */
export const HouseInteriorModal: React.FC<HouseInteriorModalProps> = ({
  isOpen,
  onClose,
  day,
  stamina,
  maxStamina,
  onSleep,
  inventoryCrops,
  inventoryTreeFruits,
  inventoryDuckEggs = 0,
  onCookDish,
  playerGender,
  addNotice,
}) => {
  const { lang, t } = useLanguage();
  const [cookingMessage, setCookingMessage] = useState<string | null>(null);
  const [fireplaceWarmth, setFireplaceWarmth] = useState(false);
  const [activeTab, setActiveTab] = useState<'roam' | 'cook'>('roam');
  const [activePoi, setActivePoi] = useState<PoiKey | null>(null);
  const [cookingInProgress, setCookingInProgress] = useState<string | null>(null);
  // Full Immersive: เริ่มต้นด้วยการซ่อน UI แต่คงฉาก 3D ไว้
  const [isUiHidden, setIsUiHidden] = useState(true);

  if (!isOpen) return null;

  const handleWarmUp = () => {
    farmAudio.playClickSound();
    setActivePoi('fireplace');
    setFireplaceWarmth(true);
    addNotice(
      t(
        '🔥 ความอบอุ่นจากเตาผิงแผ่ซ่าน อุณหภูมิในห้องอบอุ่นขึ้น',
        '🔥 Cozy fireplace warmth fills the cabin'
      ),
      '#ff9800'
    );
    setTimeout(() => setFireplaceWarmth(false), 4000);
  };

  const handleCookTea = () => {
    farmAudio.playHarvestSound();
    setActivePoi('table');
    setCookingMessage(
      t(
        '🍵 คุณจิบชาร้อนหอมกรุ่นจากใบชาในฟาร์ม ผ่อนคลายร่างกายและจิตใจ',
        '🍵 You sip warm farmstead herbal tea and relax'
      )
    );
    setTimeout(() => setCookingMessage(null), 4000);
  };

  const handleRestBed = () => {
    setActivePoi('bed');
    onSleep();
  };

  const handleWalkToKitchen = () => {
    setActivePoi('kitchen');
    farmAudio.playClickSound();
    addNotice(
      t('🚶 เดินไปที่เคาน์เตอร์เตาครัวปรุงอาหาร...', '🚶 Walking to the kitchen counter...'),
      '#f59e0b'
    );
    setTimeout(() => {
      setActiveTab('cook');
    }, 600);
  };

  const handleExecuteCooking = (recipe: Recipe) => {
    setCookingInProgress(recipe.id);
    farmAudio.playHarvestSound();

    const displayDishName = lang === 'en' ? recipe.nameEn : recipe.name;
    const success = onCookDish(
      displayDishName,
      recipe.ingredients,
      recipe.staminaGain,
      recipe.xpGain
    );

    setTimeout(() => {
      setCookingInProgress(null);
      if (success) {
        setCookingMessage(
          t(
            `🍲 ปรุงเมนู "${recipe.name}" หอมกรุ่นเสร็จสมบูรณ์!`,
            `🍲 Freshly cooked "${recipe.nameEn}"!`
          )
        );
        setTimeout(() => setCookingMessage(null), 4000);
      } else {
        addNotice(
          t(
            `❌ ไม่สามารถปรุง "${recipe.name}" ได้ (วัตถุดิบอาจไม่เพียงพอ)`,
            `❌ Cannot cook "${recipe.nameEn}" (missing ingredients)`
          ),
          '#ef4444'
        );
      }
    }, 700);
  };

  const checkCanCook = (recipe: Recipe) => {
    if (recipe.ingredients.duckEggs && inventoryDuckEggs < recipe.ingredients.duckEggs) {
      return false;
    }
    if (recipe.ingredients.crops) {
      for (const [c, needed] of Object.entries(recipe.ingredients.crops)) {
        if (needed && (inventoryCrops[c as CropType] || 0) < needed) return false;
      }
    }
    if (recipe.ingredients.fruits) {
      for (const [f, needed] of Object.entries(recipe.ingredients.fruits)) {
        if (needed && (inventoryTreeFruits[f as TreeType] || 0) < needed) return false;
      }
    }
    return true;
  };

  return (
    // Outer Background แบบเต็มจอ พร้อมกระจกฝ้าโปร่งแสง
    <div className="fixed inset-0 z-50 flex bg-black/60 animate-in fade-in duration-200">
      <div className={`relative w-full h-full text-amber-100 flex flex-col overflow-hidden transition-all duration-300 ${
        isUiHidden
          ? 'p-0 gap-0 bg-transparent border-0 shadow-none'
          : 'bg-[#1a0f0a]/70 backdrop-blur-2xl p-2.5 sm:p-4 shadow-2xl gap-3 sm:gap-4 border border-white/10'
      }`}>
        {/* Top Header: ซ่อนใน Full Immersive */}
        {!isUiHidden && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl sm:text-2xl p-2 bg-white/5 border border-white/10 rounded-2xl shadow-inner shrink-0 backdrop-blur-sm">
              🏡
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-black text-amber-200 tracking-wide truncate drop-shadow-md">
                  {t('บ้านพักชาวไร่ & ครัวทำอาหาร', 'Cozy Farmhouse & Kitchen')}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40 whitespace-nowrap backdrop-blur-sm">
                  {playerGender === 'female'
                    ? t('👩 ชาวไร่สาว', '👩 Female Farmer')
                    : t('👨 ชาวไร่หนุ่ม', '👨 Male Farmer')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 backdrop-blur-md">
              <button
                onClick={() => setActiveTab('roam')}
                className={`min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'roam'
                    ? 'bg-amber-500/90 text-amber-950 shadow-md'
                    : 'text-amber-300 hover:text-amber-100 hover:bg-white/5'
                }`}
              >
                <Footprints className="w-3.5 h-3.5 shrink-0" />
                <span>{t('สำรวจห้อง 3D', '3D Room')}</span>
              </button>
              <button
                onClick={() => setActiveTab('cook')}
                className={`min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'cook'
                    ? 'bg-amber-500/90 text-stone-950 shadow-md'
                    : 'text-amber-300 hover:text-amber-100 hover:bg-white/5'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5 shrink-0" />
                <span>{t('ครัวทำอาหาร', 'Kitchen')}</span>
              </button>
            </div>

            <button
              onClick={() => {
                farmAudio.playDoorSound();
                onClose();
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-white/10 transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
              title={t('ออกจากบ้านพัก', 'Exit Farmhouse')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        )}

        {/* Tab 1: 3D Viewport */}
        {activeTab === 'roam' && (
          <div
            className={`${
              isUiHidden
                ? 'absolute inset-0 z-0 flex flex-col'
                : 'relative flex flex-col flex-1 min-h-0 gap-3'
            }`}
          >
            <div
              className={`${
                isUiHidden
                  ? 'absolute inset-0 rounded-none border-0 shadow-none bg-black'
                  : 'relative flex-1 rounded-2xl border border-white/10 shadow-inner bg-black/20'
              } overflow-hidden`}
            >
              <InteriorViewport
                fireplaceWarmth={fireplaceWarmth}
                playerGender={playerGender}
                activePoi={activePoi}
                onSelectPoi={(poi) => {
                  setActivePoi(poi);
                  if (poi === 'kitchen') {
                    addNotice(
                      t(
                        '🍳 คุณเดินมาถึงเคาน์เตอร์เตาครัวแล้ว! แตะเพื่อปรุงอาหาร',
                        '🍳 Reached the kitchen counter! Tap Kitchen to cook'
                      ),
                      '#f59e0b'
                    );
                  } else if (poi === 'fireplace') {
                    handleWarmUp();
                  } else if (poi === 'table') {
                    handleCookTea();
                  }
                }}
                isCookingAnimation={cookingInProgress !== null}
                loadingLabel={t(
                  'กำลังโหลดบรรยากาศและตัวละครภายในบ้าน...',
                  'Loading 3D cabin interior...'
                )}
              />

              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-black/20" />

              {!isUiHidden && (
              <div className="absolute top-2.5 left-3 flex items-center gap-2 text-[10px] sm:text-xs text-amber-200/90 font-mono pointer-events-none bg-black/40 px-2.5 py-1 rounded-xl backdrop-blur-md border border-white/10">
                <Footprints className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  {t(
                    'แตะบนพื้นเพื่อเดิน • ลากเพื่อหมุนมุมมอง 3D',
                    'Tap floor to walk • Drag to orbit 3D view'
                  )}
                </span>
              </div>
              )}

              {!isUiHidden && cookingMessage && (
                <div className="absolute top-11 sm:top-2.5 right-3 left-3 sm:left-auto bg-emerald-950/80 text-emerald-200 border border-emerald-500/50 rounded-xl px-3 py-1.5 text-xs font-semibold animate-in fade-in flex items-center gap-1.5 shadow-lg backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{cookingMessage}</span>
                </div>
              )}
            </div>

            {/* Compact Action Grid: แสดงเมื่อเปิด UI */}
            {!isUiHidden && (
            <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <button
                onClick={handleWalkToKitchen}
                className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all active:scale-95 shadow-lg cursor-pointer backdrop-blur-md"
              >
                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform drop-shadow-md">🍳</span>
                <span className="text-xs font-bold text-amber-200">{t('เปิดครัว', 'Kitchen')}</span>
                <span className="text-[10px] text-amber-400/80">
                  {t(`${FARM_RECIPES.length} เมนู`, `${FARM_RECIPES.length} Recipes`)}
                </span>
              </button>

              <button
                onClick={handleRestBed}
                className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-indigo-500/10 border border-indigo-400/20 hover:border-indigo-400/50 hover:bg-indigo-500/20 transition-all active:scale-95 shadow-lg cursor-pointer backdrop-blur-md"
              >
                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform drop-shadow-md">🛏️</span>
                <span className="text-xs font-bold text-indigo-200">{t('เข้านอน', 'Sleep')}</span>
                <span className="text-[10px] text-indigo-300/80">+{maxStamina} Stamina</span>
              </button>

              <button
                onClick={handleWarmUp}
                className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-white/10 transition-all active:scale-95 shadow-lg cursor-pointer backdrop-blur-md"
              >
                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform drop-shadow-md">🔥</span>
                <span className="text-xs font-bold text-amber-200">{t('ผิงไฟ', 'Fireplace')}</span>
                <span className="text-[10px] text-amber-400/80">{t('อบอุ่น', 'Warmth')}</span>
              </button>

              <button
                onClick={handleCookTea}
                className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-white/10 transition-all active:scale-95 shadow-lg cursor-pointer backdrop-blur-md"
              >
                <span className="text-3xl mb-1 group-hover:scale-110 transition-transform drop-shadow-md">☕</span>
                <span className="text-xs font-bold text-amber-200">{t('ดื่มชา', 'Tea')}</span>
                <span className="text-[10px] text-amber-400/80">{t('ผ่อนคลาย', 'Relax')}</span>
              </button>
            </div>
            )}

          </div>
        )}

        {/* Tab 2: Cooking Station */}
        {activeTab === 'cook' && (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <div className="flex items-center justify-between gap-2 bg-white/5 p-3 rounded-2xl border border-white/10 shrink-0 flex-wrap backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-amber-200">
                  {t(
                    'เลือกเมนูที่ต้องการปรุงด้วยผลผลิตจากไร่',
                    'Choose a recipe to cook with fresh farm ingredients'
                  )}
                </span>
              </div>
              <div className="text-xs text-amber-300/80 font-mono">
                {t('พลังกาย:', 'Stamina:')}{' '}
                <strong className="text-emerald-400">
                  {stamina}/{maxStamina}
                </strong>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
                {FARM_RECIPES.map((recipe) => {
                  const canCook = checkCanCook(recipe);
                  const isCookingThis = cookingInProgress === recipe.id;
                  const title = lang === 'en' ? recipe.nameEn : recipe.name;
                  const subtitle = lang === 'en' ? recipe.name : recipe.nameEn;
                  const desc =
                    lang === 'en' ? RECIPE_DESC_EN[recipe.id] || recipe.description : recipe.description;

                  return (
                    <div
                      key={recipe.id}
                      className={`relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 backdrop-blur-md ${
                        canCook
                          ? 'bg-white/10 border-white/20 hover:bg-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.1)]'
                          : 'bg-black/20 border-white/5 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-2xl p-1 bg-white/10 rounded-xl border border-white/10 shrink-0 shadow-sm backdrop-blur-sm">
                              {recipe.emoji}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-amber-100 text-sm truncate drop-shadow-sm">{title}</h4>
                              <span className="text-[10px] text-amber-400/80 font-mono truncate block">
                                {subtitle}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap backdrop-blur-sm">
                              +{recipe.staminaGain} {t('พลังกาย', 'Stamina')}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap backdrop-blur-sm">
                              +{recipe.xpGain} XP
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-stone-300 mb-2 leading-relaxed">{desc}</p>

                        {/* วัตถุดิบแบบวงกลมเล็กๆ กระจกใส */}
                        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/10">
                          <span className="text-[10px] text-stone-400 font-medium">
                            {t('วัตถุดิบ:', 'Ingredients:')}
                          </span>
                          
                          {recipe.ingredients.crops &&
                            Object.entries(recipe.ingredients.crops).map(([c, need]) => {
                              const have = inventoryCrops[c as CropType] || 0;
                              const hasEnough = have >= (need || 0);
                              const def = CROP_DEFINITIONS[c as CropType];
                              return (
                                <div
                                  key={c}
                                  className={`relative flex items-center justify-center w-9 h-9 rounded-full border shadow-md backdrop-blur-md transition-all group ${
                                    hasEnough
                                      ? 'bg-emerald-500/20 border-emerald-400/50'
                                      : 'bg-rose-500/20 border-rose-400/50'
                                  }`}
                                  title={`${getCropName(c as CropType, lang)} (${have}/${need})`}
                                >
                                  <span className="text-lg drop-shadow-md group-hover:scale-110 transition-transform">{def?.iconEmoji || '🌱'}</span>
                                  <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm ${
                                    hasEnough ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-rose-950 text-rose-300 border-rose-600'
                                  }`}>
                                    {have}/{need}
                                  </span>
                                </div>
                              );
                            })}

                          {recipe.ingredients.fruits &&
                            Object.entries(recipe.ingredients.fruits).map(([f, need]) => {
                              const have = inventoryTreeFruits[f as TreeType] || 0;
                              const hasEnough = have >= (need || 0);
                              const def = TREE_DEFINITIONS[f as TreeType];
                              return (
                                <div
                                  key={f}
                                  className={`relative flex items-center justify-center w-9 h-9 rounded-full border shadow-md backdrop-blur-md transition-all group ${
                                    hasEnough
                                      ? 'bg-emerald-500/20 border-emerald-400/50'
                                      : 'bg-rose-500/20 border-rose-400/50'
                                  }`}
                                  title={`${getTreeFruitName(f as TreeType, lang)} (${have}/${need})`}
                                >
                                  <span className="text-lg drop-shadow-md group-hover:scale-110 transition-transform">{def?.iconEmoji || '🍎'}</span>
                                  <span className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm ${
                                    hasEnough ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-rose-950 text-rose-300 border-rose-600'
                                  }`}>
                                    {have}/{need}
                                  </span>
                                </div>
                              );
                            })}

                          {recipe.ingredients.duckEggs && recipe.ingredients.duckEggs > 0 && (() => {
                            const need = recipe.ingredients.duckEggs;
                            const have = inventoryDuckEggs;
                            const hasEnough = have >= need;
                            return (
                              <div
                                className={`relative flex items-center justify-center w-9 h-9 rounded-full border shadow-md backdrop-blur-md transition-all group ${
                                  hasEnough
                                    ? 'bg-emerald-500/20 border-emerald-400/50'
                                    : 'bg-rose-500/20 border-rose-400/50'
                                }`}
                                title={`${t('ไข่เป็ดสด', 'Fresh Duck Egg')} (${have}/${need})`}
                              >
                                <span className="text-lg drop-shadow-md group-hover:scale-110 transition-transform">
                                  🥚
                                </span>
                                <span
                                  className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm ${
                                    hasEnough
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                      : 'bg-rose-950 text-rose-300 border-rose-600'
                                  }`}
                                >
                                  {have}/{need}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleExecuteCooking(recipe)}
                        disabled={!canCook || isCookingThis}
                        className={`w-full min-h-[38px] py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg cursor-pointer backdrop-blur-sm ${
                          canCook
                            ? 'bg-gradient-to-r from-amber-400/90 via-amber-500/90 to-yellow-500/90 text-stone-950 hover:brightness-110 border border-amber-300/50'
                            : 'bg-black/40 text-stone-500 cursor-not-allowed border border-white/5'
                        }`}
                      >
                        {isCookingThis ? (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-stone-950 border-t-transparent animate-spin" />
                            <span>{t('กำลังปรุงอาหารบนเตา...', 'Cooking...')}</span>
                          </>
                        ) : canCook ? (
                          <>
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>{t('ปรุงเมนูนี้', 'Cook Dish')}</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{t('วัตถุดิบไม่เพียงพอ', 'Missing Ingredients')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Slim Footer Bar: ซ่อนใน Full Immersive */}
        {!isUiHidden && (
        <div className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <div className="text-xs text-stone-300 flex items-center gap-3 min-w-0">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Heart className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {t('พลังกาย:', 'Stamina:')}{' '}
                <strong className="text-amber-200">{stamina}</strong>/{maxStamina}
              </span>
            </span>
            <span className="text-stone-500 hidden sm:inline">•</span>
            <span className="text-amber-400/80 text-[11px] truncate hidden sm:inline">
              {activeTab === 'roam'
                ? t(
                    '💡 แตะพื้นห้องเพื่อให้ชาวไร่เดิน',
                    '💡 Tap the floor to walk around the cabin'
                  )
                : t(
                    '💡 อาหารช่วยฟื้นฟูพลังกายโดยไม่ต้องนอนหลับ',
                    '💡 Cooked meals restore Stamina without ending the day'
                  )}
            </span>
          </div>

          <button
            onClick={() => {
              farmAudio.playDoorSound();
              onClose();
            }}
            className="min-h-[36px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap backdrop-blur-md shadow-sm"
          >
            <LogOut className="w-4 h-4 text-amber-400" />
            <span>{t('ออกจากบ้าน', 'Step Outside')}</span>
          </button>
        </div>
        )}

        {/* ปุ่มลอยเปิด/ซ่อน UI — อยู่นอกส่วนที่ถูกซ่อนเสมอ */}
        <button
          type="button"
          onClick={() => {
            if (!isUiHidden && activeTab === 'cook') {
              setActiveTab('roam');
            }
            setIsUiHidden((hidden) => !hidden);
          }}
          className="fixed top-4 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white shadow-xl backdrop-blur-md transition-all hover:bg-black/65 active:scale-90"
          title={isUiHidden ? t('แสดงเมนู', 'Show menu') : t('ซ่อนเมนู', 'Hide menu')}
          aria-label={isUiHidden ? t('แสดงเมนู', 'Show menu') : t('ซ่อนเมนู', 'Hide menu')}
        >
          {isUiHidden ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>

        {/* ปุ่มออกจากบ้าน — ใช้งานได้แม้ซ่อน UI */}
        <button
          type="button"
          onClick={() => {
            farmAudio.playDoorSound();
            onClose();
          }}
          className="fixed bottom-4 right-4 z-[100] flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white shadow-xl backdrop-blur-md transition-all hover:bg-black/65 active:scale-90"
          title={t('ออกจากบ้านพัก', 'Exit Farmhouse')}
          aria-label={t('ออกจากบ้านพัก', 'Exit Farmhouse')}
        >
          <LogOut className="h-5 w-5" />
        </button>

      </div>
    </div>
  );
};