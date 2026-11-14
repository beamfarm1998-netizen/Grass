// src/components/3d/animals/types.ts
import * as THREE from 'three';
import { AnimalType, PlacedAnimal } from '../../../types/game';

/**
 * Shared PBR material palette for procedural farm animal rigs
 */
export interface AnimalRigMaterials {
  cowMat: THREE.Material;
  pigMat: THREE.Material;
  chickenMat: THREE.Material;
  goatMat: THREE.Material;
  pinkMuzzleMat: THREE.Material;
  darkHoofMat: THREE.Material;
  hornIvoryMat: THREE.Material;
  chickenCombMat: THREE.Material;
  chickenBeakMat: THREE.Material;
  darkEyeMat: THREE.Material;
}

/**
 * Standard hierarchical structure for an animal 3D procedural rig
 */
export interface AnimalRigResult {
  root: THREE.Group;
  bodyMesh: THREE.Object3D;
  headGroup: THREE.Group;
  tailGroup?: THREE.Group;
  legs: THREE.Group[];
  wings?: THREE.Group[];
  jawGroup?: THREE.Group;
}

/**
 * Runtime state representation for an active animal in the 3D world
 */
export interface AnimalRuntime {
  data: PlacedAnimal;
  group: THREE.Group;
  bodyMesh: THREE.Object3D;
  headGroup: THREE.Group;
  tailGroup?: THREE.Group;
  legs: THREE.Group[];
  wings?: THREE.Group[];
  jawGroup?: THREE.Group;

  // Kinematic & Differential state
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  velocity: THREE.Vector3;
  currentHeading: number;
  angularVelocity: number;
  state: 'idle' | 'walking' | 'grazing';
  stateTimer: number;
  walkCycle: number;
  petBounce: number;
}

/**
 * Unified interface that every animal species module must implement
 */
export interface AnimalSpeciesController {
  readonly type: AnimalType;
  readonly nameEn: string;
  readonly nameTh: string;
  readonly emoji: string;

  /** Procedurally builds the Three.js mesh rig and articulable joints */
  createRig(materials: AnimalRigMaterials): AnimalRigResult;

  /**
   * Evaluates calculus-based gait harmonics, species gestures,
   * jaw/wing articulators, and grazing kinematics.
   */
  animate(
    runtime: AnimalRuntime,
    dt: number,
    elapsed: number,
    isWalking: boolean,
    currentSpeed: number
  ): void;
}
