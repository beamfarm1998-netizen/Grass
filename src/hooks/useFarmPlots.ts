// src/hooks/useFarmPlots.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FarmPlot,
  CropType,
  ToolType,
  PlacedHouse,
  CROP_DEFINITIONS,
  gridToWorld,
  worldToGrid,
} from '../types/game';
import { ExpansionZone } from '../components/ui/LandExpansionModal';
import { farmAudio } from '../utils/audio';
import {
  createAutoSaveChannel,
  getInitialOfflineElapsedSeconds,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
} from '../utils/farmAutoSave';
import { isSaveSuppressed } from '../utils/saveReset';
import {
  tr,
  getCropName,
  getCurrentLang,
  ZONE_TEXT_EN,
} from '../i18n/translations';

const STORAGE_KEY = 'beam_farm_3d_save_map_v2';

export const ALL_FARM_PLOTS: (FarmPlot & { zoneId: number })[] = [
  // ZONE 1
  { id: 0, zoneId: 1, gridX: 3, gridZ: 2, worldX: 6.0, worldZ: 4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 1, zoneId: 1, gridX: 4, gridZ: 2, worldX: 8.0, worldZ: 4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 2, zoneId: 1, gridX: 3, gridZ: 3, worldX: 6.0, worldZ: 6.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 3, zoneId: 1, gridX: 4, gridZ: 3, worldX: 8.0, worldZ: 6.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 4, zoneId: 1, gridX: -4, gridZ: 5, worldX: -8.0, worldZ: 10.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 5, zoneId: 1, gridX: -3, gridZ: 5, worldX: -6.0, worldZ: 10.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 6, zoneId: 1, gridX: -4, gridZ: 6, worldX: -8.0, worldZ: 12.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 7, zoneId: 1, gridX: -3, gridZ: 6, worldX: -6.0, worldZ: 12.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 8, zoneId: 1, gridX: 3, gridZ: -3, worldX: 6.0, worldZ: -6.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 9, zoneId: 1, gridX: 4, gridZ: -3, worldX: 8.0, worldZ: -6.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 10, zoneId: 1, gridX: 3, gridZ: -2, worldX: 6.0, worldZ: -4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 11, zoneId: 1, gridX: 4, gridZ: -2, worldX: 8.0, worldZ: -4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },

  // ZONE 2
  { id: 12, zoneId: 2, gridX: 9, gridZ: 6, worldX: 18.0, worldZ: 12.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 13, zoneId: 2, gridX: 10, gridZ: 6, worldX: 20.0, worldZ: 12.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 14, zoneId: 2, gridX: 11, gridZ: 6, worldX: 22.0, worldZ: 12.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 15, zoneId: 2, gridX: 12, gridZ: 6, worldX: 24.0, worldZ: 12.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 16, zoneId: 2, gridX: 9, gridZ: 7, worldX: 18.0, worldZ: 14.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 17, zoneId: 2, gridX: 10, gridZ: 7, worldX: 20.0, worldZ: 14.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 18, zoneId: 2, gridX: 11, gridZ: 7, worldX: 22.0, worldZ: 14.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 19, zoneId: 2, gridX: 12, gridZ: 7, worldX: 24.0, worldZ: 14.0, status: 'EMPTY', growthProgress: 0, isWatered: false },

  // ZONE 3
  { id: 20, zoneId: 3, gridX: -12, gridZ: 1, worldX: -24.0, worldZ: 2.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 21, zoneId: 3, gridX: -11, gridZ: 1, worldX: -22.0, worldZ: 2.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 22, zoneId: 3, gridX: -10, gridZ: 1, worldX: -20.0, worldZ: 2.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 23, zoneId: 3, gridX: -9, gridZ: 1, worldX: -18.0, worldZ: 2.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 24, zoneId: 3, gridX: -12, gridZ: 2, worldX: -24.0, worldZ: 4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 25, zoneId: 3, gridX: -11, gridZ: 2, worldX: -22.0, worldZ: 4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 26, zoneId: 3, gridX: -10, gridZ: 2, worldX: -20.0, worldZ: 4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 27, zoneId: 3, gridX: -9, gridZ: 2, worldX: -18.0, worldZ: 4.0, status: 'EMPTY', growthProgress: 0, isWatered: false },

  // ZONE 4
  { id: 28, zoneId: 4, gridX: 9, gridZ: -5, worldX: 18.0, worldZ: -10.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 29, zoneId: 4, gridX: 10, gridZ: -5, worldX: 20.0, worldZ: -10.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 30, zoneId: 4, gridX: 11, gridZ: -5, worldX: 22.0, worldZ: -10.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 31, zoneId: 4, gridX: 12, gridZ: -5, worldX: 24.0, worldZ: -10.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 32, zoneId: 4, gridX: 9, gridZ: -4, worldX: 18.0, worldZ: -8.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 33, zoneId: 4, gridX: 10, gridZ: -4, worldX: 20.0, worldZ: -8.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 34, zoneId: 4, gridX: 11, gridZ: -4, worldX: 22.0, worldZ: -8.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 35, zoneId: 4, gridX: 12, gridZ: -4, worldX: 24.0, worldZ: -8.0, status: 'EMPTY', growthProgress: 0, isWatered: false },

  // ZONE 5
  { id: 36, zoneId: 5, gridX: -16, gridZ: -11, worldX: -32.0, worldZ: -22.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 37, zoneId: 5, gridX: -15, gridZ: -11, worldX: -30.0, worldZ: -22.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 38, zoneId: 5, gridX: -14, gridZ: -11, worldX: -28.0, worldZ: -22.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 39, zoneId: 5, gridX: -16, gridZ: -10, worldX: -32.0, worldZ: -20.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 40, zoneId: 5, gridX: -15, gridZ: -10, worldX: -30.0, worldZ: -20.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 41, zoneId: 5, gridX: -14, gridZ: -10, worldX: -28.0, worldZ: -20.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 42, zoneId: 5, gridX: -16, gridZ: -9, worldX: -32.0, worldZ: -18.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 43, zoneId: 5, gridX: -15, gridZ: -9, worldX: -30.0, worldZ: -18.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 44, zoneId: 5, gridX: -14, gridZ: -9, worldX: -28.0, worldZ: -18.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 45, zoneId: 5, gridX: -16, gridZ: -8, worldX: -32.0, worldZ: -16.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 46, zoneId: 5, gridX: -15, gridZ: -8, worldX: -30.0, worldZ: -16.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
  { id: 47, zoneId: 5, gridX: -14, gridZ: -8, worldX: -28.0, worldZ: -16.0, status: 'EMPTY', growthProgress: 0, isWatered: false },
];

export function useFarmPlots(addNotice: (text: string, color?: string) => void) {
  /* ═══════════ STATE ═══════════ */
  const [unlockedZones, setUnlockedZones] = useState<number[]>(() => {
    try {
      const saved = safeGetLocalStorageItem(STORAGE_KEY + '_zones');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [1];
  });

  const [plots, setPlots] = useState<FarmPlot[]>(() => {
    try {
      const saved = safeGetLocalStorageItem(STORAGE_KEY + '_plots');
      if (saved !== null) {
        const parsed = JSON.parse(saved) as FarmPlot[];
        if (Array.isArray(parsed)) {
          const elapsedSec = getInitialOfflineElapsedSeconds();
          if (elapsedSec <= 0.5) return parsed;
          return parsed.map((plot) => {
            if ((plot.status === 'PLANTED' || plot.status === 'GROWING') && plot.cropType) {
              const def = CROP_DEFINITIONS[plot.cropType];
              if (!def) return plot;
              const roofBoost = plot.coveredByHouseId ? 1.25 : 1.0;
              const gain =
                (elapsedSec / def.growthTimeSeconds) * (plot.isWatered ? 2.0 : 1.0) * roofBoost;
              const newProgress = Math.min(1.0, (plot.growthProgress || 0) + gain);
              if (newProgress >= 1.0) {
                return { ...plot, status: 'READY', growthProgress: 1.0 };
              }
              if (newProgress > 0.35 && plot.status === 'PLANTED') {
                return { ...plot, status: 'GROWING', growthProgress: newProgress };
              }
              return { ...plot, growthProgress: newProgress };
            }
            return plot;
          });
        }
      }
    } catch {}
    return ALL_FARM_PLOTS.filter((p) => p.zoneId === 1).map((p) => ({ ...p }));
  });

  const plotsRef = useRef(plots);
  plotsRef.current = plots;
  const zonesRef = useRef(unlockedZones);
  zonesRef.current = unlockedZones;

  const setPlotsSync = useCallback(
    (updater: FarmPlot[] | ((prev: FarmPlot[]) => FarmPlot[])) => {
      const next = typeof updater === 'function' ? updater(plotsRef.current) : updater;
      plotsRef.current = next;
      setPlots(next);
    },
    []
  );

  const setUnlockedZonesSync = useCallback(
    (updater: number[] | ((prev: number[]) => number[])) => {
      const next = typeof updater === 'function' ? updater(zonesRef.current) : updater;
      zonesRef.current = next;
      setUnlockedZones(next);
    },
    []
  );

  /* ═══════════ AUTO-SAVE ═══════════ */
  const writePlotsToStorage = useCallback(() => {
    if (isSaveSuppressed()) return;
    safeSetLocalStorageItem(STORAGE_KEY + '_plots', JSON.stringify(plotsRef.current));
    safeSetLocalStorageItem(STORAGE_KEY + '_zones', JSON.stringify(zonesRef.current));
  }, []);

  const saveChannelRef = useRef<ReturnType<typeof createAutoSaveChannel> | null>(null);
  useEffect(() => {
    const channel = createAutoSaveChannel(writePlotsToStorage, {
      delayMs: 250,
      maxWaitMs: 1200,
    });
    saveChannelRef.current = channel;
    channel.schedule();
    return () => {
      channel.dispose();
      saveChannelRef.current = null;
    };
  }, [writePlotsToStorage]);

  useEffect(() => {
    saveChannelRef.current?.schedule();
  }, [plots, unlockedZones]);

  /* ═══════════ GROWTH TICK (1s) ═══════════ */
  useEffect(() => {
    const interval = setInterval(() => {
      setPlotsSync((prevPlots) => {
        const anyGrowing = prevPlots.some(
          (plot) => (plot.status === 'PLANTED' || plot.status === 'GROWING') && plot.cropType
        );
        if (!anyGrowing) return prevPlots;

        return prevPlots.map((plot) => {
          if ((plot.status === 'PLANTED' || plot.status === 'GROWING') && plot.cropType) {
            const def = CROP_DEFINITIONS[plot.cropType];
            const roofBoost = plot.coveredByHouseId ? 1.25 : 1.0;
            const growthIncrement =
              (1 / def.growthTimeSeconds) * (plot.isWatered ? 2.0 : 1.0) * roofBoost;
            const newProgress = Math.min(1.0, plot.growthProgress + growthIncrement);

            if (newProgress >= 1.0) {
              return { ...plot, status: 'READY', growthProgress: 1.0 };
            } else if (newProgress > 0.35 && plot.status === 'PLANTED') {
              return { ...plot, status: 'GROWING', growthProgress: newProgress };
            } else {
              return { ...plot, growthProgress: newProgress };
            }
          }
          return plot;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [setPlotsSync]);

  /* ═══════════ UNLOCK ZONE ═══════════ */
  const handleUnlockZone = useCallback(
    (
      zone: ExpansionZone,
      coins: number,
      level: number,
      spendCoins: (amt: number) => boolean
    ): boolean => {
      if (zonesRef.current.includes(zone.id)) {
        addNotice(tr('ℹ️ พื้นที่โซนนี้ปลดล็อกเรียบร้อยแล้ว', 'ℹ️ This zone is already unlocked'), '#90caf9');
        return false;
      }
      if (level < zone.requiredLevel) {
        addNotice(
          tr(`🔒 ต้องมีเลเวล ${zone.requiredLevel} ขึ้นไป`, `🔒 Requires Level ${zone.requiredLevel}+`),
          '#ef5350'
        );
        return false;
      }
      if (coins < zone.cost || (zone.cost > 0 && !spendCoins(zone.cost))) {
        addNotice(
          tr('❌ เหรียญทองไม่เพียงพอสำหรับปลดล็อกพื้นที่', '❌ Not enough coins to unlock land'),
          '#ef5350'
        );
        return false;
      }

      setUnlockedZonesSync((prev) => (prev.includes(zone.id) ? prev : [...prev, zone.id]));

      const newPlots = ALL_FARM_PLOTS.filter((p) => p.zoneId === zone.id);
      setPlotsSync((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...newPlots.filter((p) => !existingIds.has(p.id))];
      });

      farmAudio.playCoinSound();
      farmAudio.playLevelUpSound();
      const zoneLabel =
        getCurrentLang() === 'en' ? ZONE_TEXT_EN[zone.id]?.name || zone.name : zone.name;
      addNotice(
        tr(
          `🎉 ปลดล็อก ${zoneLabel}! ขยายพื้นที่ +${newPlots.length} แปลง`,
          `🎉 Unlocked ${zoneLabel}! +${newPlots.length} new plots`
        ),
        '#81c784'
      );
      return true;
    },
    [addNotice, setUnlockedZonesSync, setPlotsSync]
  );

  /* ═══════════ INTERACT PLOT (tap/click) ═══════════ */
  const interactPlot = useCallback(
    (
      plotId: number,
      activeTool: ToolType,
      selectedSeed: CropType,
      _seedCount: number,
      spendSeed: (crop: CropType) => boolean,
      addCrop: (crop: CropType) => void,
      addSeed: (crop: CropType, count: number) => void,
      addXP: (amount: number) => void
      // ✅ ลบ spendCoinsForDirectSeed ออก
    ) => {
      const plot = plotsRef.current.find((p) => p.id === plotId);
      if (!plot) return;

      // EMPTY -> plow
      if (plot.status === 'EMPTY') {
        if (activeTool === 'seed_bag') {
          const seedDef = CROP_DEFINITIONS[selectedSeed];
          
          // ✅ บังคับให้ต้องมีเมล็ดในกระเป๋าเท่านั้น
          if (!spendSeed(selectedSeed)) {
            addNotice(
              tr(
                `❌ ไม่มีเมล็ด${seedDef.name}ในกระเป๋า! กรุณาซื้อจากร้านค้าก่อน`,
                `❌ No ${getCropName(selectedSeed)} seeds in bag! Please buy from shop`
              ),
              '#ef5350'
            );
            return;
          }

          const plantedAt = Date.now();
          setPlotsSync((prev) =>
            prev.map((p) =>
              p.id === plotId
                ? {
                    ...p,
                    status: 'PLANTED',
                    cropType: selectedSeed,
                    growthProgress: 0.1,
                    plantedAt,
                    isWatered: false,
                    wateredAt: undefined,
                  }
                : p
            )
          );
          farmAudio.playPlantSound();
          addXP(10);
          addNotice(
            tr(
              `🌱 พรวนและปลูก${seedDef.name}เรียบร้อย!`,
              `🌱 Plowed & planted ${getCropName(selectedSeed)}!`
            ),
            '#a5d6a7'
          );
          return;
        }

        setPlotsSync((prev) => prev.map((p) => (p.id === plotId ? { ...p, status: 'PLOWED' } : p)));
        farmAudio.playTillSound();
        addXP(4);
        addNotice(
          tr(
            '✨ พรวนดินสำเร็จ! แตะซ้ำเพื่อปลูกพืชทันที',
            '✨ Soil plowed! Tap again to plant seeds'
          ),
          '#a5d6a7'
        );
        return;
      }

      // PLOWED -> plant
      if (plot.status === 'PLOWED') {
        const seedDef = CROP_DEFINITIONS[selectedSeed];
        
        // ✅ บังคับให้ต้องมีเมล็ดในกระเป๋าเท่านั้น
        if (!spendSeed(selectedSeed)) {
          addNotice(
            tr(
              `❌ ไม่มีเมล็ด${seedDef.name}ในกระเป๋า! กรุณาซื้อจากร้านค้าก่อน`,
              `❌ No ${getCropName(selectedSeed)} seeds in bag! Please buy from shop`
            ),
            '#ef5350'
          );
          return;
        }

        const plantedAt = Date.now();
        setPlotsSync((prev) =>
          prev.map((p) =>
            p.id === plotId
              ? {
                  ...p,
                  status: 'PLANTED',
                  cropType: selectedSeed,
                  growthProgress: 0.1,
                  plantedAt,
                  isWatered: false,
                  wateredAt: undefined,
                }
              : p
          )
        );
        farmAudio.playPlantSound();
        addXP(6);
        addNotice(
          tr(
            `🌱 ปลูก${seedDef.name}เรียบร้อย!`,
            `🌱 Planted ${getCropName(selectedSeed)}!`
          ),
          '#a5d6a7'
        );
        return;
      }

      // PLANTED / GROWING -> water
      if (plot.status === 'PLANTED' || plot.status === 'GROWING') {
        if (!plot.isWatered) {
          const wateredAt = Date.now();
          setPlotsSync((prev) =>
            prev.map((p) => (p.id === plotId ? { ...p, isWatered: true, wateredAt } : p))
          );
          farmAudio.playWaterSound();
          addXP(3);
          addNotice(
            tr('💦 รดน้ำชุ่มชื้นแล้ว โตเร็วขึ้น 2 เท่า!', '💦 Watered! Growing 2x faster!'),
            '#42a5f5'
          );
          return;
        }

        const crop = plot.cropType;
        if (crop) {
          const def = CROP_DEFINITIONS[crop];
          const pct = Math.min(99, Math.round((plot.growthProgress || 0) * 100));
          const roofBoost = plot.coveredByHouseId ? 1.25 : 1.0;
          const speedMult = (plot.isWatered ? 2.0 : 1.0) * roofBoost;
          const secLeft = Math.max(
            1,
            Math.ceil(((1 - (plot.growthProgress || 0)) * def.growthTimeSeconds) / speedMult)
          );
          const timeLabel =
            secLeft >= 60
              ? tr(`${Math.ceil(secLeft / 60)} นาที`, `${Math.ceil(secLeft / 60)}m`)
              : tr(`${secLeft} วินาที`, `${secLeft}s`);
          addNotice(
            tr(
              `💧 ${def.name} ชุ่มชื้นแล้ว (${pct}% • อีก ~${timeLabel})`,
              `💧 ${getCropName(crop)} watered (${pct}% • ~${timeLabel} left)`
            ),
            '#90caf9'
          );
        }
        return;
      }

      // READY -> harvest
      if (plot.status === 'READY') {
        const crop = plot.cropType;
        if (!crop) return;

        setPlotsSync((prev) =>
          prev.map((p) =>
            p.id === plotId
              ? { ...p, status: 'PLOWED', cropType: undefined, growthProgress: 0, isWatered: false }
              : p
          )
        );

        farmAudio.playHarvestSound();
        const def = CROP_DEFINITIONS[crop];
        const seedYield = Math.floor(Math.random() * 2) + 1;

        addCrop(crop);
        addSeed(crop, seedYield);
        addXP(def.xpReward);

        addNotice(
          tr(
            `🧺 เก็บเกี่ยว ${def.name} สำเร็จ! ได้รับ ${def.iconEmoji} ${def.name} x1 และ 🌱 เมล็ด${def.name} x${seedYield} (+${def.xpReward} XP)`,
            `🧺 Harvested ${getCropName(crop)}! Got ${def.iconEmoji} ${getCropName(crop)} x1 & 🌱 ${getCropName(crop)} Seeds x${seedYield} (+${def.xpReward} XP)`
          ),
          '#ffd54f'
        );
      }
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ ✅ NEW: WATER PLOT (Drone) ═══════════ */
  const waterPlot = useCallback(
    (plotId: number): boolean => {
      const plot = plotsRef.current.find((p) => p.id === plotId);
      if (!plot) return false;
      if (plot.isWatered) return false;
      if (plot.status !== 'PLANTED' && plot.status !== 'GROWING') return false;

      const wateredAt = Date.now();
      setPlotsSync((prev) =>
        prev.map((p) => (p.id === plotId ? { ...p, isWatered: true, wateredAt } : p))
      );
      farmAudio.playWaterSound();
      addNotice(
        tr(
          `💦 โดรนรดน้ำแปลง #${plotId}! โตเร็วขึ้น 2 เท่า`,
          `💦 Drone watered plot #${plotId}! 2x growth`
        ),
        '#42a5f5'
      );
      return true;
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ ✅ NEW: REPLANT PLOT (Drone) ═══════════ */
  const replantPlot = useCallback(
    (
      plotId: number,
      seed: CropType,
      spendSeed?: (crop: CropType) => boolean
      // ✅ ลบ spendCoinsForDirectSeed ออก
    ): boolean => {
      const plot = plotsRef.current.find((p) => p.id === plotId);
      if (!plot) return false;
      if (plot.status !== 'EMPTY' && plot.status !== 'PLOWED') return false;

      const def = CROP_DEFINITIONS[seed];
      
      // ✅ บังคับให้ต้องมีเมล็ดในกระเป๋าเท่านั้น
      if (!spendSeed || !spendSeed(seed)) {
        addNotice(
          tr(
            `❌ โดรนไม่สามารถปลูก${def.name}ได้! ไม่มีเมล็ดในกระเป๋า`,
            `❌ Drone cannot plant ${getCropName(seed)}! No seeds in bag`
          ),
          '#ef5350'
        );
        return false;
      }

      const plantedAt = Date.now();
      setPlotsSync((prev) =>
        prev.map((p) =>
          p.id === plotId
            ? {
                ...p,
                status: 'PLANTED',
                cropType: seed,
                growthProgress: 0.1,
                plantedAt,
                isWatered: false,
                wateredAt: undefined,
              }
            : p
        )
      );
      farmAudio.playPlantSound();
      addNotice(
        tr(
          `🌱 โดรนปลูก${def.name}ซ้ำแปลง #${plotId}`,
          `🌱 Drone replanted ${getCropName(seed)} on #${plotId}`
        ),
        '#86efac'
      );
      return true;
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ MOVE PLOT ═══════════ */
  const movePlot = useCallback(
    (plotId: number, newWorldX: number, newWorldZ: number) => {
      const { gx, gz } = worldToGrid(newWorldX, newWorldZ);
      const { x: snappedX, z: snappedZ } = gridToWorld(gx, gz);
      setPlotsSync((prev) =>
        prev.map((p) =>
          p.id === plotId
            ? { ...p, gridX: gx, gridZ: gz, worldX: snappedX, worldZ: snappedZ }
            : p
        )
      );
      farmAudio.playBuildSound();
      addNotice(
        tr(
          '📍 ย้ายตำแหน่งแปลงผักสำเร็จ! แตะแปลงอื่นต่อเพื่อย้าย หรือปิดโหมด',
          '📍 Plot moved! Tap another plot to move or close mode'
        ),
        '#81c784'
      );
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ SLEEP OVERNIGHT ═══════════ */
  const sleepOvernight = useCallback(() => {
    setPlotsSync((prev) =>
      prev.map((p) => {
        if (p.status === 'PLANTED' || p.status === 'GROWING') {
          if (p.coveredByHouseId) {
            const gain = p.isWatered ? 0.45 : 0.2;
            const newProg = Math.min(1.0, p.growthProgress + gain);
            return {
              ...p,
              growthProgress: newProg,
              status: newProg >= 1.0 ? 'READY' : 'GROWING',
              isWatered: false,
            };
          }
          if (p.isWatered) {
            const newProg = Math.min(1.0, p.growthProgress + 0.35);
            return {
              ...p,
              growthProgress: newProg,
              status: newProg >= 1.0 ? 'READY' : 'GROWING',
              isWatered: false,
            };
          }
          return p;
        }
        return p;
      })
    );
  }, [setPlotsSync]);

  /* ═══════════ SYNC COVERED PLOTS ═══════════ */
  const syncCoveredPlots = useCallback(
    (houses: PlacedHouse[]) => {
      const coveredHouses = houses.filter((h) => h.type === 30);
      setPlotsSync((prev) => {
        const coveredHouseIds = new Set(coveredHouses.map((h) => h.id));
        let changed = false;

        const kept = prev.filter((p) => {
          if (!p.coveredByHouseId) return true;
          const alive = coveredHouseIds.has(p.coveredByHouseId);
          if (!alive) changed = true;
          return alive;
        });

        let maxId = kept.reduce((acc, p) => Math.max(acc, p.id), 10000);
        const nextList = [...kept];

        for (const h of coveredHouses) {
          const cos = Math.cos(h.rot);
          const sin = Math.sin(h.rot);
          for (const slot of [0, 1] as const) {
            const lx = slot === 0 ? -1.0 : 1.0;
            const worldX = Number((h.x + lx * cos).toFixed(3));
            const worldZ = Number((h.z - lx * sin).toFixed(3));
            const { gx, gz } = worldToGrid(worldX, worldZ);

            const existingIdx = nextList.findIndex(
              (p) => p.coveredByHouseId === h.id && p.coveredSlot === slot
            );

            if (existingIdx >= 0) {
              const cur = nextList[existingIdx];
              const curRot = cur.rotY ?? 0;
              if (
                Math.abs(cur.worldX - worldX) > 1e-3 ||
                Math.abs(cur.worldZ - worldZ) > 1e-3 ||
                Math.abs(curRot - h.rot) > 1e-4 ||
                cur.gridX !== gx ||
                cur.gridZ !== gz
              ) {
                nextList[existingIdx] = {
                  ...cur,
                  gridX: gx,
                  gridZ: gz,
                  worldX,
                  worldZ,
                  rotY: h.rot,
                };
                changed = true;
              }
            } else {
              maxId += 1;
              nextList.push({
                id: maxId,
                gridX: gx,
                gridZ: gz,
                worldX,
                worldZ,
                rotY: h.rot,
                status: 'PLOWED',
                growthProgress: 0,
                isWatered: false,
                coveredByHouseId: h.id,
                coveredSlot: slot,
              });
              changed = true;
            }
          }
        }

        return changed ? nextList : prev;
      });
    },
    [setPlotsSync]
  );

  /* ═══════════ PLANT COVERED HOUSE CROP ═══════════ */
  const plantCoveredHouseCrop = useCallback(
    (
      houseId: string,
      crop: CropType,
      _getSeedCount: (c: CropType) => number,
      spendSeed: (c: CropType) => boolean,
      addXP: (amount: number) => void
      // ✅ ลบ spendCoinsForDirectSeed ออก
    ): number => {
      const targetBeds = plotsRef.current.filter(
        (p) => p.coveredByHouseId === houseId && (p.status === 'EMPTY' || p.status === 'PLOWED')
      );
      if (targetBeds.length === 0) {
        addNotice(
          tr(
            'ℹ️ แปลงใต้หลังคากำลังปลูกพืชอยู่เต็มทั้ง 2 ช่องแล้ว',
            'ℹ️ Both sheltered beds already have crops growing'
          ),
          '#90caf9'
        );
        return 0;
      }

      const def = CROP_DEFINITIONS[crop];
      const plantedIds = new Set<number>();

      for (const bed of targetBeds) {
        if (spendSeed(crop)) {
          plantedIds.add(bed.id);
        }
      }

      // ✅ ถ้าไม่มีเมล็ดเลยสักเมล็ด ให้แจ้งเตือนและไม่ปลูก
      if (plantedIds.size === 0) {
        addNotice(
          tr(
            `❌ ไม่มีเมล็ด${def.name}ในกระเป๋า! กรุณาซื้อจากร้านค้าก่อน`,
            `❌ No ${getCropName(crop)} seeds in bag! Please buy from shop`
          ),
          '#ef5350'
        );
        return 0;
      }

      const now = Date.now();
      setPlotsSync((prev) =>
        prev.map((p) =>
          plantedIds.has(p.id)
            ? {
                ...p,
                status: 'PLANTED',
                cropType: crop,
                growthProgress: 0.1,
                plantedAt: now,
                isWatered: false,
                wateredAt: undefined,
              }
            : p
        )
      );
      farmAudio.playPlantSound();

      addXP(plantedIds.size * 6);
      addNotice(
        tr(
          `🌱 ปลูก${def.name}ในแปลงมีหลังคา ${plantedIds.size} ช่อง! โตไวขึ้น +25%`,
          `🌱 Planted ${getCropName(crop)} in ${plantedIds.size} covered bed(s)! (+25% speed)`
        ),
        '#86efac'
      );
      return plantedIds.size;
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ WATER COVERED HOUSE ═══════════ */
  const waterCoveredHouse = useCallback(
    (houseId: string, addXP: (amount: number) => void): number => {
      const dryGrowing = plotsRef.current.filter(
        (p) =>
          p.coveredByHouseId === houseId &&
          (p.status === 'PLANTED' || p.status === 'GROWING') &&
          !p.isWatered
      );
      if (dryGrowing.length === 0) {
        addNotice(
          tr(
            '💧 แปลงใต้หลังคาชุ่มชื้นครบแล้ว หรือยังไม่ได้ลงเมล็ด',
            '💧 Covered beds are already watered or empty'
          ),
          '#90caf9'
        );
        return 0;
      }
      const targetIds = new Set(dryGrowing.map((p) => p.id));
      const now = Date.now();
      setPlotsSync((prev) =>
        prev.map((p) => (targetIds.has(p.id) ? { ...p, isWatered: true, wateredAt: now } : p))
      );
      farmAudio.playWaterSound();
      addXP(targetIds.size * 3);
      addNotice(
        tr(
          `💦 รดน้ำแปลงผักมีหลังคา ${targetIds.size} ช่อง! เร่งโตไวคูณ 2.5x`,
          `💦 Watered ${targetIds.size} covered bed(s)! Growing at 2.5x speed`
        ),
        '#38bdf8'
      );
      return targetIds.size;
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ HARVEST COVERED HOUSE ═══════════ */
  const harvestCoveredHouse = useCallback(
    (
      houseId: string,
      addCrop: (crop: CropType) => void,
      addSeed: (crop: CropType, count: number) => void,
      addXP: (amount: number) => void
    ): number => {
      const readyBeds = plotsRef.current.filter(
        (p) => p.coveredByHouseId === houseId && p.status === 'READY' && p.cropType
      );
      if (readyBeds.length === 0) {
        addNotice(
          tr(
            '⏳ พืชในแปลงมีหลังคายังไม่สุกพร้อมเก็บเกี่ยว',
            '⏳ Crops in this covered plot are still growing'
          ),
          '#ffb74d'
        );
        return 0;
      }

      const readyIds = new Set(readyBeds.map((p) => p.id));
      setPlotsSync((prev) =>
        prev.map((p) =>
          readyIds.has(p.id)
            ? {
                ...p,
                status: 'PLOWED',
                cropType: undefined,
                growthProgress: 0,
                isWatered: false,
              }
            : p
        )
      );

      let totalXp = 0;
      let totalSeeds = 0;
      for (const bed of readyBeds) {
        if (!bed.cropType) continue;
        const def = CROP_DEFINITIONS[bed.cropType];
        const seedYield = Math.floor(Math.random() * 2) + 1;
        
        addCrop(bed.cropType);
        addSeed(bed.cropType, seedYield);
        totalXp += def.xpReward;
        totalSeeds += seedYield;
      }
      addXP(totalXp);
      farmAudio.playHarvestSound();

      addNotice(
        tr(
          `🧺 เก็บเกี่ยวผักจากแปลงมีหลังคา ${readyBeds.length} ช่องสำเร็จ! ได้รับเมล็ดพันธุ์รวม +${totalSeeds} เมล็ด (+${totalXp} XP)`,
          `🧺 Harvested ${readyBeds.length} covered bed(s)! Got total +${totalSeeds} seeds (+${totalXp} XP)`
        ),
        '#ffd54f'
      );
      return readyBeds.length;
    },
    [addNotice, setPlotsSync]
  );

  /* ═══════════ RETURN ═══════════ */
  return {
    plots,
    unlockedZones,
    interactPlot,
    handleUnlockZone,
    movePlot,
    sleepOvernight,
    syncCoveredPlots,
    plantCoveredHouseCrop,
    waterCoveredHouse,
    harvestCoveredHouse,
    waterPlot,
    replantPlot,
  };
}