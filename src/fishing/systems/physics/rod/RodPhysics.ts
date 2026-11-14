import * as THREE from 'three';

export interface RodBendState {
  bendRatio: number; // 0..1
  tipWorldPos: THREE.Vector3;
}

const _baseDir = new THREE.Vector3();
const _pullDir = new THREE.Vector3();
const _segDir = new THREE.Vector3();

export class RodPhysics {
  /**
   * Computes realistic progressive cantilever deflection across N rod blank segments
   * without allocating heap objects inside the simulation loop.
   */
  static computeSegmentPositions(
    buttWorldPos: THREE.Vector3,
    aimYawRad: number,
    elevationPitchRad: number,
    rodLengthM: number,
    rodStrengthN: number,
    flexibility: number,
    tensionN: number,
    targetWorldPos: THREE.Vector3,
    outPoints: THREE.Vector3[]
  ): number {
    const count = outPoints.length;
    if (count < 2) return 0;

    const cosPitch = Math.cos(elevationPitchRad);
    _baseDir.set(
      Math.sin(aimYawRad) * cosPitch,
      Math.sin(elevationPitchRad),
      -Math.cos(aimYawRad) * cosPitch
    ).normalize();

    const normalizedLoad = rodStrengthN > 0 ? Math.min(1.35, tensionN / rodStrengthN) : 0;
    const bendRatio = Math.min(1, normalizedLoad * (0.55 + flexibility * 0.6));

    outPoints[0].copy(buttWorldPos);
    const segLen = rodLengthM / (count - 1);

    _pullDir.copy(targetWorldPos).sub(buttWorldPos);
    if (_pullDir.lengthSq() < 0.001) {
      _pullDir.set(0, -1, 0);
    } else {
      _pullDir.normalize();
    }

    for (let i = 1; i < count; i++) {
      const s = i / (count - 1); // 0 at grip -> 1 at tip
      // Progressive fast/parabolic taper curve: tip bends significantly more than butt
      const taperWeight = Math.pow(s, 2.15) * bendRatio * 0.82;
      _segDir.copy(_baseDir).lerp(_pullDir, Math.min(0.92, taperWeight)).normalize();
      outPoints[i].copy(outPoints[i - 1]).addScaledVector(_segDir, segLen);
    }

    return bendRatio;
  }
}
