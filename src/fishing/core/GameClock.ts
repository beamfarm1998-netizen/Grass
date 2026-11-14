export class GameClock {
  private lastTimestampMs = 0;
  private elapsedSeconds = 0;
  private paused = false;
  private readonly maxDeltaSeconds: number;

  constructor(maxDeltaSeconds = 0.1) {
    this.maxDeltaSeconds = maxDeltaSeconds;
  }

  start(nowMs = performance.now()): void {
    this.lastTimestampMs = nowMs;
  }

  tick(nowMs = performance.now()): number {
    if (this.lastTimestampMs === 0) {
      this.lastTimestampMs = nowMs;
      return 0;
    }
    const rawDelta = Math.max(0, (nowMs - this.lastTimestampMs) / 1000);
    this.lastTimestampMs = nowMs;

    if (this.paused) {
      return 0;
    }

    const clamped = Math.min(rawDelta, this.maxDeltaSeconds);
    this.elapsedSeconds += clamped;
    return clamped;
  }

  setPaused(paused: boolean, nowMs = performance.now()): void {
    this.paused = paused;
    this.lastTimestampMs = nowMs;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getElapsed(): number {
    return this.elapsedSeconds;
  }

  reset(): void {
    this.lastTimestampMs = 0;
    this.elapsedSeconds = 0;
    this.paused = false;
  }
}
