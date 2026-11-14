// src/components/3d/FarmScene.tsx
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HouseWalkSystem } from '../../game/player/HouseWalk';
import {
  BakingJob,
  CameraMode,
  FarmerGender,
  FarmPlot,
  FeedAutoCollectEvent,
  FeedMillJob,
  PlacedAnimal,
  PlacedHouse,
  PlacedRock,
  PlacedTree,
  PlacingState,
  PlayerOutfitConfig,
  RockType,
  TimeOfDay,
  ToolType,
} from '../../types/game';
import { isMobileViewportOrTouch } from '../../utils/glbValidator';
import {
  applySceneUltra4kQuality,
  invalidateRendererSizeCache,
  type GraphicsQualityMode,
} from '../../utils/graphics4k';
import { applyTimeOfDayAtmosphere, createFarmLighting } from '../../core/Lighting';
import { FarmTerrain3D } from './FarmTerrain';
import { FarmTerrainMap2 } from './FarmTerrainMap2';
import { FarmNightSky3D } from './FarmNightSky';
import { FarmGrass3D } from './FarmGrass';
import { FarmHouses3D, type GhostState } from './FarmHouses';
import type { OvenVisualState } from './structures';
import { FarmAnimals3D, type AnimalGhostState } from './FarmAnimals';
import { FarmRocks3D, type RockGhostState } from './FarmRocks';
import { FarmCrops3D } from './FarmCrops';
import { FarmTrees3D } from './FarmTrees';
import { FarmScenery3D } from './FarmScenery';
import { FarmGridOverlay3D } from './FarmGridOverlay';
import { FarmPlayer3D } from './FarmPlayer';
import { HayDayCameraController } from '../../engine/camera/HayDayCameraController';
import {
  useHayDayTouchCamera,
  type HayDayTouchHandlers,
} from '../../hooks/useHayDayTouchCamera';
import type { HarvestPhase, HarvestTarget } from '../../hooks/useHarvestMode';
import {
  createDoubleTapPlacementTracker,
  createGhostReporter,
  syncPlacementGhostLifecycle,
  syncPlacementGhostPosition,
  syncPlacementGhostRotation,
  validateRockPlacement,
} from './scene/SceneGhostPreview';
import { createScenePickHandlers, type SceneRaycastState } from './scene/SceneRaycastPicker';
import { PlayerKeyboardWASD, type WorldMoveDirection } from '../../game/player/PlayerKeyboardWASD';
import { PlayerTouchSlideMove } from '../../game/player/PlayerTouchSlideMove';
import { POND } from '../../data/terrainFeatures';

const POND_FISHING_REACH = 4.5;
/** ระยะ (เมตร) จากป้ายไม้หัวหินที่ปุ่มเข้าไปจะโผล่ */
const HUA_HIN_SIGN_REACH = 4.5;

/**
 * ✅ Horizontal FOV Compensation
 * ป้องกันภาพถูกซูมชิดจนล้นจอเมื่อ container มีสัดส่วนแคบลง (เช่น กรอบมือถือ 18:9, 19.5:9)
 * - aspect ≥ 16:9 → FOV คงที่ 35°
 * - aspect < 16:9 → ขยาย FOV เพื่อรักษา horizontal coverage (สูงสุด 55°)
 */
function applyCameraFovFromAspect(camera: THREE.PerspectiveCamera, aspect: number): void {
  const targetAspect = 16 / 9;
  if (aspect < targetAspect) {
    camera.fov = Math.min(55, Math.max(35, 35 * (targetAspect / Math.max(aspect, 0.55))));
  } else {
    camera.fov = 35;
  }
  camera.updateProjectionMatrix();
}

export interface FarmSceneProps {
  plots: FarmPlot[];
  activeTool: ToolType;
  timeOfDay: TimeOfDay;
  onPlotClick: (plotId: number) => void;
  onPlayerMove?: (pos: { x: number; z: number; heading?: number }) => void;
  initialPlayerPos?: { x: number; z: number; heading?: number };
  resetCameraTrigger?: number;

  houses?: PlacedHouse[];
  placing?: PlacingState | null;
  selectedHouseId?: string | null;
  onHouseSelect?: (id: string | null) => void;
  onHouseMove?: (id: string) => void;
  onHouseInteract?: (id: string) => void;
  onPondInteract?: () => void;
  onClearFingerHouse?: () => void;
  onGhostChange?: (g: GhostState | AnimalGhostState | RockGhostState | null) => void;
  onConfirmPlace?: (g?: GhostState | AnimalGhostState | RockGhostState | null) => void;

  animals?: PlacedAnimal[];
  selectedAnimalId?: string | null;
  onAnimalSelect?: (id: string | null) => void;
  onAnimalPet?: (animal: PlacedAnimal) => void;

  rocks?: PlacedRock[];
  selectedRockId?: string | null;
  onRockSelect?: (id: string | null) => void;
  onRockMove?: (id: string) => void;

  trees?: PlacedTree[];
  gridVisible?: boolean;
  onTreeClick?: (treeId: string) => void;
  onGridCellClick?: (gx: number, gz: number) => void;
  isCellFree?: (gx: number, gz: number) => { free: boolean; reason?: string };
  canPlacePlotAt?: (gx: number, gz: number) => { valid: boolean; reason?: string };

