export interface RodSpec {
  id: string;
  nameKey: string;
  lengthM: number;
  strengthRatingN: number;
  flexibility: number; // 0.3 stiff .. 0.9 parabolic flex
  castDistanceBonus: number;
  unlockLevel: number;
  priceCoins: number;
  primaryColorHex: number;
}

export interface ReelSpec {
  id: string;
  nameKey: string;
  recoveryRateMps: number;
  maxDragN: number;
  smoothness: number;
  unlockLevel: number;
  priceCoins: number;
  accentColorHex: number;
}

export interface LineSpec {
  id: string;
  nameKey: string;
  breakStrengthN: number;
  stiffnessK: number; // Spring stiffness N/m
  dampingC: number; // Damping N·s/m
  visibilityFactor: number; // Lower = stealthier
  unlockLevel: number;
  priceCoins: number;
}

export interface BaitSpec {
  id: string;
  nameKey: string;
  attractionMultiplier: number;
  targetDepthM: number;
  preferredSpeciesIds: string[];
  unlockLevel: number;
  priceCoins: number;
  bobberColorHex: number;
}

export const ROD_CATALOG: readonly RodSpec[] = [
  {
    id: 'rod_fiberglass',
    nameKey: 'equip.item.rod_fiberglass',
    lengthM: 2.35,
    strengthRatingN: 75,
    flexibility: 0.72,
    castDistanceBonus: 1.0,
    unlockLevel: 1,
    priceCoins: 0,
    primaryColorHex: 0x334155,
  },
  {
    id: 'rod_carbon_pro',
    nameKey: 'equip.item.rod_carbon_pro',
    lengthM: 2.55,
    strengthRatingN: 135,
    flexibility: 0.58,
    castDistanceBonus: 1.18,
    unlockLevel: 2,
    priceCoins: 180,
    primaryColorHex: 0x0f172a,
  },
  {
    id: 'rod_titan_master',
    nameKey: 'equip.item.rod_titan_master',
    lengthM: 2.75,
    strengthRatingN: 240,
    flexibility: 0.48,
    castDistanceBonus: 1.34,
    unlockLevel: 4,
    priceCoins: 460,
    primaryColorHex: 0x1e293b,
  },
];

export const REEL_CATALOG: readonly ReelSpec[] = [
  {
    id: 'reel_spin_2500',
    nameKey: 'equip.item.reel_spin_2500',
    recoveryRateMps: 2.5,
    maxDragN: 58,
    smoothness: 0.85,
    unlockLevel: 1,
    priceCoins: 0,
    accentColorHex: 0x94a3b8,
  },
  {
    id: 'reel_aero_4000',
    nameKey: 'equip.item.reel_aero_4000',
    recoveryRateMps: 3.3,
    maxDragN: 112,
    smoothness: 0.92,
    unlockLevel: 2,
    priceCoins: 210,
    accentColorHex: 0x38bdf8,
  },
  {
    id: 'reel_magnum_6000',
    nameKey: 'equip.item.reel_magnum_6000',
    recoveryRateMps: 4.1,
    maxDragN: 215,
    smoothness: 0.97,
    unlockLevel: 4,
    priceCoins: 520,
    accentColorHex: 0xf59e0b,
  },
];

export const LINE_CATALOG: readonly LineSpec[] = [
  {
    id: 'line_mono_6kg',
    nameKey: 'equip.item.line_mono_6kg',
    breakStrengthN: 60,
    stiffnessK: 42,
    dampingC: 8.5,
    visibilityFactor: 0.9,
    unlockLevel: 1,
    priceCoins: 0,
  },
  {
    id: 'line_fluoro_12kg',
    nameKey: 'equip.item.line_fluoro_12kg',
    breakStrengthN: 115,
    stiffnessK: 64,
    dampingC: 11.0,
    visibilityFactor: 0.65,
    unlockLevel: 2,
    priceCoins: 160,
  },
  {
    id: 'line_braid_24kg',
    nameKey: 'equip.item.line_braid_24kg',
    breakStrengthN: 220,
    stiffnessK: 96,
    dampingC: 14.5,
    visibilityFactor: 0.8,
    unlockLevel: 3,
    priceCoins: 390,
  },
];

export const BAIT_CATALOG: readonly BaitSpec[] = [
  {
    id: 'bait_earthworm',
    nameKey: 'equip.item.bait_earthworm',
    attractionMultiplier: 1.0,
    targetDepthM: 1.6,
    preferredSpeciesIds: ['rainbow_trout', 'largemouth_bass', 'siamese_carp'],
    unlockLevel: 1,
    priceCoins: 0,
    bobberColorHex: 0xef4444,
  },
  {
    id: 'bait_minnow_lure',
    nameKey: 'equip.item.bait_minnow_lure',
    attractionMultiplier: 1.25,
    targetDepthM: 2.1,
    preferredSpeciesIds: ['largemouth_bass', 'rainbow_trout', 'golden_mahseer'],
    unlockLevel: 2,
    priceCoins: 120,
    bobberColorHex: 0x38bdf8,
  },
  {
    id: 'bait_frog_topwater',
    nameKey: 'equip.item.bait_frog_topwater',
    attractionMultiplier: 1.42,
    targetDepthM: 1.1,
    preferredSpeciesIds: ['giant_snakehead', 'largemouth_bass'],
    unlockLevel: 3,
    priceCoins: 240,
    bobberColorHex: 0x22c55e,
  },
  {
    id: 'bait_golden_spoon',
    nameKey: 'equip.item.bait_golden_spoon',
    attractionMultiplier: 1.68,
    targetDepthM: 2.8,
    preferredSpeciesIds: ['golden_mahseer', 'siamese_carp', 'arapaima'],
    unlockLevel: 4,
    priceCoins: 420,
    bobberColorHex: 0xf59e0b,
  },
];
