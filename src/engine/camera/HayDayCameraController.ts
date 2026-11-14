// src/engine/camera/HayDayCameraController.ts
import * as THREE from 'three';
import { CameraMode } from '../../types/game';
import { clamp, exponentialDamp } from '../../utils/calculus';

export type PointerSource = 'mouse' | 'touch';

export interface CameraPickCallback {
  (screenX: number, screenY: number, source?: PointerSource): void;
}

export interface CameraHoverCallback {
  (screenX: number, screenY: number): void;
}

export interface WorldBoundsConfig {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /**
   * ขอบซ้ายเมื่อปลดล็อกที่ดินขยายโซน 5 (Map 2) — optional
   * ใช้เฉพาะโลกฟาร์มหลัก โลกอื่น (สะพานปลา, มินิเกม) ไม่ต้องส่งมา
   * ถ้าไม่ระบุ จะ fallback ไปใช้ minX
   */
  map2MinX?: number;
}

/**
 * HayDayCameraController — ตัวควบคุมกล้อง 3D สไตล์ Hay Day 100% (60 FPS Zero-GC)
 *
 * คุณสมบัติหลัก:
 * 1. ลากจอ 1:1 ติดนิ้ว (Exact Ray-Ground Plane Projection): คำนวณจุดตัดบนพื้นดิน y=0
 *    ทำให้ตำแหน่งหญ้า/แปลงผักใต้ปลายนิ้วเกาะติดนิ้วตลอดการลาก ไม่หน่วงตามนิ้วช้า
 * 2. ความเฉื่อยลื่นไหล (Frame-Rate Independent Inertia): คำนวณความเร็วเฉลี่ยต่อเฟรมเรนเดอร์
 *    ปล่อยนิ้วตวัดแล้วไหลนุ่มนวล 60fps และหยุดนิ่งทันทีหากค้างนิ้วก่อนปล่อย
 * 3. ล็อกขอบเขตเกาะฟาร์ม (World Bounds + Soft Edge Cushion): ไม่หลุดออกนอกแผนที่
 * 4. ปรับระยะใกล้-ไกลของกล้องได้ง่ายผ่าน `camHeight` และ `camDistance`
 */
export class HayDayCameraController {
  public readonly camera: THREE.PerspectiveCamera;

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 ปรับความสูงและระยะห่างพื้นฐานของกล้องให้พอดีกับขนาดโมเดลในเกมได้ที่นี่เลยครับ
  //    - ลดตัวเลข = กล้องซูมใกล้โมเดลมากขึ้น
  //    - เพิ่มตัวเลข = กล้องถอยมุมสูงเห็นฟาร์มกว้างขึ้น
  // ═══════════════════════════════════════════════════════════════════════════
  public camHeight: number = 18.0;
  public camDistance: number = 24.0;

  /** ตัวคูณระยะซูมจาก Pinch 2 นิ้ว หรือลูกกลิ้งเมาส์ (1.0 = ระยะมาตรฐานตาม camHeight/camDistance) */
  public zoom: number = 1.0;
  public desiredZoom: number = 1.0;
  public minZoom: number = 0.44;
  public maxZoom: number = 1.85;

  /** มุมเฉียงแนวนอน Isometric (เรเดียน, -0.78 ≈ -45° สไตล์ Hay Day) */
  public theta: number = -0.78;
  /** หมุนกล้องอัตโนมัติรอบฟาร์ม 360° (Cinematic Auto-Rotate) */
  public autoRotate: boolean = false;
  /** ความเร็วในการหมุนกล้องอัตโนมัติ (เรเดียน/วินาที) */
  public autoRotateSpeed: number = 0.08;
  /** มุมก้มเงยเสริมเมื่อหมุนด้วยเมาส์ขวา (1.0 = มุมมาตรฐานจาก camHeight/camDistance) */
  public pitchScale: number = 1.0;

