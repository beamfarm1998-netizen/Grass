// ============================================================================
// HarvestSelection.tsx
// Visual Layer ของ selection — สร้าง/อัปเดต/ลบ Three.js objects
// - ไม่มี business logic
// - ไม่คำนวณ Raycast
// - dispose ครบทุก geometry/material
// ============================================================================
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { HarvestTarget } from '../../hooks/useHarvestMode';

interface HarvestSelectionProps {
  scene: THREE.Scene;
  hover: HarvestTarget | null;
  selection: HarvestTarget[];
  /** parent แปลง target → ตำแหน่งโลก (ดึงจาก grid/plots/trees) */
  getTargetPosition: (target: HarvestTarget) => THREE.Vector3 | null;
  /** ตัวเลือก: รัศมีริงต่อ target (default 0.7) */
  getTargetRadius?: (target: HarvestTarget) => number;
}

const READY_COLOR = 0x22c55e; // green-500
const NOT_READY_COLOR = 0x9ca3af; // gray-400
const SELECTED_COLOR = 0x10b981; // emerald-500

export const HarvestSelection: React.FC<HarvestSelectionProps> = ({
  scene,
  hover,
  selection,
  getTargetPosition,
  getTargetRadius = () => 0.7,
}) => {
  const groupRef = useRef<THREE.Group | null>(null);

  // Mount / unmount group
  useEffect(() => {
    const group = new THREE.Group();
    group.name = 'HarvestSelectionOverlay';
    scene.add(group);
    groupRef.current = group;

    return () => {
      scene.remove(group);
      disposeChildren(group);
      groupRef.current = null;
    };
  }, [scene]);

  // อัปเดต visuals ทุกครั้งที่ hover/selection เปลี่ยน
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // เคลียร์ของเดิมแบบ dispose ครบ
    disposeChildren(group);
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // ---- Hover ring ----
    if (hover) {
      const pos = getTargetPosition(hover);
      if (pos) {
        const ring = createRing(
          hover.isReady ? READY_COLOR : NOT_READY_COLOR,
          getTargetRadius(hover),
          hover.isReady ? 0.85 : 0.45,
        );
        ring.position.copy(pos);
        ring.position.y += 0.03;
        group.add(ring);
      }
    }

    // ---- Selected rings ----
    for (const target of selection) {
      const pos = getTargetPosition(target);
      if (!pos) continue;
      const ring = createRing(
        SELECTED_COLOR,
        getTargetRadius(target) * 1.15,
        1,
      );
      ring.position.copy(pos);
      ring.position.y += 0.04;
      group.add(ring);
    }

    // Selection จะถูก clear โดย hook หลัง execute เสร็จ
    // ถ้า target หายไปจากโลก -> getTargetPosition คืน null -> ไม่มีริงถูกวาด
  }, [hover, selection, getTargetPosition, getTargetRadius]);

  return null;
};

// ---------- helpers ----------
function createRing(color: number, radius: number, opacity: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.85, radius, 40);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 999;
  return mesh;
}

function disposeChildren(group: THREE.Group) {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
}

export default HarvestSelection;