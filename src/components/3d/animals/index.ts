// src/components/3d/animals/index.ts
import { AnimalType } from '../../../types/game';
import {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
} from './types';
import { chickenSpecies, ChickenAnimalController } from './ChickenAnimal';
import { duckSpecies, DuckAnimalController, createAnimatedDuckInstance } from './DuckAnimal';
import { pigSpecies, PigAnimalController } from './PigAnimal';
import { goatSpecies, GoatAnimalController } from './GoatAnimal';
import { cowSpecies, CowAnimalController } from './CowAnimal';
import { dogSpecies, DogAnimalController } from './DogAnimal';
import { catSpecies, CatAnimalController } from './CatAnimal';
import { horseSpecies, HorseAnimalController } from './HorseAnimal';
import { sheepSpecies, SheepAnimalController } from './SheepAnimal';

export type {
  AnimalRigMaterials,
  AnimalRigResult,
  AnimalRuntime,
  AnimalSpeciesController,
};

export {
  ChickenAnimalController,
  chickenSpecies,
  DuckAnimalController,
  duckSpecies,
  createAnimatedDuckInstance,
  PigAnimalController,
  pigSpecies,
  GoatAnimalController,
  goatSpecies,
  CowAnimalController,
  cowSpecies,
  DogAnimalController,
  dogSpecies,
  CatAnimalController,
  catSpecies,
  HorseAnimalController,
  horseSpecies,
  SheepAnimalController,
  sheepSpecies,
};

/**
 * Systematic registry mapping every AnimalType to its dedicated species controller.
 */
export const ANIMAL_SPECIES_REGISTRY: Record<AnimalType, AnimalSpeciesController> = {
  chicken: chickenSpecies,
  duck: duckSpecies,
  pig: pigSpecies,
  goat: goatSpecies,
  cow: cowSpecies,
  dog: dogSpecies,
  cat: catSpecies,
  horse: horseSpecies,
  sheep: sheepSpecies,
};

/**
 * Systematic accessor for species controller
 */
export function getAnimalSpecies(type: AnimalType): AnimalSpeciesController {
  const species = ANIMAL_SPECIES_REGISTRY[type];
  if (!species) {
    throw new Error(`Unknown animal species type: ${type}`);
  }
  return species;
}

/**
 * Systematic rig builders conforming to the modular species controllers.
 * One builder per species — kept explicit for clear type narrowing & tree-shaking.
 */
export function createCowRig(materials: AnimalRigMaterials): AnimalRigResult {
  return cowSpecies.createRig(materials);
}

export function createPigRig(materials: AnimalRigMaterials): AnimalRigResult {
  return pigSpecies.createRig(materials);
}

export function createChickenRig(materials: AnimalRigMaterials): AnimalRigResult {
  return chickenSpecies.createRig(materials);
}

export function createDuckRig(materials: AnimalRigMaterials): AnimalRigResult {
  return duckSpecies.createRig(materials);
}

export function createGoatRig(materials: AnimalRigMaterials): AnimalRigResult {
  return goatSpecies.createRig(materials);
}

export function createSheepRig(materials: AnimalRigMaterials): AnimalRigResult {
  return sheepSpecies.createRig(materials);
}

export function createDogRig(materials: AnimalRigMaterials): AnimalRigResult {
  return dogSpecies.createRig(materials);
}

export function createCatRig(materials: AnimalRigMaterials): AnimalRigResult {
  return catSpecies.createRig(materials);
}

export function createHorseRig(materials: AnimalRigMaterials): AnimalRigResult {
  return horseSpecies.createRig(materials);
}