export interface PhysicsConfig {
  gravity: number;
  waterDensity: number;
  airDragCoeff: number;
  waterDragCoeff: number;
  waterCurrentX: number;
  waterCurrentZ: number;
  slackEscapeSeconds: number;
  overloadSnapImpulse: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: 9.81,
  waterDensity: 1000,
  airDragCoeff: 0.045,
  waterDragCoeff: 0.85,
  waterCurrentX: 0.08,
  waterCurrentZ: -0.03,
  slackEscapeSeconds: 2.8,
  overloadSnapImpulse: 0.72,
};
