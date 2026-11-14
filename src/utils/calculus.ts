/**
 * Calculus & Kinematic Mathematics Utilities
 * Differential equations, Fourier harmonic gait physics, and exponential damping
 */

/**
 * First-Order Differential Damping (Exponential Lerp)
 * Exact analytical solution to dx/dt = -λ * (x - target)
 * Resolves frame-rate independent smooth convergence.
 */
export function exponentialDamp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/**
 * Centrifugal Banking Angle
 * θ = arctan( (v * ω) / g )
 * Calculates natural body roll lean when cornering based on centripetal acceleration.
 */
export function centrifugalBankingAngle(
  speed: number,
  angularVelocity: number,
  gravity: number = 9.81
): number {
  const lateralAcceleration = speed * angularVelocity;
  return Math.atan(lateralAcceleration / gravity);
}

/**
 * Shortest Angular Difference (in radians, from -π to +π)
 */
export function shortestAngleDiff(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Smooth Cubic Hermite Spline S-Curve (Growth Curves)
 * S(t) = 3t^2 - 2t^3 for t in [0, 1]
 */
export function cubicHermite(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Quadruped Trot Gait Fourier Harmonics
 * Trot gait uses diagonal pair antiphase (phase difference = π):
 * LF & RR in phase; RF & LR offset by π.
 * Returns leg pitch angle in radians.
 */
export function quadrupedLegPitch(
  walkCycle: number,
  legIndex: number, // 0: LF, 1: RF, 2: LR, 3: RR
  pitchAmplitude: number = 0.55
): number {
  const phaseOffset = legIndex === 0 || legIndex === 3 ? 0 : Math.PI;
  // Fundamental frequency + second harmonic for natural foot strike
  return (
    Math.sin(walkCycle + phaseOffset) * pitchAmplitude +
    Math.sin((walkCycle + phaseOffset) * 2) * (pitchAmplitude * 0.15)
  );
}

/**
 * Biped Gait Fourier Harmonics (for Chicken)
 * Left leg at phase 0, Right leg at phase π
 */
export function bipedLegPitch(walkCycle: number, isRightLeg: boolean, amplitude: number = 0.7): number {
  const offset = isRightLeg ? Math.PI : 0;
  return Math.sin(walkCycle + offset) * amplitude;
}

/**
 * Periodic grazing bobbing motion
 */
export function grazingBob(time: number, freq: number = 2.5, amplitude: number = 0.08): number {
  return Math.sin(time * freq) * amplitude;
}