  cameraMode?: CameraMode;
  skyVistaEnabled?: boolean;
  isPlayerLocked?: boolean;
  isPlayerHidden?: boolean;
  fingerSwipeEnabled?: boolean;
  playerGender?: FarmerGender;
  playerOutfit?: PlayerOutfitConfig;
  cameraFocusRequest?: { seq: number; mode: 'house' | 'player'; x?: number; z?: number };
  autoRotateCamera?: boolean;
  autoRotateSpeed?: number;
  twoFingerRotateEnabled?: boolean;
  cameraRotateTrigger?: { seq: number; deltaRad?: number; resetDefault?: boolean };
  onNearHouseChange?: (house: PlacedHouse | null) => void;
  onNearPondChange?: (near: boolean) => void;
  /** true เมื่อผู้เล่นเดินเข้าใกล้ป้ายไม้ "ไปสะพานปลาหัวหิน" */
  onNearHuaHinSignChange?: (near: boolean) => void;
  renderPaused?: boolean;
  isMovingPlotMode?: boolean;
  selectedPlotToMove?: number | null;

  unlockedZones?: number[];
  onOpenExpansionModal?: () => void;

  onSceneReady?: (scene: THREE.Scene) => void;
  harvestPhase?: HarvestPhase;
  onHarvestHover?: (target: HarvestTarget | null) => void;
  onHarvestToggle?: (target: HarvestTarget) => void;

  wasdEnabled?: boolean;
  touchSlideEnabled?: boolean;
  isInputBlocked?: boolean;
  structureEditEnabled?: boolean;
  structureEditClickMode?: 'double' | 'single';
  graphicsQualityMode?: GraphicsQualityMode;
  ultra4kEnabled?: boolean;
  activeBrewHouseIds?: string[];
  bakingJobs?: BakingJob[];
  feedMillJobs?: FeedMillJob[];
  feedAutoCollectEvents?: FeedAutoCollectEvent[];
  fishBagCount?: number;
  fishSaleTrigger?: { seq: number; houseId?: string };
}

const EMPTY_HOUSES: PlacedHouse[] = [];
const EMPTY_ANIMALS: PlacedAnimal[] = [];
const EMPTY_TREES: PlacedTree[] = [];
const EMPTY_ROCKS: PlacedRock[] = [];
const EMPTY_STRINGS: string[] = [];
const EMPTY_BAKING_JOBS: BakingJob[] = [];
const EMPTY_FEED_JOBS: FeedMillJob[] = [];
const EMPTY_FEED_EVENTS: FeedAutoCollectEvent[] = [];

function computeFeedActiveCountsMap(jobs: FeedMillJob[], nowMs: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const j of jobs) {
    if (nowMs < j.finishAt) {
      map.set(j.houseId, (map.get(j.houseId) ?? 0) + 1);
    }
  }
  return map;
}

function computeOvenStatesMap(jobs: BakingJob[], nowMs: number): Map<string, OvenVisualState> {
  const map = new Map<string, OvenVisualState>();
  for (const j of jobs) {
    let entry = map.get(j.houseId);
    if (!entry) {
      entry = { activeCount: 0, readyItems: [] };
      map.set(j.houseId, entry);
    }
    if (nowMs >= j.finishAt) {
      entry.readyItems.push({ id: j.id, itemType: j.itemType });
    } else {
      entry.activeCount += 1;
    }
  }
  return map;
}

