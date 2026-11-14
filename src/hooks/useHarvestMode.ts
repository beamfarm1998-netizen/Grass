// ============================================================================
// useHarvestMode.ts
// State Machine + Orchestrator ของโหมดเก็บเกี่ยว
// - ถือ: phase, hover, selection, cooldown
// - ไม่ถือ: ข้อมูลพืช/สัตว์/เศรษฐกิจ (อ่านผ่าน callback เท่านั้น)
// ============================================================================
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  HarvestTargetType,
  HarvestTarget,
  HarvestResult,
  HarvestBatchResult,
  HarvestPhase,
  SelectionSummary,
} from '../types/game';
import { tr } from '../i18n/translations';

// Re-export for convenience and backward compatibility
export type {
  HarvestTargetType,
  HarvestTarget,
  HarvestResult,
  HarvestBatchResult,
  HarvestPhase,
  SelectionSummary,
};

export interface UseHarvestModeOptions {
  /** ป้องกัน mutual exclusion กับโหมดวางสิ่งของ */
  isPlacementActive: boolean;
  getStamina: () => number;
  consumeStamina: (amount: number) => boolean;
  /** เรียกเฉพาะแปลงที่ผ่านการกรอง READY แล้ว — hook ไม่ deduct stamina ในนี้ */
  harvestPlots: (ids: string[]) => HarvestResult[];
  harvestTrees: (ids: string[]) => HarvestResult[];
  onReward?: (results: HarvestResult[]) => void;
  onNotice?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  cooldownMs?: number;
  staminaPerPlot?: number;
  staminaPerTree?: number;
  /** true = กลับเข้า SELECTING อัตโนมัติหลัง cooldown, false = กลับ IDLE */
  continuous?: boolean;
}

// ---------- Reducer ----------
interface State {
  phase: HarvestPhase;
  hover: HarvestTarget | null;
  selection: HarvestTarget[];
  cooldownUntil: number;
  lastResult: HarvestBatchResult | null;
}

type Action =
  | { type: 'ENTER' }
  | { type: 'EXIT' }
  | { type: 'SET_HOVER'; target: HarvestTarget | null }
  | { type: 'TOGGLE'; target: HarvestTarget }
  | { type: 'SET_SELECTION'; targets: HarvestTarget[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'START_EXECUTING' }
  | { type: 'FINISH_EXECUTING'; result: HarvestBatchResult | null; cooldownUntil: number }
  | { type: 'ROLLBACK_TO_SELECTING' }
  | { type: 'COOLDOWN_END'; continuous: boolean }
  | { type: 'UPDATE_TARGET_READY'; id: string; kind: HarvestTargetType; isReady: boolean };

const initialState: State = {
  phase: 'IDLE',
  hover: null,
  selection: [],
  cooldownUntil: 0,
  lastResult: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ENTER':
      if (state.phase === 'EXECUTING' || state.phase === 'COOLDOWN') return state;
      return { ...state, phase: 'SELECTING', hover: null, selection: [] };

    case 'EXIT':
      return { ...initialState, lastResult: state.lastResult };

    case 'SET_HOVER':
      if (state.phase !== 'SELECTING') return state;
      return { ...state, hover: action.target };

    case 'TOGGLE': {
      if (state.phase !== 'SELECTING') return state;
      if (!action.target.isReady) return state;
      const exists = state.selection.some(
        (t) => t.type === action.target.type && t.id === action.target.id,
      );
      return {
        ...state,
        selection: exists
          ? state.selection.filter(
              (t) => !(t.type === action.target.type && t.id === action.target.id),
            )
          : [...state.selection, action.target],
      };
    }

    case 'SET_SELECTION':
      if (state.phase !== 'SELECTING') return state;
      return { ...state, selection: action.targets.filter((t) => t.isReady) };

    case 'CLEAR_SELECTION':
      return { ...state, selection: [] };

    case 'START_EXECUTING':
      return { ...state, phase: 'EXECUTING' };

    case 'FINISH_EXECUTING':
      return {
        ...state,
        phase: 'COOLDOWN',
        cooldownUntil: action.cooldownUntil,
        lastResult: action.result ?? state.lastResult,
        selection: [],
        hover: null,
      };

    case 'ROLLBACK_TO_SELECTING':
      return { ...state, phase: 'SELECTING', cooldownUntil: 0 };

    case 'COOLDOWN_END':
      return {
        ...state,
        phase: action.continuous ? 'SELECTING' : 'IDLE',
        cooldownUntil: 0,
      };

    case 'UPDATE_TARGET_READY':
      return {
        ...state,
        hover:
          state.hover && state.hover.type === action.kind && state.hover.id === action.id
            ? { ...state.hover, isReady: action.isReady }
            : state.hover,
        selection: state.selection.map((t) =>
          t.type === action.kind && t.id === action.id ? { ...t, isReady: action.isReady } : t,
        ),
      };

    default:
      return state;
  }
}

