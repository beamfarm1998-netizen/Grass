export interface LinePhysicsInput {
  currentDistanceM: number; // L: Euclidean distance from rod tip to hook/fish
  unstrainedLengthM: number; // L0: Unspooled line length
  extensionVelocityMps: number; // dL/dt
  stiffnessK: number; // k (N/m)
  dampingC: number; // c (N·s/m)
  maxDragForceN: number; // Reel clutch slip threshold
  breakStrengthN: number; // Line test limit
  rodFlexShockAbsorb: number; // 0.3..0.9 rod cushioning factor
  dt: number;
}

export interface LinePhysicsResult {
  tensionN: number;
  newUnstrainedLengthM: number;
  isSlack: boolean;
  isDragSlipping: boolean;
  tensionRatio: number; // tensionN / breakStrengthN
  overloadDelta: number;
  isInstantSnap: boolean;
}

export class LinePhysics {
  /**
   * Core spring-damper tension equation:
   * T = max(0, k * (L - L0) + c * dL/dt)
   * Extended with rod blank shock absorption, slack gating, and reel drag clutch slip.
   */
  static evaluateSpringDamperTension(
    L: number,
    L0: number,
    dLdt: number,
    k: number,
    c: number
  ): number {
    const extension = L - L0;
    if (extension <= 0) {
      return 0;
    }
    const raw = k * extension + c * dLdt;
    return Math.max(0, raw);
  }

  static step(input: LinePhysicsInput): LinePhysicsResult {
    const {
      currentDistanceM: L,
      extensionVelocityMps: dLdt,
      stiffnessK: k,
      dampingC: c,
      maxDragForceN,
      breakStrengthN,
      rodFlexShockAbsorb,
      dt,
    } = input;

    let L0 = Math.max(0.6, input.unstrainedLengthM);
    const effectiveK = k * (1 - rodFlexShockAbsorb * 0.28);

    let tensionN = this.evaluateSpringDamperTension(L, L0, dLdt, effectiveK, c);
    let isDragSlipping = false;

    // Reel drag clutch pays out line when pull exceeds drag setting, with viscous clutch friction
    if (tensionN > maxDragForceN && maxDragForceN > 0) {
      isDragSlipping = true;
      const excessForce = tensionN - maxDragForceN;
      const payoutSpeedMps = Math.min(9.5, excessForce * 0.085);
      L0 += payoutSpeedMps * dt;
      // Re-evaluate post-slip tension with dynamic friction spike residual
      const postSlipTension = this.evaluateSpringDamperTension(L, L0, dLdt * 0.45, effectiveK, c);
      tensionN = Math.max(maxDragForceN, maxDragForceN + (postSlipTension - maxDragForceN) * 0.42);
    }

    const isSlack = L - L0 < 0.015 || tensionN < 1.2;
    const tensionRatio = breakStrengthN > 0 ? tensionN / breakStrengthN : 0;

    let overloadDelta = 0;
    if (tensionRatio > 0.96) {
      overloadDelta = (tensionRatio - 0.96) * 3.4 * dt;
    } else {
      overloadDelta = -0.85 * dt;
    }

    const isInstantSnap = tensionRatio >= 1.24;

    return {
      tensionN,
      newUnstrainedLengthM: L0,
      isSlack,
      isDragSlipping,
      tensionRatio,
      overloadDelta,
      isInstantSnap,
    };
  }
}
