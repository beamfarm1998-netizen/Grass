import { GameClock } from './GameClock';

export interface GameLoopHandlers {
  fixedUpdate: (fixedDt: number, elapsed: number) => void;
  render: (frameDt: number, alpha: number, elapsed: number) => void;
  getGlContext?: () => WebGL2RenderingContext | WebGLRenderingContext | null;
  isSoftwareGl?: boolean;
}

export class GameLoop {
  private running = false;
  private rafId = 0;
  private timerId = 0;
  private accumulator = 0;
  private readonly clock: GameClock;
  private readonly fixedTimeStep: number;
  private readonly maxSubSteps: number;
  private readonly handlers: GameLoopHandlers;

  constructor(
    clock: GameClock,
    fixedTimeStep: number,
    maxSubSteps: number,
    handlers: GameLoopHandlers
  ) {
    this.clock = clock;
    this.fixedTimeStep = fixedTimeStep;
    this.maxSubSteps = maxSubSteps;
    this.handlers = handlers;
  }

  start(): void {
    if (this.running) {
      // Guard against duplicate loops
      return;
    }
    this.running = true;
    this.accumulator = 0;
    this.clock.start();
    this.scheduleNextFrame();
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = 0;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduleNextFrame(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((now) => this.step(now));
  }

  private afterSoftwareDraw(cb: () => void): void {
    const gl = this.handlers.getGlContext?.();
    if (gl && 'fenceSync' in gl && typeof gl.fenceSync === 'function') {
      const gl2 = gl as WebGL2RenderingContext;
      const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl2.flush();
      const poll = () => {
        if (!this.running) {
          if (sync) gl2.deleteSync(sync);
          return;
        }
        const state = sync && gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
        if (state === gl2.UNSIGNALED) {
          this.timerId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl2.deleteSync(sync);
          this.timerId = window.setTimeout(cb, 80);
        }
      };
      this.timerId = window.setTimeout(poll, 5);
    } else {
      this.timerId = window.setTimeout(cb, 80);
    }
  }

  private step(nowMs: number): void {
    if (!this.running) return;
    this.rafId = 0;

    const dt = this.clock.tick(nowMs);
    const elapsed = this.clock.getElapsed();

    if (dt > 0 && !this.clock.isPaused()) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
        this.handlers.fixedUpdate(this.fixedTimeStep, elapsed);
        this.accumulator -= this.fixedTimeStep;
        steps++;
      }
      if (steps === this.maxSubSteps) {
        this.accumulator = 0;
      }
    }

    const alpha = this.fixedTimeStep > 0 ? this.accumulator / this.fixedTimeStep : 0;
    this.handlers.render(dt, alpha, elapsed);

    if (!this.running) return;

    if (this.handlers.isSoftwareGl) {
      this.afterSoftwareDraw(() => {
        if (this.running) {
          this.step(performance.now());
        }
      });
    } else {
      this.scheduleNextFrame();
    }
  }
}
