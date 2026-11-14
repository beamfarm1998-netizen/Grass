// src/components/3d/animals/DogAnimal.ts
import * as THREE from 'three';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

export class DogAnimalController implements AnimalSpeciesController {
  public readonly type = 'dog' as const;
  public readonly nameEn = 'Farm Dog';
  public readonly nameTh = 'หมาฟาร์มแสนรู้';
  public readonly emoji = '🐕';

  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'DogRigRoot';

    // Materials
    const furTanMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.75 });
    const furWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.3 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });

    // 1. Body
    const bodyGeom = new THREE.BoxGeometry(0.55, 0.5, 0.9);
    const bodyMesh = new THREE.Mesh(bodyGeom, furTanMat);
    bodyMesh.position.y = 0.55;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);

    // White chest patch
    const chestGeom = new THREE.BoxGeometry(0.38, 0.35, 0.1);
    const chest = new THREE.Mesh(chestGeom, furWhiteMat);
    chest.position.set(0, 0.55, 0.42);
    root.add(chest);

    // 2. Head Group
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.82, 0.5);

    const headGeom = new THREE.BoxGeometry(0.42, 0.38, 0.42);
    const headMesh = new THREE.Mesh(headGeom, furTanMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Snout with black nose
    const snoutGeom = new THREE.BoxGeometry(0.26, 0.18, 0.25);
    const snout = new THREE.Mesh(snoutGeom, furWhiteMat);
    snout.position.set(0, -0.06, 0.28);
    headGroup.add(snout);

    const noseGeom = new THREE.SphereGeometry(0.045, 6, 6);
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.position.set(0, 0.02, 0.4);
    headGroup.add(nose);

    // Pointed ears
    const earGeom = new THREE.ConeGeometry(0.09, 0.18, 4);
    const earL = new THREE.Mesh(earGeom, furTanMat);
    earL.position.set(-0.16, 0.24, 0);
    earL.rotation.z = 0.25;
    headGroup.add(earL);

    const earR = new THREE.Mesh(earGeom, furTanMat);
    earR.position.set(0.16, 0.24, 0);
    earR.rotation.z = -0.25;
    headGroup.add(earR);

    // Cute dark eyes
    const eyeGeom = new THREE.SphereGeometry(0.04, 5, 5);
    const eyeL = new THREE.Mesh(eyeGeom, noseMat);
    eyeL.position.set(-0.12, 0.06, 0.21);
    headGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeom, noseMat);
    eyeR.position.set(0.12, 0.06, 0.21);
    headGroup.add(eyeR);

    // Red Collar & Bell
    const collarGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 8);
    const collar = new THREE.Mesh(collarGeom, collarMat);
    collar.position.set(0, -0.16, 0);
    headGroup.add(collar);

    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), bellMat);
    bell.position.set(0, -0.2, 0.22);
    headGroup.add(bell);

    root.add(headGroup);

    // 3. Wagging Tail (Curled up Shiba tail)
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.72, -0.45);

    const tailCurve = new THREE.CylinderGeometry(0.05, 0.04, 0.32, 5);
    tailCurve.translate(0, 0.16, 0);
    const tailMesh = new THREE.Mesh(tailCurve, furTanMat);
    tailMesh.rotation.x = 0.8;
    tailGroup.add(tailMesh);
    root.add(tailGroup);

    // 4. Four Legs & Paws
    const legs: THREE.Group[] = [];
    const legPositions = [
      [-0.18, 0.38, 0.28],  // FL
      [0.18, 0.38, 0.28],   // FR
      [-0.18, 0.38, -0.28], // BL
      [0.18, 0.38, -0.28],  // BR
    ];

    const legGeom = new THREE.BoxGeometry(0.13, 0.38, 0.13);
    legGeom.translate(0, -0.19, 0); // pivot at hip

    legPositions.forEach(([lx, ly, lz]) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, ly, lz);

      const legMesh = new THREE.Mesh(legGeom, furTanMat);
      legMesh.castShadow = true;
      legPivot.add(legMesh);

      // White paw socks
      const pawGeom = new THREE.BoxGeometry(0.14, 0.1, 0.16);
      const paw = new THREE.Mesh(pawGeom, furWhiteMat);
      paw.position.set(0, -0.34, 0.02);
      legPivot.add(paw);

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
      // Energetic dog trot cycle
      runtime.walkCycle += dt * currentSpeed * 7.5;
      const swing = Math.sin(runtime.walkCycle) * 0.55;

      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      legs[2].rotation.x = -swing;
      legs[3].rotation.x = swing;

      // Head rhythm bob
      headGroup.rotation.x = Math.sin(runtime.walkCycle * 2) * 0.12;

      // Rapid happy tail wag
      if (tailGroup) {
        tailGroup.rotation.y = Math.sin(elapsed * 18) * 0.55;
        tailGroup.rotation.z = Math.cos(elapsed * 18) * 0.2;
      }
    } else {
      // Idle dog: gentle breathing, head tilting, periodic tail wag
      legs.forEach((l) => (l.rotation.x = 0));
      headGroup.rotation.x = Math.sin(elapsed * 2.5) * 0.05;
      headGroup.rotation.y = Math.sin(elapsed * 1.2) * 0.12;

      if (tailGroup) {
        tailGroup.rotation.y = Math.sin(elapsed * 8) * 0.35;
      }
    }

    // Petting reaction bounce
    if (runtime.petBounce > 0) {
      runtime.group.position.y = Math.sin(runtime.petBounce * Math.PI) * 0.35;
      if (tailGroup) tailGroup.rotation.y = Math.sin(elapsed * 28) * 0.8;
      runtime.petBounce = Math.max(0, runtime.petBounce - dt * 2.5);
    } else {
      runtime.group.position.y = 0;
    }
  }
}

export const dogSpecies = new DogAnimalController();
