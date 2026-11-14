// src/components/3d/animals/PigAnimal.ts
import * as THREE from 'three';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

/**
 * 🐷 Pig Species Module (หมู)
 * Systematic rig generator and quadruped trot controller with snout rooting and corkscrew tail dynamics.
 */
export class PigAnimalController implements AnimalSpeciesController {
  public readonly type = 'pig' as const;
  public readonly nameEn = 'Pig';
  public readonly nameTh = 'หมู';
  public readonly emoji = '🐷';

  /**
   * Procedural Rosy Pig Rig with snout, floppy ears, short trotters, curly tail
   */
  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'PigRig';

    // Plump Barrel Torso
    const bodyGeo = new THREE.BoxGeometry(0.95, 0.85, 1.55);
    const bodyMesh = new THREE.Mesh(bodyGeo, materials.pigMat);
    bodyMesh.position.set(0, 0.75, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);

    // Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.82, 0.75);
    root.add(headGroup);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.65), materials.pigMat);
    skull.castShadow = true;
    headGroup.add(skull);

    // Snout
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.22, 0.24, 16),
      materials.pinkMuzzleMat
    );
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -0.06, 0.38);
    headGroup.add(snout);

    const nostrilGeo = new THREE.SphereGeometry(0.04, 6, 6);
    const n1 = new THREE.Mesh(nostrilGeo, materials.darkEyeMat);
    n1.position.set(0.08, -0.06, 0.5);
    const n2 = n1.clone();
    n2.position.set(-0.08, -0.06, 0.5);
    headGroup.add(n1, n2);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, materials.darkEyeMat);
    eyeL.position.set(0.34, 0.12, 0.2);
    const eyeR = eyeL.clone();
    eyeR.position.set(-0.34, 0.12, 0.2);
    headGroup.add(eyeL, eyeR);

    // Floppy Ears
    const earGeo = new THREE.BoxGeometry(0.24, 0.28, 0.08);
    const earL = new THREE.Mesh(earGeo, materials.pigMat);
    earL.position.set(0.38, 0.32, -0.05);
    earL.rotation.z = -0.4;
    earL.rotation.x = 0.35;
    const earR = earL.clone();
    earR.position.set(-0.38, 0.32, -0.05);
    earR.rotation.z = 0.4;
    headGroup.add(earL, earR);

    // Trotters (4 short sturdy legs)
    const legGeo = new THREE.BoxGeometry(0.22, 0.45, 0.22);
    const hoofGeo = new THREE.BoxGeometry(0.24, 0.1, 0.24);

    const makeLeg = (x: number, z: number, name: string) => {
      const hip = new THREE.Group();
      hip.name = name;
      hip.position.set(x, 0.45, z);

      const leg = new THREE.Mesh(legGeo, materials.pigMat);
      leg.position.set(0, -0.18, 0);
      leg.castShadow = true;
      hip.add(leg);

      const hoof = new THREE.Mesh(hoofGeo, materials.darkHoofMat);
      hoof.position.set(0, -0.38, 0);
      hip.add(hoof);

      root.add(hip);
      return hip;
    };

    const legLF = makeLeg(0.34, 0.48, 'Pig_LF');
    const legRF = makeLeg(-0.34, 0.48, 'Pig_RF');
    const legLR = makeLeg(0.34, -0.48, 'Pig_LR');
    const legRR = makeLeg(-0.34, -0.48, 'Pig_RR');

    // Curly Corkscrew Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 0.95, -0.78);
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.03, 8, 16, Math.PI * 1.8),
      materials.pinkMuzzleMat
    );
    coil.rotation.y = Math.PI / 2;
    tailGroup.add(coil);
    root.add(tailGroup);

    return {
      root,
      bodyMesh,
      headGroup,
      tailGroup,
      legs: [legLF, legRF, legLR, legRR],
    };
  }

  /**
   * Quadruped trot kinematics: diagonal trotter pair synchrony,
   * curly tail wiggling, snout rooting when grazing, and waddling heave.
   */
  public animate(
    runtime: AnimalRuntime,
    _dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    // 1. Diagonal trot harmonic: Pair 1 (LF, RR) vs Pair 2 (RF, LR)
    const gaitFreq = currentSpeed * 5.2;
    const trotPhase = isWalking ? Math.sin(elapsed * gaitFreq) : 0;

    if (runtime.legs[0]) runtime.legs[0].rotation.x = trotPhase * 0.55;
    if (runtime.legs[3]) runtime.legs[3].rotation.x = trotPhase * 0.55;
    if (runtime.legs[1]) runtime.legs[1].rotation.x = -trotPhase * 0.55;
    if (runtime.legs[2]) runtime.legs[2].rotation.x = -trotPhase * 0.55;

    // 2. Curly tail corkscrew vibration / twirl
    if (runtime.tailGroup) {
      const tailWiggle = isWalking
        ? Math.sin(elapsed * 12.0) * 0.35
        : Math.sin(elapsed * 3.0) * 0.12;
      runtime.tailGroup.rotation.z = tailWiggle;
      runtime.tailGroup.rotation.y = Math.PI / 2 + Math.cos(elapsed * 6.0) * 0.15;
    }

    // 3. Head & Snout Rooting
    if (runtime.state === 'grazing') {
      runtime.headGroup.rotation.x = 0.5 + Math.sin(elapsed * 2.8) * 0.1;
      runtime.headGroup.rotation.y = Math.sin(elapsed * 4.0) * 0.08;
    } else {
      runtime.headGroup.rotation.x = Math.sin(elapsed * 1.6) * 0.06;
      runtime.headGroup.rotation.y = 0;
    }

    // 4. Plump waddling bounce
    const bounce = isWalking ? Math.abs(Math.sin(elapsed * gaitFreq)) * 0.035 : 0;
    runtime.group.position.y = bounce + runtime.petBounce * 0.4;
  }
}

export const pigSpecies = new PigAnimalController();
