// src/hooks/useFarmTrees.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlacedTree,
  TreeType,
  TreeStage,
  PlacedHouse,
  FarmPlot,
  PlacedRock,
  TREE_DEFINITIONS,
  gridToWorld,
  GRID_MIN_X,
  GRID_MAX_X,
  GRID_MIN_Z,
  GRID_MAX_Z,
} from '../types/game';
import { farmAudio } from '../utils/audio';
import { isTerrainBlocked, debugTerrainGrid } from '../data/terrainFeatures';
import {
  createAutoSaveChannel,
  getInitialOfflineElapsedSeconds,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
} from '../utils/farmAutoSave';
import { isSaveSuppressed } from '../utils/saveReset';
import {
  tr,
  getTreeName,
  getTreeFruitName,
  translatePlacementReason,
} from '../i18n/translations';

const STORAGE_KEY = 'beam_farm_3d_trees_v2';

export const INITIAL_TREES: PlacedTree[] = [];

export function useFarmTrees(addNotice: (text: string, color?: string) => void) {
  const [trees, setTrees] = useState<PlacedTree[]>(() => {
    try {
      const saved = safeGetLocalStorageItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PlacedTree[];
        if (Array.isArray(parsed)) {
          const elapsedSec = getInitialOfflineElapsedSeconds();
          if (elapsedSec <= 0.5) return parsed;
          return parsed.map((tree) => {
            if (tree.stage === 'ready') return tree;
            const def = TREE_DEFINITIONS[tree.type];
            if (!def) return tree;
            const gain = (elapsedSec / def.growthTimeSeconds) * (tree.isWatered ? 2.0 : 1.0);
            const newProgress = Math.min(1.0, (tree.growthProgress || 0) + gain);
            let newStage: TreeStage = tree.stage;
            if (newProgress >= 1.0) {
              newStage = 'ready';
            } else if (newProgress >= 0.7 || tree.stage === 'mature' || tree.harvestsCount > 0) {
              newStage = 'mature';
            } else if (newProgress >= 0.3) {
              newStage = 'growing';
            }
            return { ...tree, growthProgress: newProgress, stage: newStage };
          });
        }
      }
    } catch {}
    return INITIAL_TREES;
  });

  const treesRef = useRef(trees);
  treesRef.current = trees;

  const setTreesSync = useCallback(
    (updater: PlacedTree[] | ((prev: PlacedTree[]) => PlacedTree[])) => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: PlacedTree[]) => PlacedTree[])(treesRef.current)
          : updater;
      treesRef.current = next;
      setTrees(next);
      return next;
    },
    []
  );

  const writeTreesToStorage = useCallback(() => {
    if (isSaveSuppressed()) return;
    safeSetLocalStorageItem(STORAGE_KEY, JSON.stringify(treesRef.current));
  }, []);

  const saveChannelRef = useRef<ReturnType<typeof createAutoSaveChannel> | null>(null);
  useEffect(() => {
    const channel = createAutoSaveChannel(writeTreesToStorage, {
      delayMs: 250,
      maxWaitMs: 1200,
    });
    saveChannelRef.current = channel;
    channel.schedule();
    return () => {
      channel.dispose();
      saveChannelRef.current = null;
    };
  }, [writeTreesToStorage]);

  useEffect(() => {
    saveChannelRef.current?.schedule();
  }, [trees]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTreesSync((prevTrees) => {
        if (prevTrees.length === 0) return prevTrees;
        const anyGrowing = prevTrees.some((t) => t.stage !== 'ready');
        if (!anyGrowing) return prevTrees;

        return prevTrees.map((tree) => {
          if (tree.stage === 'ready') return tree;

          const def = TREE_DEFINITIONS[tree.type];
          const growthIncrement =
            (1 / def.growthTimeSeconds) * (tree.isWatered ? 2.0 : 1.0);
          const newProgress = Math.min(1.0, tree.growthProgress + growthIncrement);

          let newStage: TreeStage = tree.stage;
          if (newProgress >= 1.0) {
            newStage = 'ready';
          } else if (newProgress >= 0.7 || tree.stage === 'mature' || tree.harvestsCount > 0) {
            newStage = 'mature';
          } else if (newProgress >= 0.3) {
            newStage = 'growing';
          }

          return {
            ...tree,
            growthProgress: newProgress,
            stage: newStage,
          };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [setTreesSync]);

  const isCellFree = useCallback(
    (
      gx: number,
      gz: number,
      houses: PlacedHouse[] = [],
      plots: FarmPlot[] = [],
      rocks: PlacedRock[] = [],
      map2Unlocked: boolean = false
    ): { free: boolean; reason?: string } => {
      const minGx = map2Unlocked ? -44 : GRID_MIN_X;
      if (gx < minGx || gx > GRID_MAX_X || gz < GRID_MIN_Z || gz > GRID_MAX_Z) {
        return { free: false, reason: 'อยู่นอกขอบเขตเกาะฟาร์ม' };
      }

      const { x, z } = gridToWorld(gx, gz);

      if (x > -43) {
        const terrain = isTerrainBlocked(x, z);
        if (terrain.blocked) {
          return { free: false, reason: terrain.reason };
        }
      }

      const treeCollision = treesRef.current.some((t) => t.gridX === gx && t.gridZ === gz);
      if (treeCollision) {
        return { free: false, reason: 'มีต้นไม้ปลูกอยู่ในช่องนี้แล้ว' };
      }

      const plotCollision = plots.some(
        (p) => Math.abs(p.worldX - x) < 1.85 && Math.abs(p.worldZ - z) < 1.85
      );
      if (plotCollision) {
        return { free: false, reason: 'ซ้อนทับแปลงปลูกผัก' };
      }

      const houseCollision = houses.some((h) => Math.hypot(h.x - x, h.z - z) < 4.2);
      if (houseCollision) {
        return { free: false, reason: 'ซ้อนทับบริเวณบ้านไม้หรือลานรั้ว' };
      }

      const rockCollision = rocks.some((r) => {
        const minDist = r.type === 'rock_large' ? 2.4 : 1.5;
        return Math.hypot(r.x - x, r.z - z) < minDist;
      });
      if (rockCollision) {
        return { free: false, reason: 'ซ้อนทับก้อนหินในฟาร์ม' };
      }

      return { free: true };
    },
    []
  );

  const plantTree = useCallback(
    (
      gx: number,
      gz: number,
      treeType: TreeType,
      spendSapling: (type: TreeType) => boolean,
      addXP: (amt: number) => void,
      houses: PlacedHouse[] = [],
      plots: FarmPlot[] = [],
      rocks: PlacedRock[] = [],
      map2Unlocked: boolean = false
    ): boolean => {
      const check = isCellFree(gx, gz, houses, plots, rocks, map2Unlocked);
      if (!check.free) {
        addNotice(`❌ ${translatePlacementReason(check.reason) || check.reason}`, '#ef5350');
        return false;
      }

      if (!spendSapling(treeType)) {
        addNotice(
          tr(
            `❌ ไม่มีกล้า${TREE_DEFINITIONS[treeType].name}ในกระเป๋า`,
            `❌ No ${getTreeName(treeType)} saplings in bag`
          ),
          '#ef5350'
        );
        return false;
      }

      const { x, z } = gridToWorld(gx, gz);
      const newTree: PlacedTree = {
        id: `tree_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        gridX: gx,
        gridZ: gz,
        worldX: x,
        worldZ: z,
        type: treeType,
        stage: 'sapling',
        growthProgress: 0.05,
        isWatered: false,
        plantedAt: Date.now(),
        harvestsCount: 0,
      };

      setTreesSync((prev) => [...prev, newTree]);
      farmAudio.playPlantSound();
      addXP(10);
      addNotice(
        tr(
          `🌱 ปลูก ${TREE_DEFINITIONS[treeType].name} ลงบนพื้นสำเร็จ!`,
          `🌱 Planted ${getTreeName(treeType)}!`
        ),
        '#81c784'
      );
      return true;
    },
    [isCellFree, addNotice, setTreesSync]
  );

  const waterTree = useCallback(
    (treeId: string, addXP: (amt: number) => void): boolean => {
      const target = treesRef.current.find((t) => t.id === treeId);
      if (!target) return false;

      if (target.isWatered) {
        addNotice(tr('💧 โคนต้นไม้นี้รดน้ำชุ่มชื้นแล้ว', '💧 This tree is already watered'), '#90caf9');
        return false;
      }

      farmAudio.playWaterSound();
      setTreesSync((prev) =>
        prev.map((t) =>
          t.id === treeId ? { ...t, isWatered: true, wateredAt: Date.now() } : t
        )
      );
      addXP(5);
      addNotice(
        tr(
          `💦 รดน้ำ ${TREE_DEFINITIONS[target.type].name} ชุ่มชื้น! โตเร็วขึ้น 2 เท่า`,
          `💦 Watered ${getTreeName(target.type)}! 2x growth speed`
        ),
        '#42a5f5'
      );
      return true;
    },
    [addNotice, setTreesSync]
  );

  const harvestTree = useCallback(
    (
      treeId: string,
      addTreeHarvest: (type: TreeType, count: number) => void,
      addSapling: (type: TreeType, count: number) => void, // ✅ เพิ่มพารามิเตอร์ addSapling
      addXP: (amt: number) => void
    ): boolean => {
      const target = treesRef.current.find((t) => t.id === treeId);
      if (!target) return false;

      const def = TREE_DEFINITIONS[target.type];

      if (target.stage === 'withered') {
        if (target.type === 'coconut' && target.harvestsCount === 3) {
          addNotice(
            tr(
              '🥀 ต้นมะพร้าวเหี่ยวเฉาหลังเก็บรอบ 3! แตะเพื่อชุบชีวิต (Revive) ให้ฟื้นคืนชีพ',
              '🥀 Coconut palm is withered after 3rd harvest! Tap to revive it'
            ),
            '#42a5f5'
          );
        } else {
          addNotice(
            tr(
              `🪚 ต้น${def.name}ตายสนิทแล้ว! ใช้เลื่อย (Saw) หรือแตะซ้ำเพื่อตัดเคลียร์พื้นที่`,
              `🪚 ${getTreeName(target.type)} is dead! Use Saw to clear space`
            ),
            '#ffb74d'
          );
        }
        return false;
      }

      if (target.stage !== 'ready') {
        const remainingPct = Math.round((1.0 - target.growthProgress) * 100);
        addNotice(
          tr(
            `⏳ ${def.name} กำลังออกดอกผล (อีก ${remainingPct}%)`,
            `⏳ ${getTreeName(target.type)} is ripening (${remainingPct}% left)`
          ),
          '#ffb74d'
        );
        return false;
      }

      farmAudio.playHarvestSound();

      if (def.isFruitTree) {
        const roundCounts = [2, 3, 4, 4];
        const currentRoundIndex = Math.min(target.harvestsCount, 3);
        const yieldCount =
          target.type === 'lemon' || target.type === 'coconut'
            ? roundCounts[currentRoundIndex]
            : 4;

        const nextHarvestCount = target.harvestsCount + 1;
        let nextStage: TreeStage = 'mature';

        if (target.type === 'lemon') {
          if (nextHarvestCount >= 4) {
            nextStage = 'withered';
          }
        } else if (target.type === 'coconut') {
          if (nextHarvestCount === 3) {
            nextStage = 'withered';
          } else if (nextHarvestCount >= 4) {
            nextStage = 'withered';
          }
        }

        const xpEarned =
          target.type === 'coconut'
            ? yieldCount * 21
            : def.xpReward;

        // ✅ สุ่มโอกาสได้รับต้นกล้า (เช่น 50% chance)
        const saplingYield = Math.random() > 0.5 ? 1 : 0;

        setTreesSync((prev) =>
          prev.map((t) =>
            t.id === treeId
              ? {
                  ...t,
                  stage: nextStage,
                  growthProgress: nextStage === 'withered' ? 1.0 : 0.7,
                  isWatered: false,
                  harvestsCount: nextHarvestCount,
                }
              : t
          )
        );

        addTreeHarvest(target.type, yieldCount);
        if (saplingYield > 0) {
          addSapling(target.type, saplingYield); // ✅ เพิ่มต้นกล้าเข้าคลัง
        }
        addXP(xpEarned);

        const saplingText = saplingYield > 0 
          ? tr(` และ 🌱 ต้นกล้า${def.name} x${saplingYield}`, ` & 🌱 ${getTreeName(target.type)} Sapling x${saplingYield}`) 
          : '';

        if (nextStage === 'withered') {
          if (target.type === 'coconut' && nextHarvestCount === 3) {
            addNotice(
              tr(
                `🧺 เก็บผล ${def.name} รอบที่ 3 ได้ x${yieldCount} ผล${saplingText} (+${xpEarned} XP)! ต้นไม้เหี่ยวเฉาแล้ว ต้องการการชุบชีวิต`,
                `🧺 Harvested round 3 ${getTreeFruitName(target.type)} x${yieldCount}${saplingText}! Tree is now withered and needs reviving`
              ),
              '#42a5f5'
            );
          } else {
            addNotice(
              tr(
                `🧺 เก็บผล ${def.name} รอบที่ 4 (ครบ 13 ลูก) ได้ x${yieldCount} ผล${saplingText} (+${xpEarned} XP)! ต้นไม้ตายสนิทแล้ว ใช้เลื่อย (Saw) ตัดออก`,
                `🧺 Harvested final round ${getTreeFruitName(target.type)} x${yieldCount}${saplingText}! Tree is permanently dead; use Saw to clear`
              ),
              '#e57373'
            );
          }
        } else {
          addNotice(
            tr(
              `🧺 เก็บผล ${def.name} (รอบที่ ${nextHarvestCount}) x${yieldCount} ผลสำเร็จ! ได้รับ ${def.iconEmoji} ${getTreeFruitName(target.type)} x${yieldCount}${saplingText} (+${xpEarned} XP)`,
              `🧺 Harvested ${getTreeFruitName(target.type)} (round ${nextHarvestCount}) x${yieldCount}! Got ${def.iconEmoji} ${getTreeFruitName(target.type)} x${yieldCount}${saplingText} (+${xpEarned} XP)`
            ),
            '#ffd54f'
          );
        }
        return true;
      } else {
        addNotice(
          tr(
            `💡 ใช้ขวาน (Axe) จามโค่นเพื่อรับไม้ซุง ${def.woodYield} ท่อน`,
            `💡 Use the Axe to chop for ${def.woodYield} Timber Logs`
          ),
          '#81c784'
        );
        return false;
      }
    },
    [addNotice, setTreesSync]
  );

  const reviveTree = useCallback(
    (treeId: string, addXP?: (amt: number) => void): boolean => {
      const target = treesRef.current.find((t) => t.id === treeId);
      if (!target) return false;

      if (target.stage !== 'withered' || target.type !== 'coconut' || target.harvestsCount !== 3) {
        addNotice(tr('ต้นไม้นี้ไม่อยู่ในสถานะที่ต้องชุบชีวิต', 'Tree cannot be revived'), '#ffb74d');
        return false;
      }

      farmAudio.playWaterSound();
      setTreesSync((prev) =>
        prev.map((t) =>
          t.id === treeId
            ? {
                ...t,
                stage: 'mature',
                growthProgress: 0.7,
                isWatered: true,
                wateredAt: Date.now(),
              }
            : t
        )
      );
      addXP?.(35);
      addNotice(
        tr(
          '✨ ชุบชีวิตต้นมะพร้าวสำเร็จ! สดชื่นกลับมาพร้อมออกผลรอบที่ 4 (รอบสุดท้าย)',
          '✨ Successfully revived the Coconut Palm! It is now growing round 4'
        ),
        '#81c784'
      );
      return true;
    },
    [addNotice, setTreesSync]
  );

  const chopTree = useCallback(
    (
      treeId: string,
      addWood: (count: number) => void,
      addXP: (amount: number) => void
    ): boolean => {
      const target = treesRef.current.find((t) => t.id === treeId);
      if (!target) return false;
      const def = TREE_DEFINITIONS[target.type];

      farmAudio.playHoeSound();

      if (target.stage === 'withered') {
        const wood = def.woodYield;
        setTreesSync((prev) => prev.filter((t) => t.id !== treeId));
        addWood(wood);
        addXP(25);
        addNotice(
          tr(
            `🪚 ใช้เลื่อย (Saw) ตัดทำลายต้น${def.name}ที่ตายแล้วเรียบร้อย เคลียร์พื้นที่สำเร็จ! (+${wood} ไม้ซุง, +25 XP)`,
            `🪚 Used Saw to clear dead ${getTreeName(target.type)}! +${wood} Timber Logs (+25 XP)`
          ),
          '#d7ccc8'
        );
        return true;
      }

      if (target.stage === 'sapling' || target.stage === 'growing') {
        setTreesSync((prev) => prev.filter((t) => t.id !== treeId));
        addNotice(
          tr(
            `🪓 ถอนต้นกล้า ${def.name} ออกจากพื้นที่เรียบร้อย (ยังไม่ให้ไม้หรือ XP)`,
            `🪓 Removed young ${getTreeName(target.type)} sapling (no wood/XP yet)`
          ),
          '#d7ccc8'
        );
        return true;
      }

      const wood = def.woodYield;
      setTreesSync((prev) => prev.filter((t) => t.id !== treeId));
      addWood(wood);
      addXP(15);

      addNotice(
        tr(
          `🪓 โค่น ${def.name} สำเร็จ! ได้รับไม้ซุง +${wood} ท่อน (+15 XP)`,
          `🪓 Chopped ${getTreeName(target.type)}! +${wood} Timber Logs (+15 XP)`
        ),
        '#d7ccc8'
      );
      return true;
    },
    [addNotice, setTreesSync]
  );

  const sleepGrowTrees = useCallback(() => {
    setTreesSync((prev) =>
      prev.map((tree) => {
        if (tree.stage === 'ready') return tree;
        const newProgress = Math.min(1.0, tree.growthProgress + 0.25);
        let newStage: TreeStage = tree.stage;
        if (newProgress >= 1.0) {
          newStage = 'ready';
        } else if (newProgress >= 0.7 || tree.stage === 'mature' || tree.harvestsCount > 0) {
          newStage = 'mature';
        } else if (newProgress >= 0.3) {
          newStage = 'growing';
        }
        return {
          ...tree,
          growthProgress: newProgress,
          stage: newStage,
          isWatered: true,
        };
      })
    );
  }, [setTreesSync]);

  const debugGrid = useCallback(() => {
    debugTerrainGrid(
      GRID_MIN_X,
      GRID_MAX_X,
      GRID_MIN_Z,
      GRID_MAX_Z,
      gridToWorld,
      (gx, gz) =>
        trees.some((t) => t.gridX === gx && t.gridZ === gz) ? 'tree' : null
    );
  }, [trees]);

  return {
    trees,
    isCellFree,
    plantTree,
    waterTree,
    harvestTree,
    reviveTree,
    chopTree,
    sleepGrowTrees,
    debugGrid,
  };
}