// src/components/3d/animals/GoatAnimal.ts
import * as THREE from 'three';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';

/**
 * 🐐 Goat Species Module (แพะ)
 * Systematic rig generator and athletic quadruped controller with curved horns, goatee, and agile kinematics.
 */
export class GoatAnimalController implements AnimalSpeciesController {
  public readonly type = 'goat' as const;
  public readonly nameEn = 'Goat';
  public readonly nameTh = 'แพะ';
  public readonly emoji = '🐐';

  /**
   * Procedural Meadow Goat Rig with curved horns, beard, agile athletic build
   */
  public createRig(materials: AnimalRigMaterials): AnimalRigResult {
    const root = new THREE.Group();
    root.name = 'GoatRig';

    // Torso (Slender athletic frame)
    const bodyGeo = new THREE.BoxGeometry(0.85, 0.85, 1.6);
    const bodyMesh = new THREE.Mesh(bodyGeo, materials.goatMat);
    bodyMesh.position.set(0, 0.95, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    root.add(bodyMesh);

    // Neck and Head
    const neck = new THREE.Group();
    neck.position.set(0, 1.25, 0.7);
    root.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.25, 0.25);
    neck.add(headGroup);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.65), materials.goatMat);
    skull.castShadow = true;
    headGroup.add(skull);

    // Muzzle
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.4), materials.pinkMuzzleMat);
    muzzle.position.set(0, -0.12, 0.36);
    headGroup.add(muzzle);

    // Goatee Beard
    const beardGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
    const beard = new THREE.Mesh(beardGeo, materials.darkHoofMat);
    beard.position.set(0, -0.34, 0.42);
    beard.rotation.x = 0.3;
    headGroup.add(beard);

    // Curved Horns (Smooth Quadratic Bezier curves)
    const hornCurveL = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0.2, 0.26, 0.05),
      new THREE.Vector3(0.3, 0.65, -0.1),
      new THREE.Vector3(0.38, 0.55, -0.38)
    );
    const hornGeoL = new THREE.TubeGeometry(hornCurveL, 12, 0.055, 6, false);
    const hornMeshL = new THREE.Mesh(hornGeoL, materials.hornIvoryMat);
    headGroup.add(hornMeshL);

    const hornCurveR = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.2, 0.26, 0.05),
      new THREE.Vector3(-0.3, 0.65, -0.1),
      new THREE.Vector3(-0.38, 0.55, -0.38)
    );
    const hornGeoR = new THREE.TubeGeometry(hornCurveR, 12, 0.055, 6, false);
    const hornMeshR = new THREE.Mesh(hornGeoR, materials.hornIvoryMat);
    headGroup.add(hornMeshR);

    // Expressive Ears
    const earGeo = new THREE.BoxGeometry(0.34, 0.12, 0.06);
    const earL = new THREE.Mesh(earGeo, materials.goatMat);
    earL.position.set(0.36, 0.16, -0.05);
    earL.rotation.z = -0.35;
    const earR = earL.clone();
    earR.position.set(-0.36, 0.16, -0.05);
    earR.rotation.z = 0.35;
    headGroup.add(earL, earR);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const eyeL = new THREE.Mesh(eyeGeo, materials.darkEyeMat);
    eyeL.position.set(0.28, 0.08, 0.18);
    const eyeR = eyeL.clone();
    eyeR.position.set(-0.28, 0.08, 0.18);
    headGroup.add(eyeL, eyeR);

    // Athletic Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    const hoofGeo = new THREE.BoxGeometry(0.2, 0.12, 0.22);

    const makeGoatLeg = (x: number, z: number, name: string) => {
      const hip = new THREE.Group();
      hip.name = name;
      hip.position.set(x, 0.65, z);

      const leg = new THREE.Mesh(legGeo, materials.goatMat);
      leg.position.set(0, -0.26, 0);
      leg.castShadow = true;
      hip.add(leg);

      const hoof = new THREE.Mesh(hoofGeo, materials.darkHoofMat);
      hoof.position.set(0, -0.58, 0.02);
      hip.add(hoof);

      root.add(hip);
      return hip;
    };

    const legLF = makeGoatLeg(0.32, 0.55, 'Goat_LF');
    const legRF = makeGoatLeg(-0.32, 0.55, 'Goat_RF');
    const legLR = makeGoatLeg(0.32, -0.55, 'Goat_LR');
    const legRR = makeGoatLeg(-0.32, -0.55, 'Goat_RR');

    // Short perky tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.25, -0.82);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 5), materials.goatMat);
    tailMesh.position.set(0, 0.08, -0.08);
    tailMesh.rotation.x = -0.65;
    tailGroup.add(tailMesh);
    root.add(tailGroup);

    return {
      root,
      bodyMesh,
      headGroup: neck,
      tailGroup,
      legs: [legLF, legRF, legLR, legRR],
    };
  }

  /**
   * Athletic gait kinematics: high-cadence trot, nimble tail flicks,
   * grazing nibbles and head bobbing.
   */
  public animate(
    runtime: AnimalRuntime,
    _dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void {
    // 1. Athletic quadruped trot: Pair 1 (LF, RR) vs Pair 2 (RF, LR)
    const gaitFreq = currentSpeed * 5.0;
    const trotPhase = isWalking ? Math.sin(elapsed * gaitFreq) : 0;

    if (runtime.legs[0]) runtime.legs[0].rotation.x = trotPhase * 0.6;
    if (runtime.legs[3]) runtime.legs[3].rotation.x = trotPhase * 0.6;
    if (runtime.legs[1]) runtime.legs[1].rotation.x = -trotPhase * 0.6;
    if (runtime.legs[2]) runtime.legs[2].rotation.x = -trotPhase * 0.6;

    // 2. Short perky tail flick
    if (runtime.tailGroup) {
      const tailFlick = isWalking
        ? Math.sin(elapsed * 6.0) * 0.4
        : Math.sin(elapsed * 2.0) * 0.15;
      runtime.tailGroup.rotation.y = tailFlick;
    }

    // 3. Grazing & Nibbling head motion
    if (runtime.state === 'grazing') {
      runtime.headGroup.rotation.x = 0.52 + Math.sin(elapsed * 3.0) * 0.08;
      runtime.headGroup.rotation.z = Math.sin(elapsed * 5.0) * 0.05;
    } else {
      runtime.headGroup.rotation.x = Math.sin(elapsed * 1.8) * 0.05;
      runtime.headGroup.rotation.z = 0;
    }

    // 4. Springy vertical harmonic
    const bounce = isWalking ? Math.abs(Math.sin(elapsed * gaitFreq)) * 0.045 : 0;
    runtime.group.position.y = bounce + runtime.petBounce * 0.4;
  }
}

export const goatSpecies = new GoatAnimalController();
