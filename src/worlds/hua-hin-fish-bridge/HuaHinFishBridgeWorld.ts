// src/worlds/hua-hin-fish-bridge/HuaHinFishBridgeWorld.ts
// ตัวรัน World สะพานปลาหัวหิน: ใช้ FarmPlayer3D / HayDayCameraController / PlayerKeyboardWASD /
// PlayerTouchSlideMove ตัวเดิม (ไม่สร้าง Player Controller ใหม่) เรนเดอร์ใน renderer ของตัวเอง
// ส่วน Farm Scene ถูกหยุดเรนเดอร์ (renderPaused) และไม่ถูกทำลาย → ข้อมูลฟาร์ม/กระเป๋า/เหรียญไม่หาย
import * as THREE from 'three';
import { FarmPlayer3D } from '../../components/3d/FarmPlayer';
import { HayDayCameraController } from '../../engine/camera/HayDayCameraController';
import { PlayerKeyboardWASD } from '../../game/player/PlayerKeyboardWASD';
import { PlayerTouchSlideMove } from '../../game/player/PlayerTouchSlideMove';
import type { FarmerGender, PlayerOutfitConfig } from '../../types/game';
import { createFishBridgeEnvironment, type FishBridgeEnvironment } from './environment/FishBridgeEnvironment';
import { BRIDGE } from './environment/StoneBridge';
import { createPierVendors, type PierVendors, type VendorInfo } from './environment/PierVendors';
import { HORIZON_COLOR } from './environment/PierHarbor';
import { WORLD_IDS, getWorldDefinition } from '../../core/world/WorldRegistry';
import { getSavedWorldPosition, saveWorldPosition } from './HuaHinFishBridgeState';

export interface FishBridgeWorldOptions {
  container: HTMLElement;
  gender: FarmerGender;
  outfit?: PlayerOutfitConfig;
  isCompact: boolean;
  onNearGatewayChange: (near: boolean) => void;
  /** ผู้เล่นเดินเข้า/ออกระยะโต้ตอบของคนขายประจำแผง (ใช้เปิดป้าย "คุยกับพ่อค้า" / หน้าต่างซื้อขาย) */
  onNearVendorChange?: (vendor: VendorInfo | null) => void;
}

const SAVE_INTERVAL_SEC = 3; // ✅ FIX RISK-2: 2 → 3 วิ (ลด jank จาก localStorage sync)