  /** จุดโฟกัสปัจจุบันบนพื้นโลก 3D */
  public readonly target: THREE.Vector3 = new THREE.Vector3(0, 0, 2);

  /** ค่าความหนืดของแรงเฉื่อยหลังปล่อยนิ้ว (ยิ่งน้อยยิ่งไหลไกล, 3.0 ให้ฟีลลื่นไหลแบบ Hay Day พอดี) */
  public inertiaDamping: number = 3.0;
  /** ความเร็วสูงสุดของแรงเฉื่อย (หน่วยเมตร/วินาที) กันภาพพุ่งแรงเกินไป */
  public maxInertiaSpeed: number = 68.0;
  /** ระยะผ่อนแรงขอบแผนที่ขณะกดนิ้วลากค้าง (Rubber-band cushion) */
  public edgeSoftMargin: number = 1.6;

  /** ขอบเขตแผนที่ฟาร์ม */
  public bounds: WorldBoundsConfig = {
    minX: -46,
    maxX: 46,
    minZ: -34,
    maxZ: 34,
    map2MinX: -86,
  };

  public followPlayer: boolean = false;
  public isPlacing: boolean = false;
  public map2Unlocked: boolean = false;
  public cameraMode: CameraMode = 'isometric';
  public fppYaw: number = 0;
  public fppPitch: number = 0;
  public touchSlideWalkEnabled: boolean = false;
  /** โหมดเงยกล้องชมวิวท้องฟ้า/พระจันทร์/ดวงดาวแบบสมูท โดยยังลากฟาร์ม 1 นิ้วแบบ Hay Day ได้ 100% */
  public skyVistaActive: boolean = false;
  private skyVistaBlend: number = 0;
  private lookHeightOffset: number = 0;

  // สถานะการลากและความเฉื่อย (เก็บภายใน Controller ไม่แตะ React State)
  private isDragging: boolean = false;
  private velX: number = 0;
  private velZ: number = 0;
  private pendingDragDeltaX: number = 0;
  private pendingDragDeltaZ: number = 0;
  private hasDragSampleThisFrame: boolean = false;
  private lastDragMoveTimeMs: number = 0;

