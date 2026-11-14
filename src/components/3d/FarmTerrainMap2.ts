// src/components/3d/FarmTerrainMap2.ts
import * as THREE from 'three';

/**
 * FarmTerrainMap2 (แผนที่ฟาร์มที่ 2 - แดนบุกเบิกทองคำ Lv.10)
 * เป็นผืนแผ่นดินส่วนขยายอิสระ ไม่ไปแตะต้อง FarmTerrain.ts เดิม
 */
export class FarmTerrainMap2 {
  public group: THREE.Group;
  public groundMesh: THREE.Mesh;
  public interactiveMeshes: THREE.Mesh[] = [];

  private isUnlocked: boolean = false;
  private gateGroup: THREE.Group;
  private barricadeGroup: THREE.Group;
  private lanternsGroup: THREE.Group;
  private groundMat: THREE.MeshStandardMaterial;

  constructor(renderer?: THREE.WebGLRenderer) {
    this.group = new THREE.Group();
    this.group.name = 'FarmTerrainMap2';

    // ──────────────────────── 1. ผืนดินแผนที่ฟาร์มที่ 2 (ฝั่งซ้าย X: -62, Z: 0) ────────────────────────
    const map2Width = 56;
    const map2Depth = 78;

    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x5a7d32, // สีเขียวทุ่งหญ้าชอุ่ม
      roughness: 0.9,
      metalness: 0.02,
    });

    const groundGeo = new THREE.PlaneGeometry(map2Width, map2Depth);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
    groundMesh.position.set(-62, 0.005, 0); // วางต่อจากขอบซ้ายของแผนที่หลัก
    groundMesh.receiveShadow = true;
    this.groundMesh = groundMesh;
    this.group.add(groundMesh);

    // ทางเดินดินเชื่อมระหว่างฟาร์ม 1 และฟาร์ม 2
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x9e8772, roughness: 0.95 });
    const pathGeo = new THREE.PlaneGeometry(16, 4.5);
    pathGeo.rotateX(-Math.PI / 2);
    const connectorPath = new THREE.Mesh(pathGeo, pathMat);
    connectorPath.position.set(-44, 0.015, -4);
    connectorPath.receiveShadow = true;
    this.group.add(connectorPath);

    // ──────────────────────── 2. ซุ้มประตูเชื่อมเขต (Frontier Gateway) ────────────────────────
    this.gateGroup = new THREE.Group();
    this.gateGroup.position.set(-42, 0, -4);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x543621, roughness: 0.85 });
    const woodLightMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.7 });

    // เสาซุ้มประตูซ้ายและขวา
    for (const sz of [-2.4, 2.4]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 3.6, 8), woodMat);
      pillar.position.set(0, 1.8, sz);
      pillar.castShadow = true;
      this.gateGroup.add(pillar);

      // โคมไฟบนเสา
      const lamp = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({
        color: 0xffd54f,
        emissive: 0xff9800,
        emissiveIntensity: 0.8,
      }));
      lamp.position.set(0, 3.8, sz);
      this.gateGroup.add(lamp);
    }

    // คานไม้ด้านบนซุ้มประตู
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 5.4), woodMat);
    beam.position.set(0, 3.5, 0);
    beam.castShadow = true;
    this.gateGroup.add(beam);

    // ──────────────────────── 3. สิ่งกีดขวาง & ป้ายประกาศตอนยังไม่ปลดล็อก (Barricade) ────────────────────────
    this.barricadeGroup = new THREE.Group();

    // รั้วกั้นทางเข้า
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 4.4), woodMat);
    fence.position.set(0, 0.6, 0);
    fence.castShadow = true;
    this.barricadeGroup.add(fence);

    // ป้ายไม้ประกาศ "ฟาร์มที่ 2 (ปลดล็อกที่ Lv.10)"
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 2.6), woodLightMat);
    signBoard.position.set(0, 1.8, 0);
    signBoard.castShadow = true;
    signBoard.userData = { isExpansionGate: true };
    this.barricadeGroup.add(signBoard);

    // แผ่นคลิกตรวจจับ Raycast สำหรับป้าย
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 3.0, 5.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(0, 1.5, 0);
    hitBox.userData = { isExpansionGate: true };
    this.barricadeGroup.add(hitBox);

    this.interactiveMeshes.push(hitBox);
    this.interactiveMeshes.push(signBoard);

    this.gateGroup.add(this.barricadeGroup);

    // ──────────────────────── 4. แถบโคมไฟฉลองเมื่อปลดล็อกแล้ว ────────────────────────
    this.lanternsGroup = new THREE.Group();
    this.lanternsGroup.visible = false;
    this.gateGroup.add(this.lanternsGroup);

    this.group.add(this.gateGroup);
  }

  /**
   * อัปเดตสถานะปลดล็อกตามโซนที่ผู้เล่นมี (Zone 5 = ฟาร์มที่ 2)
   */
  public setUnlocked(unlocked: boolean) {
    this.isUnlocked = unlocked;
    if (unlocked) {
      this.barricadeGroup.visible = false;
      this.lanternsGroup.visible = true;
      this.groundMat.color.setHex(0x4c6f2a); // เปลี่ยนเป็นสีเขียวชอุ่มเต็มที่
    } else {
      this.barricadeGroup.visible = true;
      this.lanternsGroup.visible = false;
      this.groundMat.color.setHex(0x5a7d32);
    }
  }

  public update(elapsed: number) {
    if (!this.isUnlocked) {
      // แอนิเมชันป้ายโยกเบาๆ ดึงดูดสายตา
      this.barricadeGroup.rotation.y = Math.sin(elapsed * 2.0) * 0.02;
    }
  }

  public dispose() {
    this.interactiveMeshes = [];
    const disposedMaterials = new Set<THREE.Material>();
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (!disposedMaterials.has(m)) {
              disposedMaterials.add(m);
              m.dispose();
            }
          });
        } else if (mat && !disposedMaterials.has(mat)) {
          disposedMaterials.add(mat);
          mat.dispose();
        }
      }
    });
    this.group.clear();
  }
}