const FarmSceneInner: React.FC<FarmSceneProps> = ({
  plots,
  activeTool,
  timeOfDay,
  onPlotClick,
  onPlayerMove,
  initialPlayerPos,
  resetCameraTrigger,
  houses = EMPTY_HOUSES,
  placing = null,
  selectedHouseId = null,
  onHouseSelect,
  onHouseMove,
  onHouseInteract,
  onPondInteract,
  onClearFingerHouse,
  onGhostChange,
  onConfirmPlace,
  animals = EMPTY_ANIMALS,
  onAnimalSelect,
  onAnimalPet,
  rocks = EMPTY_ROCKS,
  selectedRockId = null,
  onRockSelect,
  onRockMove,
  trees = EMPTY_TREES,
  gridVisible = true,
  onTreeClick,
  onGridCellClick,
  isCellFree,
  canPlacePlotAt,
  cameraMode = 'isometric',
  skyVistaEnabled = false,
  isPlayerLocked = false,
  isPlayerHidden = false,
  fingerSwipeEnabled = false,
  playerGender = 'male',
  playerOutfit,
  cameraFocusRequest,
  autoRotateCamera = false,
  autoRotateSpeed = 0.08,
  twoFingerRotateEnabled = true,
  cameraRotateTrigger,
  onNearHouseChange,
  onNearPondChange,
  onNearHuaHinSignChange,
  renderPaused = false,
  isMovingPlotMode = false,
  selectedPlotToMove = null,
  unlockedZones,
  onOpenExpansionModal,
  onSceneReady,
  harvestPhase,
  onHarvestHover,
  onHarvestToggle,
  wasdEnabled = true,
  touchSlideEnabled = false,
  isInputBlocked = false,
  structureEditEnabled = true,
  structureEditClickMode = 'double',
  graphicsQualityMode,
  ultra4kEnabled = false,
  activeBrewHouseIds = EMPTY_STRINGS,
  bakingJobs = EMPTY_BAKING_JOBS,
  feedMillJobs = EMPTY_FEED_JOBS,
  feedAutoCollectEvents = EMPTY_FEED_EVENTS,
  fishBagCount = 0,
  fishSaleTrigger,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const touchIndicatorRef = useRef<HTMLDivElement>(null);
  const touchRingRef = useRef<HTMLDivElement>(null);
  const touchKnobRef = useRef<HTMLDivElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const isSoftwareGlRef = useRef<boolean>(false);
  const isMobileGpuRef = useRef<boolean>(false);
  const ultra4kRef = useRef<boolean>(ultra4kEnabled);
  ultra4kRef.current = ultra4kEnabled;
  const qualityModeRef = useRef<GraphicsQualityMode | undefined>(graphicsQualityMode);
  qualityModeRef.current = graphicsQualityMode;
  const initialPlayerPosRef = useRef(initialPlayerPos);
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  cameraModeRef.current = cameraMode;
  const timeOfDayRef = useRef<TimeOfDay>(timeOfDay);
  timeOfDayRef.current = timeOfDay;
  const skyVistaRef = useRef<boolean>(skyVistaEnabled);
  skyVistaRef.current = skyVistaEnabled;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<HayDayCameraController | null>(null);
  const nightSkyRef = useRef<FarmNightSky3D | null>(null);
  const touchHandlersRef = useRef<HayDayTouchHandlers | null>(null);
  const terrainRef = useRef<FarmTerrain3D | null>(null);
  const terrainMap2Ref = useRef<FarmTerrainMap2 | null>(null);
  const cropsRef = useRef<FarmCrops3D | null>(null);
  const treesRef = useRef<FarmTrees3D | null>(null);
  const gridOverlayRef = useRef<FarmGridOverlay3D | null>(null);
  const playerRef = useRef<FarmPlayer3D | null>(null);
  const houseWalkRef = useRef<HouseWalkSystem | null>(null);
  const housesRef = useRef<FarmHouses3D | null>(null);
  const animalsRef = useRef<FarmAnimals3D | null>(null);
  const rocksRef = useRef<FarmRocks3D | null>(null);
  const sceneryRef = useRef<FarmScenery3D | null>(null);
  const grassRef = useRef<FarmGrass3D | null>(null);
  const lastNearHouseRef = useRef<PlacedHouse | null>(null);
  const lastNearPondRef = useRef<boolean>(false);
  const lastNearSignRef = useRef<boolean>(false);
  const renderPausedRef = useRef(false);
  renderPausedRef.current = renderPaused;
  const bakingJobsRef = useRef<BakingJob[]>(bakingJobs);
  bakingJobsRef.current = bakingJobs;
  const feedMillJobsRef = useRef<FeedMillJob[]>(feedMillJobs);
  feedMillJobsRef.current = feedMillJobs;
  const processedFeedEventIdsRef = useRef<Set<string>>(new Set());
  const lastFishSaleSeqRef = useRef<number>(fishSaleTrigger?.seq ?? 0);
  const lastCameraFocusSeqRef = useRef<number>(cameraFocusRequest?.seq ?? 0);
  const lastOvenSyncSecRef = useRef<number>(-1);

  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);

  const wasdRef = useRef<PlayerKeyboardWASD | null>(null);
  const touchSlideRef = useRef<PlayerTouchSlideMove | null>(null);

  const callbacksRef = useRef<
    SceneRaycastState & {
      onNearHouseChange?: (house: PlacedHouse | null) => void;
      onNearPondChange?: (near: boolean) => void;
      onNearHuaHinSignChange?: (near: boolean) => void;
      onSceneReady?: (scene: THREE.Scene) => void;
    }
  >({
    onPlotClick,
    onPlayerMove,
    activeTool,
    placing,
    plots,
    houses,
    animals,
    rocks,
    trees,
    gridVisible,
    selectedHouseId,
    selectedRockId,
    onHouseSelect,
    onHouseMove,
    onHouseInteract,
    onPondInteract,
    onClearFingerHouse,
    onGhostChange,
    onConfirmPlace,
    onAnimalSelect,
    onAnimalPet,
    onRockSelect,
    onRockMove,
    onTreeClick,
    onGridCellClick,
    isCellFree,
    canPlacePlotAt,
    isPlayerLocked,
    isPlayerHidden,
    isMovingPlotMode,
    selectedPlotToMove,
    unlockedZones,
    onOpenExpansionModal,
    harvestPhase,
    onHarvestHover,
    onHarvestToggle,
    structureEditEnabled,
    structureEditClickMode,
    touchSlideEnabled,
    onNearHouseChange,
    onNearPondChange,
    onNearHuaHinSignChange,
    onSceneReady,
  });

  callbacksRef.current = {
    onPlotClick,
    onPlayerMove,
    activeTool,
    placing,
    plots,
    houses,
    animals,
    rocks,
    trees,
    gridVisible,
    selectedHouseId,
    selectedRockId,
    onHouseSelect,
    onHouseMove,
    onHouseInteract,
    onPondInteract,
    onClearFingerHouse,
    onGhostChange,
    onConfirmPlace,
    onAnimalSelect,
    onAnimalPet,
    onRockSelect,
    onRockMove,
    onTreeClick,
    onGridCellClick,
    isCellFree,
    canPlacePlotAt,
    isPlayerLocked,
    isPlayerHidden,
    isMovingPlotMode,
    selectedPlotToMove,
    unlockedZones,
    onOpenExpansionModal,
    harvestPhase,
    onHarvestHover,
    onHarvestToggle,
    structureEditEnabled,
    structureEditClickMode,
    touchSlideEnabled,
    onNearHouseChange,
    onNearPondChange,
    onNearHuaHinSignChange,
    onSceneReady,
  };

  const ghostReporter = useMemo(
    () => createGhostReporter(() => callbacksRef.current.onGhostChange),
    []
  );
  const tapTracker = useMemo(() => createDoubleTapPlacementTracker(), []);

  const validateRock = useCallback((gx: number, gz: number, type: RockType) => {
    const cur = callbacksRef.current;
    return validateRockPlacement(gx, gz, type, {
      unlockedZones: cur.unlockedZones,
      editId: cur.placing?.editId,
      houses: cur.houses,
      plots: cur.plots,
      trees: cur.trees,
      rocks: cur.rocks,
    });
  }, []);

  const plotsLayoutKey = useMemo(
    () => plots.map((p) => `${p.id}:${p.worldX}:${p.worldZ}`).join('|'),
    [plots]
  );

  const treesLayoutKey = useMemo(
    () => trees.map((t) => `${t.id}:${t.worldX}:${t.worldZ}`).join('|'),
    [trees]
  );

  const housesLayoutKey = useMemo(
    () => houses.map((h) => `${h.id}:${h.type}:${h.x}:${h.z}:${h.rot}`).join('|'),
    [houses]
  );

  const rocksLayoutKey = useMemo(
    () => rocks.map((r) => `${r.id}:${r.type}:${r.x}:${r.z}`).join('|'),
    [rocks]
  );

  useEffect(() => {
    cropsRef.current?.updatePlots(plots);
    if (rendererRef.current && rendererRef.current.shadowMap.enabled) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [plots]);

  useEffect(() => {
    if (rendererRef.current && rendererRef.current.shadowMap.enabled) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
  }, [plotsLayoutKey, treesLayoutKey, housesLayoutKey, rocksLayoutKey, timeOfDay]);

  useEffect(() => {
    treesRef.current?.updateTrees(trees);
  }, [trees]);

  useEffect(() => {
    cropsRef.current?.setSelectedPlot(isMovingPlotMode ? selectedPlotToMove : null);
  }, [isMovingPlotMode, selectedPlotToMove]);

  useEffect(() => {
    gridOverlayRef.current?.setGridVisible(gridVisible || isMovingPlotMode);
    gridOverlayRef.current?.setGridOpacity(isMovingPlotMode ? 0.42 : 0.28);
    if (!isMovingPlotMode && activeTool !== 'tree_sapling') {
      gridOverlayRef.current?.hideCursor();
    }
  }, [gridVisible, isMovingPlotMode, activeTool]);

  useEffect(() => {
    playerRef.current?.setTool(activeTool);
  }, [activeTool]);

  useHayDayTouchCamera({
    containerRef: mountRef,
    controllerRef: controlsRef,
    handlersRef: touchHandlersRef,
    isInputBlocked,
    fingerSwipeEnabled,
    twoFingerRotateEnabled,
  });

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.setAutoRotate(autoRotateCamera, autoRotateSpeed);
    }
  }, [autoRotateCamera, autoRotateSpeed]);

  const lastCameraRotateSeqRef = useRef<number>(cameraRotateTrigger?.seq ?? 0);
  useEffect(() => {
    if (!cameraRotateTrigger || cameraRotateTrigger.seq === lastCameraRotateSeqRef.current) return;
    lastCameraRotateSeqRef.current = cameraRotateTrigger.seq;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    if (cameraRotateTrigger.resetDefault) {
      ctrl.resetToDefaultAngle();
    } else if (typeof cameraRotateTrigger.deltaRad === 'number') {
      ctrl.rotateByAngle(cameraRotateTrigger.deltaRad);
    }
  }, [cameraRotateTrigger]);

  useEffect(() => {
    if (resetCameraTrigger !== undefined && controlsRef.current) {
      controlsRef.current.reset(playerRef.current?.position);
    }
  }, [resetCameraTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcfe2ec);
    scene.fog = new THREE.Fog(0xcfe2ec, 80, 260);
    sceneRef.current = scene;

    const aspect = container.clientWidth / Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(35, aspect, 0.5, 650);
    cameraRef.current = camera;
    // ✅ FOV Compensation ที่ setup เริ่มต้น (สำหรับกรณีกรอบมือถือแคบ)
    applyCameraFovFromAspect(camera, aspect);

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const isMobileGpu = isMobileViewportOrTouch();
    isSoftwareGlRef.current = isSoftwareGl;
    isMobileGpuRef.current = isMobileGpu;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl && (!isMobileGpu || ultra4kRef.current),
        powerPreference: 'high-performance',
      });
    } catch {
      renderer = new THREE.WebGLRenderer({ antialias: false });
    }
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = !isSoftwareGl && qualityModeRef.current !== 'smooth';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    const initialShadowDim = ultra4kRef.current
      ? isMobileGpu ? 2048 : 4096
      : isMobileGpu ? 512 : 1024;

    const lighting = createFarmLighting(scene, {
      shadowMapDim: initialShadowDim,
      enableShadows: !isSoftwareGl,
    });
    sunRef.current = lighting.sun;
    hemiRef.current = lighting.hemi;

    if (lighting.sun?.shadow) {
      lighting.sun.shadow.radius = isMobileGpu ? 2 : 4;
    }

    applyTimeOfDayAtmosphere(scene, timeOfDayRef.current, lighting.sun, lighting.hemi);

    const nightSky = new FarmNightSky3D(timeOfDayRef.current);
    scene.add(nightSky.skyGroup);
    scene.add(nightSky.worldGroup);
    nightSkyRef.current = nightSky;

    applySceneUltra4kQuality({
      renderer,
      scene,
      sunLight: lighting.sun,
      cssWidth: Math.max(1, container.clientWidth),
      cssHeight: Math.max(1, container.clientHeight),
      ultra4k: ultra4kRef.current,
      qualityMode: qualityModeRef.current,
      isSoftwareGl,
      isMobileGpu,
    });

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      renderer.shadowMap.type = THREE.PCFShadowMap;
      applySceneUltra4kQuality({
        renderer,
        scene,
        sunLight: sunRef.current,
        cssWidth: Math.max(1, container.clientWidth),
        cssHeight: Math.max(1, container.clientHeight),
        ultra4k: ultra4kRef.current,
        qualityMode: qualityModeRef.current,
        isSoftwareGl,
        isMobileGpu,
      });
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.transition = 'none';
    container.appendChild(renderer.domElement);

    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRenderTarget.texture;
      pmremGenerator.dispose();
    } catch {
      // Fallback gracefully if PMREM compilation is unsupported on older mobile GPUs
    }

    const terrain = new FarmTerrain3D(renderer);
    scene.add(terrain.group);
    terrainRef.current = terrain;

    const initialMap2Open = callbacksRef.current.unlockedZones?.includes(5) ?? false;

    const terrainMap2 = new FarmTerrainMap2(renderer);
    terrainMap2.setUnlocked(initialMap2Open);
    scene.add(terrainMap2.group);
    terrainMap2Ref.current = terrainMap2;

    const gridOverlay = new FarmGridOverlay3D();
    gridOverlay.setGridVisible(callbacksRef.current.gridVisible);
    scene.add(gridOverlay.group);
    gridOverlayRef.current = gridOverlay;

    const houses3d = new FarmHouses3D(renderer);
    houses3d.map2Unlocked = initialMap2Open;
    scene.add(houses3d.group);
    housesRef.current = houses3d;
    houses3d.setHouses(houses);
    houses3d.setObstacles([
      ...plots.map((p) => ({ x: p.worldX, z: p.worldZ })),
      ...trees.map((t) => ({ x: t.worldX, z: t.worldZ })),
      ...rocks.map((r) => ({ x: r.x, z: r.z })),
    ]);

    const animals3d = new FarmAnimals3D();
    animals3d.map2Unlocked = initialMap2Open;
    scene.add(animals3d.group);
    animalsRef.current = animals3d;
    animals3d.setHouses(houses);
    animals3d.setAnimals(animals);

    const rocks3d = new FarmRocks3D();
    scene.add(rocks3d.group);
    rocksRef.current = rocks3d;
    rocks3d.sync(rocks);

    const farmTrees = new FarmTrees3D();
    scene.add(farmTrees.group);
    treesRef.current = farmTrees;
    farmTrees.updateTrees(trees);

    const scenery = new FarmScenery3D();
    scene.add(scenery.group);
    sceneryRef.current = scenery;
    void scenery.build();

    farmTrees.setOnModelLoaded(() => {
      if (isDisposed) return;
      farmTrees.refreshAllTrees(callbacksRef.current.trees);
      if (renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
      }
    });

    const grass = new FarmGrass3D(terrain.groundMesh, renderer, {
      qualityMode: qualityModeRef.current,
      map2Unlocked: initialMap2Open,
      exclude: (x, z) =>
        houses3d.isInsideYard(x, z) ||
        callbacksRef.current.plots.some(
          (p) => Math.abs(x - p.worldX) < 1.04 && Math.abs(z - p.worldZ) < 1.04
        ) ||
        callbacksRef.current.rocks.some(
          (r) =>
            r.type !== 'grass_on_rock' &&
            Math.hypot(x - r.x, z - r.z) < (r.type === 'rock_large' ? 1.8 : 1.0)
        ),
    });
    scene.add(grass.group);
    grassRef.current = grass;

    const crops = new FarmCrops3D(renderer);
    scene.add(crops.group);
    cropsRef.current = crops;
    crops.updatePlots(plots);
    crops.setSelectedPlot(isMovingPlotMode ? selectedPlotToMove : null);

    const player = new FarmPlayer3D();
    player.map2Unlocked = initialMap2Open;
    if (initialPlayerPosRef.current) {
      player.setPositionImmediate(
        initialPlayerPosRef.current.x,
        initialPlayerPosRef.current.z,
        initialPlayerPosRef.current.heading
      );
    }
    scene.add(player.group);
    playerRef.current = player;
    const houseWalk = new HouseWalkSystem(
      () => callbacksRef.current.houses,
      (id) => housesRef.current?.getHouseGroup(id)
    );
    player.groundHeightAt = houseWalk.groundHeightAt;
    player.resolveMove = houseWalk.resolveMove;
    houseWalkRef.current = houseWalk;
    player.setTool(activeTool);
    player.setGender(playerGender);
    player.setMovementLocked(Boolean(callbacksRef.current.isPlayerLocked));
    player.setCharacterHidden(Boolean(callbacksRef.current.isPlayerHidden));
    if (playerOutfit) player.setOutfit(playerOutfit);

    const initialTouchSlideAllowed =
      Boolean(touchSlideEnabled) &&
      !isPlayerLocked &&
      !callbacksRef.current.isPlayerHidden &&
      placing === null &&
      !isInputBlocked;

    const cameraControls = new HayDayCameraController(camera);
    cameraControls.map2Unlocked = initialMap2Open;
    cameraControls.touchSlideWalkEnabled = initialTouchSlideAllowed;
    cameraControls.setTargetImmediate(player.position.x, 0, player.position.z);
    cameraControls.setCameraMode(cameraModeRef.current, player.position);
    cameraControls.setSkyVista(Boolean(skyVistaRef.current));
    player.setVisibleInFPP(cameraModeRef.current === 'fpp');
    controlsRef.current = cameraControls;

    const wasdController = new PlayerKeyboardWASD();
    wasdController.setEnabled(
      Boolean(wasdEnabled) &&
        !isPlayerLocked &&
        !callbacksRef.current.isPlayerHidden &&
        placing === null &&
        !isInputBlocked
    );
    wasdController.attach();
    wasdRef.current = wasdController;

    const touchSlideController = new PlayerTouchSlideMove();
    touchSlideController.setIndicatorElements(
      touchIndicatorRef.current,
      touchRingRef.current,
      touchKnobRef.current
    );
    touchSlideController.setEnabled(initialTouchSlideAllowed);
    touchSlideController.attach(renderer.domElement);
    touchSlideRef.current = touchSlideController;

    const {
      handlePick,
      handleDoublePick,
      handleLongPress,
      handleSwipeBegin,
      handleSwipePick,
      handleHover,
      handlePlacementMove,
    } = createScenePickHandlers({
      container,
      camera,
      player,
      cameraControls,
      callbacksRef,
      terrainRef,
      terrainMap2Ref,
      cropsRef,
      treesRef,
      gridOverlayRef,
      housesRef,
      animalsRef,
      rocksRef,
      ghostReporter,
      tapTracker,
      validateRockFn: validateRock,
    });

    touchHandlersRef.current = {
      onPick: handlePick,
      onDoublePick: handleDoublePick,
      onLongPress: handleLongPress,
      onSwipeBegin: handleSwipeBegin,
      onSwipePick: handleSwipePick,
      onHover: handleHover,
      onPlacementMove: handlePlacementMove,
    };
    callbacksRef.current.onSceneReady?.(scene);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;

      const newAspect = w / h;
      camera.aspect = newAspect;
      // ✅ Horizontal FOV Compensation
      applyCameraFovFromAspect(camera, newAspect);

      renderer.shadowMap.type = THREE.PCFShadowMap;
      applySceneUltra4kQuality({
        renderer,
        scene,
        sunLight: sunRef.current,
        cssWidth: w,
        cssHeight: h,
        ultra4k: ultra4kRef.current,
        qualityMode: qualityModeRef.current,
        isSoftwareGl,
        isMobileGpu,
      });
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    let frameId = 0;

    const timer = new THREE.Timer();

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const _moveDir: WorldMoveDirection = { x: 0, z: 0 };
    let lastReportedPlayerX = player.position.x;
    let lastReportedPlayerZ = player.position.z;
    let lastReportedPlayerTime = 0;
    let wasPlayerMoving = false;
    let shadowFrameCount = 0;

    function tick() {
      if (isDisposed) return;

      timer.update();

      if (renderPausedRef.current) {
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(0.1, timer.getDelta());
      const elapsed = timer.getElapsed();

      const hasTouchSlide = touchSlideController.computeWorldDirection(
        cameraControls.cameraMode,
        cameraControls.theta,
        cameraControls.fppYaw,
        _moveDir
      );
      const hasManualInput =
        hasTouchSlide ||
        wasdController.computeWorldDirection(
          cameraControls.cameraMode,
          cameraControls.theta,
          cameraControls.fppYaw,
          _moveDir
        );
      player.setManualMoveDirection(_moveDir.x, _moveDir.z);
      if (hasManualInput) cameraControls.followPlayer = true;

      crops.update(delta, elapsed);
      houseWalkRef.current?.update(delta, player.position.x, player.position.y, player.position.z);
      player.update(delta);

      const movedDist = Math.hypot(
        player.position.x - lastReportedPlayerX,
        player.position.z - lastReportedPlayerZ
      );
      const justStopped = wasPlayerMoving && !player.isMoving;
      if (
        (movedDist > 0.25 && elapsed - lastReportedPlayerTime >= 0.6) ||
        (justStopped && movedDist > 0.04)
      ) {
        lastReportedPlayerX = player.position.x;
        lastReportedPlayerZ = player.position.z;
        lastReportedPlayerTime = elapsed;
        callbacksRef.current.onPlayerMove?.({
          x: player.position.x,
          z: player.position.z,
          heading: player.getHeading(),
        });
      }
      wasPlayerMoving = player.isMoving;

      const playerHiddenNow = Boolean(callbacksRef.current.isPlayerHidden);

      let nearH: PlacedHouse | null = null;
      if (!playerHiddenNow) {
        for (const h of callbacksRef.current.houses) {
          const radius =
            h.type === 25 || h.type === 26 || h.type === 27 ||
            h.type === 28 || h.type === 29 || h.type === 30
              ? 4.8
              : 3.8;
          if (Math.hypot(player.position.x - h.x, player.position.z - h.z) < radius) {
            nearH = h;
            break;
          }
        }
      }
      if (nearH !== lastNearHouseRef.current) {
        lastNearHouseRef.current = nearH;
        callbacksRef.current.onNearHouseChange?.(nearH);
      }

      const nearPond =
        !playerHiddenNow &&
        Math.hypot(player.position.x - POND.x, player.position.z - POND.z) <
          POND.radius + POND_FISHING_REACH;
      if (nearPond !== lastNearPondRef.current) {
        lastNearPondRef.current = nearPond;
        callbacksRef.current.onNearPondChange?.(nearPond);
      }

      // เดินเข้าใกล้ป้ายไม้หัวหิน → แจ้ง UI ให้โชว์ปุ่มเข้าไป
      const signPos = sceneryRef.current?.huaHinSignPos;
      const nearSign =
        !playerHiddenNow &&
        !!signPos &&
        Math.hypot(player.position.x - signPos.x, player.position.z - signPos.z) < HUA_HIN_SIGN_REACH;
      if (nearSign !== lastNearSignRef.current) {
        lastNearSignRef.current = nearSign;
        callbacksRef.current.onNearHuaHinSignChange?.(nearSign);
      }

      const wholeSec = Math.floor(elapsed);
      if (wholeSec !== lastOvenSyncSecRef.current) {
        lastOvenSyncSecRef.current = wholeSec;
        const now = Date.now();
        if (bakingJobsRef.current.length > 0) {
          housesRef.current?.setOvenStates(computeOvenStatesMap(bakingJobsRef.current, now));
        }
        if (feedMillJobsRef.current.length > 0) {
          housesRef.current?.setFeedMachineActiveCounts(
            computeFeedActiveCountsMap(feedMillJobsRef.current, now)
          );
        }
      }

      animalsRef.current?.update(delta, elapsed);
      housesRef.current?.update(delta, elapsed);
      farmTrees.update(delta, elapsed);
      terrainMap2.update(elapsed);
      gridOverlay.update(elapsed);
      grass.update(elapsed, cameraControls.target);

      cameraControls.update(delta, player.position, player.isMoving);

      nightSky.update(delta, elapsed, camera, renderer.getPixelRatio());

      if (renderer.shadowMap.enabled && !renderer.shadowMap.autoUpdate) {
        shadowFrameCount++;
        if (player.isMoving || cameraControls.isPlacing) {
          if ((shadowFrameCount % (isMobileGpu ? 3 : 2)) === 0) {
            renderer.shadowMap.needsUpdate = true;
          }
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored, false);
      wasdController.detach();
      wasdRef.current = null;
      touchSlideController.detach();
      touchSlideRef.current = null;
      touchHandlersRef.current = null;
      controlsRef.current = null;
      housesRef.current?.dispose?.();
      rocksRef.current?.dispose?.();
      sceneryRef.current?.dispose();
      sceneryRef.current = null;
      animalsRef.current?.dispose?.();
      cropsRef.current?.dispose?.();
      treesRef.current?.dispose?.();
      terrainRef.current?.dispose?.();
      grassRef.current?.dispose?.();
      playerRef.current?.dispose?.();
      (gridOverlayRef.current as unknown as { dispose?: () => void })?.dispose?.();
      terrainMap2Ref.current?.dispose?.();
      terrainMap2Ref.current = null;
      nightSkyRef.current?.dispose();
      nightSkyRef.current = null;
      lighting.dispose();
      envRenderTarget?.dispose();
      renderer.dispose();
      rendererRef.current = null;
      scene.clear();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [ghostReporter, tapTracker, validateRock]);

  useEffect(() => {
    if (graphicsQualityMode) {
      grassRef.current?.setQualityMode(graphicsQualityMode);
    }
    const renderer = rendererRef.current;
    const container = mountRef.current;
    if (!renderer || !container) return;
    if (renderPaused) {
      renderer.setPixelRatio(1);
      renderer.setSize(1, 1, false);
      // ต้องล้างแคชขนาด ไม่งั้นตอนกลับมา (เช่น ออกจากสะพานปลา) จะข้าม setSize แล้วจอฟาร์มว่างเปล่า
      invalidateRendererSizeCache(renderer);
      return;
    }
    renderer.shadowMap.type = THREE.PCFShadowMap;
    applySceneUltra4kQuality({
      renderer,
      scene: sceneRef.current,
      sunLight: sunRef.current,
      cssWidth: Math.max(1, container.clientWidth),
      cssHeight: Math.max(1, container.clientHeight),
      ultra4k: Boolean(ultra4kEnabled),
      qualityMode: graphicsQualityMode,
      isSoftwareGl: isSoftwareGlRef.current,
      isMobileGpu: isMobileGpuRef.current,
    });
    if (sceneRef.current && cameraRef.current) {
      renderer.render(sceneRef.current, cameraRef.current);
    }
  }, [
    renderPaused,
    graphicsQualityMode,
    ultra4kEnabled,
    housesLayoutKey,
    treesLayoutKey,
    plotsLayoutKey,
    rocksLayoutKey,
  ]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.setCameraMode(cameraMode, playerRef.current?.position);
      playerRef.current?.setVisibleInFPP(cameraMode === 'fpp');
    }
  }, [cameraMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    applyTimeOfDayAtmosphere(scene, timeOfDay, sunRef.current, hemiRef.current);
    nightSkyRef.current?.setTimeOfDay(timeOfDay);
  }, [timeOfDay]);

  useEffect(() => {
    controlsRef.current?.setSkyVista(Boolean(skyVistaEnabled));
  }, [skyVistaEnabled]);

  useEffect(() => {
    playerRef.current?.setMovementLocked(Boolean(isPlayerLocked));
  }, [isPlayerLocked]);

  useEffect(() => {
    playerRef.current?.setCharacterHidden(Boolean(isPlayerHidden));
    if (isPlayerHidden && controlsRef.current) {
      controlsRef.current.followPlayer = false;
    }
  }, [isPlayerHidden]);

  useEffect(() => {
    playerRef.current?.setGender(playerGender);
  }, [playerGender]);

  useEffect(() => {
    if (playerOutfit) playerRef.current?.setOutfit(playerOutfit);
  }, [playerOutfit]);

  useEffect(() => {
    if (!cameraFocusRequest || cameraFocusRequest.seq === lastCameraFocusSeqRef.current) return;
    lastCameraFocusSeqRef.current = cameraFocusRequest.seq;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    if (
      cameraFocusRequest.mode === 'house' &&
      typeof cameraFocusRequest.x === 'number' &&
      typeof cameraFocusRequest.z === 'number'
    ) {
      ctrl.focusWorldPoint(cameraFocusRequest.x, cameraFocusRequest.z, 17.5);
      playerRef.current?.setVisibleInFPP(false);
    } else if (cameraFocusRequest.mode === 'player') {
      ctrl.focusPlayerCloseUp(playerRef.current?.position);
      playerRef.current?.setVisibleInFPP(false);
    }
  }, [cameraFocusRequest]);

  useEffect(() => {
    housesRef.current?.setObstacles([
      ...callbacksRef.current.plots.map((p) => ({ x: p.worldX, z: p.worldZ })),
      ...callbacksRef.current.trees.map((t) => ({ x: t.worldX, z: t.worldZ })),
      ...rocks.map((r) => ({ x: r.x, z: r.z })),
    ]);
  }, [plotsLayoutKey, treesLayoutKey, rocks]);

  useEffect(() => {
    const h = housesRef.current;
    if (!h) return;
    const now = Date.now();
    h.setHouses(houses);
    h.setSelected(selectedHouseId);
    h.setActiveBrewHouses(activeBrewHouseIds);
    h.setOvenStates(computeOvenStatesMap(bakingJobs, now));
    h.setFeedMachineActiveCounts(computeFeedActiveCountsMap(feedMillJobs, now));
    h.setFishShopStockCount(fishBagCount);
    animalsRef.current?.setHouses(houses);
  }, [houses, selectedHouseId, activeBrewHouseIds, bakingJobs, feedMillJobs, fishBagCount]);

  useEffect(() => {
    if (!fishSaleTrigger || fishSaleTrigger.seq === lastFishSaleSeqRef.current) return;
    lastFishSaleSeqRef.current = fishSaleTrigger.seq;
    housesRef.current?.triggerFishSaleCelebration(fishSaleTrigger.houseId);
  }, [fishSaleTrigger]);

  useEffect(() => {
    const h = housesRef.current;
    if (!h || feedAutoCollectEvents.length === 0) return;
    const seen = processedFeedEventIdsRef.current;
    for (const ev of feedAutoCollectEvents) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      h.triggerFeedAutoFloat(ev.houseId, ev.feedType, playerRef.current?.position);
    }
    if (seen.size > 80) {
      const keep = new Set(feedAutoCollectEvents.map((e) => e.id));
      seen.forEach((id) => {
        if (!keep.has(id)) seen.delete(id);
      });
    }
  }, [feedAutoCollectEvents]);

  useEffect(() => {
    animalsRef.current?.setAnimals(animals);
  }, [animals]);

  useEffect(() => {
    const map2Open = unlockedZones?.includes(5) ?? false;
    terrainMap2Ref.current?.setUnlocked(map2Open);
    grassRef.current?.setMap2Unlocked(map2Open);
    if (controlsRef.current) controlsRef.current.map2Unlocked = map2Open;
    if (playerRef.current) playerRef.current.map2Unlocked = map2Open;
    if (housesRef.current) housesRef.current.map2Unlocked = map2Open;
    if (animalsRef.current) animalsRef.current.map2Unlocked = map2Open;
  }, [unlockedZones]);

  useEffect(() => {
    rocksRef.current?.sync(rocks);
    rocksRef.current?.setSelected(selectedRockId);
  }, [rocks, selectedRockId]);

  useEffect(() => {
    grassRef.current?.refresh();
  }, [plotsLayoutKey, housesLayoutKey, rocksLayoutKey]);

  const placingActive = placing !== null;

  useEffect(() => {
    wasdRef.current?.setEnabled(
      Boolean(wasdEnabled) &&
        !isPlayerLocked &&
        !isPlayerHidden &&
        !placingActive &&
        !isInputBlocked
    );
  }, [wasdEnabled, isPlayerLocked, isPlayerHidden, placingActive, isInputBlocked]);

  useEffect(() => {
    const allowed =
      Boolean(touchSlideEnabled) &&
      !isPlayerLocked &&
      !isPlayerHidden &&
      !placingActive &&
      !isInputBlocked;
    touchSlideRef.current?.setEnabled(allowed);
    if (controlsRef.current) {
      controlsRef.current.touchSlideWalkEnabled = allowed;
    }
  }, [touchSlideEnabled, isPlayerLocked, isPlayerHidden, placingActive, isInputBlocked]);
  const placingCategory = placing?.category ?? 'house';
  const placingType = placing?.type;
  const placingAnimalType = placing?.animalType;
  const placingRockType = placing?.rockType;
  const placingEditId = placing?.editId;

  useEffect(() => {
    tapTracker.reset();
    syncPlacementGhostLifecycle({
      placing: callbacksRef.current.placing,
      refs: { housesRef, animalsRef, rocksRef, grassRef, controlsRef },
      reporter: ghostReporter,
      validateRockFn: validateRock,
    });
  }, [
    placingActive,
    placingCategory,
    placingType,
    placingAnimalType,
    placingRockType,
    placingEditId,
    ghostReporter,
    tapTracker,
    validateRock,
  ]);

  const placingRot = placing?.rot;
  useEffect(() => {
    syncPlacementGhostRotation({
      placingRot,
      placingCategory,
      refs: { housesRef, animalsRef, rocksRef },
      reporter: ghostReporter,
    });
  }, [placingRot, placingCategory, ghostReporter]);

  const placingX = placing?.x;
  const placingZ = placing?.z;
  useEffect(() => {
    syncPlacementGhostPosition({
      placingX,
      placingZ,
      placingCategory,
      placingActive,
      refs: { housesRef, animalsRef, rocksRef },
      reporter: ghostReporter,
      validateRockFn: validateRock,
    });
  }, [placingX, placingZ, placingCategory, placingActive, ghostReporter, validateRock]);

  return (
    <>
      <div
        ref={mountRef}
        data-farm-canvas
        className="absolute inset-0 w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
      />
      <div
        ref={touchIndicatorRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-0 transition-opacity duration-100"
      >
        <div
          ref={touchRingRef}
          className="absolute top-0 left-0 w-24 h-24 rounded-full border-2 border-white/35 bg-black/15 backdrop-blur-[2px] shadow-lg will-change-transform"
        />
        <div
          ref={touchKnobRef}
          className="absolute top-0 left-0 w-9 h-9 rounded-full bg-amber-300/85 border-2 border-white/90 shadow-md will-change-transform"
        />
      </div>
    </>
  );
};

export const FarmScene = React.memo(FarmSceneInner);