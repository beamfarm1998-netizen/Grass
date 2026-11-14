import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LinePhysics } from '../../src/systems/physics/fishing-line/LinePhysics';
import { RodPhysics } from '../../src/systems/physics/rod/RodPhysics';

describe('Fishing Line & Rod Physics', () => {
  it('evaluates zero tension when line has slack (L <= L0)', () => {
    const tension = LinePhysics.evaluateSpringDamperTension(8.0, 8.5, 0.5, 50, 10);
    expect(tension).toBe(0);
  });

  it('evaluates positive spring-damper tension T = max(0, k*(L - L0) + c*dL/dt)', () => {
    // L = 10.5, L0 = 10.0, dL/dt = 1.0, k = 40, c = 8 -> 40*0.5 + 8*1 = 28 N
    const tension = LinePhysics.evaluateSpringDamperTension(10.5, 10.0, 1.0, 40, 8);
    expect(tension).toBeCloseTo(28, 4);
  });

  it('engages reel drag clutch slip and pays out line when pull exceeds maxDragForceN', () => {
    const res = LinePhysics.step({
      currentDistanceM: 14.0,
      unstrainedLengthM: 12.0,
      extensionVelocityMps: 2.5,
      stiffnessK: 60,
      dampingC: 10,
      maxDragForceN: 45,
      breakStrengthN: 115,
      rodFlexShockAbsorb: 0.6,
      dt: 1 / 60,
    });

    expect(res.isDragSlipping).toBe(true);
    expect(res.newUnstrainedLengthM).toBeGreaterThan(12.0);
    expect(res.tensionN).toBeGreaterThanOrEqual(45);
  });

  it('flags instant snap when extreme spike exceeds break threshold', () => {
    const res = LinePhysics.step({
      currentDistanceM: 16.0,
      unstrainedLengthM: 10.0,
      extensionVelocityMps: 6.0,
      stiffnessK: 80,
      dampingC: 12,
      maxDragForceN: 200,
      breakStrengthN: 60,
      rodFlexShockAbsorb: 0.4,
      dt: 1 / 60,
    });

    expect(res.isInstantSnap).toBe(true);
  });

  it('computes progressive cantilever rod deflection under load', () => {
    const points = Array.from({ length: 8 }, () => new THREE.Vector3());
    const butt = new THREE.Vector3(0, 2, 15);
    const target = new THREE.Vector3(0, 0, -5);

    const unloadedBend = RodPhysics.computeSegmentPositions(
      butt,
      0,
      0.5,
      2.4,
      100,
      0.7,
      0,
      target,
      points
    );
    const unloadedTipY = points[points.length - 1].y;

    const loadedBend = RodPhysics.computeSegmentPositions(
      butt,
      0,
      0.5,
      2.4,
      100,
      0.7,
      80,
      target,
      points
    );
    const loadedTipY = points[points.length - 1].y;

    expect(unloadedBend).toBe(0);
    expect(loadedBend).toBeGreaterThan(0.5);
    expect(loadedTipY).toBeLessThan(unloadedTipY);
  });
});
