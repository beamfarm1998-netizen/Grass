export class ReelMechanics {
  private dragRatio = 0.6; // 15% to 100% of reel maxDragN
  private spoolAngleRad = 0;

  getDragRatio(): number {
    return this.dragRatio;
  }

  setDragRatio(ratio: number): void {
    this.dragRatio = Math.max(0.15, Math.min(1.0, ratio));
  }

  adjustDrag(delta: number): number {
    this.setDragRatio(this.dragRatio + delta);
    return this.dragRatio;
  }

  getEffectiveMaxDragN(reelMaxDragN: number): number {
    return reelMaxDragN * this.dragRatio;
  }

  /**
   * Computes how much unstrained line is retrieved during dt when the player holds Reel.
   * High opposing tension slows cranking efficiency realistically.
   */
  computeLineRetrieved(
    isReeling: boolean,
    recoveryRateMps: number,
    currentTensionN: number,
    maxDragN: number,
    dt: number
  ): number {
    if (!isReeling) return 0;
    const loadFactor = maxDragN > 0 ? Math.min(0.92, (currentTensionN / maxDragN) * 0.55) : 0;
    const effectiveSpeed = recoveryRateMps * (1 - loadFactor);
    const deltaLine = Math.max(0, effectiveSpeed * dt);
    this.spoolAngleRad = (this.spoolAngleRad + deltaLine * 9.5) % (Math.PI * 2);
    return deltaLine;
  }

  advanceDragSlipAngle(slipMeters: number): void {
    this.spoolAngleRad = (this.spoolAngleRad - slipMeters * 11.0) % (Math.PI * 2);
  }

  getSpoolAngleRad(): number {
    return this.spoolAngleRad;
  }
}
