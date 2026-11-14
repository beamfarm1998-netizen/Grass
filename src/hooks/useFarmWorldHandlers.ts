// src/hooks/useFarmWorldHandlers.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  CameraMode,
  CropType,
  CROP_DEFINITIONS,
  DEFAULT_PLAYER_OUTFIT,
  FarmerGender,
  GRID_MAX_X,
  GRID_MAX_Z,
  GRID_MIN_X,
  GRID_MIN_Z,
  gridToWorld,
  HOUSE_DEFS,
  OvenMachineType,
  PlacedHouse,
  PlayerOutfitConfig,
  TimeOfDay,
  ToolType,
  TreeType,
  TREE_DEFINITIONS,
} from '../types/game';
import { isTerrainBlocked } from '../data/terrainFeatures';
import type { GhostState } from '../components/3d/FarmHouses';
import type { AnimalGhostState } from '../components/3d/FarmAnimals';
import type { RockGhostState } from '../components/3d/FarmRocks';
import { farmAudio } from '../utils/audio';
import {
  GRAPHICS_4K_CHANGE_EVENT,
  type GraphicsQualityMode,
  loadSavedGraphicsQualityMode,
  loadSavedUltra4kEnabled,
  saveGraphicsQualityMode,
} from '../utils/graphics4k';
import { wipeAllFarmSaveData } from '../utils/saveReset';
import {
  createAutoSaveChannel,
  flushAllPendingFarmSaves,
  loadWorldSessionState,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  saveWorldSessionState,
} from '../utils/farmAutoSave';
import {
  hydrateSavedPlayerOutfitIfNeeded,
  loadSavedPlayerOutfit,
  savePlayerOutfit,
} from '../game/player/PlayerOutfitSystem';
import type { CaughtFishRecord } from '../fishing/storage/SaveSchema';
import {
  getFishShopPrice,
  getFishSpeciesInfo,
  loadFishBag,
  sellAllFishInShop,
  sellFishInShop,
  subscribeFishBagChanged,
} from '../utils/fishMarketStorage';
import {
  getCropName,
  getCurrentLang,
  getTreeName,
  tr,
  translatePlacementReason,
} from '../i18n/translations';
import {
  useHarvestMode,
  type HarvestResult,
  type HarvestTarget,
} from './useHarvestMode';
import type { useFarmEconomy } from './useFarmEconomy';
import type { useFarmPlots } from './useFarmPlots';
import type { useFarmTrees } from './useFarmTrees';
import type { useFarmPlacement } from './useFarmPlacement';

export interface UseFarmWorldHandlersOptions {
  addNotice: (text: string, color?: string) => void;
  economy: ReturnType<typeof useFarmEconomy>;
  farmPlots: ReturnType<typeof useFarmPlots>;
  farmTrees: ReturnType<typeof useFarmTrees>;
  placement: ReturnType<typeof useFarmPlacement>;
  onResetGameSession?: () => void;
  isFreshReset: boolean;
}

