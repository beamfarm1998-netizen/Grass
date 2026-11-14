import { FishSpeciesSpec } from '../data/FishCatalog';
import { PerceptionReport } from './FishPerception';
import { FishAIState } from './FishStateMachine';

export class FishDecision {
  static chooseNextPatrolDecision(
    perception: PerceptionReport,
    baitAlreadyClaimed: boolean,
    dt: number
  ): FishAIState | null {
    if (!perception.canDetectBait || baitAlreadyClaimed) return null;
    // Higher desire -> faster decision to approach bait
    const chancePerSec = 0.45 * perception.desireScore;
    if (Math.random() < chancePerSec * dt) {
      return FishAIState.APPROACH_BAIT;
    }
    return null;
  }

  static chooseBaitInteraction(
    distanceToBaitM: number,
    species: FishSpeciesSpec,
    nibbleCount: number,
    maxNibbles: number
  ): FishAIState | null {
    if (distanceToBaitM > 1.15) return null;
    if (nibbleCount >= maxNibbles || species.aggression > 0.88) {
      return FishAIState.STRIKE_BITE;
    }
    return FishAIState.NIBBLE;
  }
}
