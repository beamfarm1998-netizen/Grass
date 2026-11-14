// src/fishing/systems/fish/ai/FishStateMachine.ts
export enum FishAIState {
  PATROL = 'PATROL',
  APPROACH_BAIT = 'APPROACH_BAIT',
  NIBBLE = 'NIBBLE',
  STRIKE_BITE = 'STRIKE_BITE',
  FLEE = 'FLEE',
  FIGHT = 'FIGHT',
  TIRED = 'TIRED',
  LANDED = 'LANDED',
}

const ALLOWED_TRANSITIONS: Record<FishAIState, readonly FishAIState[]> = {
  [FishAIState.PATROL]: [FishAIState.APPROACH_BAIT, FishAIState.FLEE],
  [FishAIState.APPROACH_BAIT]: [FishAIState.PATROL, FishAIState.NIBBLE, FishAIState.STRIKE_BITE, FishAIState.FLEE],
  [FishAIState.NIBBLE]: [FishAIState.APPROACH_BAIT, FishAIState.STRIKE_BITE, FishAIState.FLEE, FishAIState.PATROL],
  [FishAIState.STRIKE_BITE]: [FishAIState.FIGHT, FishAIState.FLEE, FishAIState.PATROL],
  [FishAIState.FLEE]: [FishAIState.PATROL],
  [FishAIState.FIGHT]: [FishAIState.TIRED, FishAIState.FLEE, FishAIState.LANDED],
  [FishAIState.TIRED]: [FishAIState.FIGHT, FishAIState.LANDED, FishAIState.FLEE],
  [FishAIState.LANDED]: [FishAIState.PATROL],
};

const isDevBuild = (): boolean => {
  try {
    const meta = import.meta as { env?: { DEV?: boolean } } | undefined;
    if (meta?.env?.DEV !== undefined) return Boolean(meta.env.DEV);
    if (typeof process !== 'undefined' && process.env?.NODE_ENV) return process.env.NODE_ENV !== 'production';
  } catch {}
  return false;
};
const DEV = isDevBuild();

export class FishStateMachine {
  private state: FishAIState = FishAIState.PATROL;
  private stateTimer = 0;
  private _justEntered = true;
  private _warnedBlocked = new Set<string>();

  getState(): FishAIState { return this.state; }
  getStateTimer(): number { return this.stateTimer; }

  consumeJustEntered(): boolean {
    if (!this._justEntered) return false;
    this._justEntered = false;
    return true;
  }

  resetStateTimer(): void { this.stateTimer = 0; }
  tickTimer(dt: number): void { this.stateTimer += dt; }

  canTransitionTo(next: FishAIState): boolean {
    if (this.state === next) return false;
    return ALLOWED_TRANSITIONS[this.state].includes(next);
  }

  transitionTo(next: FishAIState): boolean {
    if (!this.canTransitionTo(next)) {
      if (DEV) {
        const key = `${this.state}→${next}`;
        if (!this._warnedBlocked.has(key)) {
          this._warnedBlocked.add(key);
          console.warn(`[FishStateMachine] Blocked invalid transition: ${key}`);
        }
      }
      return false;
    }
    this.state = next;
    this.stateTimer = 0;
    this._justEntered = true;
    return true;
  }

  forceReset(): void {
    this.state = FishAIState.PATROL;
    this.stateTimer = 0;
    this._justEntered = true;
    this._warnedBlocked.clear();
  }
}