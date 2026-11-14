// src/components/3d/FarmGridOverlay.ts
import * as THREE from 'three';
import {
  GRID_CELL_SIZE,
  GRID_MIN_X,
  GRID_MAX_X,
  GRID_MIN_Z,
  GRID_MAX_Z,
  gridToWorld,
} from '../../types/game';

export type GridCursorStatus = 'valid' | 'invalid' | 'action' | 'neutral';

/**
 * FarmGridOverlay3D
 * ระบบกริด 3 มิติฝังตัวครอบคลุมทั่วทั้งผืนดินเกาะฟาร์ม (Embedded Terrain Grid System)
 * แสดงเส้นตารางกริดที่ดูสบายตา และ Cursor ไฮไลต์ช่องกริดที่กำลังเลือก/ชี้แบบเรียลไทม์
 */
export class FarmGridOverlay3D {
  public group: THREE.Group;
  private gridLinesMesh: THREE.LineSegments;
  private cursorGroup: THREE.Group;
  private cursorPlane: THREE.Mesh;
  private cornerLines: THREE.LineSegments;
  private cursorMat: THREE.MeshBasicMaterial;
  private cornerMat: THREE.LineBasicMaterial;
  private gridMat: THREE.LineBasicMaterial;

  private isVisible: boolean = true;
  private cursorVisible: boolean = false;
  private currentStatus: GridCursorStatus = 'valid';

  // สีแสดงสถานะช่องกริด
  private static readonly COLORS = {
    valid: 0x10b981,    // เขียวมรกต: ว่าง ปลูกต้นไม้หรือพรวนดินได้
    invalid: 0xf43f5e,  // แดงกุหลาบ: มีสิ่งกีดขวาง (บ้าน, แปลงเดิม, บ่อน้ำ)
    action: 0xf59e0b,   // ทองอำพัน: มีต้นไม้/พืชผล พร้อมรดน้ำหรือเก็บเกี่ยว
    neutral: 0x38bdf8,  // ฟ้าคราม: โหมดสำรวจทั่วไป
  };

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'FarmGridOverlay';

    // ──────────────────────── 1. เส้นกริดครอบคลุมทั้งเกาะฟาร์ม (ขอบช่องตรงกับพิกัด ±1.0 รอบจุดกึ่งกลางช่อง) ────────────────────────
    const halfCell = GRID_CELL_SIZE * 0.5;
    const minX = GRID_MIN_X * GRID_CELL_SIZE - halfCell;
    const maxX = GRID_MAX_X * GRID_CELL_SIZE + halfCell;
    const minZ = GRID_MIN_Z * GRID_CELL_SIZE - halfCell;
    const maxZ = GRID_MAX_Z * GRID_CELL_SIZE + halfCell;

    const linePositions: number[] = [];
    const lineColors: number[] = [];

    const baseColor = new THREE.Color(0xa7f3d0); // mint/soft green
    const accentColor = new THREE.Color(0xfcd34d); // soft gold

