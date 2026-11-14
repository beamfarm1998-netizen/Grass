// src/components/3d/drone/useDroneModel.ts
import { useEffect } from 'react';
import * as THREE from 'three';
import {
  disposeHierarchySafely,
  loadValidatedGLTF,
  optimizeGLTFSceneForDevice,
} from '../../../utils/glbValidator';
import { SPOTLIGHT_DISTANCE } from './types';

interface Args {
  scene: THREE.Scene | null;
  isActive: boolean;
  getBasePos: () => THREE.Vector3;
  droneLoadedRef: React.MutableRefObject<boolean>;
  droneRef: React.MutableRefObject<THREE.Group | null>;
  droneWorldPosRef: React.MutableRefObject<THREE.Vector3>;
  basePosRef: React.MutableRefObject<THREE.Vector3>;
  propellersRef: React.MutableRefObject<THREE.Mesh[]>;
  modelHeightRef: React.MutableRefObject<number>;
  spotlightRef: React.MutableRefObject<THREE.SpotLight | null>;
  spotlightTargetRef: React.MutableRefObject<THREE.Object3D | null>;
  enabledRef: React.MutableRefObject<boolean>;
}

export function useDroneModel({
  scene, isActive, getBasePos,
  droneLoadedRef, droneRef, droneWorldPosRef, basePosRef,
  propellersRef, modelHeightRef, spotlightRef, spotlightTargetRef, enabledRef,
}: Args) {
  useEffect(() => {
    if (!scene || (!isActive && !droneLoadedRef.current)) return;
    droneLoadedRef.current = true;
    let cancelled = false;
    const group = new THREE.Group();
    group.position.copy(getBasePos());
    group.visible = enabledRef.current;

    scene.add(group);
    droneRef.current = group;
    basePosRef.current.copy(getBasePos());
    droneWorldPosRef.current.copy(getBasePos());

    // 🛸 3D Helipad แท่นชาร์จทรงล้ำอนาคตที่ (-2, 0.05, 0)
    const helipad = new THREE.Group();
    helipad.name = 'DroneHelipadPad';
    helipad.position.set(-2, 0.05, 0);

    // ฐานโลหะ
    const baseGeo = new THREE.CylinderGeometry(1.5, 1.6, 0.08, 24);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const padMesh = new THREE.Mesh(baseGeo, baseMat);
    padMesh.receiveShadow = true;
    helipad.add(padMesh);

    // วงแหวนนีออนสีฟ้า (Cyan Ring)
    const ringGeo = new THREE.TorusGeometry(1.2, 0.04, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.045;
    helipad.add(ringMesh);

    // ตัวอักษร 'H' ตรงกลาง (3 ชิ้น: แท่งซ้าย, แท่งขวา, คานกลาง)
    const hMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.6,
    });
    const barGeo = new THREE.BoxGeometry(0.12, 0.02, 0.9);
    const leftBar = new THREE.Mesh(barGeo, hMat);
    leftBar.position.set(-0.35, 0.045, 0);
    const rightBar = new THREE.Mesh(barGeo, hMat);
    rightBar.position.set(0.35, 0.045, 0);

    const crossGeo = new THREE.BoxGeometry(0.7, 0.02, 0.12);
    const crossBar = new THREE.Mesh(crossGeo, hMat);
    crossBar.position.set(0, 0.045, 0);

    helipad.add(leftBar);
    helipad.add(rightBar);
    helipad.add(crossBar);
    scene.add(helipad);

    const spotlight = new THREE.SpotLight(0xfff4d6, 0, SPOTLIGHT_DISTANCE, Math.PI / 6, 0.4, 1.5);
    spotlight.position.set(0, 0.5, 0);
    spotlight.castShadow = true;
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, -10, 0);
    group.add(spotlight);
    group.add(spotTarget);
    spotlight.target = spotTarget;
    spotlightRef.current = spotlight;
    spotlightTargetRef.current = spotTarget;

    const isPropellerName = (name: string) => {
      const n = name.toLowerCase();
      return n.includes('prop') || n.includes('rotor') || n.includes('blade');
    };

    const alignModelToGround = (obj: THREE.Object3D) => {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      modelHeightRef.current = size.y || 1.2;
      obj.position.y += -box.min.y;
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
      });
    };

    const finishSetup = (obj: THREE.Object3D) => {
      if (cancelled) { disposeHierarchySafely(obj); return; }
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && isPropellerName(o.name ?? '')) propellersRef.current.push(m);
      });
      alignModelToGround(obj);
      group.add(obj);
    };

    const buildFallback = () => {
      if (cancelled) return;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.25, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x2b2b3a, metalness: 0.6, roughness: 0.3 })
      );
      body.position.y = 0.15;
      body.castShadow = true;
      group.add(body);
      const armGeo = new THREE.BoxGeometry(1.6, 0.08, 0.08);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x555566 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.y = 0.15;
      group.add(arm);
      const arm2 = new THREE.Mesh(armGeo, armMat);
      arm2.rotation.y = Math.PI / 2;
      arm2.position.y = 0.15;
      group.add(arm2);
      const positions: [number, number][] = [
        [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8], [-0.8, -0.8],
      ];
      positions.forEach(([x, z]) => {
        const prop = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.04, 0.1),
          new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.85 })
        );
        prop.position.set(x, 0.3, z);
        group.add(prop);
        propellersRef.current.push(prop);
      });
      modelHeightRef.current = 0.5;
    };

    loadValidatedGLTF('/drone.glb')
      .then(({ gltf, inspection }) => {
        if (cancelled) { disposeHierarchySafely(gltf.scene); return; }
        optimizeGLTFSceneForDevice(gltf.scene, inspection);
        finishSetup(gltf.scene);
      })
      .catch(() => { if (!cancelled) buildFallback(); });

    return () => {
      cancelled = true;
      scene.remove(group);
      disposeHierarchySafely(group);
      scene.remove(helipad);
      disposeHierarchySafely(helipad);
      propellersRef.current = [];
      droneRef.current = null;
      droneLoadedRef.current = false;
      spotlightRef.current = null;
      spotlightTargetRef.current = null;
    };
  }, [scene, isActive, getBasePos, droneLoadedRef, droneRef, droneWorldPosRef,
      basePosRef, propellersRef, modelHeightRef, spotlightRef, spotlightTargetRef, enabledRef]);
}