  // Pre-allocated scratch vectors (Zero GC 100% ใน Render Loop)
  private readonly _desiredTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 2);
  private readonly _desiredPos: THREE.Vector3 = new THREE.Vector3();
  private readonly _lookTarget: THREE.Vector3 = new THREE.Vector3();
  private readonly _camRight: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private readonly _camUp: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  private readonly _camForward: THREE.Vector3 = new THREE.Vector3(0, -0.6, -0.8);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.syncCameraImmediate();
  }

  /** อ่านค่า distance ปัจจุบัน (เผื่อส่วนอื่นในระบบอ้างอิง) */
  public get distance(): number {
    return Math.hypot(this.camHeight, this.camDistance) * this.zoom;
  }

  public set distance(val: number) {
    const baseDist = Math.max(1, Math.hypot(this.camHeight, this.camDistance));
    this.desiredZoom = clamp(val / baseDist, this.minZoom, this.maxZoom);
    this.zoom = this.desiredZoom;
  }

  private getActiveMinX(): number {
    return this.map2Unlocked
      ? (this.bounds.map2MinX ?? this.bounds.minX)
      : this.bounds.minX;
  }

  public setTargetImmediate(x: number, y: number, z: number): void {
    const minX = this.getActiveMinX();
    const cx = clamp(x, minX, this.bounds.maxX);
    const cz = clamp(z, this.bounds.minZ, this.bounds.maxZ);
    this.target.set(cx, y, cz);
    this._desiredTarget.set(cx, y, cz);
    this.velX = 0;
    this.velZ = 0;
    this.pendingDragDeltaX = 0;
    this.pendingDragDeltaZ = 0;
    this.syncCameraImmediate();
  }

  public setCameraMode(mode: CameraMode, playerPos?: THREE.Vector3): void {
    this.cameraMode = mode;
    this.stopInertia();

    if (mode === 'fpp') {
      this.fppPitch = 0;
      if (playerPos) {
        this.camera.position.set(playerPos.x, 1.55, playerPos.z);
      }
      return;
    }

    if (mode === 'topdown') {
      this.pitchScale = 1.0;
      this.desiredZoom = 1.15;
      this.followPlayer = false;
    } else if (mode === 'follow') {
      this.theta = -0.78;
      this.pitchScale = 1.0;
      this.desiredZoom = 0.55;
      this.followPlayer = true;
    } else {
      // โหมดมาตรฐาน Isometric (Hay Day View)
      this.theta = -0.78;
      this.pitchScale = 1.0;
      this.desiredZoom = 1.0;
      this.followPlayer = false;
    }

    if (playerPos) {
      const minX = this.getActiveMinX();
      this._desiredTarget.set(
        clamp(playerPos.x, minX, this.bounds.maxX),
        0,
        clamp(playerPos.z, this.bounds.minZ, this.bounds.maxZ)
      );
      if (this.target.lengthSq() < 0.001) {
        this.target.copy(this._desiredTarget);
      }
    }
  }

  public reset(targetPosition?: THREE.Vector3): void {
    this.cameraMode = 'isometric';
    this.theta = -0.78;
    this.pitchScale = 1.0;
    this.desiredZoom = 1.0;
    this.stopInertia();
    this.followPlayer = false;

    const minX = this.getActiveMinX();
    if (targetPosition) {
      this._desiredTarget.set(
        clamp(targetPosition.x, minX, this.bounds.maxX),
        0,
        clamp(targetPosition.z, this.bounds.minZ, this.bounds.maxZ)
      );
    } else {
      this._desiredTarget.set(0, 0, 2);
    }
  }

  public focusWorldPoint(x: number, z: number, distance = 17.5): void {
    if (this.cameraMode === 'fpp') {
      this.cameraMode = 'isometric';
    }
    this.stopInertia();
    this.followPlayer = false;
    this.pitchScale = 0.92;
    const baseDist = Math.max(1, Math.hypot(this.camHeight, this.camDistance));
    this.desiredZoom = clamp(distance / baseDist, this.minZoom, this.maxZoom);

    const minX = this.getActiveMinX();
    this._desiredTarget.set(
      clamp(x, minX, this.bounds.maxX),
      0.9,
      clamp(z, this.bounds.minZ, this.bounds.maxZ)
    );
  }

  public focusPlayerCloseUp(playerPos?: THREE.Vector3): void {
    if (this.cameraMode === 'fpp') {
      this.cameraMode = 'isometric';
    }
    this.stopInertia();
    this.followPlayer = true;
    this.pitchScale = 0.72;
    const baseDist = Math.max(1, Math.hypot(this.camHeight, this.camDistance));
    this.desiredZoom = clamp(8.8 / baseDist, 0.28, this.maxZoom);

    if (playerPos) {
      const minX = this.getActiveMinX();
      this._desiredTarget.set(
        clamp(playerPos.x, minX, this.bounds.maxX),
        0.75,
        clamp(playerPos.z, this.bounds.minZ, this.bounds.maxZ)
      );
    }
  }

  public stopInertia(): void {
    this.velX = 0;
    this.velZ = 0;
    this.pendingDragDeltaX = 0;
    this.pendingDragDeltaZ = 0;
    this.hasDragSampleThisFrame = false;
  }

  // ─────────────────────── Gesture Callbacks จาก Touch Hook ───────────────────────

  public beginDrag(): void {
    this.isDragging = true;
    this.velX = 0;
    this.velZ = 0;
    this.pendingDragDeltaX = 0;
    this.pendingDragDeltaZ = 0;
    this.hasDragSampleThisFrame = false;
    this.lastDragMoveTimeMs = performance.now();
  }

  public endDrag(nowMs = performance.now()): void {
    this.isDragging = false;
    // หากผู้เล่นหยุดนิ้วค้างไว้บนจอก่อนยกนิ้ว (> 135ms) ให้หยุดกล้องนิ่งสนิททันทีแบบ Hay Day
    if (nowMs - this.lastDragMoveTimeMs > 135) {
      this.velX = 0;
      this.velZ = 0;
    }
    this.pendingDragDeltaX = 0;
    this.pendingDragDeltaZ = 0;
    this.hasDragSampleThisFrame = false;
  }

  /**
   * คำนวณจุดตกกระทบของพิกัดหน้าจอ (clientX, clientY) บนระนาบพื้นดิน (เทียบกับตำแหน่งกล้องปัจจุบัน)
   * โดยไม่สร้าง Object ใหม่เลยแม้แต่ชิ้นเดียว (Zero-GC)
   */
  private projectScreenOffsetOnGround(
    clientX: number,
    clientY: number,
    rectLeft: number,
    rectTop: number,
    rectWidth: number,
    rectHeight: number,
    out: { x: number; z: number }
  ): void {
    const safeW = Math.max(1, rectWidth);
    const safeH = Math.max(1, rectHeight);
    const ndcX = ((clientX - rectLeft) / safeW) * 2 - 1;
    const ndcY = -((clientY - rectTop) / safeH) * 2 + 1;

    const e = this.camera.matrixWorld.elements;
    this._camRight.set(e[0], e[1], e[2]);
    this._camUp.set(e[4], e[5], e[6]);
    this._camForward.set(-e[8], -e[9], -e[10]);

    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const aspect = safeW / safeH;
    const sx = ndcX * aspect * tanHalfFov;
    const sy = ndcY * tanHalfFov;

    const dirX = this._camRight.x * sx + this._camUp.x * sy + this._camForward.x;
    const dirY = this._camRight.y * sx + this._camUp.y * sy + this._camForward.y;
    const dirZ = this._camRight.z * sx + this._camUp.z * sy + this._camForward.z;

    // ป้องกันลำแสงขนานขอบฟ้า
    const clampedDirY = Math.min(-0.16, dirY);
    const camHeightAboveTarget = Math.max(2.5, this.camera.position.y - this._desiredTarget.y);
    const t = -camHeightAboveTarget / clampedDirY;

    out.x = dirX * t;
    out.z = dirZ * t;
  }

  private readonly _prevGroundHit = { x: 0, z: 0 };
  private readonly _currGroundHit = { x: 0, z: 0 };

  /**
   * เลื่อนกล้อง 1:1 ตามการลากนิ้วบนหน้าจอ (Hay Day Ground-Locked Panning)
   */
  public panByScreenPoints(
    prevClientX: number,
    prevClientY: number,
    currClientX: number,
    currClientY: number,
    rectLeft: number,
    rectTop: number,
    rectWidth: number,
    rectHeight: number
  ): void {
    if (this.cameraMode === 'fpp') {
      const dx = currClientX - prevClientX;
      const dy = currClientY - prevClientY;
      this.fppYaw -= dx * 0.005;
      this.fppPitch = clamp(this.fppPitch - dy * 0.005, -1.1, 1.1);
      return;
    }

    this.followPlayer = false;
    // รีเซ็ตระดับความสูงเป้าหมายกลับมาที่พื้นดินเมื่อเริ่มแพนอิสระ
    if (this._desiredTarget.y !== 0) {
      this._desiredTarget.y = exponentialDamp(this._desiredTarget.y, 0, 12, 0.016);
    }

    this.projectScreenOffsetOnGround(
      prevClientX,
      prevClientY,
      rectLeft,
      rectTop,
      rectWidth,
      rectHeight,
      this._prevGroundHit
    );
    this.projectScreenOffsetOnGround(
      currClientX,
      currClientY,
      rectLeft,
      rectTop,
      rectWidth,
      rectHeight,
      this._currGroundHit
    );

    let worldDx = this._prevGroundHit.x - this._currGroundHit.x;
    let worldDz = this._prevGroundHit.z - this._currGroundHit.z;

    const minX = this.getActiveMinX();
    const maxX = this.bounds.maxX;
    const minZ = this.bounds.minZ;
    const maxZ = this.bounds.maxZ;

    // Soft rubber-band resistance เมื่อลากชนขอบแผนที่
    if (
      (this._desiredTarget.x < minX && worldDx < 0) ||
      (this._desiredTarget.x > maxX && worldDx > 0)
    ) {
      const overX =
        this._desiredTarget.x < minX
          ? minX - this._desiredTarget.x
          : this._desiredTarget.x - maxX;
      const resist = Math.max(0.08, 1 - overX / this.edgeSoftMargin);
      worldDx *= resist * 0.35;
    }

    if (
      (this._desiredTarget.z < minZ && worldDz < 0) ||
      (this._desiredTarget.z > maxZ && worldDz > 0)
    ) {
      const overZ =
        this._desiredTarget.z < minZ
          ? minZ - this._desiredTarget.z
          : this._desiredTarget.z - maxZ;
      const resist = Math.max(0.08, 1 - overZ / this.edgeSoftMargin);
      worldDz *= resist * 0.35;
    }

    this._desiredTarget.x = clamp(
      this._desiredTarget.x + worldDx,
      minX - this.edgeSoftMargin,
      maxX + this.edgeSoftMargin
    );
    this._desiredTarget.z = clamp(
      this._desiredTarget.z + worldDz,
      minZ - this.edgeSoftMargin,
      maxZ + this.edgeSoftMargin
    );

    this.pendingDragDeltaX += worldDx;
    this.pendingDragDeltaZ += worldDz;
    this.hasDragSampleThisFrame = true;
    this.lastDragMoveTimeMs = performance.now();
  }

  /**
   * ซูมเข้า/ออก (Pinch 2 นิ้ว หรือล้อเมาส์) โดยยึดจุดบนพื้นใต้กึ่งกลางนิ้วไม่ให้เลื่อนหนี
   */
  public zoomAtScreenPoint(
    zoomFactor: number,
    screenX: number,
    screenY: number,
    rectLeft: number,
    rectTop: number,
    rectWidth: number,
    rectHeight: number,
    immediate = false
  ): void {
    if (this.cameraMode === 'fpp') return;

    const prevZoom = this.desiredZoom;
    const nextZoom = clamp(prevZoom * zoomFactor, this.minZoom, this.maxZoom);
    if (Math.abs(nextZoom - prevZoom) < 1e-4) return;

    this.projectScreenOffsetOnGround(
      screenX,
      screenY,
      rectLeft,
      rectTop,
      rectWidth,
      rectHeight,
      this._prevGroundHit
    );

    const ratio = nextZoom / prevZoom;
    this.desiredZoom = nextZoom;
    if (immediate) {
      this.zoom = nextZoom;
    }

    // ชดเชยจุดโฟกัสให้ตำแหน่งพื้นตรงจุดบีบนิ้วอยู่กับที่แบบ Hay Day
    const anchorShiftX = this._prevGroundHit.x * (1 - ratio) * 0.35;
    const anchorShiftZ = this._prevGroundHit.z * (1 - ratio) * 0.35;

    const minX = this.getActiveMinX();
    this._desiredTarget.x = clamp(this._desiredTarget.x + anchorShiftX, minX, this.bounds.maxX);
    this._desiredTarget.z = clamp(
      this._desiredTarget.z + anchorShiftZ,
      this.bounds.minZ,
      this.bounds.maxZ
    );
  }

  public setSkyVista(active: boolean): void {
    this.skyVistaActive = active;
  }

  /**
   * หมุนมุมมองด้วยคลิกขวาเมาส์บนคอมพิวเตอร์ (เสริมสำหรับผู้เล่น PC)
   */
  public orbitByPixels(dx: number, dy: number): void {
    if (this.cameraMode === 'fpp') {
      this.fppYaw -= dx * 0.005;
      this.fppPitch = clamp(this.fppPitch - dy * 0.005, -1.1, 1.1);
      return;
    }
    this.theta -= dx * 0.005;
    this.pitchScale = clamp(this.pitchScale + dy * 0.004, 0.24, 1.45);
  }

  /**
   * เปิด/ปิดการหมุนกล้องอัตโนมัติรอบฟาร์ม 360° (Cinematic Auto-Rotate)
   */
  public setAutoRotate(enabled: boolean, speed?: number): void {
    this.autoRotate = enabled;
    if (typeof speed === 'number' && Number.isFinite(speed)) {
      this.autoRotateSpeed = speed;
    }
  }

  /**
   * หมุนมุมมองด้วยมือทีละองศา/เรเดียน (Manual Orbit Angle)
   */
  public rotateByAngle(deltaRad: number): void {
    if (this.cameraMode === 'fpp') {
      this.fppYaw += deltaRad;
      return;
    }
    this.theta += deltaRad;
    if (this.theta > Math.PI * 2) this.theta -= Math.PI * 2;
    else if (this.theta < -Math.PI * 2) this.theta += Math.PI * 2;
  }

  /**
   * ตั้งค่ามุมมองระนาบแนวนอนโดยตรง
   */
  public setTheta(theta: number): void {
    this.theta = theta;
  }

  /**
   * รีเซ็ตมุมมองกล้องกลับสู่มาตรฐาน Hay Day (-45° Isometric)
   */
  public resetToDefaultAngle(): void {
    this.theta = -0.78;
    this.pitchScale = 1.0;
  }

  /**
   * คำนวณพิกัดกล้องจาก camHeight, camDistance, zoom และมุมมองปัจจุบัน (Zero-GC)
   */
  private computeDesiredCameraTransform(): void {
    let effHeight = this.camHeight * this.zoom * this.pitchScale;
    let effDist = this.camDistance * this.zoom;
    let targetLookLift = 0;

    if (this.cameraMode === 'topdown') {
      effHeight = this.camHeight * 1.95 * this.zoom;
      effDist = this.camDistance * 0.18 * this.zoom;
      targetLookLift = 0;
    } else if (this.cameraMode === 'follow') {
      effHeight = 5.4 * this.zoom * this.pitchScale;
      effDist = 15.2 * this.zoom;
      targetLookLift = 1.9;
    } else if (this.skyVistaBlend > 0.001) {
      const vistaHeight = 5.3 * this.zoom * Math.min(1.0, this.pitchScale);
      const vistaDist = 23.2 * this.zoom;
      effHeight = THREE.MathUtils.lerp(effHeight, vistaHeight, this.skyVistaBlend);
      effDist = THREE.MathUtils.lerp(effDist, vistaDist, this.skyVistaBlend);
      targetLookLift = 3.35 * this.skyVistaBlend;
    }

    this.lookHeightOffset = targetLookLift;
    this._desiredPos.set(
      this.target.x + effDist * Math.sin(this.theta),
      this.target.y + effHeight,
      this.target.z + effDist * Math.cos(this.theta)
    );
  }

  private syncCameraImmediate(): void {
    this.skyVistaBlend = this.skyVistaActive && this.cameraMode === 'isometric' ? 1 : 0;
    this.computeDesiredCameraTransform();
    this.camera.position.copy(this._desiredPos);
    this._lookTarget.set(this.target.x, this.target.y + this.lookHeightOffset, this.target.z);
    this.camera.lookAt(this._lookTarget);
    this.camera.updateMatrixWorld();
  }

  /**
   * อัปเดตกล้องใน Render Loop ทุกเฟรม (60 FPS, Frame-Rate Independent, Zero-GC)
   */
  public update(delta: number, playerPos?: THREE.Vector3, isPlayerMoving?: boolean): void {
    const dt = Math.min(0.066, Math.max(0.001, delta));

    // โหมดมุมมองบุคคลที่หนึ่ง (FPP)
    if (this.cameraMode === 'fpp' && playerPos) {
      const eyeHeight = 1.55;
      this.camera.position.set(playerPos.x, eyeHeight, playerPos.z);

      const lookDist = 10;
      const cosPitch = Math.cos(this.fppPitch);
      const sinPitch = Math.sin(this.fppPitch);
      const dirX = Math.sin(this.fppYaw) * cosPitch;
      const dirY = sinPitch;
      const dirZ = Math.cos(this.fppYaw) * cosPitch;

      this._lookTarget.set(
        playerPos.x + dirX * lookDist,
        eyeHeight + dirY * lookDist,
        playerPos.z + dirZ * lookDist
      );
      this.camera.lookAt(this._lookTarget);
      return;
    }

    const minX = this.getActiveMinX();
    const maxX = this.bounds.maxX;
    const minZ = this.bounds.minZ;
    const maxZ = this.bounds.maxZ;

    if (this.isDragging) {
      // คำนวณความเร็วจากระยะจริงที่นิ้วเลื่อนในเฟรมนี้ เพื่อตัดปัญหา Event Batching บนมือถือ
      if (this.hasDragSampleThisFrame) {
        const instVx = clamp(
          this.pendingDragDeltaX / Math.max(0.008, dt),
          -this.maxInertiaSpeed,
          this.maxInertiaSpeed
        );
        const instVz = clamp(
          this.pendingDragDeltaZ / Math.max(0.008, dt),
          -this.maxInertiaSpeed,
          this.maxInertiaSpeed
        );
        this.velX = this.velX * 0.35 + instVx * 0.65;
        this.velZ = this.velZ * 0.35 + instVz * 0.65;
        this.pendingDragDeltaX = 0;
        this.pendingDragDeltaZ = 0;
        this.hasDragSampleThisFrame = false;
      } else {
        // เฉพาะเมื่อผู้เล่นหยุดนิ้วค้างไว้นานกว่า 35ms จริงๆ ถึงจะเริ่มชะลอความเร็ว (ป้องกัน Frame Dropout ระหว่าง touchmove)
        const timeSinceMove = performance.now() - this.lastDragMoveTimeMs;
        if (timeSinceMove > 35) {
          const holdDecay = Math.exp(-22 * dt);
          this.velX *= holdDecay;
          this.velZ *= holdDecay;
        }
      }
    } else {
      // 1. โหมดตามตัวละครอัตโนมัติ (เฉพาะตอนเดินด้วย WASD / Touch-Slide หรืออยู่ในโหมด Follow)
      const shouldAutoFollow =
        !this.isPlacing &&
        playerPos !== undefined &&
        (this.cameraMode === 'follow' || (this.followPlayer && Boolean(isPlayerMoving)) || this.followPlayer);

      if (shouldAutoFollow && playerPos) {
        const followRate = 5.4;
        this._desiredTarget.x = exponentialDamp(
          this._desiredTarget.x,
          clamp(playerPos.x, minX, maxX),
          followRate,
          dt
        );
        this._desiredTarget.z = exponentialDamp(
          this._desiredTarget.z,
          clamp(playerPos.z, minZ, maxZ),
          followRate,
          dt
        );
        if (isPlayerMoving) {
          this._desiredTarget.y = exponentialDamp(this._desiredTarget.y, 0, followRate, dt);
        }
        this.velX = 0;
        this.velZ = 0;
      } else {
        // 2. คำนวณความเฉื่อย (Hay Day Smooth Inertia Glide) หลังปล่อยนิ้ว
        const speedSq = this.velX * this.velX + this.velZ * this.velZ;
        if (speedSq > 0.0004) {
          this._desiredTarget.x += this.velX * dt;
          this._desiredTarget.z += this.velZ * dt;

          const friction = Math.exp(-this.inertiaDamping * dt);
          this.velX *= friction;
          this.velZ *= friction;

          // หากไถลชนขอบเกาะฟาร์ม ให้ซับความเร็วแกนที่ชนอย่างนุ่มนวลและล็อกขอบเขต
          if (this._desiredTarget.x < minX) {
            this._desiredTarget.x = minX;
            this.velX = 0;
          } else if (this._desiredTarget.x > maxX) {
            this._desiredTarget.x = maxX;
            this.velX = 0;
          }

          if (this._desiredTarget.z < minZ) {
            this._desiredTarget.z = minZ;
            this.velZ = 0;
          } else if (this._desiredTarget.z > maxZ) {
            this._desiredTarget.z = maxZ;
            this.velZ = 0;
          }
        } else {
          this.velX = 0;
          this.velZ = 0;
        }

        // ดึงกลับเข้าขอบเขตอย่างนุ่มนวลหากผู้เล่นดึงค้างเกินขอบ (Rubber-band snap-back)
        if (this._desiredTarget.x < minX) {
          this._desiredTarget.x = exponentialDamp(this._desiredTarget.x, minX, 16, dt);
        } else if (this._desiredTarget.x > maxX) {
          this._desiredTarget.x = exponentialDamp(this._desiredTarget.x, maxX, 16, dt);
        }

        if (this._desiredTarget.z < minZ) {
          this._desiredTarget.z = exponentialDamp(this._desiredTarget.z, minZ, 16, dt);
        } else if (this._desiredTarget.z > maxZ) {
          this._desiredTarget.z = exponentialDamp(this._desiredTarget.z, maxZ, 16, dt);
        }
      }
    }

    // 3. ซูมสมูท + เกาะติดนิ้วทันทีขณะลาก (Stiffness สูงขณะลาก = ภาพไม่ดีเลย์ตามนิ้ว!)
    this.zoom = exponentialDamp(this.zoom, this.desiredZoom, this.isDragging ? 28 : 16, dt);

    const targetVista =
      this.skyVistaActive && this.cameraMode === 'isometric' && !this.isPlacing ? 1 : 0;
    this.skyVistaBlend = exponentialDamp(this.skyVistaBlend, targetVista, 4.6, dt);

    if (this.isDragging) {
      // 1:1 Ground-lock ทันทีแบบ Hay Day แท้ 100% ปราศจาก Drag-Lag
      this.target.x = this._desiredTarget.x;
      this.target.y = this._desiredTarget.y;
      this.target.z = this._desiredTarget.z;
    } else {
      const glideLambda = 26;
      this.target.x = exponentialDamp(this.target.x, this._desiredTarget.x, glideLambda, dt);
      this.target.y = exponentialDamp(this.target.y, this._desiredTarget.y, 16, dt);
      this.target.z = exponentialDamp(this.target.z, this._desiredTarget.z, glideLambda, dt);
    }

    // 4. หมุนกล้องอัตโนมัติรอบฟาร์ม 360° (Cinematic Auto-Rotate) หากเปิดใช้งานและไม่ได้กำลังลากนิ้ว
    if (this.autoRotate && !this.isDragging && this.cameraMode !== 'fpp') {
      this.theta += this.autoRotateSpeed * dt;
      if (this.theta > Math.PI * 2) this.theta -= Math.PI * 2;
      else if (this.theta < -Math.PI * 2) this.theta += Math.PI * 2;
    }

    this.computeDesiredCameraTransform();
    this.camera.position.copy(this._desiredPos);
    this._lookTarget.set(this.target.x, this.target.y + this.lookHeightOffset, this.target.z);
    this.camera.lookAt(this._lookTarget);
  }
}