    // เส้นขนานแนวแกน Z (ขอบช่องตั้งแต่ GRID_MIN_X - 0.5 ถึง GRID_MAX_X + 0.5)
    for (let gx = GRID_MIN_X; gx <= GRID_MAX_X + 1; gx++) {
      const x = gx * GRID_CELL_SIZE - halfCell;
      const isMajor = gx % 5 === 0;
      const c = isMajor ? accentColor : baseColor;

      linePositions.push(x, 0.018, minZ, x, 0.018, maxZ);
      lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    // เส้นขนานแนวแกน X (ขอบช่องตั้งแต่ GRID_MIN_Z - 0.5 ถึง GRID_MAX_Z + 0.5)
    for (let gz = GRID_MIN_Z; gz <= GRID_MAX_Z + 1; gz++) {
      const z = gz * GRID_CELL_SIZE - halfCell;
      const isMajor = gz % 5 === 0;
      const c = isMajor ? accentColor : baseColor;

      linePositions.push(minX, 0.018, z, maxX, 0.018, z);
      lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

    this.gridMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    this.gridLinesMesh = new THREE.LineSegments(gridGeo, this.gridMat);
    this.gridLinesMesh.renderOrder = 2;
    this.group.add(this.gridLinesMesh);

    // ──────────────────────── 2. เซลเคอร์เซอร์ไฮไลต์ช่องกริด (Grid Cursor) ────────────────────────
    this.cursorGroup = new THREE.Group();
    this.cursorGroup.position.set(0, 0.025, 0);
    this.cursorGroup.visible = false;

    // แผ่นพื้นไฮไลต์กลางช่อง (Quad Fill)
    const pad = 0.06;
    const half = GRID_CELL_SIZE / 2 - pad;
    const planeGeo = new THREE.PlaneGeometry(half * 2, half * 2);
    planeGeo.rotateX(-Math.PI / 2);

    this.cursorMat = new THREE.MeshBasicMaterial({
      color: FarmGridOverlay3D.COLORS.valid,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cursorPlane = new THREE.Mesh(planeGeo, this.cursorMat);
    this.cursorPlane.renderOrder = 3;
    this.cursorGroup.add(this.cursorPlane);

    // มุมกรอบ 4 ด้าน (L-shaped bracket corners)
    const cornerPositions: number[] = [];
    const cl = 0.45; // ความยาวมุม bracket

    // Top-Left corner (-half, -half)
    cornerPositions.push(-half, 0.005, -half, -half + cl, 0.005, -half);
    cornerPositions.push(-half, 0.005, -half, -half, 0.005, -half + cl);

    // Top-Right corner (half, -half)
    cornerPositions.push(half, 0.005, -half, half - cl, 0.005, -half);
    cornerPositions.push(half, 0.005, -half, half, 0.005, -half + cl);

    // Bottom-Left corner (-half, half)
    cornerPositions.push(-half, 0.005, half, -half + cl, 0.005, half);
    cornerPositions.push(-half, 0.005, half, -half, 0.005, half - cl);

    // Bottom-Right corner (half, half)
    cornerPositions.push(half, 0.005, half, half - cl, 0.005, half);
    cornerPositions.push(half, 0.005, half, half, 0.005, half - cl);

    const cornerGeo = new THREE.BufferGeometry();
    cornerGeo.setAttribute('position', new THREE.Float32BufferAttribute(cornerPositions, 3));

    this.cornerMat = new THREE.LineBasicMaterial({
      color: FarmGridOverlay3D.COLORS.valid,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    this.cornerLines = new THREE.LineSegments(cornerGeo, this.cornerMat);
    this.cornerLines.renderOrder = 4;
    this.cursorGroup.add(this.cornerLines);

    this.group.add(this.cursorGroup);
  }

  /**
   * เปิดหรือปิดการแสดงผลเส้นตารางกริดทั่วทั้งฟาร์ม
   */
  public setGridVisible(visible: boolean) {
    this.isVisible = visible;
    this.gridLinesMesh.visible = visible;
  }

  public getGridVisible(): boolean {
    return this.isVisible;
  }

  /**
   * ปรับความเข้มเส้นกริด (เช่น เพิ่มความเด่นชัดเมื่อถือเครื่องมือปลูกต้นไม้)
   */
  public setGridOpacity(opacity: number) {
    this.gridMat.opacity = opacity;
  }

  /**
   * อัปเดตตำแหน่งและการแสดงผลของเคอร์เซอร์กริด
   */
  public updateCursor(
    gx: number,
    gz: number,
    status: GridCursorStatus = 'valid',
    visible: boolean = true
  ) {
    this.cursorVisible = visible;
    this.cursorGroup.visible = visible;

    if (!visible) return;

    // คำนวณพิกัดโลกจากพิกัดกริด
    const { x, z } = gridToWorld(gx, gz);
    this.cursorGroup.position.set(x, 0.025, z);

    if (this.currentStatus !== status) {
      this.currentStatus = status;
      const colorVal = FarmGridOverlay3D.COLORS[status];
      this.cursorMat.color.setHex(colorVal);
      this.cornerMat.color.setHex(colorVal);
    }
  }

  /**
   * ซ่อน Cursor เมื่อเมาส์ออกนอกเขตหรือไม่ได้เล็งที่ดิน
   */
  public hideCursor() {
    this.cursorVisible = false;
    this.cursorGroup.visible = false;
  }

  /**
   * แอนิเมชันกระพริบหายใจของ Cursor (Breathing pulse)
   */
  public update(elapsed: number) {
    if (this.cursorVisible) {
      // แคลคูลัสการกวัดแกว่งแบบ Sine Wave: f(t) = base + A * sin(omega * t)
      const pulse = 0.28 + 0.12 * Math.sin(elapsed * 5.0);
      this.cursorMat.opacity = pulse;

      // หมุน/ขยับขยายมุมจิ๋วๆ เบาๆ เพื่อให้ดูมีชีวิตชีวา
      const scale = 1.0 + 0.02 * Math.sin(elapsed * 4.0);
      this.cursorGroup.scale.set(scale, 1, scale);
    }
  }
}
