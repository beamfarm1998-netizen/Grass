// src/components/3d/structures/index.ts

export {
  HouseMeshBuilder,
  createHouseMaterials,
  buildPicketYardFence,
  WalkingAgent,
  type HouseMaterials,
  type WalkingAgentOptions,
} from './HouseMeshBuilder';

export {
  buildCabinHouse,
  buildPorchHouse,
  buildTwoStoryHouse,
  buildAFrameHouse,
  buildStiltHouse,
  buildResidentialHouseWithYard,
} from './ResidentialHouses';

export {
  buildHorseStableProcedural,
  buildCowCorralProcedural,
} from './AnimalEnclosures';

export {
  buildJungleHouseProcedural,
  buildGardenerQuartersProcedural,
  buildWoodenFenceProcedural,
  buildProduceStorageProcedural,
  buildRiverRockProcedural,
  buildOakTreesProcedural,
  buildMountainTrailProcedural,
} from './EstateAndDecorStructures';

export {
  ChickenCoopBuilder,
  type CoopMaterials,
  type CoopResult,
} from './ChickenCoop';

export {
  DuckCoopBuilder,
  type DuckCoopOptions,
  type DuckCoopResult,
} from './DuckCoop';

export {
  BreweryFactoryBuilder,
  type BreweryFactoryOptions,
  type BreweryFactoryResult,
} from './BreweryFactory';

export {
  BakeryOvenBuilder,
  type ReadyOvenVisualItem,
  type OvenVisualState,
  type BakeryOvenOptions,
  type BakeryOvenResult,
} from './BakeryOven';

export {
  AnimalFeedMachineBuilder,
  type AnimalFeedMachineOptions,
  type AnimalFeedMachineResult,
} from './AnimalFeedMachine';

export {
  FishBuyingShopBuilder,
  FISH_BUYING_SHOP_GLB_CANDIDATES,
  type FishBuyingShopOptions,
  type FishBuyingShopResult,
} from './FishBuyingShop';

export {
  CoveredVegetablePlotBuilder,
  COVERED_VEGETABLE_PLOT_GLB_CANDIDATES,
  type CoveredVegetablePlotOptions,
  type CoveredVegetablePlotResult,
} from './CoveredVegetablePlot';

export {
  buildWaterTowerProcedural,
  buildWindmillProcedural,
  buildTrainStationProcedural,
  buildPowerLineProcedural,
  buildSpookyLampPostProcedural,
  buildTractorProcedural,
  buildVillageProcedural,
  buildUtilityPoleProcedural,
  buildFireEscapeProcedural,
} from './FarmInfrastructure';

export {
  syncEntryHousePaint,
  disposeHousePaintRuntime,
  resolveEffectiveHouseParts,
  hasAnyHouseCustomization,
  serializeHouseStyleSignature,
  type HousePaintRuntimeState,
  type HousePaintContext,
} from './HousePaintShader';