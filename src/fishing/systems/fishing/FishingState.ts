export enum FishingState {
  IDLE = 'IDLE',
  CASTING = 'CASTING',
  WAITING = 'WAITING',
  BITE = 'BITE',
  HOOKED = 'HOOKED',
  FIGHTING = 'FIGHTING',
  REELING = 'REELING',
  LANDED = 'LANDED',
  RESULT = 'RESULT',
  FISH_ESCAPED = 'FISH_ESCAPED',
  HOOK_FAILED = 'HOOK_FAILED',
  LINE_BROKEN = 'LINE_BROKEN',
}

const VALID_TRANSITIONS: Record<FishingState, readonly FishingState[]> = {
  [FishingState.IDLE]: [FishingState.CASTING],
  [FishingState.CASTING]: [FishingState.WAITING, FishingState.IDLE],
  [FishingState.WAITING]: [FishingState.BITE, FishingState.HOOK_FAILED, FishingState.IDLE],
  [FishingState.BITE]: [FishingState.HOOKED, FishingState.HOOK_FAILED, FishingState.IDLE],
  [FishingState.HOOKED]: [FishingState.FIGHTING, FishingState.FISH_ESCAPED],
  [FishingState.FIGHTING]: [
    FishingState.REELING,
    FishingState.LANDED,
    FishingState.FISH_ESCAPED,
    FishingState.LINE_BROKEN,
  ],
  [FishingState.REELING]: [
    FishingState.FIGHTING,
    FishingState.LANDED,
    FishingState.FISH_ESCAPED,
    FishingState.LINE_BROKEN,
  ],
  [FishingState.LANDED]: [FishingState.RESULT],
  [FishingState.RESULT]: [FishingState.IDLE],
  [FishingState.FISH_ESCAPED]: [FishingState.IDLE],
  [FishingState.HOOK_FAILED]: [FishingState.IDLE],
  [FishingState.LINE_BROKEN]: [FishingState.IDLE],
};

export function canTransitionFishingState(from: FishingState, to: FishingState): boolean {
  if (from === to) return false;
  return VALID_TRANSITIONS[from].includes(to);
}
