// src/types/harvest.ts

// ───────────────────────── โหมดเก็บเกี่ยว ─────────────────────────

export type HarvestTargetType = 'plot' | 'tree';

export interface HarvestTarget {
  type: HarvestTargetType;
  id: string;
  isReady: boolean;
}

export interface HarvestResult {
  targetId: string;
  type: HarvestTargetType;
  itemId: string;
  itemName: string;
  quantity: number;
  xp: number;
  coins: number;
}

export interface HarvestBatchResult {
  results: HarvestResult[];
  totalItems: number;
  totalXp: number;
  totalCoins: number;
}

export type HarvestPhase = 'IDLE' | 'SELECTING' | 'EXECUTING' | 'COOLDOWN';

export interface SelectionSummary {
  ready: number;
  notReady: number;
  readyPlots: number;
  readyTrees: number;
}
