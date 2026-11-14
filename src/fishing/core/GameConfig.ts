export type WeatherType = 'clear' | 'sunset' | 'mist' | 'rain';
export type CameraPreset = 'angler' | 'bobber' | 'underwater' | 'cinematic';

export interface GameConfig {
  fixedTimeStep: number;
  maxSubSteps: number;
  maxDeltaSeconds: number;
  lakeRadius: number;
  maxFishCount: number;
  dockTipPosition: { x: number; y: number; z: number };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  fixedTimeStep: 1 / 60,
  maxSubSteps: 5,
  maxDeltaSeconds: 0.1,
  lakeRadius: 58,
  maxFishCount: 14,
  dockTipPosition: { x: 0, y: 1.15, z: 14.2 },
};
