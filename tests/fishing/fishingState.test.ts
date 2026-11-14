import { describe, expect, it } from 'vitest';
import { FishAIState, FishStateMachine } from '../../src/systems/fish/ai/FishStateMachine';
import { FishingSession } from '../../src/systems/fishing/FishingSession';
import { canTransitionFishingState, FishingState } from '../../src/systems/fishing/FishingState';

describe('Fishing Gameplay & Fish AI State Machines', () => {
  it('enforces valid sequential angling transitions from IDLE through RESULT', () => {
    const session = new FishingSession();
    expect(session.getState()).toBe(FishingState.IDLE);

    // Reject illegal skip
    expect(session.transitionTo(FishingState.FIGHTING)).toBe(false);
    expect(session.getState()).toBe(FishingState.IDLE);

    // Complete valid sequence
    expect(session.transitionTo(FishingState.CASTING)).toBe(true);
    expect(session.transitionTo(FishingState.WAITING)).toBe(true);
    expect(session.transitionTo(FishingState.BITE)).toBe(true);
    expect(session.transitionTo(FishingState.HOOKED)).toBe(true);
    expect(session.transitionTo(FishingState.FIGHTING)).toBe(true);
    expect(session.transitionTo(FishingState.REELING)).toBe(true);
    expect(session.transitionTo(FishingState.LANDED)).toBe(true);
    expect(session.transitionTo(FishingState.RESULT)).toBe(true);
    expect(session.transitionTo(FishingState.IDLE)).toBe(true);
  });

  it('supports recovery transitions from failure states back to IDLE', () => {
    expect(canTransitionFishingState(FishingState.BITE, FishingState.HOOK_FAILED)).toBe(true);
    expect(canTransitionFishingState(FishingState.HOOK_FAILED, FishingState.IDLE)).toBe(true);

    expect(canTransitionFishingState(FishingState.FIGHTING, FishingState.LINE_BROKEN)).toBe(true);
    expect(canTransitionFishingState(FishingState.LINE_BROKEN, FishingState.IDLE)).toBe(true);

    expect(canTransitionFishingState(FishingState.REELING, FishingState.FISH_ESCAPED)).toBe(true);
    expect(canTransitionFishingState(FishingState.FISH_ESCAPED, FishingState.IDLE)).toBe(true);
  });

  it('validates autonomous FishStateMachine transitions', () => {
    const fsm = new FishStateMachine();
    expect(fsm.getState()).toBe(FishAIState.PATROL);
    expect(fsm.transitionTo(FishAIState.FIGHT)).toBe(false);

    expect(fsm.transitionTo(FishAIState.APPROACH_BAIT)).toBe(true);
    expect(fsm.transitionTo(FishAIState.NIBBLE)).toBe(true);
    expect(fsm.transitionTo(FishAIState.STRIKE_BITE)).toBe(true);
    expect(fsm.transitionTo(FishAIState.FIGHT)).toBe(true);
    expect(fsm.transitionTo(FishAIState.TIRED)).toBe(true);
    expect(fsm.transitionTo(FishAIState.LANDED)).toBe(true);
  });
});
