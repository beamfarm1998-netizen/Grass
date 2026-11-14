// src/fishing/systems/fish/data/FishCatalog.ts
import { FishRarity } from '../../../storage/SaveSchema';

export interface FishSpeciesSpec {
  id: string;
  nameKey: string;
  descKey: string;
  rarity: FishRarity;
  spawnWeight: number;
  minWeightKg: number;
  maxWeightKg: number;
  minLengthCm: number;
  maxLengthCm: number;
  cruiseSpeedMps: number;
  burstSpeedMps: number;
  basePullForceN: number;
  maxStamina: number;
  preferredDepthM: number;
  aggression: number; // 0..1
  baseCoinsPerKg: number;
  baseXpPerKg: number;
  bodyColorHex: number;
  bellyColorHex: number;
  finColorHex: number;
  accentStripeHex: number;

  // 🎯 Optional Custom GLB Model Support (หากไม่พบไฟล์จะสลับใช้โมเดลปลา 3D มาตรฐานอัตโนมัติ)
  modelUrl?: string;
  modelScale?: number;
  modelYawOffset?: number;
  modelYOffset?: number;
  swimClipName?: string;
}

export const FISH_SPECIES_CATALOG: readonly FishSpeciesSpec[] = [
  {
    id: 'rainbow_trout',
    nameKey: 'species.rainbow_trout',
    descKey: 'species.rainbow_trout.desc',
    rarity: 'common',
    spawnWeight: 32,
    minWeightKg: 0.8,
    maxWeightKg: 3.4,
    minLengthCm: 34,
    maxLengthCm: 62,
    cruiseSpeedMps: 1.45,
    burstSpeedMps: 4.2,
    basePullForceN: 34,
    maxStamina: 65,
    preferredDepthM: 1.5,
    aggression: 0.72,
    baseCoinsPerKg: 26,
    baseXpPerKg: 22,
    bodyColorHex: 0x3b7a6c,
    bellyColorHex: 0xdbeafe,
    finColorHex: 0x64748b,
    accentStripeHex: 0xf472b6,
    modelUrl: '/assets/models/fish/fish3.glb',
    modelScale: 1.55,
    modelYawOffset: Math.PI / 2,
    swimClipName: 'Scene',
  },
  {
    id: 'largemouth_bass',
    nameKey: 'species.largemouth_bass',
    descKey: 'species.largemouth_bass.desc',
    rarity: 'common',
    spawnWeight: 28,
    minWeightKg: 1.2,
    maxWeightKg: 5.2,
    minLengthCm: 38,
    maxLengthCm: 72,
    cruiseSpeedMps: 1.3,
    burstSpeedMps: 4.5,
    basePullForceN: 46,
    maxStamina: 78,
    preferredDepthM: 1.8,
    aggression: 0.84,
    baseCoinsPerKg: 30,
    baseXpPerKg: 25,
    bodyColorHex: 0x3f6212,
    bellyColorHex: 0xecfccb,
    finColorHex: 0x365314,
    accentStripeHex: 0x1a2e05,
  },
  {
    id: 'giant_snakehead',
    nameKey: 'species.giant_snakehead',
    descKey: 'species.giant_snakehead.desc',
    rarity: 'uncommon',
    spawnWeight: 18,
    minWeightKg: 2.8,
    maxWeightKg: 9.8,
    minLengthCm: 56,
    maxLengthCm: 105,
    cruiseSpeedMps: 1.35,
    burstSpeedMps: 5.4,
    basePullForceN: 78,
    maxStamina: 105,
    preferredDepthM: 1.3,
    aggression: 0.92,
    baseCoinsPerKg: 36,
    baseXpPerKg: 32,
    bodyColorHex: 0x1e293b,
    bellyColorHex: 0xcbd5e1,
    finColorHex: 0x0f172a,
    accentStripeHex: 0x0ea5e9,
  },
  {
    id: 'siamese_carp',
    nameKey: 'species.siamese_carp',
    descKey: 'species.siamese_carp.desc',
    rarity: 'rare',
    spawnWeight: 11,
    minWeightKg: 5.5,
    maxWeightKg: 18.5,
    minLengthCm: 68,
    maxLengthCm: 128,
    cruiseSpeedMps: 1.1,
    burstSpeedMps: 3.9,
    basePullForceN: 104,
    maxStamina: 145,
    preferredDepthM: 3.1,
    aggression: 0.58,
    baseCoinsPerKg: 28,
    baseXpPerKg: 26,
    bodyColorHex: 0x78716c,
    bellyColorHex: 0xfef3c7,
    finColorHex: 0x57534e,
    accentStripeHex: 0xd97706,
  },
  {
    id: 'golden_mahseer',
    nameKey: 'species.golden_mahseer',
    descKey: 'species.golden_mahseer.desc',
    rarity: 'trophy',
    spawnWeight: 7,
    minWeightKg: 4.2,
    maxWeightKg: 14.6,
    minLengthCm: 64,
    maxLengthCm: 118,
    cruiseSpeedMps: 1.55,
    burstSpeedMps: 5.8,
    basePullForceN: 128,
    maxStamina: 160,
    preferredDepthM: 2.5,
    aggression: 0.76,
    baseCoinsPerKg: 52,
    baseXpPerKg: 46,
    bodyColorHex: 0xd97706,
    bellyColorHex: 0xfef08a,
    finColorHex: 0xb45309,
    accentStripeHex: 0xfbbf24,
  },
  {
    id: 'arapaima',
    nameKey: 'species.arapaima',
    descKey: 'species.arapaima.desc',
    rarity: 'legendary',
    spawnWeight: 4,
    minWeightKg: 12.0,
    maxWeightKg: 34.0,
    minLengthCm: 115,
    maxLengthCm: 195,
    cruiseSpeedMps: 1.25,
    burstSpeedMps: 6.2,
    basePullForceN: 178,
    maxStamina: 220,
    preferredDepthM: 2.9,
    aggression: 0.85,
    baseCoinsPerKg: 48,
    baseXpPerKg: 44,
    bodyColorHex: 0x334155,
    bellyColorHex: 0xfca5a5,
    finColorHex: 0x991b1b,
    accentStripeHex: 0xef4444,
  },
];