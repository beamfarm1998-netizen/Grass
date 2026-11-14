import { FISH_SPECIES_CATALOG, FishSpeciesSpec } from './data/FishCatalog';

export class FishRegistry {
  private static readonly map = new Map<string, FishSpeciesSpec>(
    FISH_SPECIES_CATALOG.map((spec) => [spec.id, spec])
  );

  static getById(id: string): FishSpeciesSpec {
    return this.map.get(id) ?? FISH_SPECIES_CATALOG[0];
  }

  static getAll(): readonly FishSpeciesSpec[] {
    return FISH_SPECIES_CATALOG;
  }

  static pickWeightedRandom(preferredIds: string[] = [], rng: () => number = Math.random): FishSpeciesSpec {
    let totalWeight = 0;
    const weights = FISH_SPECIES_CATALOG.map((spec) => {
      const bonus = preferredIds.includes(spec.id) ? 1.85 : 1.0;
      const w = spec.spawnWeight * bonus;
      totalWeight += w;
      return w;
    });

    let roll = rng() * totalWeight;
    for (let i = 0; i < FISH_SPECIES_CATALOG.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return FISH_SPECIES_CATALOG[i];
      }
    }
    return FISH_SPECIES_CATALOG[0];
  }
}
