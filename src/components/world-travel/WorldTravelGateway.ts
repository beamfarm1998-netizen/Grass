// src/components/world-travel/WorldTravelGateway.ts
// ตรรกะการเดินทางระหว่าง World (ไม่มี UI):
//   Farm → บันทึกเซฟฟาร์ม → บันทึก activeWorld → โหลด World ปลายทาง → เปิดอินพุต
// - กันกด Travel ซ้ำระหว่างโหลด (busy lock)
// - โหลดไม่สำเร็จ → กลับฟาร์มอัตโนมัติ ไม่ทิ้งผู้เล่นไว้ในฉากที่ใช้ไม่ได้
// - Farm Scene ไม่ถูกทำลาย (แค่ pause) จึงไม่สร้าง Player ซ้ำ / Inventory / Currency ไม่หาย
import { useCallback, useRef, useState } from 'react';
import { WORLD_IDS, type WorldId } from '../../core/world/WorldRegistry';
import { loadWorldState, saveActiveWorld } from '../../worlds/hua-hin-fish-bridge/HuaHinFishBridgeState';
import { flushAllPendingFarmSaves } from '../../utils/farmAutoSave';

export type TravelPhase = 'idle' | 'loading' | 'ready';

export interface WorldTravelApi {
  activeWorld: WorldId;
  phase: TravelPhase;
  isAwayFromFarm: boolean;
  travelTo: (target: WorldId) => void;
  markReady: () => void;
  markFailed: () => void;
}

export function useWorldTravel(onFailed?: () => void): WorldTravelApi {
  const [activeWorld, setActiveWorld] = useState<WorldId>(() => loadWorldState().activeWorld);
  const [phase, setPhase] = useState<TravelPhase>(() =>
    loadWorldState().activeWorld === WORLD_IDS.FARM ? 'idle' : 'loading'
  );
  const busy = useRef(phase === 'loading');

  const travelTo = useCallback((target: WorldId) => {
    if (busy.current) return; // กันกดซ้ำ
    busy.current = true;
    try {
      flushAllPendingFarmSaves();
    } catch {
      /* เซฟล้มเหลวไม่ควรขวางการเดินทาง */
    }
    saveActiveWorld(target);
    setActiveWorld(target);
    if (target === WORLD_IDS.FARM) {
      setPhase('idle');
      busy.current = false;
    } else {
      setPhase('loading');
    }
  }, []);

  const markReady = useCallback(() => {
    setPhase('ready');
    busy.current = false;
  }, []);

  const markFailed = useCallback(() => {
    saveActiveWorld(WORLD_IDS.FARM);
    setActiveWorld(WORLD_IDS.FARM);
    setPhase('idle');
    busy.current = false;
    onFailed?.();
  }, [onFailed]);

  return {
    activeWorld,
    phase,
    isAwayFromFarm: activeWorld !== WORLD_IDS.FARM,
    travelTo,
    markReady,
    markFailed,
  };
}