// ---------- Hook ----------
export function useHarvestMode(options: UseHarvestModeOptions) {
  const {
    isPlacementActive,
    getStamina,
    consumeStamina,
    harvestPlots,
    harvestTrees,
    onReward,
    onNotice,
    cooldownMs = 800,
    staminaPerPlot = 1,
    staminaPerTree = 2,
    continuous = true,
  } = options;

  const [state, dispatch] = useReducer(reducer, initialState);

  // Synchronous ref เพื่อ idempotency / อ่าน phase ปัจจุบันแบบไม่ stale
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const isExecutingRef = useRef(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // now tick เฉพาะตอน COOLDOWN เพื่อให้ HUD แสดงตัวนับได้
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.phase !== 'COOLDOWN') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [state.phase]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const clearCooldownTimer = () => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  };

  // ---------- Commands ----------
  const enter = useCallback((): boolean => {
    if (isPlacementActive) {
      onNotice?.(tr('ปิดโหมดวางสิ่งของก่อนเปิดโหมดเก็บเกี่ยว', 'Exit placement mode before opening Harvest Mode'), 'error');
      return false;
    }
    const phase = stateRef.current.phase;
    if (phase === 'EXECUTING' || phase === 'COOLDOWN') return false;
    dispatch({ type: 'ENTER' });
    return true;
  }, [isPlacementActive, onNotice]);

  const exit = useCallback(() => {
    clearCooldownTimer();
    isExecutingRef.current = false;
    dispatch({ type: 'EXIT' });
  }, []);

  const setHover = useCallback((target: HarvestTarget | null) => {
    dispatch({ type: 'SET_HOVER', target });
  }, []);

  const toggleTarget = useCallback((target: HarvestTarget) => {
    dispatch({ type: 'TOGGLE', target });
  }, []);

  const setSelection = useCallback((targets: HarvestTarget[]) => {
    dispatch({ type: 'SET_SELECTION', targets });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const updateTargetReady = useCallback(
    (id: string, kind: HarvestTargetType, isReady: boolean) => {
      dispatch({ type: 'UPDATE_TARGET_READY', id, kind, isReady });
    },
    [],
  );

  /**
   * Execute harvest:
   * - idempotency: ถอน isExecutingRef ทันที
   * - atomic stamina: pre-check ก่อนหักจริง ถ้าไม่พอ reject ทั้ง batch
   * - atomic result: เรียก harvestPlots + harvestTrees รวมผลลัพธ์ก่อน onReward
   */
  const execute = useCallback(
    (explicitTargets?: HarvestTarget[]): boolean => {
      if (isExecutingRef.current) return false;
      const phase = stateRef.current.phase;
      if (phase !== 'SELECTING') return false;

      const source = explicitTargets ?? stateRef.current.selection;
      const ready = source.filter((t) => t.isReady);
      if (ready.length === 0) {
        onNotice?.(tr('ไม่มีอะไรให้เก็บเกี่ยว', 'Nothing ready to harvest'), 'info');
        return false;
      }

      const plotIds = ready.filter((t) => t.type === 'plot').map((t) => t.id);
      const treeIds = ready.filter((t) => t.type === 'tree').map((t) => t.id);

      const totalCost =
        plotIds.length * staminaPerPlot + treeIds.length * staminaPerTree;

      if (getStamina() < totalCost) {
        onNotice?.(tr('พลังกายไม่เพียงพอ', 'Not enough stamina'), 'error');
        return false;
      }

      isExecutingRef.current = true;
      dispatch({ type: 'START_EXECUTING' });

      let committed = false;
      try {
        if (totalCost > 0 && !consumeStamina(totalCost)) {
          onNotice?.(tr('พลังกายไม่เพียงพอ', 'Not enough stamina'), 'error');
          return false;
        }
        committed = true;

        const results: HarvestResult[] = [];
        if (plotIds.length > 0) results.push(...harvestPlots(plotIds));
        if (treeIds.length > 0) results.push(...harvestTrees(treeIds));

        const batch: HarvestBatchResult = {
          results,
          totalItems: results.reduce((s, r) => s + r.quantity, 0),
          totalXp: results.reduce((s, r) => s + r.xp, 0),
          totalCoins: results.reduce((s, r) => s + r.coins, 0),
        };

        onReward?.(results);

        const cooldownUntil = Date.now() + cooldownMs;
        dispatch({ type: 'FINISH_EXECUTING', result: batch, cooldownUntil });

        clearCooldownTimer();
        cooldownTimerRef.current = setTimeout(() => {
          cooldownTimerRef.current = null;
          dispatch({ type: 'COOLDOWN_END', continuous });
        }, cooldownMs);

        if (batch.totalItems > 0) {
          const coinPartTh = batch.totalCoins > 0 ? `, โบนัส +${batch.totalCoins} เหรียญ` : '';
          const coinPartEn = batch.totalCoins > 0 ? `, Bonus +${batch.totalCoins} Coins` : '';
          onNotice?.(
            tr(
              `เก็บเกี่ยวเข้ากระเป๋า ${batch.totalItems} ชิ้น (+${batch.totalXp} XP${coinPartTh})`,
              `Harvested ${batch.totalItems} items (+${batch.totalXp} XP${coinPartEn})`
            ),
            'success',
          );
        }
        return true;
      } finally {
        isExecutingRef.current = false;
        if (!committed) {
          // ยังไม่หัก stamina / ยังไม่ harvest → กลับไป SELECTING แบบไม่ติด cooldown
          dispatch({ type: 'ROLLBACK_TO_SELECTING' });
        }
      }
    },
    [
      cooldownMs,
      consumeStamina,
      continuous,
      getStamina,
      harvestPlots,
      harvestTrees,
      onNotice,
      onReward,
      staminaPerPlot,
      staminaPerTree,
    ],
  );

  /**
   * เก็บทุกอย่างที่พร้อมในโลก
   * parent ส่ง allReady (plots + trees ที่ isReady) เข้ามาเอง
   */
  const harvestAll = useCallback(
    (allReady: HarvestTarget[]): boolean => execute(allReady),
    [execute],
  );

  // ---------- Derived ----------
  const summary: SelectionSummary = useMemo(() => {
    let ready = 0;
    let notReady = 0;
    let readyPlots = 0;
    let readyTrees = 0;
    for (const t of state.selection) {
      if (t.isReady) {
        ready++;
        if (t.type === 'plot') readyPlots++;
        else readyTrees++;
      } else {
        notReady++;
      }
    }
    return { ready, notReady, readyPlots, readyTrees };
  }, [state.selection]);

  const cooldownRemaining = Math.max(0, state.cooldownUntil - now);

  return {
    // state
    phase: state.phase,
    isActive: state.phase !== 'IDLE',
    hover: state.hover,
    selection: state.selection,
    lastResult: state.lastResult,
    summary,
    cooldownUntil: state.cooldownUntil,
    cooldownRemaining,
    canExecute: state.phase === 'SELECTING' && summary.ready > 0,

    // commands
    enter,
    exit,
    setHover,
    toggleTarget,
    setSelection,
    clearSelection,
    updateTargetReady,
    execute,
    harvestAll,
  };
}

export type UseHarvestModeReturn = ReturnType<typeof useHarvestMode>;