export class HuaHinFishBridgeWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private env: FishBridgeEnvironment;
  private vendors: PierVendors;
  private nearVendorId: string | null = null;
  private player: FarmPlayer3D;
  private cameraControls: HayDayCameraController;
  private wasd = new PlayerKeyboardWASD();
  private touch = new PlayerTouchSlideMove();
  
  // ✅ FIX: ใช้ performance.now() แทน THREE.Clock/Timer
  private lastTime = performance.now();
  private startTime = this.lastTime;
  private elapsed = 0;

  private raf = 0;
  private disposed = false;
  private inputEnabled = false;
  private nearGateway = false;
  private lastSave = 0;
  private resizeObserver: ResizeObserver;
  private readonly moveDir = { x: 0, z: 0 };
  
  // ✅ FIX: หยุดนับเวลาเมื่อ tab hidden (กัน delta กระโดดตอนกลับมา)
  private onVisibilityChange = (): void => {
    if (!document.hidden) {
      this.lastTime = performance.now();
    }
  };

  constructor(private opts: FishBridgeWorldOptions) {
    const { container } = opts;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.isCompact, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.isCompact ? 1.35 : 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !opts.isCompact;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // ✅ FIX RISK-6: ครอบ try/catch → cleanup canvas ถ้า constructor throw กลางทาง
    let appended = false;
    try {
      container.appendChild(this.renderer.domElement);
      appended = true;
      this.renderer.domElement.style.touchAction = 'none';

      // สีขอบฟ้าเดียวกับท้องฟ้าไล่สี → หมอกกลืนทะเลไกลๆ เหมือนในภาพ
      this.scene.background = new THREE.Color(HORIZON_COLOR);
      this.scene.fog = new THREE.Fog(HORIZON_COLOR, 90, 260);

      this.scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6b7a4a, 0.85));
      const sun = new THREE.DirectionalLight(0xfff1d0, 1.6);
      sun.position.set(-25, 40, -10);
      sun.castShadow = !opts.isCompact;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
      this.scene.add(sun);

      this.env = createFishBridgeEnvironment();
      this.scene.add(this.env.group);
      // คนขายประจำแผง (man.glb แคชร่วมกับผู้เล่น) แยก group จาก env เพื่อไม่ให้ env.dispose ไปทำลาย geometry ร่วม
      this.vendors = createPierVendors({ ambient: !opts.isCompact });
      this.scene.add(this.vendors.group);

      this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);

      const def = getWorldDefinition(WORLD_IDS.HUA_HIN_FISH_BRIDGE);
      const saved = getSavedWorldPosition(WORLD_IDS.HUA_HIN_FISH_BRIDGE);
      const start = saved && this.isValidStart(saved.x, saved.z) ? saved : def.spawn;

      this.player = new FarmPlayer3D();
      this.player.groundHeightAt = this.env.groundHeightAt;
      this.player.resolveMove = this.env.resolveMove;
      this.player.setGender(opts.gender);
      if (opts.outfit) this.player.setOutfit(opts.outfit);
      this.player.setTool('hand');
      this.player.setPositionImmediate(start.x, start.z, start.heading);
      this.scene.add(this.player.group);

      this.cameraControls = new HayDayCameraController(this.camera);
      // ✅ FIX RISK-7: ตัด map2MinX ที่ไม่จำเป็นออก
      this.cameraControls.bounds = { minX: -40, maxX: 40, minZ: -30, maxZ: BRIDGE.endZ + 4 };
      this.cameraControls.setTargetImmediate(this.player.position.x, 0, this.player.position.z);
      this.cameraControls.setCameraMode('follow', this.player.position);
      // กล้องอยู่ด้านหลังตัวละคร (ฝั่งบก) มองไปทางซุ้ม/สะพาน/ทะเล เหมือนภาพอ้างอิง: กล้องที่ z ต่ำ → theta = π
      // (ค่า default -0.78 ใช้ในฟาร์ม จึงตั้งทับหลัง setCameraMode เท่านั้น)
      this.cameraControls.setTheta(Math.PI);
      this.cameraControls.zoom = this.cameraControls.desiredZoom; // เริ่มที่ระยะสุดท้ายเลย ไม่ซูมเข้าให้เห็นกลางทาง
      this.cameraControls.setTargetImmediate(this.player.position.x, 0, this.player.position.z);

      this.wasd.setEnabled(false);
      this.wasd.attach();
      this.touch.setEnabled(false);
      this.touch.attach(this.renderer.domElement);

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);

      document.addEventListener('visibilitychange', this.onVisibilityChange);

      this.lastTime = performance.now();
      this.startTime = this.lastTime;
      this.loop();
    } catch (err) {
      if (appended) this.renderer.domElement.parentElement?.removeChild(this.renderer.domElement);
      this.renderer.dispose();
      throw err;
    }
  }

  private updateVendors(delta: number): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    this.vendors.update(delta, px, pz);
    const v = this.vendors.nearest(px, pz);
    const id = v?.id ?? null;
    if (id !== this.nearVendorId) {
      this.nearVendorId = id;
      this.opts.onNearVendorChange?.(v);
    }
  }

  // ✅ FIX BUG-1: ตรวจว่าตำแหน่งนี้ resolve แล้วไม่เปลี่ยน (ยืนได้จริง)
  private isValidStart(x: number, z: number): boolean {
    const r = this.env.resolveMove(x, z, x, z);
    return r.x === x && r.z === z && Math.abs(x) <= 44 && z >= -33 && z <= BRIDGE.endZ;
  }

  /** เปิด/ปิดอินพุต (ปิดระหว่างโหลด/เปลี่ยน World) */
  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.wasd.setEnabled(enabled);
    this.touch.setEnabled(enabled);
    if (!enabled) this.player.setManualMoveDirection(0, 0);
  }

  getPlayerPose() {
    return { x: this.player.position.x, z: this.player.position.z, heading: this.player.getHeading() };
  }

  /** บันทึกตำแหน่งก่อนออกจาก World */
  savePosition(): void {
    saveWorldPosition(WORLD_IDS.HUA_HIN_FISH_BRIDGE, this.getPlayerPose());
  }

  private resize(): void {
    const c = this.opts.container;
    const w = Math.max(1, c.clientWidth);
    const h = Math.max(1, c.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    // ✅ FIX: ใช้ performance.now() แทน Timer
    const now = performance.now();
    const delta = Math.min(0.066, (now - this.lastTime) / 1000);
    this.elapsed = (now - this.startTime) / 1000;
    this.lastTime = now;

    const cc = this.cameraControls;

    // ✅ FIX BUG-3: อ่าน input เฉพาะเมื่อ inputEnabled → ไม่มี moveDir stale
    let hasKey = false;
    if (this.inputEnabled) {
      const hasTouch = this.touch.computeWorldDirection(cc.cameraMode, cc.theta, cc.fppYaw, this.moveDir);
      hasKey = hasTouch || this.wasd.computeWorldDirection(cc.cameraMode, cc.theta, cc.fppYaw, this.moveDir);
      this.player.setManualMoveDirection(this.moveDir.x, this.moveDir.z);
    } else {
      this.player.setManualMoveDirection(0, 0);
    }
    if (hasKey) cc.followPlayer = true;

    this.env.update(this.elapsed);
    this.player.update(delta);
    this.updateVendors(delta);
    cc.update(delta, this.player.position, this.player.isMoving);

    const near = this.env.isNearReturnGateway(this.player.position.x, this.player.position.z);
    if (near !== this.nearGateway) {
      this.nearGateway = near;
      this.opts.onNearGatewayChange(near);
    }

    // ✅ FIX RISK-2: 3 วิ (จาก 2)
    if (this.elapsed - this.lastSave > SAVE_INTERVAL_SEC) {
      this.lastSave = this.elapsed;
      this.savePosition();
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // ✅ FIX RISK-1: save ตำแหน่งก่อน dispose
    this.savePosition();

    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.resizeObserver.disconnect();
    this.wasd.detach();
    this.touch.detach();
    this.player.dispose();
    this.vendors.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.domElement.parentElement?.removeChild(this.renderer.domElement);
  }
}