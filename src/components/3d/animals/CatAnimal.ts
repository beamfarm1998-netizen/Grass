// src/components/3d/animals/CatAnimal.ts
import * as THREE from 'three';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

export class CatAnimalController implements AnimalSpeciesController {
  public readonly type = 'cat' as const;
  public readonly nameEn = 'Calico Cat';
  public readonly nameTh = 'แมวสามสีฟาร์ม';
  public readonly emoji = '🐱';

  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'CatRigRoot';

    // Materials
    const furWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.7 });
    const furOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.75 });
    const furBlackMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
    const eyeGreenMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.2 });

    // 1. Sleek Torso
    const bodyGeom = new THREE.BoxGeometry(0.42, 0.38, 0.75);
    const bodyMesh = new THREE.Mesh(bodyGeom, furWhiteMat);
    bodyMesh.position.y = 0.42;
    bodyMesh.castShadow = true;
    root.add(bodyMesh);

    // Calico ginger and dark patches
    const patchOrange = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.3), furOrangeMat);
    patchOrange.position.set(-0.14, 0.46, 0.1);
    root.add(patchOrange);

    const patchBlack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.28), furBlackMat);
    patchBlack.position.set(0.13, 0.44, -0.15);
    root.add(patchBlack);

    // 2. Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.65, 0.42);

    const headGeom = new THREE.BoxGeometry(0.36, 0.32, 0.34);
    const headMesh = new THREE.Mesh(headGeom, furWhiteMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Orange patch over one eye
    const headPatch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.15), furOrangeMat);
    headPatch.position.set(-0.1, 0.08, 0.12);
    headGroup.add(headPatch);

    // Pointed triangular ears
    const earGeom = new THREE.ConeGeometry(0.08, 0.16, 4);
    const earL = new THREE.Mesh(earGeom, furOrangeMat);
    earL.position.set(-0.14, 0.22, 0);
    earL.rotation.z = 0.2;
    headGroup.add(earL);

    const earR = new THREE.Mesh(earGeom, furBlackMat);
    earR.position.set(0.14, 0.22, 0);
    earR.rotation.z = -0.2;
    headGroup.add(earR);

    // Pink nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.05, 3), pinkMat);
    nose.rotation.x = Math.PI;
    nose.position.set(0, -0.04, 0.18);
    headGroup.add(nose);

    // Green cat eyes
    const eyeGeom = new THREE.SphereGeometry(0.035, 5, 5);
    const eyeL = new THREE.Mesh(eyeGeom, eyeGreenMat);
    eyeL.position.set(-0.1, 0.04, 0.17);
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeom, eyeGreenMat);
    eyeR.position.set(0.1, 0.04, 0.17);
    headGroup.add(eyeR);

    root.add(headGroup);

    // 3. Elegant Long Curved Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.52, -0.38);

    const tailGeom = new THREE.CylinderGeometry(0.035, 0.03, 0.45, 5);
    tailGeom.translate(0, 0.22, 0);
    const tailMesh = new THREE.Mesh(tailGeom, furOrangeMat);
    tailMesh.rotation.x = 0.7;
    tailGroup.add(tailMesh);
    root.add(tailGroup);

    // 4. Four Slender Paws
    const legs: THREE.Group[] = [];
    const legPositions = [
      [-0.14, 0.3, 0.24],  // FL
      [0.14, 0.3, 0.24],   // FR
      [-0.14, 0.3, -0.24], // BL
      [0.14, 0.3, -0.24],  // BR
    ];

    const legGeom = new THREE.BoxGeometry(0.09, 0.3, 0.09);
    legGeom.translate(0, -0.15, 0);

    legPositions.forEach(([lx, ly, lz]) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, ly, lz);

      const legMesh = new THREE.Mesh(legGeom, furWhiteMat);
      legMesh.castShadow = true;
      legPivot.add(legMesh);

      root.add(legPivot);
      legs.push(legPivot);
    });

    return {
      root,
      bodyMesh,
      headGroup,
      tailGroup,
      legs,
    };
  }

  public animate(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    const { headGroup, tailGroup, legs } = runtime;

    if (isWalking) {
      // Fluid cat walk cycle
      runtime.walkCycle += dt * currentSpeed * 6.5;
      const swing = Math.sin(runtime.walkCycle) * 0.45;

      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      legs[2].rotation.x = -swing;
      legs[3].rotation.x = swing;

      headGroup.rotation.x = Math.sin(runtime.walkCycle * 2) * 0.08;

      if (tailGroup) {
        tailGroup.rotation.y = Math.sin(elapsed * 6) * 0.4;
        tailGroup.rotation.z = Math.cos(elapsed * 4) * 0.25;
      }
    } else {
      // Idle cat: gentle breathing, occasional ear twitch, lazy tail swish
      legs.forEach((l) => (l.rotation.x = 0));
      headGroup.rotation.x = Math.sin(elapsed * 1.5) * 0.03;
      headGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.15;

      if (tailGroup) {
        tailGroup.rotation.y = Math.sin(elapsed * 3.5) * 0.35;
      }
    }

    // Petting reaction bounce
    if (runtime.petBounce > 0) {
      runtime.group.position.y = Math.sin(runtime.petBounce * Math.PI) * 0.25;
      runtime.petBounce = Math.max(0, runtime.petBounce - dt * 2.5);
    } else {
      runtime.group.position.y = 0;
    }
  }
}

export const catSpecies = new CatAnimalController();