export function useFarmWorldHandlers({
  addNotice,
  economy,
  farmPlots,
  farmTrees,
  placement,
  onResetGameSession,
  isFreshReset,
}: UseFarmWorldHandlersOptions) {
  const {
    stats,
    setStats,
    inventorySeeds,
    addXP,
    spendCoins,
    earnCoins,
    spendGems,
    earnGems,
    spendSeed,
    spendSapling,
    addCrop,
    addSeed, // ✅ ดึง addSeed มาใช้งาน
    addTreeHarvest,
    addSapling, // ✅ ดึง addSapling มาใช้งาน
    addWood,
    addDuckProduce,
    brewingJobs,
    bakingJobs,
    handleCollectAllReadyBrews,
    handleCollectOvenBasket,
    pruneDeletedHouseBrews,
  } = economy;

  const {
    plots,
    unlockedZones,
    interactPlot,
    movePlot,
    sleepOvernight,
    syncCoveredPlots,
    plantCoveredHouseCrop,
    waterCoveredHouse,
    harvestCoveredHouse,
  } = farmPlots;
  const { trees, isCellFree, plantTree, waterTree, harvestTree, reviveTree, chopTree, sleepGrowTrees } =
    farmTrees;
  const {
    houses,
    animals,
    rocks,
    placing,
    ghost,
    selectedHouse,
    selectedAnimal,
    selectedRock,
    setSelectedHouseId,
    setSelectedAnimalId,
    setSelectedRockId,
    handleCancelPlacing,
    handleConfirmPlace,
    handleMoveHouseById,
    handleDeleteSelectedHouse,
    handleDeleteSelectedAnimal,
    handleDeleteSelectedRock,
    handlePetAnimal,
  } = placement;

  const map2Unlocked = unlockedZones.includes(5);

  const [initialSession] = useState(() => loadWorldSessionState());
  const [initialPlayerPos] = useState(() => ({
    x: initialSession.playerX,
    z: initialSession.playerZ,
    heading: initialSession.playerHeading,
  }));
  const playerPosRef = useRef({
    x: initialSession.playerX,
    z: initialSession.playerZ,
    heading: initialSession.playerHeading,
  });

  const [activeTool, setActiveTool] = useState<ToolType>(() => initialSession.activeTool);
  const [selectedSeed, setSelectedSeed] = useState<CropType>(() => initialSession.selectedSeed);
  const [selectedSapling, setSelectedSapling] = useState<TreeType>(
    () => initialSession.selectedSapling
  );
  const [gridVisible, setGridVisible] = useState<boolean>(() => initialSession.gridVisible);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => initialSession.timeOfDay);
  const [skyVistaEnabled, setSkyVistaEnabled] = useState<boolean>(
    () => initialSession.timeOfDay === 'night'
  );
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_sound_sfx_enabled');
    return saved !== null ? saved !== 'false' : true;
  });
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_music_enabled');
    return saved !== null ? saved !== 'false' : true;
  });

  useEffect(() => {
    farmAudio.setMuted(!soundEffectsEnabled);
  }, [soundEffectsEnabled]);

  const [cameraMode, setCameraMode] = useState<CameraMode>(() =>
    initialSession.isPlayerHidden &&
    (initialSession.cameraMode === 'fpp' || initialSession.cameraMode === 'follow')
      ? 'isometric'
      : initialSession.cameraMode
  );
  const [isPlayerLocked, setIsPlayerLocked] = useState<boolean>(
    () => initialSession.isPlayerLocked
  );
  const [isPlayerHidden, setIsPlayerHidden] = useState<boolean>(
    () => Boolean(initialSession.isPlayerHidden)
  );
  const [fingerSwipeEnabled, setFingerSwipeEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_finger_swipe_enabled');
    return saved === 'true';
  });
  const [playerGender, setPlayerGender] = useState<FarmerGender>(
    () => initialSession.playerGender
  );
  const [playerOutfit, setPlayerOutfit] = useState<PlayerOutfitConfig>(() =>
    loadSavedPlayerOutfit()
  );
  const [cameraFocusRequest, setCameraFocusRequest] = useState<{
    seq: number;
    mode: 'house' | 'player';
    x?: number;
    z?: number;
  }>({ seq: 0, mode: 'player' });

  const [autoRotateCamera, setAutoRotateCamera] = useState<boolean>(() => {
    return safeGetLocalStorageItem('beam_farm_auto_rotate_camera') === 'true';
  });
  const [autoRotateSpeed, setAutoRotateSpeed] = useState<number>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_auto_rotate_speed');
    const parsed = saved ? parseFloat(saved) : 0.08;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0.08;
  });
  const [twoFingerRotateEnabled, setTwoFingerRotateEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_two_finger_rotate');
    return saved !== 'false';
  });
  const [cameraRotateTrigger, setCameraRotateTrigger] = useState<{
    seq: number;
    deltaRad?: number;
    resetDefault?: boolean;
  }>({ seq: 0 });

  useEffect(() => {
    let cancelled = false;
    void hydrateSavedPlayerOutfitIfNeeded().then((hydrated) => {
      if (!cancelled && hydrated) {
        setPlayerOutfit(hydrated);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    savePlayerOutfit(playerOutfit);
  }, [playerOutfit]);

  const sessionSnapshotRef = useRef({
    playerGender,
    timeOfDay,
    cameraMode,
    gridVisible,
    activeTool,
    selectedSeed,
    selectedSapling,
    isPlayerLocked,
    isPlayerHidden,
  });
  sessionSnapshotRef.current = {
    playerGender,
    timeOfDay,
    cameraMode,
    gridVisible,
    activeTool,
    selectedSeed,
    selectedSapling,
    isPlayerLocked,
    isPlayerHidden,
  };

  const sessionSaveChannelRef = useRef<ReturnType<typeof createAutoSaveChannel> | null>(null);
  if (!sessionSaveChannelRef.current) {
    sessionSaveChannelRef.current = createAutoSaveChannel(
      () => {
        const s = sessionSnapshotRef.current;
        const p = playerPosRef.current;
        saveWorldSessionState({
          playerX: p.x,
          playerZ: p.z,
          playerHeading: p.heading,
          playerGender: s.playerGender,
          timeOfDay: s.timeOfDay,
          cameraMode: s.cameraMode,
          gridVisible: s.gridVisible,
          activeTool: s.activeTool,
          selectedSeed: s.selectedSeed,
          selectedSapling: s.selectedSapling,
          isPlayerLocked: s.isPlayerLocked,
          isPlayerHidden: s.isPlayerHidden,
        });
      },
      { delayMs: 250, maxWaitMs: 1200 }
    );
  }

  useEffect(() => {
    return () => {
      sessionSaveChannelRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    sessionSaveChannelRef.current?.schedule();
  }, [
    playerGender,
    timeOfDay,
    cameraMode,
    gridVisible,
    activeTool,
    selectedSeed,
    selectedSapling,
    isPlayerLocked,
    isPlayerHidden,
  ]);

  const handlePlayerMove = useCallback(
    (pos: { x: number; z: number; heading?: number }) => {
      const minX = map2Unlocked ? -88 : -48;
      const clampedX = Math.max(minX, Math.min(48, pos.x));
      const clampedZ = Math.max(-35, Math.min(35, pos.z));
      playerPosRef.current = {
        x: clampedX,
        z: clampedZ,
        heading:
          typeof pos.heading === 'number' && Number.isFinite(pos.heading)
            ? pos.heading
            : playerPosRef.current.heading,
      };
      sessionSaveChannelRef.current?.schedule();
    },
    [map2Unlocked]
  );

  const [wasdEnabled, setWasdEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_wasd_enabled');
    return saved !== null ? saved !== 'false' : true;
  });

  const [touchSlideEnabled, setTouchSlideEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_touch_slide_walk_v2');
    return saved === 'true';
  });

  const [structureEditEnabled, setStructureEditEnabled] = useState<boolean>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_structure_edit_enabled');
    return saved !== null ? saved !== 'false' : true;
  });

  const [structureEditClickMode, setStructureEditClickMode] = useState<'double' | 'single'>(() => {
    const saved = safeGetLocalStorageItem('beam_farm_structure_edit_click_mode');
    return saved === 'single' || saved === 'double' ? saved : 'double';
  });

  const [graphicsQualityMode, setGraphicsQualityMode] = useState<GraphicsQualityMode>(() =>
    loadSavedGraphicsQualityMode()
  );
  const [ultra4kEnabled, setUltra4kEnabled] = useState<boolean>(() =>
    loadSavedUltra4kEnabled()
  );

  useEffect(() => {
    const syncQuality = () => {
      const mode = loadSavedGraphicsQualityMode();
      setGraphicsQualityMode(mode);
      setUltra4kEnabled(mode === 'ultra4k');
    };
    window.addEventListener(GRAPHICS_4K_CHANGE_EVENT, syncQuality);
    return () => window.removeEventListener(GRAPHICS_4K_CHANGE_EVENT, syncQuality);
  }, []);

  const [proximityNearHouse, _setProximityNearHouse] = useState<PlacedHouse | null>(null);
  const proximityNearHouseRef = useRef<PlacedHouse | null>(null);
  proximityNearHouseRef.current = proximityNearHouse;
  const [dismissedNearHouseId, setDismissedNearHouseId] = useState<string | null>(null);
  const [fingerNearHouseId, setFingerNearHouseId] = useState<string | null>(null);
  const fingerNearHouseIdRef = useRef<string | null>(null);
  fingerNearHouseIdRef.current = fingerNearHouseId;

  const setNearHouse = useCallback((house: PlacedHouse | null) => {
    const validHouse = house && house.type !== 19 && house.type !== 23 ? house : null;
    const prevHouse = proximityNearHouseRef.current;
    if (prevHouse?.id !== validHouse?.id) {
      setDismissedNearHouseId(null);
      if (fingerNearHouseIdRef.current) {
        setFingerNearHouseId(null);
      }
    }
    _setProximityNearHouse(validHouse);
  }, []);

  const handleClearFingerHouse = useCallback(() => {
    setFingerNearHouseId(null);
  }, []);

  const handleDismissNearHouse = useCallback((specificHouseId?: string | null) => {
    setFingerNearHouseId(null);
    const targetId =
      specificHouseId !== undefined
        ? specificHouseId
        : proximityNearHouseRef.current?.id ?? null;
    if (targetId) {
      setDismissedNearHouseId(targetId);
    }
  }, []);

  const fingerNearHouse = useMemo(
    () =>
      fingerNearHouseId
        ? houses.find((h) => h.id === fingerNearHouseId && h.type === 30) ?? null
        : null,
    [houses, fingerNearHouseId]
  );

  const activeProximityNearHouse = useMemo(
    () =>
      proximityNearHouse && proximityNearHouse.id !== dismissedNearHouseId
        ? proximityNearHouse
        : null,
    [proximityNearHouse, dismissedNearHouseId]
  );

  const nearHouse = useMemo(
    () => (isPlayerHidden ? fingerNearHouse : fingerNearHouse ?? activeProximityNearHouse),
    [isPlayerHidden, fingerNearHouse, activeProximityNearHouse]
  );

  const [showHouseInterior, _setShowHouseInterior] = useState<boolean>(false);
  const setShowHouseInterior = useCallback(
    (show: boolean) => {
      if (show && (nearHouse?.type === 19 || nearHouse?.type === 23)) {
        return;
      }
      if (!show) {
        handleDismissNearHouse();
      }
      _setShowHouseInterior(show);
    },
    [nearHouse, handleDismissNearHouse]
  );

  const [activeBreweryHouseId, setActiveBreweryHouseId] = useState<string | null>(null);
  const handleEnterBrewery = useCallback((houseId: string) => {
    setActiveBreweryHouseId(houseId);
  }, []);
  const handleCloseBrewery = useCallback(() => {
    handleDismissNearHouse(activeBreweryHouseId);
    setActiveBreweryHouseId(null);
  }, [activeBreweryHouseId, handleDismissNearHouse]);

  const [activeOvenTarget, setActiveOvenTarget] = useState<{
    houseId: string;
    machineType: OvenMachineType;
  } | null>(null);
  const handleEnterOven = useCallback((houseId: string, machineType: OvenMachineType) => {
    setActiveOvenTarget({ houseId, machineType });
  }, []);
  const handleCloseOven = useCallback(() => {
    handleDismissNearHouse(activeOvenTarget?.houseId);
    setActiveOvenTarget(null);
  }, [activeOvenTarget?.houseId, handleDismissNearHouse]);

  const [activeFeedMillHouseId, setActiveFeedMillHouseId] = useState<string | null>(null);
  const handleEnterFeedMill = useCallback((houseId: string) => {
    setActiveFeedMillHouseId(houseId);
  }, []);
  const handleCloseFeedMill = useCallback(() => {
    handleDismissNearHouse(activeFeedMillHouseId);
    setActiveFeedMillHouseId(null);
  }, [activeFeedMillHouseId, handleDismissNearHouse]);

  const [activeFishShopHouseId, setActiveFishShopHouseId] = useState<string | null>(null);
  const [fishBag, setFishBag] = useState<CaughtFishRecord[]>([]);
  const [fishSaleTrigger, setFishSaleTrigger] = useState<{ seq: number; houseId?: string }>({
    seq: 0,
  });

  const refreshFishBag = useCallback(() => {
    void loadFishBag().then((items) => {
      setFishBag(items);
    });
  }, []);

  const handleEnterFishShop = useCallback(
    (houseId: string) => {
      refreshFishBag();
      setActiveFishShopHouseId(houseId);
    },
    [refreshFishBag]
  );
  const handleCloseFishShop = useCallback(() => {
    handleDismissNearHouse(activeFishShopHouseId);
    setActiveFishShopHouseId(null);
  }, [activeFishShopHouseId, handleDismissNearHouse]);

  const activeBrewHouseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const j of brewingJobs) {
      ids.add(j.houseId);
    }
    return Array.from(ids);
  }, [brewingJobs]);

  const [isMovingPlotMode, setIsMovingPlotMode] = useState<boolean>(false);
  const [selectedPlotToMove, setSelectedPlotToMove] = useState<number | null>(null);
  const [poiCooldowns, setPoiCooldowns] = useState<Record<string, number>>({});

  const poiCooldownsRef = useRef<Record<string, number>>({});
  poiCooldownsRef.current = poiCooldowns;

  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  // ✅ NEW: แท็บเริ่มต้นของ InventoryModal (ตั้งจากปุ่มด้านขวาของ BottomDock หรือ handler อื่น ๆ)
  const [inventoryInitialTab, setInventoryInitialTab] =
    useState<'harvests' | 'processing' | 'shop'>('harvests');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isExpansionOpen, setIsExpansionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [isDevDocsOpen, setIsDevDocsOpen] = useState(false);
  const handleOpenDevDocs = useCallback(() => setIsDevDocsOpen(true), []);
  const handleCloseDevDocs = useCallback(() => setIsDevDocsOpen(false), []);

  const handleFastForwardTime = useCallback((seconds: number) => {
    farmTrees.sleepGrowTrees();
    farmPlots.sleepOvernight();
    addNotice(
      tr(
        `⏩ เร่งเวลาการเติบโตของฟาร์มสำเร็จ (+${Math.round(seconds / 60)} นาที)`,
        `⏩ Accelerated growth (+${Math.round(seconds / 60)} min)`
      ),
      '#38bdf8'
    );
  }, [farmTrees, farmPlots, addNotice]);

  const handleGiveSaplings = useCallback((type: TreeType, amount: number) => {
    addSapling(type, amount);
  }, [addSapling]);

  const handleReviveAllTrees = useCallback(() => {
    let count = 0;
    trees.forEach((t) => {
      if (t.stage === 'withered') {
        farmTrees.reviveTree(t.id, addXP);
        count++;
      }
    });
    if (count > 0) {
      addNotice(
        tr(
          `✨ ชุบชีวิตต้นไม้เหี่ยวเฉาทั้งหมด ${count} ต้นสำเร็จ!`,
          `✨ Revived all ${count} withered trees!`
        ),
        '#81c784'
      );
    } else {
      addNotice(
        tr('ไม่มีต้นไม้ที่เหี่ยวเฉาในฟาร์มขณะนี้', 'No withered trees found on farm'),
        '#94a3b8'
      );
    }
  }, [trees, farmTrees, addXP, addNotice]);

  const [proximityNearPond, setNearPond] = useState(false);
  const nearPond = !isPlayerHidden && proximityNearPond;
  const [isFishingOpen, setIsFishingOpen] = useState(false);
  const handleOpenFishing = useCallback(() => {
    flushAllPendingFarmSaves();
    setIsFishingOpen(true);
  }, []);
  const handleCloseFishing = useCallback(() => {
    setIsFishingOpen(false);
    refreshFishBag();
    flushAllPendingFarmSaves();
  }, [refreshFishBag]);

  useEffect(() => {
    refreshFishBag();
    return subscribeFishBagChanged(refreshFishBag);
  }, [refreshFishBag]);

  const fishBagTotalCoins = useMemo(
    () => fishBag.reduce((sum, item) => sum + getFishShopPrice(item), 0),
    [fishBag]
  );

  const handleSellSingleFish = useCallback(
    (recordId: string) => {
      void sellFishInShop(recordId).then((res) => {
        if (!res.sold) return;
        setFishBag(res.remaining);
        farmAudio.playCoinSound();
        earnCoins(res.coinsEarned);
        addXP(res.xpEarned);
        setFishSaleTrigger((prev) => ({
          seq: prev.seq + 1,
          houseId: activeFishShopHouseId ?? nearHouse?.id,
        }));
        const lang = getCurrentLang();
        const sp = getFishSpeciesInfo(res.sold.speciesId, lang);
        addNotice(
          tr(
            `🐟 ขาย${sp.name} (${res.sold.weightKg.toFixed(2)} kg) ได้รับ +${res.coinsEarned} 🪙 (+${res.xpEarned} XP)`,
            `🐟 Sold ${sp.name} (${res.sold.weightKg.toFixed(2)} kg) for +${res.coinsEarned} 🪙 (+${res.xpEarned} XP)`
          ),
          '#38bdf8'
        );
      });
    },
    [earnCoins, addXP, addNotice, activeFishShopHouseId, nearHouse?.id]
  );

  const handleSellAllCaughtFish = useCallback(
    (houseId?: string) => {
      void sellAllFishInShop().then((res) => {
        if (res.count <= 0) {
          addNotice(
            tr(
              '🐟 ยังไม่มีปลาในกระเป๋า ไปตกปลาที่สระน้ำก่อนนำมาขายนะครับ',
              '🐟 Keepnet is empty — catch fish at the pond first!'
            ),
            '#94a3b8'
          );
          return;
        }
        setFishBag(res.remaining);
        farmAudio.playCoinSound();
        earnCoins(res.coinsEarned);
        addXP(res.xpEarned);
        setFishSaleTrigger((prev) => ({
          seq: prev.seq + 1,
          houseId: houseId ?? activeFishShopHouseId ?? nearHouse?.id,
        }));
        addNotice(
          tr(
            `💰 ขายปลาสด ${res.count} ตัว (${res.totalWeightKg.toFixed(2)} kg) รับเงิน +${res.coinsEarned} 🪙 (+${res.xpEarned} XP)`,
            `💰 Sold ${res.count} fresh fish (${res.totalWeightKg.toFixed(2)} kg) for +${res.coinsEarned} 🪙 (+${res.xpEarned} XP)`
          ),
          '#facc15'
        );
      });
    },
    [earnCoins, addXP, addNotice, activeFishShopHouseId, nearHouse?.id]
  );

  const [isLoadingScreenOpen, setIsLoadingScreenOpen] = useState(isFreshReset);
  const [resetCameraTrigger, setResetCameraTrigger] = useState(0);
  const [openLeftMenu, setOpenLeftMenu] = useState<'build' | 'tools' | null>(null);

  useEffect(() => {
    if (isFreshReset) {
      addNotice(
        tr(
          '🌱 เริ่มเล่นเกมใหม่เรียบร้อยแล้ว! เริ่มต้นสร้างฟาร์มจากศูนย์',
          '🌱 Started a fresh new game! Build your farm from Day 1'
        ),
        '#81c784'
      );
    }
  }, [isFreshReset, addNotice]);

  const workerQuartersCount = useMemo(
    () => Math.min(3, houses.filter((h) => h.type === 18).length),
    [houses]
  );
  const hasWorkerQuarters = workerQuartersCount > 0;
  const workerBonusRate = workerQuartersCount * 0.1;

  const statsRef = useRef(stats);
  statsRef.current = stats;
  const plotsRef = useRef(plots);
  plotsRef.current = plots;
  const treesRef = useRef(trees);
  treesRef.current = trees;
  const housesRef = useRef(houses);
  housesRef.current = houses;
  const rocksRef = useRef(rocks);
  rocksRef.current = rocks;
  const inventorySeedsRef = useRef(inventorySeeds);
  inventorySeedsRef.current = inventorySeeds;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const harvestPlotsBatch = useCallback(
    (ids: string[]): HarvestResult[] => {
      const out: HarvestResult[] = [];
      const curPlots = plotsRef.current;
      const curSeeds = inventorySeedsRef.current;
      for (const id of ids) {
        const plot = curPlots.find((p) => String(p.id) === id);
        if (!plot || plot.status !== 'READY' || !plot.cropType) continue;

        interactPlot(
          plot.id,
          'sickle',
          selectedSeed,
          curSeeds[selectedSeed] || 0,
          spendSeed,
          addCrop,
          addSeed,
          addXP,
          spendCoins
        );

        const cropDef = CROP_DEFINITIONS[plot.cropType];
        const bonusCoins =
          workerBonusRate > 0
            ? Math.max(1, Math.round((cropDef?.sellPrice ?? 0) * workerBonusRate))
            : 0;
        if (bonusCoins > 0) {
          earnCoins(bonusCoins);
        }

        out.push({
          targetId: id,
          type: 'plot',
          itemId: String(plot.cropType),
          itemName: getCropName(plot.cropType),
          quantity: 1,
          xp: cropDef?.xpReward ?? 0,
          coins: bonusCoins,
        });
      }
      return out;
    },
    [interactPlot, selectedSeed, spendSeed, addCrop, addSeed, addXP, earnCoins, spendCoins, workerBonusRate]
  );

  const harvestTreesBatch = useCallback(
    (ids: string[]): HarvestResult[] => {
      const out: HarvestResult[] = [];
      const curTrees = treesRef.current;
      for (const id of ids) {
        const tree = curTrees.find((trItem) => trItem.id === id);
        const treeDef = tree ? TREE_DEFINITIONS[tree.type] : undefined;
        if (!tree || tree.stage !== 'ready' || !treeDef?.isFruitTree) continue;

        const harvested = harvestTree(tree.id, addTreeHarvest, addSapling, addXP);
        if (!harvested) continue;

        const yieldCount = 4;
        const bonusCoins =
          workerBonusRate > 0
            ? Math.max(1, Math.round(treeDef.fruitSellPrice * yieldCount * workerBonusRate))
            : 0;
        if (bonusCoins > 0) {
          earnCoins(bonusCoins);
        }

        out.push({
          targetId: id,
          type: 'tree',
          itemId: tree.type,
          itemName: getTreeName(tree.type),
          quantity: yieldCount,
          xp: treeDef.xpReward,
          coins: bonusCoins,
        });
      }
      return out;
    },
    [harvestTree, addTreeHarvest, addSapling, addXP, earnCoins, workerBonusRate]
  );

  const handleHarvestNotice = useCallback(
    (msg: string, type: 'info' | 'success' | 'error' = 'info') =>
      addNotice(
        msg,
        type === 'error' ? '#ef5350' : type === 'success' ? '#81c784' : '#90caf9'
      ),
    [addNotice]
  );

  const consumeStamina = useCallback(
    (n: number) => {
      if (statsRef.current.stamina < n) return false;
      setStats((prev) => ({ ...prev, stamina: Math.max(0, prev.stamina - n) }));
      return true;
    },
    [setStats]
  );

  const getStamina = useCallback(() => statsRef.current.stamina, []);

  const harvest = useHarvestMode({
    isPlacementActive: !!placing,
    getStamina,
    consumeStamina,
    harvestPlots: harvestPlotsBatch,
    harvestTrees: harvestTreesBatch,
    onNotice: handleHarvestNotice,
    cooldownMs: 800,
    continuous: true,
    staminaPerPlot: 1,
    staminaPerTree: 2,
  });

  useEffect(() => {
    if (placing) {
      setOpenLeftMenu(null);
      setFingerNearHouseId(null);
      if (harvest.isActive) harvest.exit();
      if (isMovingPlotMode) {
        setIsMovingPlotMode(false);
        setSelectedPlotToMove(null);
      }
    }
  }, [placing, harvest, isMovingPlotMode]);

  const readyTargets = useMemo((): HarvestTarget[] => {
    if (harvest.phase === 'IDLE') return [];
    const plotTargets: HarvestTarget[] = plots
      .filter((p) => p.status === 'READY')
      .map((p) => ({ type: 'plot', id: String(p.id), isReady: true }));
    const treeTargets: HarvestTarget[] = trees
      .filter((trItem) => trItem.stage === 'ready' && TREE_DEFINITIONS[trItem.type]?.isFruitTree)
      .map((trItem) => ({ type: 'tree', id: trItem.id, isReady: true }));
    return [...plotTargets, ...treeTargets];
  }, [harvest.phase, plots, trees]);

  const resolveWorldPos = useCallback((target: HarvestTarget): THREE.Vector3 | null => {
    if (target.type === 'plot') {
      const p = plotsRef.current.find((x) => String(x.id) === target.id);
      if (!p) return null;
      if (typeof p.worldX === 'number' && typeof p.worldZ === 'number') {
        return new THREE.Vector3(p.worldX, 0, p.worldZ);
      }
      if (typeof p.gridX === 'number' && typeof p.gridZ === 'number') {
        const { x, z } = gridToWorld(p.gridX, p.gridZ);
        return new THREE.Vector3(x, 0, z);
      }
      return null;
    }
    const trItem = treesRef.current.find((x) => x.id === target.id);
    if (!trItem) return null;
    if (typeof trItem.worldX === 'number' && typeof trItem.worldZ === 'number') {
      return new THREE.Vector3(trItem.worldX, 0, trItem.worldZ);
    }
    if (typeof trItem.gridX === 'number' && typeof trItem.gridZ === 'number') {
      const { x, z } = gridToWorld(trItem.gridX, trItem.gridZ);
      return new THREE.Vector3(x, 0, z);
    }
    return null;
  }, []);

  const hasStartedAudio = useRef(false);
  const ensureAudioStarted = useCallback(() => {
    if (!hasStartedAudio.current) {
      if (musicEnabled) farmAudio.startAmbientMusic();
      hasStartedAudio.current = true;
    }
  }, [musicEnabled]);

  const handlePondInteract = useCallback(() => {
    ensureAudioStarted();
    farmAudio.playWaterSound();
    handleOpenFishing();
  }, [ensureAudioStarted, handleOpenFishing]);

  useEffect(() => {
    if (!hasStartedAudio.current && !isFishingOpen) return;
    farmAudio.setMusicEnabled(isFishingOpen ? false : musicEnabled);
  }, [isFishingOpen, musicEnabled]);

  const handleCycleTime = useCallback(() => {
    ensureAudioStarted();
    const cycle: TimeOfDay[] = ['morning', 'day', 'sunset', 'night'];
    const next = cycle[(cycle.indexOf(timeOfDay) + 1) % cycle.length];
    setTimeOfDay(next);
    if (next === 'night') {
      setSkyVistaEnabled(true);
      addNotice(
        tr(
          '🌙 ยามค่ำคืน (21:30): พระจันทร์และดวงดาวส่องสว่างบนท้องฟ้าเหนือฟาร์ม',
          '🌙 Nightfall (21:30): The Moon and stars illuminate the sky above your farm'
        ),
        '#a5b4fc'
      );
    } else if (next === 'sunset') {
      addNotice(
        tr(
          '🌅 ยามพลบค่ำ (17:45): ดาวดวงแรกและพระจันทร์เริ่มทอแสงบนขอบฟ้า',
          '🌅 Dusk (17:45): Early stars and the rising moon appear on the horizon'
        ),
        '#fdba74'
      );
    } else {
      setSkyVistaEnabled(false);
    }
  }, [ensureAudioStarted, timeOfDay, addNotice]);

  const handleToggleSkyVista = useCallback(() => {
    ensureAudioStarted();
    if (cameraMode !== 'isometric') {
      setCameraMode('isometric');
      setSkyVistaEnabled(true);
      addNotice(
        tr(
          '🔭 เปิดมุมมองชมท้องฟ้า/พระจันทร์/ดวงดาว (ยังลากจอ 1 นิ้วแบบ Hay Day ได้ปกติ)',
          '🔭 Sky Vista enabled (1-finger Hay Day panning remains active)'
        ),
        '#93c5fd'
      );
      return;
    }
    const next = !skyVistaEnabled;
    setSkyVistaEnabled(next);
    addNotice(
      next
        ? tr(
            '🔭 เงยกล้องชมวิวท้องฟ้า พระจันทร์ และหมู่ดาวเหนือฟาร์ม',
            '🔭 Tilted camera to frame the sky, Moon, and stars'
          )
        : tr(
            '📐 กลับสู่มุมมองสูงทำฟาร์มมาตรฐานแบบ Hay Day',
            '📐 Returned to standard Hay Day farming camera angle'
          ),
      next ? '#93c5fd' : '#86efac'
    );
  }, [ensureAudioStarted, cameraMode, skyVistaEnabled, addNotice]);

  const handleToggleSoundEffects = useCallback(() => {
    ensureAudioStarted();
    const next = !soundEffectsEnabled;
    farmAudio.setMuted(!next);
    safeSetLocalStorageItem('beam_farm_sound_sfx_enabled', String(next));
    setSoundEffectsEnabled(next);
  }, [ensureAudioStarted, soundEffectsEnabled]);

  const handleToggleMusic = useCallback(() => {
    ensureAudioStarted();
    const next = !musicEnabled;
    farmAudio.setMusicEnabled(next);
    safeSetLocalStorageItem('beam_farm_music_enabled', String(next));
    setMusicEnabled(next);
  }, [ensureAudioStarted, musicEnabled]);

  const handleSaveGameNow = useCallback(() => {
    ensureAudioStarted();
    flushAllPendingFarmSaves();
    farmAudio.playCoinSound();
    addNotice(
      tr(
        '💾 บันทึกเซฟฟาร์มลงเครื่องและฐานข้อมูลสำรองเรียบร้อยแล้ว!',
        '💾 Farm progress saved to device & backup database!'
      ),
      '#4ade80'
    );
  }, [ensureAudioStarted, addNotice]);

  const handleResetProgress = useCallback(() => {
    wipeAllFarmSaveData();
    if (onResetGameSession) {
      onResetGameSession();
    } else {
      window.location.reload();
    }
  }, [onResetGameSession]);

  const handleCycleCameraMode = useCallback(() => {
    ensureAudioStarted();
    const modes: CameraMode[] = isPlayerHidden
      ? ['isometric', 'topdown']
      : ['isometric', 'follow', 'fpp', 'topdown'];
    const curIdx = modes.indexOf(cameraMode);
    const next = modes[(curIdx === -1 ? 0 : curIdx + 1) % modes.length];
    setCameraMode(next);
    const modeNames: Record<CameraMode, string> = {
      isometric: tr('📐 Isometric (มุมมองเฉียง 3D)', '📐 Isometric 3D View'),
      follow: tr('🎥 Follow (กล้องตามหลังตัวละคร)', '🎥 Third-Person Follow (TPP)'),
      fpp: tr('👁️ FPP (มุมมองบุคคลที่หนึ่ง สายตาตัวละคร)', '👁️ First-Person View (FPP)'),
      topdown: tr('🗺️ Top-down (มุมมองจากด้านบน)', '🗺️ Top-Down View'),
    };
    addNotice(
      tr(`📷 มุมกล้อง: ${modeNames[next]}`, `📷 Camera: ${modeNames[next]}`),
      '#b388ff'
    );
  }, [cameraMode, isPlayerHidden, ensureAudioStarted, addNotice]);

  const handleTogglePlayerHidden = useCallback(() => {
    ensureAudioStarted();
    const next = !isPlayerHidden;
    safeSetLocalStorageItem('beam_farm_player_hidden', String(next));
    if (next) {
      if (cameraMode === 'fpp' || cameraMode === 'follow') {
        setCameraMode('isometric');
      }
      setFingerNearHouseId(null);
    }
    setIsPlayerHidden(next);
    addNotice(
      next
        ? tr(
            '👆 ซ่อนตัวละครชาย/หญิงแล้ว! ใช้นิ้วแตะทำฟาร์ม เก็บผลผลิต เข้าอาคาร และตกปลาได้ทุกจุดเหมือน Hay Day',
            '👆 Farmer hidden! Tap plots, trees, buildings, animals & pond directly with your finger like Hay Day'
          )
        : tr(
            playerGender === 'female'
              ? '👩 แสดงตัวละครชาวไร่หญิงแล้ว (ยังใช้นิ้วแตะทำฟาร์มได้ทุกจุดเหมือนเดิม)'
              : '👨 แสดงตัวละครชาวไร่ชายแล้ว (ยังใช้นิ้วแตะทำฟาร์มได้ทุกจุดเหมือนเดิม)',
            playerGender === 'female'
              ? '👩 Female farmer shown (direct finger actions still active everywhere)'
              : '👨 Male farmer shown (direct finger actions still active everywhere)'
          ),
      next ? '#38bdf8' : '#4ade80'
    );
  }, [ensureAudioStarted, isPlayerHidden, cameraMode, playerGender, addNotice]);

  const handleToggleFingerSwipe = useCallback(() => {
    ensureAudioStarted();
    const next = !fingerSwipeEnabled;
    safeSetLocalStorageItem('beam_farm_finger_swipe_enabled', String(next));
    if (next && touchSlideEnabled) {
      setTouchSlideEnabled(false);
      safeSetLocalStorageItem('beam_farm_touch_slide_walk_v2', 'false');
    }
    setFingerSwipeEnabled(next);
    addNotice(
      next
        ? tr(
            '🌾 เปิดโหมดปาดนิ้วรวดเดียว (Hay Day Swipe)! ลาก 1 นิ้วผ่านแปลงผัก/ต้นผลไม้เพื่อเก็บ-รดน้ำ-ปลูกต่อเนื่อง (2 นิ้วเลื่อนจอ)',
            '🌾 Hay Day Swipe Brush ON! Drag 1 finger across crops & fruit trees to farm in one stroke (2 fingers pan camera)'
          )
        : tr(
            '🖐️ ปิดโหมดปาดนิ้ว — ลาก 1 นิ้วเลื่อนดูฟาร์มลื่นๆ และแตะแปลง/อาคารด้วยนิ้วได้ทุกจุด',
            '🖐️ Swipe Brush OFF — Smooth 1-finger camera pan restored (tap any plot or building directly)'
          ),
      next ? '#facc15' : '#86efac'
    );
  }, [ensureAudioStarted, fingerSwipeEnabled, touchSlideEnabled, addNotice]);

  const handleToggleMovementLock = useCallback(() => {
    ensureAudioStarted();
    const next = !isPlayerLocked;
    setIsPlayerLocked(next);
    addNotice(
      next
        ? tr(
            '🔒 ล็อกการเดินของตัวละครแล้ว (ไม่เดินด้วยปุ่ม WASD หรือการแตะบนมือถือ)',
            '🔒 Farmer movement locked'
          )
        : tr(
            '🔓 ปลดล็อกการเดิน (เดินได้ด้วยปุ่ม W/A/S/D หรือแตะบนมือถือ)',
            '🔓 Farmer movement unlocked'
          ),
      next ? '#ef5350' : '#81c784'
    );
  }, [ensureAudioStarted, isPlayerLocked, addNotice]);

  const handleToggleWasd = useCallback(() => {
    ensureAudioStarted();
    const next = !wasdEnabled;
    try {
      localStorage.setItem('beam_farm_wasd_enabled', String(next));
    } catch {}
    setWasdEnabled(next);
    addNotice(
      next
        ? tr(
            '⌨️ เปิดใช้งานเดินด้วยปุ่ม W / A / S / D แล้ว',
            '⌨️ Enabled W / A / S / D keyboard movement'
          )
        : tr(
            '⌨️ ปิดใช้งานเดินด้วยปุ่ม W / A / S / D',
            '⌨️ Disabled W / A / S / D keyboard movement'
          ),
      next ? '#81c784' : '#ffb74d'
    );
  }, [ensureAudioStarted, wasdEnabled, addNotice]);

  const handleToggleTouchSlide = useCallback(() => {
    ensureAudioStarted();
    const next = !touchSlideEnabled;
    try {
      localStorage.setItem('beam_farm_touch_slide_walk_v2', String(next));
    } catch {}
    if (next && fingerSwipeEnabled) {
      setFingerSwipeEnabled(false);
      safeSetLocalStorageItem('beam_farm_finger_swipe_enabled', 'false');
    }
    if (next && isPlayerHidden) {
      setIsPlayerHidden(false);
      safeSetLocalStorageItem('beam_farm_player_hidden', 'false');
    }
    setTouchSlideEnabled(next);
    addNotice(
      next
        ? tr(
            '📱 สลับเป็นโหมดเลื่อน 1 นิ้วเพื่อเดินตัวละคร (ใช้ 2 นิ้วลากจอกล้อง)',
            '📱 Switched to 1-finger slide-to-walk (use 2 fingers to pan camera)'
          )
        : tr(
            '🌾 เปิดโหมดลากหน้าจอแบบ Hay Day 100% แล้ว! (ลาก 1 นิ้วเลื่อนดูฟาร์มลื่นๆ)',
            '🌾 Enabled 100% Hay Day 1-finger camera panning!'
          ),
      next ? '#ffb74d' : '#4ade80'
    );
  }, [ensureAudioStarted, touchSlideEnabled, fingerSwipeEnabled, isPlayerHidden, addNotice]);

  const handleToggleStructureEdit = useCallback(() => {
    ensureAudioStarted();
    const next = !structureEditEnabled;
    try {
      localStorage.setItem('beam_farm_structure_edit_enabled', String(next));
    } catch {}
    if (!next) {
      setSelectedHouseId(null);
      setSelectedRockId(null);
    }
    setStructureEditEnabled(next);
    addNotice(
      next
        ? tr(
            '🏗️ เปิดการย้าย/หมุน/เก็บสิ่งปลูกสร้างและของตกแต่งแล้ว',
            '🏗️ Enabled building & decoration Move/Rotate/Store bar'
          )
        : tr(
            '🏗️ ปิดป้ายย้าย/หมุน/เก็บเมื่อกดสิ่งปลูกสร้างแล้ว',
            '🏗️ Disabled building & decoration edit bar'
          ),
      next ? '#ffd54f' : '#90caf9'
    );
  }, [ensureAudioStarted, structureEditEnabled, addNotice, setSelectedHouseId, setSelectedRockId]);

  const handleChangeStructureEditClickMode = useCallback(
    (mode: 'double' | 'single') => {
      ensureAudioStarted();
      setStructureEditClickMode(mode);
      try {
        localStorage.setItem('beam_farm_structure_edit_click_mode', mode);
      } catch {}
      addNotice(
        mode === 'double'
          ? tr(
              '🖱️ ตั้งเป็น: ดับเบิลคลิกเมาส์ซ้ายเพื่อแสดงป้ายย้าย/หมุน/เก็บ',
              '🖱️ Set to: Double-click left mouse to edit buildings'
            )
          : tr(
              '🖱️ ตั้งเป็น: คลิกซ้าย 1 ครั้งเพื่อแสดงป้ายย้าย/หมุน/เก็บ',
              '🖱️ Set to: Single-click to edit buildings'
            ),
        '#ffd54f'
      );
    },
    [ensureAudioStarted, addNotice]
  );

  const handleSetGraphicsQualityMode = useCallback(
    (mode: GraphicsQualityMode) => {
      ensureAudioStarted();
      if (graphicsQualityMode === mode) return;
      saveGraphicsQualityMode(mode);
      setGraphicsQualityMode(mode);
      setUltra4kEnabled(mode === 'ultra4k');
      if (mode === 'smooth') {
        addNotice(
          tr(
            '⚡ เปิดโหมดลื่นไหลมือถือ (Smooth 60 FPS) แล้ว!',
            '⚡ Enabled Mobile Smooth 60 FPS Mode!'
          ),
          '#34d399'
        );
      } else if (mode === 'ultra4k') {
        addNotice(
          tr(
            '🖥️ เปิดโหมดภาพคมชัดระดับ 4K Ultra HD (3840×2160) แล้ว!',
            '🖥️ Enabled 4K Ultra HD (3840×2160) Graphics!'
          ),
          '#38bdf8'
        );
      } else {
        addNotice(
          tr(
            '🖥️ เปลี่ยนเป็นความละเอียดภาพมาตรฐาน (Standard HD) แล้ว',
            '🖥️ Switched to Standard HD Graphics'
          ),
          '#a5d6a7'
        );
      }
    },
    [ensureAudioStarted, graphicsQualityMode, addNotice]
  );

  const handleSetUltra4k = useCallback(
    (enabled: boolean) => {
      handleSetGraphicsQualityMode(enabled ? 'ultra4k' : 'standard');
    },
    [handleSetGraphicsQualityMode]
  );

  const handleToggleUltra4k = useCallback(() => {
    handleSetGraphicsQualityMode(ultra4kEnabled ? 'smooth' : 'ultra4k');
  }, [handleSetGraphicsQualityMode, ultra4kEnabled]);

  const handleToggleFarmerGender = useCallback(() => {
    ensureAudioStarted();
    if (isPlayerHidden) {
      setIsPlayerHidden(false);
      safeSetLocalStorageItem('beam_farm_player_hidden', 'false');
    }
    setPlayerGender((prev) => {
      const order: FarmerGender[] = ['male', 'female', 'boy', 'girl'];
      const next: FarmerGender = order[(order.indexOf(prev) + 1) % order.length];
      const label: Record<FarmerGender, string> = {
        male: tr('เปลี่ยนตัวละครเป็น: 👨 ชาวไร่หนุ่มหมวกฟาง', 'Switched character: 👨 Male Farmer'),
        female: tr('เปลี่ยนตัวละครเป็น: 👩 ชาวไร่สาวผมเปีย', 'Switched character: 👩 Female Farmer'),
        boy: tr('เปลี่ยนตัวละครเป็น: 👦 เด็กชาย', 'Switched character: 👦 Boy'),
        girl: tr('เปลี่ยนตัวละครเป็น: 👧 เด็กหญิง', 'Switched character: 👧 Girl'),
      };
      addNotice(label[next], '#ffd54f');
      return next;
    });
  }, [ensureAudioStarted, isPlayerHidden, addNotice]);

  const handleUpdatePlayerOutfit = useCallback(
    (updater: PlayerOutfitConfig | ((prev: PlayerOutfitConfig) => PlayerOutfitConfig)) => {
      ensureAudioStarted();
      setPlayerOutfit((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    },
    [ensureAudioStarted]
  );

  const handleResetPlayerOutfit = useCallback(() => {
    ensureAudioStarted();
    setPlayerOutfit({ ...DEFAULT_PLAYER_OUTFIT, parts: {} });
    addNotice(
      tr('👕 คืนค่าชุดเครื่องแต่งกายดั้งเดิมแล้ว', '👕 Restored default farmer outfit'),
      '#93c5fd'
    );
  }, [ensureAudioStarted, addNotice]);

  const handleFocusHouseCamera = useCallback(
    (x: number, z: number) => {
      ensureAudioStarted();
      if (cameraMode === 'fpp') {
        setCameraMode('isometric');
      }
      setCameraFocusRequest((prev) => ({ seq: prev.seq + 1, mode: 'house', x, z }));
    },
    [ensureAudioStarted, cameraMode]
  );

  const handleFocusPlayerCamera = useCallback(() => {
    ensureAudioStarted();
    if (isPlayerHidden) {
      setIsPlayerHidden(false);
      safeSetLocalStorageItem('beam_farm_player_hidden', 'false');
    }
    if (cameraMode === 'fpp') {
      setCameraMode('isometric');
    }
    setCameraFocusRequest((prev) => ({ seq: prev.seq + 1, mode: 'player' }));
  }, [ensureAudioStarted, isPlayerHidden, cameraMode]);

  const handleToggleMovingPlotMode = useCallback(() => {
    ensureAudioStarted();
    const next = !isMovingPlotMode;
    setSelectedPlotToMove(null);
    if (next) {
      if (harvest.isActive) harvest.exit();
      if (placing) handleCancelPlacing();
    }
    setIsMovingPlotMode(next);
    addNotice(
      next
        ? tr(
            '📍 โหมดย้ายแปลงผัก: แตะแปลงที่ต้องการย้าย แล้วแตะพื้นดินเพื่อวางใหม่',
            '📍 Move Plot Mode: Tap a crop plot, then tap open soil to relocate'
          )
        : tr('ปิดโหมดย้ายแปลงผัก', 'Exited Move Plot Mode'),
      next ? '#ffb74d' : '#90caf9'
    );
  }, [ensureAudioStarted, isMovingPlotMode, addNotice, harvest, placing, handleCancelPlacing]);

  const checkPoiCooldown = useCallback(
    (poiId: string, durationSec: number): boolean => {
      const now = Date.now();
      const readyAt = poiCooldownsRef.current[poiId] || 0;
      if (now < readyAt) {
        const remaining = Math.ceil((readyAt - now) / 1000);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const timeStrTh = mins > 0 ? `${mins} นาที ${secs} วินาที` : `${secs} วินาที`;
        const timeStrEn = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        addNotice(
          tr(
            `⏳ ผลผลิตกำลังเตรียมพร้อม (รออีก ${timeStrTh})`,
            `⏳ Preparing facility (${timeStrEn} remaining)`
          ),
          '#ffb74d'
        );
        return false;
      }
      setPoiCooldowns((prev) => ({ ...prev, [poiId]: now + durationSec * 1000 }));
      return true;
    },
    [addNotice]
  );

  const handleCollectDuckCoop = useCallback(
    (coopId: string) => {
      ensureAudioStarted();
      if (!checkPoiCooldown(coopId, 35)) return;
      farmAudio.playDuckSound();
      farmAudio.playHarvestSound();
      addDuckProduce(2, 2);
      addXP(12);
      addNotice(
        tr(
          '🦆 เก็บไข่เป็ดสด +2 ฟอง & ขนเป็ดนุ่ม +2 เส้นจากเล้าเป็ด! (+12 XP)',
          '🦆 Collected +2 Fresh Duck Eggs & +2 Soft Duck Feathers! (+12 XP)'
        ),
        '#facc15'
      );
    },
    [ensureAudioStarted, checkPoiCooldown, addDuckProduce, addXP, addNotice]
  );

  const handleSleep = useCallback(() => {
    farmAudio.playRoosterSound();
    setTimeOfDay('morning');
    setSkyVistaEnabled(false);
    sleepOvernight();
    sleepGrowTrees();
    const workerBonus = Math.min(30, workerQuartersCount * 10);
    const duckCoopCount = Math.min(4, housesRef.current.filter((h) => h.type === 24).length);
    if (duckCoopCount > 0) {
      addDuckProduce(duckCoopCount * 2, duckCoopCount);
    }
    const chickenCoopCount = Math.min(4, housesRef.current.filter((h) => h.type === 5).length);
    if (chickenCoopCount > 0) {
      addDuckProduce(chickenCoopCount * 3, 0);
      earnCoins(chickenCoopCount * 25);
    }
    setStats((prev) => ({
      ...prev,
      day: prev.day + 1,
      stamina: prev.maxStamina,
    }));
    setShowHouseInterior(false);
    addNotice(
      workerBonus > 0
        ? tr(
            `☀️ อรุณสวัสดิ์วันที่ ${stats.day + 1}! พลังกายฟื้นฟูเต็ม 100% (คนสวนช่วยดูแลฟาร์ม +${workerBonus} โบนัสผลผลิต)`,
            `☀️ Good morning, Day ${stats.day + 1}! Stamina 100% restored (Farmhands gave +${workerBonus} harvest bonus)`
          )
        : tr(
            `☀️ อรุณสวัสดิ์วันที่ ${stats.day + 1}! พลังกายฟื้นฟูเต็ม 100%`,
            `☀️ Good morning, Day ${stats.day + 1}! Stamina 100% restored`
          ),
      '#81c784'
    );
    if (duckCoopCount > 0) {
      addNotice(
        tr(
          `🦆 เช้านี้เล้าเป็ดออกผลผลิตใหม่: ไข่เป็ดสด +${duckCoopCount * 2} ฟอง & ขนเป็ด +${duckCoopCount} เส้น!`,
          `🦆 Morning Duck Coop yield: +${duckCoopCount * 2} Duck Eggs & +${duckCoopCount} Feather(s)!`
        ),
        '#fde047'
      );
    }
  }, [
    setStats,
    stats.day,
    addNotice,
    sleepOvernight,
    sleepGrowTrees,
    workerQuartersCount,
    addDuckProduce,
    setShowHouseInterior,
  ]);

  useEffect(() => {
    syncCoveredPlots(houses);
  }, [houses, syncCoveredPlots]);

  const handlePlantCoveredCrop = useCallback(
    (houseId: string, crop: CropType) => {
      ensureAudioStarted();
      plantCoveredHouseCrop(
        houseId,
        crop,
        (c) => inventorySeedsRef.current[c] || 0,
        (c) => {
          const ok = spendSeed(c);
          if (ok) {
            inventorySeedsRef.current = {
              ...inventorySeedsRef.current,
              [c]: Math.max(0, (inventorySeedsRef.current[c] || 0) - 1),
            };
          }
          return ok;
        },
        (cost) => spendCoins(cost),
        addXP
      );
    },
    [ensureAudioStarted, plantCoveredHouseCrop, spendSeed, spendCoins, addXP]
  );

  const handleWaterCoveredHouse = useCallback(
    (houseId: string) => {
      ensureAudioStarted();
      waterCoveredHouse(houseId, addXP);
    },
    [ensureAudioStarted, waterCoveredHouse, addXP]
  );

  const handleHarvestCoveredHouse = useCallback(
    (houseId: string) => {
      ensureAudioStarted();
      harvestCoveredHouse(houseId, addCrop, addSeed, addXP);
    },
    [ensureAudioStarted, harvestCoveredHouse, addCrop, addSeed, addXP]
  );

  const handlePlotClick = useCallback(
    (plotId: number) => {
      ensureAudioStarted();

      if (isMovingPlotMode) {
        const clickedPlot = plotsRef.current.find((p) => p.id === plotId);
        if (clickedPlot?.coveredByHouseId) {
          setIsMovingPlotMode(false);
          setSelectedPlotToMove(null);
          handleMoveHouseById(clickedPlot.coveredByHouseId);
          addNotice(
            tr(
              '🔄 เลือกย้ายแปลงผักแบบมีหลังคาทั้งหลังแล้ว! แตะตำแหน่งใหม่เพื่อวาง',
              '🔄 Moving the entire Covered Vegetable Plot! Tap a new spot to place'
            ),
            '#ffca28'
          );
          return;
        }
        setSelectedPlotToMove(plotId);
        addNotice(
          tr(
            `📍 เลือกแปลง #${plotId} แล้ว! ตอนนี้แตะจุดบนพื้นดินเพื่อย้ายไปวาง`,
            `📍 Selected Plot #${plotId}! Now tap any open soil cell to place it`
          ),
          '#ffca28'
        );
        return;
      }

      interactPlot(
        plotId,
        activeTool,
        selectedSeed,
        inventorySeedsRef.current[selectedSeed] || 0,
        (c) => {
          const ok = spendSeed(c);
          if (ok) {
            inventorySeedsRef.current = {
              ...inventorySeedsRef.current,
              [c]: Math.max(0, (inventorySeedsRef.current[c] || 0) - 1),
            };
          }
          return ok;
        },
        addCrop,
        addSeed,
        addXP,
        spendCoins
      );
    },
    [
      ensureAudioStarted,
      isMovingPlotMode,
      handleMoveHouseById,
      addNotice,
      interactPlot,
      activeTool,
      selectedSeed,
      spendSeed,
      addCrop,
      addSeed,
      addXP,
      spendCoins,
    ]
  );

  const canPlacePlotAt = useCallback(
    (gx: number, gz: number): { valid: boolean; reason?: string } => {
      const minGx = map2Unlocked ? -44 : GRID_MIN_X;
      if (gx < minGx || gx > GRID_MAX_X || gz < GRID_MIN_Z || gz > GRID_MAX_Z) {
        return {
          valid: false,
          reason: tr('❌ อยู่นอกขอบเขตพื้นที่ฟาร์ม', '❌ Outside farm boundary'),
        };
      }

      const { x, z } = gridToWorld(gx, gz);
      if (x > -43) {
        const terrain = isTerrainBlocked(x, z);
        if (terrain.blocked) {
          return {
            valid: false,
            reason: `❌ ${
              translatePlacementReason(terrain.reason) ||
              tr('วางแปลงบนน้ำหรือถนนไม่ได้', 'Cannot place plot on water or road')
            }`,
          };
        }
      }

      const curPlots = plotsRef.current;
      if (
        curPlots.some(
          (p) =>
            p.id !== selectedPlotToMove &&
            Math.abs(p.worldX - x) < 1.85 &&
            Math.abs(p.worldZ - z) < 1.85
        )
      ) {
        return {
          valid: false,
          reason: tr('❌ ตำแหน่งนี้มีแปลงปลูกผักอยู่แล้ว', '❌ This cell already has a crop plot'),
        };
      }

      const curHouses = housesRef.current;
      if (
        curHouses.some((h) => {
          const def = HOUSE_DEFS[h.type];
          if (def?.collisionBox) {
            const cos = Math.cos(-h.rot);
            const sin = Math.sin(-h.rot);
            const dx = x - h.x;
            const dz = z - h.z;
            const lx = dx * cos - dz * sin;
            const lz = dx * sin + dz * cos;
            return (
              Math.abs(lx) < def.collisionBox.w * 0.5 + 0.8 &&
              Math.abs(lz) < def.collisionBox.d * 0.5 + 0.8
            );
          }
          const coreRadius = Math.max(0.9, (def?.yard ?? 6) * 0.5 - 1.1);
          return Math.hypot(h.x - x, h.z - z) < coreRadius;
        })
      ) {
        return {
          valid: false,
          reason: tr('❌ ตำแหน่งนี้ทับตัวสิ่งปลูกสร้าง', '❌ Overlaps a structure'),
        };
      }

      const curTrees = treesRef.current;
      if (
        curTrees.some(
          (trItem) => Math.abs(trItem.worldX - x) < 1.75 && Math.abs(trItem.worldZ - z) < 1.75
        )
      ) {
        return {
          valid: false,
          reason: tr('❌ ตำแหน่งนี้มีต้นไม้อยู่แล้ว', '❌ Overlaps an existing tree'),
        };
      }

      const curRocks = rocksRef.current;
      if (
        curRocks.some(
          (r) => Math.hypot(r.x - x, r.z - z) < (r.type === 'rock_large' ? 1.9 : 1.35)
        )
      ) {
        return {
          valid: false,
          reason: tr('❌ ตำแหน่งนี้ทับก้อนหิน', '❌ Overlaps a rock'),
        };
      }

      return { valid: true };
    },
    [map2Unlocked, selectedPlotToMove]
  );

  const handleGridCellClick = useCallback(
    (gx: number, gz: number) => {
      ensureAudioStarted();
      const curPlots = plotsRef.current;
      const curHouses = housesRef.current;
      const curRocks = rocksRef.current;

      if (isMovingPlotMode) {
        if (selectedPlotToMove !== null) {
          const verdict = canPlacePlotAt(gx, gz);
          if (!verdict.valid) {
            if (verdict.reason) {
              addNotice(verdict.reason, '#ef5350');
            }
            return;
          }
          const { x, z } = gridToWorld(gx, gz);
          movePlot(selectedPlotToMove, x, z);
          setSelectedPlotToMove(null);
        }
        return;
      }

      if (openLeftMenu !== null) {
        setOpenLeftMenu(null);
      }
      if (selectedHouse) {
        setSelectedHouseId(null);
      }
      if (selectedAnimal) {
        setSelectedAnimalId(null);
      }
      if (selectedRock) {
        setSelectedRockId(null);
      }

      if (activeTool === 'tree_sapling') {
        plantTree(
          gx,
          gz,
          selectedSapling,
          spendSapling,
          addXP,
          curHouses,
          curPlots,
          curRocks,
          map2Unlocked
        );
      }
    },
    [
      isMovingPlotMode,
      selectedPlotToMove,
      canPlacePlotAt,
      map2Unlocked,
      movePlot,
      activeTool,
      selectedSapling,
      plantTree,
      spendSapling,
      addXP,
      ensureAudioStarted,
      addNotice,
      openLeftMenu,
      selectedHouse,
      selectedAnimal,
      selectedRock,
      setSelectedHouseId,
      setSelectedAnimalId,
      setSelectedRockId,
    ]
  );

  const lastTimberTreeTapRef = useRef<{ id: string; time: number } | null>(null);

  const handleTreeClick = useCallback(
    (treeId: string) => {
      ensureAudioStarted();
      const target = treesRef.current.find((trItem) => trItem.id === treeId);
      if (!target) return;

      if (activeTool === 'axe') {
        chopTree(treeId, addWood, addXP);
        return;
      }

      const treeDef = TREE_DEFINITIONS[target.type];

      if (target.stage === 'withered') {
        if (target.type === 'coconut' && target.harvestsCount === 3) {
          reviveTree(treeId, addXP);
          return;
        }
        chopTree(treeId, addWood, addXP);
        return;
      }

      if (target.stage === 'ready' && treeDef?.isFruitTree) {
        harvestTree(treeId, addTreeHarvest, addSapling, addXP);
        return;
      }

      if (
        !target.isWatered &&
        target.stage !== 'ready' &&
        (target.stage === 'sapling' ||
          target.stage === 'growing' ||
          target.stage === 'mature')
      ) {
        waterTree(treeId, addXP);
        return;
      }

      if (target.stage === 'ready' && !treeDef?.isFruitTree) {
        const now = performance.now();
        const prev = lastTimberTreeTapRef.current;
        if (prev && prev.id === treeId && now - prev.time <= 2600) {
          lastTimberTreeTapRef.current = null;
          chopTree(treeId, addWood, addXP);
          return;
        }
        lastTimberTreeTapRef.current = { id: treeId, time: now };
        const treeName = getTreeName(target.type);
        addNotice(
          tr(
            `🪓 ${treeName} โตเต็มวัย — แตะซ้ำอีกครั้งเพื่อตัดเก็บไม้ซุง (+${treeDef?.woodYield ?? 3} ท่อน)`,
            `🪓 Mature ${treeName} — Tap once more to harvest timber (+${treeDef?.woodYield ?? 3} wood)`
          ),
          '#fbbf24'
        );
        return;
      }

      if (activeTool === 'watering_can') {
        waterTree(treeId, addXP);
      } else if (activeTool === 'sickle' || activeTool === 'hand') {
        harvestTree(treeId, addTreeHarvest, addSapling, addXP);
      } else {
        const treeName = getTreeName(target.type);
        const stateDesc =
          target.stage === 'mature'
            ? tr('กำลังออกผล', 'Fruiting')
            : target.stage === 'growing'
              ? tr('กำลังเติบโต', 'Growing')
              : tr('ต้นกล้าเล็ก', 'Sapling');
        addNotice(
          tr(
            `🌳 ${treeName} (${stateDesc} • รดน้ำแล้ว รอโตเต็มที่)`,
            `🌳 ${treeName} (${stateDesc} • Watered & growing)`
          ),
          '#a5d6a7'
        );
      }
    },
    [
      activeTool,
      chopTree,
      addWood,
      addXP,
      waterTree,
      harvestTree,
      addTreeHarvest,
      addSapling,
      addNotice,
      ensureAudioStarted,
    ]
  );

  const brewingJobsRef = useRef(brewingJobs);
  brewingJobsRef.current = brewingJobs;
  const bakingJobsRef = useRef(bakingJobs);
  bakingJobsRef.current = bakingJobs;

  const handleHouseInteract = useCallback(
    (houseId: string) => {
      ensureAudioStarted();
      const house = housesRef.current.find((h) => h.id === houseId);
      if (!house) return;
      if (house.type === 19 || house.type === 23) return;

      setFingerNearHouseId(house.type === 30 ? house.id : null);
      const now = Date.now();

      switch (house.type) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 17: {
          farmAudio.playDoorSound();
          _setShowHouseInterior(true);
          return;
        }
        case 5: {
          if (!checkPoiCooldown(house.id, 1200)) return;
          farmAudio.playChickenSound();
          farmAudio.playHarvestSound();
          earnCoins(60);
          addXP(35);
          addDuckProduce(3, 0);
          addNotice(
            tr(
              '🥚 เก็บไข่ไก่สดเต็มตะกร้าจากเล้าไก่ +3 ฟอง, +60 🪙 (+35 XP)',
              '🥚 Collected full egg basket from Chicken Coop +3 Eggs, +60 🪙 (+35 XP)'
            ),
            '#facc15'
          );
          return;
        }
        case 6: {
          if (!checkPoiCooldown(house.id, 45)) return;
          farmAudio.playWaterSound();
          addXP(5);
          addNotice(
            tr(
              '🚰 เติมน้ำใส่บัวรดน้ำจากหอส่งน้ำเต็มเปี่ยม! (+5 XP)',
              '🚰 Refilled watering can at the Water Tower! (+5 XP)'
            ),
            '#38bdf8'
          );
          return;
        }
        case 7: {
          if (!checkPoiCooldown(house.id, 60)) return;
          farmAudio.playHarvestSound();
          earnCoins(18);
          addXP(10);
          addNotice(
            tr(
              '🌾 โม่แป้งสาลีด้วยกังหันลมโบราณสำเร็จ +18 🪙 (+10 XP)',
              '🌾 Milled golden flour at the Windmill +18 🪙 (+10 XP)'
            ),
            '#f59e0b'
          );
          return;
        }
        case 8: {
          if (!checkPoiCooldown(house.id, 90)) return;
          farmAudio.playCoinSound();
          earnCoins(25);
          addXP(12);
          addNotice(
            tr(
              '🚉 รถไฟขนส่งสินค้าแวะมารับผลผลิตที่สถานี! +25 🪙 (+12 XP)',
              '🚉 Freight train picked up farm cargo! +25 🪙 (+12 XP)'
            ),
            '#10b981'
          );
          return;
        }
        case 9: {
          addNotice(
            tr(
              '⚡ เสาไฟฟ้าแรงสูงจ่ายพลังงานหล่อเลี้ยงระบบฟาร์มอย่างเสถียร',
              '⚡ Power tower supplying clean energy across the farm'
            ),
            '#60a5fa'
          );
          return;
        }
        case 10: {
          if (!checkPoiCooldown(house.id, 45)) return;
          farmAudio.playCoinSound();
          addXP(3);
          addNotice(
            tr(
              '🏮 จุดโคมไฟโบราณ แสงไฟสลัวส่องสว่างอบอุ่นรอบพื้นที่ฟาร์ม (+3 XP)',
              '🏮 Lit the vintage lantern post (+3 XP)'
            ),
            '#fbbf24'
          );
          return;
        }
        case 11: {
          if (!checkPoiCooldown(house.id, 60)) return;
          farmAudio.playHarvestSound();
          earnCoins(20);
          addXP(10);
          addNotice(
            tr(
              '🚜 บรึ้มมม! สตาร์ตเครื่องยนต์แทรกเตอร์ ช่วยไถเตรียมดิน +20 🪙 (+10 XP)',
              '🚜 Started the farm tractor to till fields! +20 🪙 (+10 XP)'
            ),
            '#22c55e'
          );
          return;
        }
        case 12: {
          if (!checkPoiCooldown(house.id, 90)) return;
          farmAudio.playCoinSound();
          earnCoins(25);
          addXP(15);
          addNotice(
            tr(
              '🏘️ แวะเยี่ยมเยียนชาวบ้านในหมู่บ้านชนบท ได้รับของขวัญต้อนรับ +25 🪙 (+15 XP)',
              '🏘️ Visited neighbors at the Country Village! +25 🪙 (+15 XP)'
            ),
            '#38bdf8'
          );
          return;
        }
        case 13: {
          if (!checkPoiCooldown(house.id, 45)) return;
          addXP(3);
          addNotice(
            tr(
              '🪵 ตรวจเช็กเสาไฟฟ้าไม้ชนบท: สายไฟทำงานปกติ (+3 XP)',
              '🪵 Checked wooden utility pole: lines nominal (+3 XP)'
            ),
            '#a3e635'
          );
          return;
        }
        case 14: {
          if (!checkPoiCooldown(house.id, 45)) return;
          addXP(3);
          addNotice(
            tr(
              '🪜 ตรวจบันไดหนีไฟเหล็ก: แข็งแรงปลอดภัย (+3 XP)',
              '🪜 Inspected steel fire escape: sturdy & safe (+3 XP)'
            ),
            '#94a3b8'
          );
          return;
        }
        case 15: {
          if (!checkPoiCooldown(house.id, 45)) return;
          farmAudio.playHorseSound();
          earnCoins(20);
          addXP(10);
          addNotice(
            tr(
              '🐴 แปรงขนและให้อาหารหญ้าแห้งม้าในคอกม้า! +20 🪙 (+10 XP)',
              '🐴 Brushed & fed hay at the Horse Stable! +20 🪙 (+10 XP)'
            ),
            '#f59e0b'
          );
          return;
        }
        case 16: {
          if (!checkPoiCooldown(house.id, 45)) return;
          farmAudio.playCowSound();
          earnCoins(22);
          addXP(12);
          addNotice(
            tr(
              '🥛 รีดนมวัวสดและให้อาหารหญ้าแห้งในคอกวัว! +22 🪙 (+12 XP)',
              '🥛 Milked fresh dairy at the Cow Barn! +22 🪙 (+12 XP)'
            ),
            '#86efac'
          );
          return;
        }
        case 18: {
          if (!checkPoiCooldown(house.id, 60)) return;
          farmAudio.playDoorSound();
          earnCoins(30);
          addXP(15);
          setStats((prev) => ({
            ...prev,
            stamina: Math.min(prev.maxStamina, prev.stamina + 20),
          }));
          addNotice(
            tr(
              '🏡 คนสวนและคนงานช่วยดูแลฟาร์ม! ฟื้นฟูพลัง +20, รับโบนัสผลผลิต +30 🪙 (+15 XP)',
              '🏡 Farmhands tended the grounds! +20 Stamina, +30 🪙 (+15 XP)'
            ),
            '#a5d6a7'
          );
          return;
        }
        case 20: {
          const readyAt = poiCooldownsRef.current[house.id] || 0;
          if (now >= readyAt) {
            setPoiCooldowns((prev) => ({ ...prev, [house.id]: now + 60 * 1000 }));
            farmAudio.playHarvestSound();
            earnCoins(20);
            addXP(10);
            addNotice(
              tr(
                '🏭 คัดแยกผลผลิตเข้าโรงเก็บ (+20 🪙, +10 XP) & เปิดคลังสินค้า',
                '🏭 Sorted produce at Barn (+20 🪙, +10 XP) & opened Storage'
              ),
              '#bc8a5f'
            );
          } else {
            farmAudio.playDoorSound();
            const remaining = Math.ceil((readyAt - now) / 1000);
            addNotice(
              tr(
                `⏳ โรงเก็บกำลังจัดเรียงผลผลิตรอบใหม่ (รออีก ${remaining} วินาที)`,
                `⏳ Storage is sorting the next batch (${remaining}s remaining)`
              ),
              '#ffb74d'
            );
          }
          setIsInventoryOpen(true);
          return;
        }
        case 21: {
          if (!checkPoiCooldown(house.id, 30)) return;
          addXP(2);
          addNotice(
            tr(
              '🪨 ชื่นชมโขดหินริมน้ำอันเงียบสงบ (+2 XP)',
              '🪨 Admired the serene river rock (+2 XP)'
            ),
            '#94a3b8'
          );
          return;
        }
        case 22: {
          if (!checkPoiCooldown(house.id, 60)) return;
          farmAudio.playHarvestSound();
          earnCoins(10);
          addXP(5);
          addNotice(
            tr(
              '🌳 สำรวจต้นโอ๊คและเก็บกิ่งไม้แห้ง +10 🪙 (+5 XP)',
              '🌳 Explored Oak Trees & gathered branches +10 🪙 (+5 XP)'
            ),
            '#2e7d32'
          );
          return;
        }
        case 24: {
          handleCollectDuckCoop(house.id);
          return;
        }
        case 25: {
          const hasReadyBrew = brewingJobsRef.current.some(
            (j) => j.houseId === house.id && now >= j.finishAt
          );
          if (hasReadyBrew) {
            handleCollectAllReadyBrews(house.id);
            return;
          }
          farmAudio.playDoorSound();
          handleEnterBrewery(house.id);
          return;
        }
        case 26:
        case 27: {
          const hasReadyBake = bakingJobsRef.current.some(
            (j) => j.houseId === house.id && now >= j.finishAt
          );
          if (hasReadyBake) {
            handleCollectOvenBasket(house.id);
            return;
          }
          farmAudio.playDoorSound();
          handleEnterOven(house.id, house.type === 26 ? 'bakery' : 'pie_oven');
          return;
        }
        case 28: {
          farmAudio.playDoorSound();
          handleEnterFeedMill(house.id);
          return;
        }
        case 29: {
          farmAudio.playDoorSound();
          handleEnterFishShop(house.id);
          return;
        }
        case 30: {
          const beds = plotsRef.current.filter((p) => p.coveredByHouseId === house.id);
          const hasReady = beds.some((p) => p.status === 'READY');
          const hasDry = beds.some(
            (p) => (p.status === 'PLANTED' || p.status === 'GROWING') && !p.isWatered
          );
          if (hasReady) {
            handleHarvestCoveredHouse(house.id);
          } else if (hasDry) {
            handleWaterCoveredHouse(house.id);
          }
          return;
        }
        default:
          return;
      }
    },
    [
      ensureAudioStarted,
      checkPoiCooldown,
      earnCoins,
      addXP,
      addNotice,
      setStats,
      handleCollectDuckCoop,
      handleCollectAllReadyBrews,
      handleEnterBrewery,
      handleCollectOvenBasket,
      handleEnterOven,
      handleEnterFeedMill,
      handleEnterFishShop,
      handleHarvestCoveredHouse,
      handleWaterCoveredHouse,
    ]
  );

  const handleConfirmPlaceWithGhost = useCallback(
    (customGhost?: GhostState | AnimalGhostState | RockGhostState | null) => {
      handleConfirmPlace(
        statsRef.current.coins,
        spendCoins,
        statsRef.current.gems,
        spendGems,
        customGhost,
        earnGems
      );
    },
    [handleConfirmPlace, spendCoins, spendGems, earnGems]
  );

  const handleHouseSelect = useCallback(
    (id: string | null) => {
      setSelectedHouseId(id);
      if (id) {
        setSelectedAnimalId(null);
        setSelectedRockId(null);
      }
    },
    [setSelectedHouseId, setSelectedAnimalId, setSelectedRockId]
  );

  const handleAnimalSelect = useCallback(
    (id: string | null) => {
      setSelectedAnimalId(id);
      if (id) {
        setSelectedHouseId(null);
        setSelectedRockId(null);
      }
    },
    [setSelectedAnimalId, setSelectedHouseId, setSelectedRockId]
  );

  const handleRockSelect = useCallback(
    (id: string | null) => {
      setSelectedRockId(id);
      if (id) {
        setSelectedHouseId(null);
        setSelectedAnimalId(null);
      }
    },
    [setSelectedRockId, setSelectedHouseId, setSelectedAnimalId]
  );

  const handleAnimalPetFromScene = useCallback(
    (animal: (typeof animals)[number]) =>
      handlePetAnimal(animal, (xp) => {
        addXP(xp);
        if (animal.type === 'duck') {
          addDuckProduce(0, 1);
          addNotice(
            tr(
              '🪶 ได้รับขนเป็ดนุ่ม +1 เส้นจากการลูบดูแลเป็ด!',
              '🪶 Gathered +1 Soft Duck Feather from caring for your duck!'
            ),
            '#fef08a'
          );
        } else if (animal.type === 'chicken') {
          addDuckProduce(1, 0);
          addNotice(
            tr(
              '🥚 ได้รับไข่ไก่สด +1 ฟองจากการดูแลแม่ไก่!',
              '🥚 Gathered +1 Fresh Egg from caring for your chicken!'
            ),
            '#fef08a'
          );
        }
      }),
    [handlePetAnimal, addXP, addDuckProduce, addNotice]
  );

  const handleCheckCellFree = useCallback(
    (gx: number, gz: number) =>
      isCellFree(
        gx,
        gz,
        housesRef.current,
        plotsRef.current,
        rocksRef.current,
        map2Unlocked
      ),
    [isCellFree, map2Unlocked]
  );

  const handleOpenExpansionModal = useCallback(() => setIsExpansionOpen(true), []);
  const handleCloseExpansionModal = useCallback(() => setIsExpansionOpen(false), []);

  // ✅ NEW: รับ tab ที่ต้องการเปิด (default: 'harvests') — ใช้กับปุ่มด้านขวาของ BottomDock
  const handleOpenInventory = useCallback(
    (tab?: 'harvests' | 'processing' | 'shop') => {
      if (proximityNearHouseRef.current?.type === 20) {
        handleDismissNearHouse(proximityNearHouseRef.current.id);
      }
      setInventoryInitialTab(tab ?? 'harvests');
      setIsInventoryOpen(true);
    },
    [handleDismissNearHouse]
  );

  const handleCloseInventory = useCallback(() => {
    if (proximityNearHouseRef.current?.type === 20) {
      handleDismissNearHouse(proximityNearHouseRef.current.id);
    }
    setIsInventoryOpen(false);
  }, [handleDismissNearHouse]);

  const handleOpenGuide = useCallback(() => setIsGuideOpen(true), []);
  const handleCloseGuide = useCallback(() => setIsGuideOpen(false), []);
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleOpenInstall = useCallback(() => setIsInstallOpen(true), []);
  const handleCloseInstall = useCallback(() => setIsInstallOpen(false), []);
  const handleReplayLoadingScreen = useCallback(() => setIsLoadingScreenOpen(true), []);
  const handleFinishLoadingScreen = useCallback(() => setIsLoadingScreenOpen(false), []);
  const handleResetCamera = useCallback(() => {
    setCameraMode('isometric');
    setSkyVistaEnabled(false);
    setResetCameraTrigger((trVal) => trVal + 1);
  }, []);

  const handleToggleAutoRotateCamera = useCallback(() => {
    ensureAudioStarted();
    const next = !autoRotateCamera;
    safeSetLocalStorageItem('beam_farm_auto_rotate_camera', String(next));
    setAutoRotateCamera(next);
    addNotice(
      next
        ? tr('🔄 เปิดการหมุนกล้องอัตโนมัติรอบฟาร์ม 360°', '🔄 Auto-rotate camera 360° enabled')
        : tr('⏹️ ปิดการหมุนกล้องอัตโนมัติ', '⏹️ Auto-rotate camera stopped'),
      next ? '#38bdf8' : '#a8a29e'
    );
  }, [ensureAudioStarted, autoRotateCamera, addNotice]);

  const handleChangeAutoRotateSpeed = useCallback((speed: number) => {
    ensureAudioStarted();
    const clamped = Math.max(0.02, Math.min(0.25, speed));
    safeSetLocalStorageItem('beam_farm_auto_rotate_speed', String(clamped));
    setAutoRotateSpeed(clamped);
  }, [ensureAudioStarted]);

  const handleToggleTwoFingerRotate = useCallback(() => {
    ensureAudioStarted();
    const next = !twoFingerRotateEnabled;
    safeSetLocalStorageItem('beam_farm_two_finger_rotate', String(next));
    setTwoFingerRotateEnabled(next);
    addNotice(
      next
        ? tr('✌️ เปิดการบิด 2 นิ้วหมุนมุมกล้องบนหน้าจอ', '✌️ 2-finger twist camera rotation enabled')
        : tr('🔒 ปิดการบิด 2 นิ้วหมุนกล้อง (ล็อกมุมมอง)', '🔒 2-finger twist camera rotation disabled'),
      next ? '#38bdf8' : '#a8a29e'
    );
  }, [ensureAudioStarted, twoFingerRotateEnabled, addNotice]);

  const handleRotateCameraByAngle = useCallback((deltaRad: number) => {
    ensureAudioStarted();
    setCameraRotateTrigger((prev) => ({
      seq: prev.seq + 1,
      deltaRad,
    }));
  }, [ensureAudioStarted]);

  const handleResetCameraAngle = useCallback(() => {
    ensureAudioStarted();
    setCameraRotateTrigger((prev) => ({
      seq: prev.seq + 1,
      resetDefault: true,
    }));
    addNotice(
      tr('📐 รีเซ็ตมุมมองสู่มาตรฐาน Hay Day (-45° Isometric)', '📐 Camera reset to default Hay Day angle'),
      '#4ade80'
    );
  }, [ensureAudioStarted, addNotice]);

  const handleSceneReady = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene;
    setSceneReady(true);
  }, []);

  const handleSelectTool = useCallback(
    (tool: ToolType) => {
      ensureAudioStarted();
      if (harvest.isActive) {
        harvest.exit();
      }
      setActiveTool(tool);
    },
    [ensureAudioStarted, harvest]
  );

  const handleSelectSaplingAndTool = useCallback(
    (sapling: TreeType) => {
      ensureAudioStarted();
      if (harvest.isActive) {
        harvest.exit();
      }
      setSelectedSapling(sapling);
      setActiveTool('tree_sapling');
    },
    [ensureAudioStarted, harvest]
  );

  const handleToggleGrid = useCallback(() => setGridVisible((v) => !v), []);

  const showBreweryModal = activeBreweryHouseId !== null;
  const showOvenModal = activeOvenTarget !== null;
  const activeOvenHouseId = activeOvenTarget?.houseId ?? null;
  const activeOvenMachineType: OvenMachineType = activeOvenTarget?.machineType ?? 'bakery';
  const showFeedMillModal = activeFeedMillHouseId !== null;
  const showFishShopModal = activeFishShopHouseId !== null;

  const isModalBlockingInput =
    showHouseInterior ||
    showBreweryModal ||
    showOvenModal ||
    showFeedMillModal ||
    showFishShopModal ||
    isInventoryOpen ||
    isGuideOpen ||
    isDevDocsOpen ||
    isExpansionOpen ||
    isSettingsOpen ||
    isInstallOpen ||
    isFishingOpen ||
    isLoadingScreenOpen;

  const anyOverlayOpen =
    showHouseInterior ||
    showBreweryModal ||
    showOvenModal ||
    showFeedMillModal ||
    showFishShopModal ||
    isInventoryOpen ||
    isGuideOpen ||
    isDevDocsOpen ||
    isExpansionOpen ||
    isSettingsOpen ||
    isInstallOpen ||
    isFishingOpen ||
    openLeftMenu !== null ||
    !!placing ||
    !!selectedHouse ||
    !!selectedRock ||
    !!selectedAnimal ||
    isMovingPlotMode ||
    harvest.isActive;

  const dismissTopOverlay = useCallback((): boolean => {
    if (isFishingOpen) {
      handleCloseFishing();
      return true;
    }
    if (isDevDocsOpen) {
      handleCloseDevDocs();
      return true;
    }
    if (showFishShopModal) {
      handleCloseFishShop();
      return true;
    }
    if (showFeedMillModal) {
      handleCloseFeedMill();
      return true;
    }
    if (showOvenModal) {
      handleCloseOven();
      return true;
    }
    if (showBreweryModal) {
      handleCloseBrewery();
      return true;
    }
    if (showHouseInterior) {
      setShowHouseInterior(false);
      return true;
    }
    if (isInventoryOpen) {
      handleCloseInventory();
      return true;
    }
    if (isGuideOpen) {
      setIsGuideOpen(false);
      return true;
    }
    if (isExpansionOpen) {
      setIsExpansionOpen(false);
      return true;
    }
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return true;
    }
    if (isInstallOpen) {
      setIsInstallOpen(false);
      return true;
    }
    if (placing) {
      handleCancelPlacing();
      return true;
    }
    if (selectedHouse) {
      setSelectedHouseId(null);
      return true;
    }
    if (selectedRock) {
      setSelectedRockId(null);
      return true;
    }
    if (selectedAnimal) {
      setSelectedAnimalId(null);
      return true;
    }
    if (isMovingPlotMode) {
      setIsMovingPlotMode(false);
      setSelectedPlotToMove(null);
      return true;
    }
    if (harvest.isActive) {
      harvest.exit();
      return true;
    }
    if (openLeftMenu !== null) {
      setOpenLeftMenu(null);
      return true;
    }
    return false;
  }, [
    isFishingOpen,
    handleCloseFishing,
    isDevDocsOpen,
    handleCloseDevDocs,
    showFishShopModal,
    handleCloseFishShop,
    showFeedMillModal,
    handleCloseFeedMill,
    showOvenModal,
    handleCloseOven,
    showBreweryModal,
    handleCloseBrewery,
    showHouseInterior,
    setShowHouseInterior,
    isInventoryOpen,
    handleCloseInventory,
    isGuideOpen,
    isExpansionOpen,
    isSettingsOpen,
    isInstallOpen,
    placing,
    handleCancelPlacing,
    selectedHouse,
    setSelectedHouseId,
    selectedRock,
    setSelectedRockId,
    selectedAnimal,
    setSelectedAnimalId,
    isMovingPlotMode,
    harvest,
    openLeftMenu,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFishingOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'g' || e.key === 'G') {
        handleToggleGrid();
      } else if (e.key === 'Escape') {
        dismissTopOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFishingOpen, handleToggleGrid, dismissTopOverlay]);

  const OVERLAY_STATE_KEY = 'beamFarmOverlay';
  const OVERLAY_TOKEN_KEY = '__beamOverlayToken';

  const pushedHistoryRef = useRef(false);
  const expectedPopRef = useRef(0);
  const overlayTokenRef = useRef<string | null>(null);
  const overlayHistorySupportedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (overlayHistorySupportedRef.current === false) return;

    if (anyOverlayOpen && !pushedHistoryRef.current) {
      const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const prevState = window.history.state;

      try {
        window.history.pushState(
          {
            ...(prevState && typeof prevState === 'object' ? prevState : {}),
            [OVERLAY_STATE_KEY]: true,
            [OVERLAY_TOKEN_KEY]: token,
          },
          ''
        );
      } catch (err) {
        overlayHistorySupportedRef.current = false;
        console.warn(
          '[useFarmWorldHandlers] pushState threw → overlay back-guard disabled',
          err
        );
        return;
      }

      const cur = window.history.state;
      if (cur && typeof cur === 'object' && cur[OVERLAY_TOKEN_KEY] === token) {
        pushedHistoryRef.current = true;
        overlayTokenRef.current = token;
        overlayHistorySupportedRef.current = true;
      } else {
        overlayHistorySupportedRef.current = false;
        console.warn(
          '[useFarmWorldHandlers] pushState silently no-op (embedded preview?) → overlay back-guard disabled'
        );
      }
      return;
    }

    if (!anyOverlayOpen && pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      const token = overlayTokenRef.current;
      overlayTokenRef.current = null;

      const cur = window.history.state;
      const stillOnOurEntry =
        !!token &&
        !!cur &&
        typeof cur === 'object' &&
        cur[OVERLAY_TOKEN_KEY] === token;

      if (stillOnOurEntry) {
        expectedPopRef.current += 1;
        try {
          window.history.back();
        } catch {
          expectedPopRef.current = Math.max(0, expectedPopRef.current - 1);
        }
      } else {
        try {
          const cleaned = { ...(cur && typeof cur === 'object' ? cur : {}) };
          delete cleaned[OVERLAY_STATE_KEY];
          delete cleaned[OVERLAY_TOKEN_KEY];
          window.history.replaceState(cleaned, '');
        } catch {}
        console.warn(
          '[useFarmWorldHandlers] not on overlay entry → skipped history.back() to avoid leaving the game'
        );
      }
    }
  }, [anyOverlayOpen]);

  useEffect(() => {
    if (expectedPopRef.current <= 0) return;
    const t = window.setTimeout(() => {
      if (expectedPopRef.current > 0) {
        console.warn('[useFarmWorldHandlers] expectedPop stale → resetting');
        expectedPopRef.current = 0;
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [anyOverlayOpen]);

  useEffect(() => {
    const onPopState = () => {
      if (expectedPopRef.current > 0) {
        expectedPopRef.current -= 1;
        return;
      }

      if (isFishingOpen) {
        const backReq = new CustomEvent('beam-fishing-back-request', { cancelable: true });
        const allowedToCloseOverlay = window.dispatchEvent(backReq);
        if (!allowedToCloseOverlay) {
          if (overlayHistorySupportedRef.current === false) return;

          const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const prevState = window.history.state;
          try {
            window.history.pushState(
              {
                ...(prevState && typeof prevState === 'object' ? prevState : {}),
                [OVERLAY_STATE_KEY]: true,
                [OVERLAY_TOKEN_KEY]: token,
              },
              ''
            );
            const cur = window.history.state;
            if (cur && typeof cur === 'object' && cur[OVERLAY_TOKEN_KEY] === token) {
              pushedHistoryRef.current = true;
              overlayTokenRef.current = token;
              overlayHistorySupportedRef.current = true;
            } else {
              overlayHistorySupportedRef.current = false;
            }
          } catch {
            overlayHistorySupportedRef.current = false;
          }
          return;
        }
      }

      if (dismissTopOverlay()) {
        pushedHistoryRef.current = false;
        overlayTokenRef.current = null;
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isFishingOpen, dismissTopOverlay]);

  const handleBuildMenuOpenChange = useCallback(
    (next: boolean) => {
      ensureAudioStarted();
      setOpenLeftMenu(next ? 'build' : null);
    },
    [ensureAudioStarted]
  );

  const handleToolsMenuOpenChange = useCallback(
    (next: boolean) => {
      ensureAudioStarted();
      setOpenLeftMenu(next ? 'tools' : null);
    },
    [ensureAudioStarted]
  );

  const handleToggleHarvestMode = useCallback(() => {
    ensureAudioStarted();
    if (harvest.isActive) {
      harvest.exit();
    } else {
      if (isMovingPlotMode) {
        setIsMovingPlotMode(false);
        setSelectedPlotToMove(null);
      }
      harvest.enter();
    }
  }, [ensureAudioStarted, harvest, isMovingPlotMode]);

  const handleCloseSelectedHouse = useCallback(
    () => setSelectedHouseId(null),
    [setSelectedHouseId]
  );
  const handleCloseSelectedAnimal = useCallback(
    () => setSelectedAnimalId(null),
    [setSelectedAnimalId]
  );
  const handleCloseSelectedRock = useCallback(
    () => setSelectedRockId(null),
    [setSelectedRockId]
  );
  const handleDeleteSelectedHouseWithRefund = useCallback(() => {
    if (selectedHouse) {
      pruneDeletedHouseBrews(selectedHouse.id);
      if (activeBreweryHouseId === selectedHouse.id) {
        setActiveBreweryHouseId(null);
      }
      if (activeOvenTarget?.houseId === selectedHouse.id) {
        setActiveOvenTarget(null);
      }
      if (activeFeedMillHouseId === selectedHouse.id) {
        setActiveFeedMillHouseId(null);
      }
      if (activeFishShopHouseId === selectedHouse.id) {
        setActiveFishShopHouseId(null);
      }
    }
    handleDeleteSelectedHouse(earnCoins);
  }, [
    selectedHouse,
    pruneDeletedHouseBrews,
    activeBreweryHouseId,
    activeOvenTarget,
    activeFeedMillHouseId,
    activeFishShopHouseId,
    handleDeleteSelectedHouse,
    earnCoins,
  ]);
  const handleDeleteSelectedAnimalWithRefund = useCallback(
    () => handleDeleteSelectedAnimal(earnCoins),
    [handleDeleteSelectedAnimal, earnCoins]
  );
  const handleDeleteSelectedRockWithRefund = useCallback(
    () => handleDeleteSelectedRock(earnCoins),
    [handleDeleteSelectedRock, earnCoins]
  );
  const handlePetSelectedAnimal = useCallback(
    () =>
      selectedAnimal &&
      handlePetAnimal(selectedAnimal, (xp) => {
        addXP(xp);
        if (selectedAnimal.type === 'duck') {
          addDuckProduce(0, 1);
          addNotice(
            tr(
              '🪶 ได้รับขนเป็ดนุ่ม +1 เส้นจากการลูบดูแลเป็ด!',
              '🪶 Gathered +1 Soft Duck Feather from caring for your duck!'
            ),
            '#fef08a'
          );
        } else if (selectedAnimal.type === 'chicken') {
          addDuckProduce(1, 0);
          addNotice(
            tr(
              '🥚 ได้รับไข่ไก่สด +1 ฟองจากการดูแลแม่ไก่!',
              '🥚 Gathered +1 Fresh Egg from caring for your chicken!'
            ),
            '#fef08a'
          );
        }
      }),
    [selectedAnimal, handlePetAnimal, addXP, addDuckProduce, addNotice]
  );

  const ghostPosMemo = useMemo(
    () => (ghost ? { x: ghost.x, z: ghost.z } : null),
    [ghost]
  );

  const readyTargetsRef = useRef(readyTargets);
  readyTargetsRef.current = readyTargets;
  const handleHarvestAllReady = useCallback(
    () => harvest.harvestAll(readyTargetsRef.current),
    [harvest.harvestAll]
  );

  return {
    activeTool,
    selectedSeed,
    setSelectedSeed,
    selectedSapling,
    gridVisible,
    timeOfDay,
    soundEffectsEnabled,
    musicEnabled,
    cameraMode,
    isPlayerLocked,
    isPlayerHidden,
    fingerSwipeEnabled,
    playerGender,
    playerOutfit,
    cameraFocusRequest,
    autoRotateCamera,
    autoRotateSpeed,
    twoFingerRotateEnabled,
    cameraRotateTrigger,
    handleToggleAutoRotateCamera,
    handleChangeAutoRotateSpeed,
    handleToggleTwoFingerRotate,
    handleRotateCameraByAngle,
    handleResetCameraAngle,
    wasdEnabled,
    touchSlideEnabled,
    structureEditEnabled,
    structureEditClickMode,
    graphicsQualityMode,
    ultra4kEnabled,
    isModalBlockingInput,
    nearHouse,
    setNearHouse,
    handleClearFingerHouse,
    handleDismissNearHouse,
    nearPond,
    setNearPond,
    isFishingOpen,
    handleOpenFishing,
    handlePondInteract,
    handleCloseFishing,
    showHouseInterior,
    setShowHouseInterior,
    showBreweryModal,
    activeBreweryHouseId,
    activeBrewHouseIds,
    handleEnterBrewery,
    handleCloseBrewery,
    showOvenModal,
    activeOvenHouseId,
    activeOvenMachineType,
    handleEnterOven,
    handleCloseOven,
    showFeedMillModal,
    activeFeedMillHouseId,
    handleEnterFeedMill,
    handleCloseFeedMill,
    showFishShopModal,
    activeFishShopHouseId,
    handleEnterFishShop,
    handleCloseFishShop,
    fishBag,
    fishBagTotalCoins,
    fishSaleTrigger,
    handleSellSingleFish,
    handleSellAllCaughtFish,
    isMovingPlotMode,
    selectedPlotToMove,
    isInventoryOpen,
    inventoryInitialTab, // ✅ NEW: สำหรับส่งให้ InventoryModal เปิดแท็บที่กำหนด
    isGuideOpen,
    isExpansionOpen,
    isSettingsOpen,
    isInstallOpen,
    isLoadingScreenOpen,
    resetCameraTrigger,
    openLeftMenu,
    workerQuartersCount,
    hasWorkerQuarters,
    sceneRef,
    sceneReady,
    harvest,
    readyTargets,
    resolveWorldPos,
    ghostPosMemo,
    ensureAudioStarted,
    checkPoiCooldown,
    skyVistaEnabled,
    handleCycleTime,
    handleToggleSkyVista,
    handleToggleSoundEffects,
    handleToggleMusic,
    handleResetProgress,
    handleCycleCameraMode,
    handleTogglePlayerHidden,
    handleToggleFingerSwipe,
    handleToggleMovementLock,
    handleToggleWasd,
    handleToggleTouchSlide,
    handleToggleStructureEdit,
    handleChangeStructureEditClickMode,
    handleToggleUltra4k,
    handleSetUltra4k,
    handleSetGraphicsQualityMode,
    handleSaveGameNow,
    handlePlayerMove,
    initialPlayerPos,
    handleToggleFarmerGender,
    handleUpdatePlayerOutfit,
    handleResetPlayerOutfit,
    handleFocusHouseCamera,
    handleFocusPlayerCamera,
    handleToggleMovingPlotMode,
    handleSleep,
    handleCollectDuckCoop,
    handlePlotClick,
    handleGridCellClick,
    handleTreeClick,
    handleHouseInteract,
    handleConfirmPlaceWithGhost,
    handleHouseSelect,
    handleAnimalSelect,
    handleRockSelect,
    handleAnimalPetFromScene,
    handleCheckCellFree,
    canPlacePlotAt,
    handleOpenExpansionModal,
    handleCloseExpansionModal,
    handleOpenInventory,
    handleCloseInventory,
    handleOpenGuide,
    handleCloseGuide,
    isDevDocsOpen,
    handleOpenDevDocs,
    handleCloseDevDocs,
    handleFastForwardTime,
    handleGiveSaplings,
    handleReviveAllTrees,
    handleOpenSettings,
    handleCloseSettings,
    handleOpenInstall,
    handleCloseInstall,
    handleReplayLoadingScreen,
    handleFinishLoadingScreen,
    handleResetCamera,
    handleSceneReady,
    handleSelectTool,
    handleSelectSaplingAndTool,
    handleToggleGrid,
    handleBuildMenuOpenChange,
    handleToolsMenuOpenChange,
    handleToggleHarvestMode,
    handleCloseSelectedHouse,
    handleCloseSelectedAnimal,
    handleCloseSelectedRock,
    handleDeleteSelectedHouseWithRefund,
    handleDeleteSelectedAnimalWithRefund,
    handleDeleteSelectedRockWithRefund,
    handlePetSelectedAnimal,
    handleHarvestAllReady,
    handlePlantCoveredCrop,
    handleWaterCoveredHouse,
    handleHarvestCoveredHouse,
  };
}