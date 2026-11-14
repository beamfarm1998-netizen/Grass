/**
 * Beam Farm 3D - Game Types & State Definitions
 * 
 * NOTE: This file is a backward-compatible barrel export.
 * The monolithic 1,600+ line type definitions have been decomposed into domain-specific modules:
 * - src/types/grid.ts       (Grid coords, bounds, world/grid conversions)
 * - src/types/crops.ts      (Crops, definitions, growth logic, plots, inventory)
 * - src/types/trees.ts      (Orchard trees, stages, fruit production)
 * - src/types/rocks.ts      (Quarry rock resources, tiers, drops)
 * - src/types/buildings.ts  (Houses, farmhouse parts, structure color customization)
 * - src/types/animals.ts    (Cows, ducks, sheep, feeds, feed mill processing)
 * - src/types/crafting.ts   (Bakery ovens, brewery, recipes, queue jobs)
 * - src/types/harvest.ts    (Swipe harvest, multi-target batch results)
 * - src/types/player.ts     (PlayerStats, tools, stamina, leveling, camera modes)
 * - src/types/index.ts      (Central types barrel)
 */

export * from './index';