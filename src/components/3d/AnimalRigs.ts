// src/components/3d/AnimalRigs.ts
/**
 * Backwards-compatible export layer delegating to the modular animal species subsystem in `./animals/`.
 * Individual species implementations:
 * - 🐔 Chicken: ./animals/ChickenAnimal.ts
 * - 🐷 Pig:     ./animals/PigAnimal.ts
 * - 🐐 Goat:    ./animals/GoatAnimal.ts
 * - 🐮 Cow:     ./animals/CowAnimal.ts
 */
export * from './animals';
