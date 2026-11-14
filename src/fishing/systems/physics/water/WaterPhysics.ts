export class WaterPhysics {
  /**
   * Deterministic surface wave elevation h(x, z, t) shared between CPU bobber buoyancy
   * and GPU vertex displacement shader.
   */
  static waveHeightAt(x: number, z: number, elapsed: number, windScale = 1.0): number {
    const w1 = Math.sin(x * 0.42 + elapsed * 1.65) * 0.045;
    const w2 = Math.cos(z * 0.55 - elapsed * 1.28) * 0.038;
    const w3 = Math.sin((x + z) * 0.85 + elapsed * 2.3) * 0.018;
    return (w1 + w2 + w3) * windScale;
  }

  /**
   * Lake bathymetry height (Y=0 is mean water surface; negative Y is underwater depth;
   * positive Y is shoreline/island terrain).
   */
  static terrainHeightAt(x: number, z: number): number {
    // Player stands on wooden pier extending from shoreline (z = +23) out to dock tip (z = +14.2)
    // Center of lake basin is around (0, -14)
    const lakeCenterX = 0;
    const lakeCenterZ = -14;
    const dx = x - lakeCenterX;
    const dz = z - lakeCenterZ;

    // Organic shoreline modulation
    const angle = Math.atan2(dz, dx);
    const shorePerturb =
      Math.sin(angle * 3.0) * 3.8 +
      Math.cos(angle * 5.0 + 1.1) * 2.2 +
      Math.sin(x * 0.09) * 1.4;

    const effectiveDist = Math.hypot(dx * 0.92, dz * 1.08) + shorePerturb;
    const shoreRadius = 35.5;

    if (effectiveDist < shoreRadius) {
      // Smooth lake basin bowl down to -5.4m depth
      const normalized = 1 - effectiveDist / shoreRadius;
      const depth = -5.4 * Math.pow(normalized, 0.72) - 0.35;
      return depth;
    }

    // Rising shoreline & surrounding pine hills
    const landDist = effectiveDist - shoreRadius;
    const hillWave =
      Math.sin(x * 0.075) * Math.cos(z * 0.075) * 2.4 +
      Math.sin(x * 0.16 + 0.7) * 0.65;
    return Math.min(18, landDist * 0.26 + Math.max(0, hillWave * 0.45));
  }

  static waterDepthAt(x: number, z: number): number {
    const bedY = this.terrainHeightAt(x, z);
    return Math.max(0, -bedY);
  }

  static isInsideWater(x: number, z: number): boolean {
    return this.terrainHeightAt(x, z) < -0.25;
  }
}
