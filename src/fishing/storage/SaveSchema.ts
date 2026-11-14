import { CameraPreset, WeatherType } from '../core/GameConfig';
import { DEFAULT_LANGUAGE, LanguageCode } from '../localization/LanguageTypes';
import { CURRENT_SAVE_VERSION } from './SaveVersion';

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'trophy' | 'legendary';

export interface CaughtFishRecord {
  id: string;
  speciesId: string;
  weightKg: number;
  lengthCm: number;
  rarity: FishRarity;
  valueCoins: number;
  caughtAtIso: string;
}

export interface PlayerStatistics {
  totalCasts: number;
  totalCatches: number;
  totalEscaped: number;
  totalLineBreaks: number;
  biggestWeightKg: number;
  biggestSpeciesId: string | null;
}

export interface EquippedSetup {
  rodId: string;
  reelId: string;
  lineId: string;
  baitId: string;
}

export interface GameSettingsData {
  audioMuted: boolean;
  audioVolume: number;
  weather: WeatherType;
  cameraPreset: CameraPreset;
  virtualJoysticks: boolean;
  hapticsEnabled: boolean;
}

export interface SaveData {
  version: number;
  updatedAtIso: string;
  language: LanguageCode;
  level: number;
  xp: number;
  coins: number;
  inventory: CaughtFishRecord[];
  statistics: PlayerStatistics;
  equipped: EquippedSetup;
  ownedEquipmentIds: string[];
  unlockedLocations: string[];
  settings: GameSettingsData;
}

export function createDefaultSaveData(language: LanguageCode = DEFAULT_LANGUAGE): SaveData {
  return {
    version: CURRENT_SAVE_VERSION,
    updatedAtIso: new Date().toISOString(),
    language,
    level: 1,
    xp: 0,
    coins: 150,
    inventory: [],
    statistics: {
      totalCasts: 0,
      totalCatches: 0,
      totalEscaped: 0,
      totalLineBreaks: 0,
      biggestWeightKg: 0,
      biggestSpeciesId: null,
    },
    equipped: {
      rodId: 'rod_fiberglass',
      reelId: 'reel_spin_2500',
      lineId: 'line_mono_6kg',
      baitId: 'bait_earthworm',
    },
    ownedEquipmentIds: [
      'rod_fiberglass',
      'reel_spin_2500',
      'line_mono_6kg',
      'bait_earthworm',
    ],
    unlockedLocations: ['emerald_pine_lake'],
    settings: {
      audioMuted: false,
      audioVolume: 0.65,
      weather: 'clear',
      cameraPreset: 'angler',
      virtualJoysticks: true,
      hapticsEnabled: true,
    },
  };
}
