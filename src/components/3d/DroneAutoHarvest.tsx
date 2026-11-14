// src/components/3d/DroneAutoHarvest.tsx
// โดรนอัจฉริยะ v3 — ตัวประสานหลัก (Logic + Voice TTS + UI + TaskMode)
// ✅ FIX: เมื่อไม่มีงาน ให้ลอยรอ (hover) แทนการบินกลับฐานทันที
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TREE_DEFINITIONS, gridToWorld, type CropType, type TreeType } from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import { getTreeName, tr } from '../../i18n/translations';
import { useDroneVoice, type VoiceEvent } from '../../hooks/useDroneVoice';

import {
  type DroneAutoHarvestProps, type DroneMode, type DroneAltitude,
  type DroneTaskMode,
  type Phase, type Cargo, type DroneTarget, type DroneStats,
  type JobKind,
  BATTERY_MAX, CARGO_CAPACITY, SKIP_TTL_MS, DRONE_SPEED, GROUND_SPEED,
  HARVEST_DELAY, WATER_DELAY, REPLANT_DELAY, PLANT_TREE_DELAY,
  VERIFY_DELAY, UNLOAD_DELAY, CHARGE_DELAY, TAKEOFF_DURATION, LANDING_DURATION,
  FOLLOW_DISTANCE, LEAD_DISTANCE, PATROL_RADIUS, PATROL_SPEED, MAX_FOLLOW_SPEED,
  NIGHT_START, NIGHT_END, SPOTLIGHT_INTENSITY,
  JOB_PRIORITY, DEFAULT_STATS, STORAGE_KEY_DEFAULT, TASK_MODE_STORAGE_KEY,
  smoothFactor, easeInOut, moveVec,
  loadDronePrefs, saveDronePrefs,
  useDroneModel, useDroneMiniMap,
  DroneHUD, ModeButtonsGroup, AltitudeButtonsGroup,
  TaskModeButtonsGroup,
  DashboardToggleButtons, MiniMapPanel, StatsDashboard,
} from './drone';
import { DroneDashboardModal } from '../ui/DroneDashboardModal';

export type { DroneMode, DroneAltitude, DroneTaskMode, DroneStats, DroneAutoHarvestProps };

const _dirScratch = new THREE.Vector3();
const _moveScratch = new THREE.Vector3();

export const DroneAutoHarvest: React.FC<DroneAutoHarvestProps> = (props) => {
  const {
    scene, addNotice, isActive, waterPlot, replantPlot, spendCoins,
    mode: externalMode, onModeChange,
    altitude: externalAltitude, onAltitudeChange,
    playerPosition, obstacles, timeOfDay = 12,
    storageKey = STORAGE_KEY_DEFAULT,
    seedCounts, saplingCounts, spendSapling, plantTree, isCellFree,
    houses = [], rocks = [], map2Unlocked = false,
    voiceEnabled = true,
  } = props;
  const { t, lang } = useLanguage();

  /* ── Voice TTS ── */
  const { speak: speakVoice, playSFX, stop: stopVoice } = useDroneVoice({
    enabled: voiceEnabled, sfxEnabled: voiceEnabled,
    language: lang === 'th' ? 'th-TH' : 'en-US',
    volume: 0.85, rate: 1.05, pitch: 1.1,
    cooldownMs: 3000, maxQueueSize: 6, stripEmojiInSpeech: true,
  });

  const voiceRef = useRef({ speakVoice, playSFX, stopVoice, voiceEnabled });
  useEffect(() => {
    voiceRef.current = { speakVoice, playSFX, stopVoice, voiceEnabled };
  }, [speakVoice, playSFX, stopVoice, voiceEnabled]);

  const say = useCallback((event: VoiceEvent) => {
    if (!voiceRef.current.voiceEnabled) return;
    voiceRef.current.speakVoice(event);
  }, []);

  /* ── State ── */
  const [status, setStatus] = useState(() => tr('พร้อม', 'Ready'));
  const [battery, setBattery] = useState(BATTERY_MAX);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [stats, setStats] = useState<DroneStats>(() => loadDronePrefs(storageKey).stats);

  /* ── TaskMode state + persistence ── */
  const [taskMode, setTaskMode] = useState<DroneTaskMode>(() => {
    try {
      const saved = localStorage.getItem(TASK_MODE_STORAGE_KEY);
      if (saved === 'HARVEST_ONLY' || saved === 'WATER_ONLY' ||
          saved === 'PLANT_CROPS' || saved === 'PLANT_TREES' || saved === 'ALL') {
        return saved as DroneTaskMode;
      }
    } catch {}
    return 'ALL';
  });
  const taskModeRef = useRef<DroneTaskMode>(taskMode);
  useEffect(() => {
    taskModeRef.current = taskMode;
    try { localStorage.setItem(TASK_MODE_STORAGE_KEY, taskMode); } catch {}
  }, [taskMode]);

  const savedPrefs = useRef(loadDronePrefs(storageKey));
  const [internalMode, setInternalMode] = useState<DroneMode>(savedPrefs.current.mode);
  const currentMode = externalMode ?? internalMode;
  const modeRef = useRef<DroneMode>(currentMode);
  const prevModeRef = useRef<DroneMode>(currentMode);

  const [internalAltitude, setInternalAltitude] = useState<DroneAltitude>(savedPrefs.current.altitude);
  const currentAltitude = externalAltitude ?? internalAltitude;
  const altitudeRef = useRef<DroneAltitude>(currentAltitude);

  /* ── Animation refs ── */
  const takeoffRef = useRef(0);
  const landingRef = useRef(0);
  const isTakingOffRef = useRef(false);
  const isLandingRef = useRef(false);

  /* ── 3D refs ── */
  const spotlightRef = useRef<THREE.SpotLight | null>(null);
  const spotlightTargetRef = useRef<THREE.Object3D | null>(null);
  const patrolAngleRef = useRef(0);
  const flightTimeAccumRef = useRef(0);
  const lastPosRef = useRef(new THREE.Vector3(-2, 0, 0));
  const modelHeightRef = useRef(1.2);
  const droneRef = useRef<THREE.Group | null>(null);
  const droneWorldPosRef = useRef(new THREE.Vector3(-2, 0, 0));
  const droneHeadingRef = useRef(0);
  const propellersRef = useRef<THREE.Mesh[]>([]);
  const basePosRef = useRef(new THREE.Vector3(-2, 0, 0));
  const droneLoadedRef = useRef(false);

  /* ── Gameplay refs ── */
  const enabledRef = useRef(false);
  const playerPosRef = useRef({ x: 0, z: 0, heading: 0 });
  const phaseRef = useRef<Phase>('IDLE');
  const targetRef = useRef<DroneTarget | null>(null);
  const timerRef = useRef(0);
  const cargoRef = useRef<Cargo[]>([]);
  const pendingVerifyRef = useRef<Cargo | null>(null);
  const skipRef = useRef<Map<string, number>>(new Map());
  const lastStatusRef = useRef('');
  const batteryRef = useRef(BATTERY_MAX);
  const obstaclesRef = useRef(obstacles ?? []);
  const callbacksRef = useRef(props);
  callbacksRef.current = props;
  obstaclesRef.current = obstacles ?? [];

  const lowBatterySpokenRef = useRef(false);
  const cargoFullSpokenRef = useRef(false);
  const distanceAccumRef = useRef(0);

  const dronePosForMapRef = useRef({ x: -2, z: 0, targetX: -2, targetZ: 0, heading: 0 });
  const targetPosForMapRef = useRef<{ x: number; z: number } | null>(null);

  /* ── Helpers ── */
  const setStatusIfChanged = useCallback((s: string) => {
    if (lastStatusRef.current !== s) {
      lastStatusRef.current = s;
      setStatus(s);
    }
  }, []);

  const syncBattery = useCallback(() => setBattery(batteryRef.current), []);

  const hasSeed = useCallback(
    (c: CropType): boolean => (seedCounts?.[c] ?? 0) > 0, [seedCounts]
  );
  const hasSapling = useCallback(
    (t: TreeType): boolean => (saplingCounts?.[t] ?? 0) > 0, [saplingCounts]
  );
  const availableSaplingTypes = useCallback((): TreeType[] => {
    if (!saplingCounts) return [];
    return (Object.entries(saplingCounts) as [TreeType, number][])
      .filter(([_, count]) => count > 0).map(([type]) => type);
  }, [saplingCounts]);

  const getAltitudeY = useCallback((alt: DroneAltitude): number => {
    const h = modelHeightRef.current;
    switch (alt) {
      case 'GROUND': return 0.02;
      case 'LOW': return h * 0.8;
      case 'NORMAL': return h * 1.5 + 0.5;
      case 'HIGH': return h * 2.5 + 1.5;
    }
  }, []);

  const getBasePos = useCallback(
    (): THREE.Vector3 => new THREE.Vector3(-2, getAltitudeY(altitudeRef.current), 0),
    [getAltitudeY]
  );

  const getSpeed = useCallback(
    (): number => (altitudeRef.current === 'GROUND' ? GROUND_SPEED : DRONE_SPEED), []
  );

  /* ── Persistence ── */
  useEffect(() => {
    saveDronePrefs(storageKey, currentMode, currentAltitude, stats);
  }, [currentMode, currentAltitude, stats, storageKey]);

  /* ── setMode + Voice ── */
  const setMode = useCallback((m: DroneMode) => {
    if (onModeChange) onModeChange(m); else setInternalMode(m);

    if (m !== 'OFF' && currentMode === 'OFF') {
      isTakingOffRef.current = true; takeoffRef.current = 0;
      playSFX('takeoff'); say('activate');
    }
    if (m === 'OFF') {
      playSFX('landing'); say('deactivate');
    } else if (m === 'PATROL') {
      say('patrolStart');
    } else if (m === 'AUTO' || m === 'FOLLOW' || m === 'LEAD') {
      say('modeChange');
    }

    addNotice(
      m === 'AUTO' ? tr('🚁 โดรน: โหมดอัตโนมัติ', '🚁 Drone: AUTO mode')
      : m === 'FOLLOW' ? tr('🚁 โดรน: ตามหลัง', '🚁 Drone: FOLLOW mode')
      : m === 'LEAD' ? tr('🚁 โดรน: นำหน้า', '🚁 Drone: LEAD mode')
      : m === 'PATROL' ? tr('🚁 โดรน: บินตรวจการณ์', '🚁 Drone: PATROL mode')
      : tr('🚁 โดรน: ปิด', '🚁 Drone: OFF'),
      '#22d3ee'
    );
  }, [onModeChange, currentMode, addNotice, playSFX, say]);

  /* ── setTaskMode + Voice ── */
  const handleSetTaskMode = useCallback((newTask: DroneTaskMode) => {
    setTaskMode(newTask);
    taskModeRef.current = newTask;
    const labels: Record<DroneTaskMode, { th: string; en: string }> = {
      ALL:          { th: '🔄 โดรน: ทำทุกอย่าง',    en: '🔄 Drone: All tasks' },
      HARVEST_ONLY: { th: '🌾 โดรน: เก็บเกี่ยว',     en: '🌾 Drone: Harvest only' },
      WATER_ONLY:   { th: '💧 โดรน: รดน้ำ',          en: '💧 Drone: Water only' },
      PLANT_CROPS:  { th: '🌱 โดรน: ปลูกพืช',        en: '🌱 Drone: Plant crops' },
      PLANT_TREES:  { th: '🌳 โดรน: ปลูกต้นไม้',     en: '🌳 Drone: Plant trees' },
    };
    addNotice(tr(labels[newTask].th, labels[newTask].en), '#10b981');
    say('modeChange');
  }, [addNotice, say]);

  /* ── setAltitude + Voice ── */
  const setAltitude = useCallback((a: DroneAltitude) => {
    if (onAltitudeChange) onAltitudeChange(a); else setInternalAltitude(a);

    if (a === 'GROUND' && altitudeRef.current !== 'GROUND') {
      isLandingRef.current = true; landingRef.current = 0; playSFX('landing');
    } else if (altitudeRef.current === 'GROUND' && a !== 'GROUND') {
      isTakingOffRef.current = true; takeoffRef.current = 0; playSFX('takeoff');
    }
    say('altitudeChange');

    const y = getAltitudeY(a);
    droneWorldPosRef.current.y = y;
    basePosRef.current.y = y;
    addNotice(
      a === 'GROUND' ? tr('🚁 โดรน: เดินบนพื้น', '🚁 Drone: Ground mode')
      : a === 'LOW' ? tr('🚁 โดรน: บินต่ำ', '🚁 Drone: Low altitude')
      : a === 'NORMAL' ? tr('🚁 โดรน: บินปกติ', '🚁 Drone: Normal altitude')
      : tr('🚁 โดรน: บินสูง', '🚁 Drone: High altitude'),
      '#a78bfa'
    );
  }, [onAltitudeChange, addNotice, getAltitudeY, playSFX, say]);

  /* ── Sync mode ── */
  useEffect(() => {
    const prev = prevModeRef.current;
    modeRef.current = currentMode;
    prevModeRef.current = currentMode;

    if (prev !== currentMode) {
      targetRef.current = null; timerRef.current = 0; pendingVerifyRef.current = null;

      if (currentMode === 'FOLLOW') {
        phaseRef.current = 'FOLLOWING';
        setStatusIfChanged(tr('🚁 ตามหลังผู้เล่น', '🚁 Following player'));
      } else if (currentMode === 'LEAD') {
        phaseRef.current = 'LEADING';
        setStatusIfChanged(tr('🚁 นำหน้าผู้เล่น', '🚁 Leading player'));
      } else if (currentMode === 'PATROL') {
        phaseRef.current = 'PATROLLING'; patrolAngleRef.current = 0;
        setStatusIfChanged(tr('🚁 บินตรวจการณ์', '🚁 Patrolling'));
      } else if (currentMode === 'AUTO') {
        phaseRef.current = 'IDLE';
        setStatusIfChanged(tr('พร้อม', 'Ready'));
      } else if (currentMode === 'OFF') {
        phaseRef.current = 'IDLE';
        batteryRef.current = BATTERY_MAX; cargoRef.current = [];
        syncBattery();
        setStatusIfChanged(tr('ปิด', 'Off'));
      }
    }
  }, [currentMode, setStatusIfChanged, syncBattery]);

  /* ── Sync altitude ── */
  useEffect(() => {
    altitudeRef.current = currentAltitude;
    const y = getAltitudeY(currentAltitude);
    if (!isTakingOffRef.current && !isLandingRef.current) {
      droneWorldPosRef.current.y = y;
      basePosRef.current.y = y;
      if (droneRef.current) droneRef.current.position.y = y;
    }
  }, [currentAltitude, getAltitudeY]);

  /* ── Sync player ── */
  useEffect(() => {
    if (!playerPosition) return;
    playerPosRef.current = {
      x: playerPosition.x, z: playerPosition.z,
      heading: playerPosition.heading ?? 0,
    };
  }, [playerPosition?.x, playerPosition?.z, playerPosition?.heading]);

  /* ── Sync isActive ── */
  useEffect(() => {
    enabledRef.current = isActive;
    if (droneRef.current) droneRef.current.visible = isActive;

    if (!isActive) {
      phaseRef.current = 'IDLE';
      targetRef.current = null; pendingVerifyRef.current = null;
      timerRef.current = 0; cargoRef.current = [];
      batteryRef.current = BATTERY_MAX;
      lowBatterySpokenRef.current = false;
      cargoFullSpokenRef.current = false;
      distanceAccumRef.current = 0;
      syncBattery();
      droneHeadingRef.current = 0;
      droneWorldPosRef.current.copy(getBasePos());
      basePosRef.current.copy(getBasePos());
      setStatusIfChanged(tr('ปิด', 'Off'));
      voiceRef.current.stopVoice();
    } else {
      isTakingOffRef.current = true; takeoffRef.current = 0;
    }
  }, [isActive, syncBattery, setStatusIfChanged, getBasePos]);

  /* ── โหลดโมเดล ── */
  useDroneModel({
    scene, isActive, getBasePos,
    droneLoadedRef, droneRef, droneWorldPosRef, basePosRef,
    propellersRef, modelHeightRef, spotlightRef, spotlightTargetRef, enabledRef,
  });

  /* ── สปอตไลต์กลางคืน ── */
  const checkIsNight = (tod: number | string = 12): boolean => {
    if (typeof tod === 'string') return tod === 'night';
    return tod >= NIGHT_START || tod < NIGHT_END;
  };

  useEffect(() => {
    if (!spotlightRef.current) return;
    const isNight = checkIsNight(timeOfDay);
    spotlightRef.current.intensity = isNight && isActive ? SPOTLIGHT_INTENSITY : 0;
  }, [timeOfDay, isActive]);

  /* ── Mini-map ── */
  const { canvasRef: miniMapCanvasRef } = useDroneMiniMap({
    // รวม isActive: แผงแผนที่ mount ตอนโดรนทำงาน → effect ต้องรันใหม่ตอนนั้น (แก้แผนที่ว่างเปล่า)
    showMiniMap: showMiniMap && isActive, plots: props.plots, trees: props.trees,
    dronePosForMapRef, targetPosForMapRef, playerPosRef,
  });

  /* ═══════════════════════════════════════════════
     Main Loop
     ═══════════════════════════════════════════════ */
  useEffect(() => {
    if (!isActive) return;
    let raf = 0;
    let lastT = performance.now();

    const isSkipped = (key: string) => {
      const until = skipRef.current.get(key);
      if (!until) return false;
      if (until < performance.now()) { skipRef.current.delete(key); return false; }
      return true;
    };
    const markSkip = (key: string) => skipRef.current.set(key, performance.now() + SKIP_TTL_MS);

    const rotateTowards = (targetAngle: number, dt: number) => {
      let diff = targetAngle - droneHeadingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      droneHeadingRef.current += diff * smoothFactor(8, dt);
    };

    const avoidObstacles = (from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 => {
      const obs = obstaclesRef.current;
      if (obs.length === 0) return to;
      const dir = _dirScratch.subVectors(to, from);
      const dist = dir.length();
      if (dist < 0.001) return to;
      dir.divideScalar(dist);
      for (const o of obs) {
        const ox = o.x - from.x;
        const oz = o.z - from.z;
        const t = Math.max(0, Math.min(dist, ox * dir.x + oz * dir.z));
        const cx = from.x + dir.x * t;
        const cz = from.z + dir.z * t;
        const d = Math.hypot(cx - o.x, cz - o.z);
        if (d < o.radius + 1.2) {
          if (altitudeRef.current === 'GROUND') {
            const perpX = -dir.z; const perpZ = dir.x;
            const side = ox * perpX + oz * perpZ > 0 ? 1 : -1;
            return new THREE.Vector3(
              to.x + perpX * side * (o.radius + 1.5), to.y,
              to.z + perpZ * side * (o.radius + 1.5)
            );
          }
          return new THREE.Vector3(to.x, Math.max(to.y, o.radius + 2), to.z);
        }
      }
      return to;
    };

    const computeFollowTarget = (): THREE.Vector3 => {
      const p = playerPosRef.current;
      const h = p.heading;
      const bx = p.x - Math.sin(h) * FOLLOW_DISTANCE;
      const bz = p.z - Math.cos(h) * FOLLOW_DISTANCE;
      return avoidObstacles(droneWorldPosRef.current,
        new THREE.Vector3(bx, getAltitudeY(altitudeRef.current), bz));
    };

    const computeLeadTarget = (): THREE.Vector3 => {
      const p = playerPosRef.current;
      const h = p.heading;
      const lx = p.x + Math.sin(h) * LEAD_DISTANCE;
      const lz = p.z + Math.cos(h) * LEAD_DISTANCE;
      return avoidObstacles(droneWorldPosRef.current,
        new THREE.Vector3(lx, getAltitudeY(altitudeRef.current), lz));
    };

    const computePatrolTarget = (dt: number): THREE.Vector3 => {
      patrolAngleRef.current += dt * PATROL_SPEED;
      return new THREE.Vector3(
        -2 + Math.cos(patrolAngleRef.current) * PATROL_RADIUS,
        getAltitudeY(altitudeRef.current),
        Math.sin(patrolAngleRef.current) * PATROL_RADIUS
      );
    };

    const findFreeSpotForTree = (): { gx: number; gz: number; x: number; z: number } | null => {
      const cbs = callbacksRef.current;
      if (!cbs.isCellFree) return null;
      for (let i = 0; i < 30; i++) {
        const gx = Math.round((Math.random() - 0.5) * 40);
        const gz = Math.round((Math.random() - 0.5) * 40);
        const result = cbs.isCellFree(gx, gz, cbs.houses ?? [], cbs.plots, cbs.rocks ?? [], cbs.map2Unlocked ?? false);
        if (result.free) {
          const { x, z } = gridToWorld(gx, gz);
          return { gx, gz, x, z };
        }
      }
      return null;
    };

    const pickNextTarget = (): DroneTarget | null => {
      const { plots, trees } = callbacksRef.current;
      const taskFilter = taskModeRef.current;
      type C = DroneTarget & { dist: number; priority: number };
      const candidates: C[] = [];
      const y = getAltitudeY(altitudeRef.current);

      // ✅ กระเป๋าเต็ม → ไม่รับงานเพิ่ม ให้กลับฐาน
      if (cargoRef.current.length >= CARGO_CAPACITY) return null;

      /* ══ แปลงผัก ══ */
      for (const p of plots) {
        let job: JobKind | null = null;
        const isReady = p.status === 'READY' || (p as any).state === 'ready';
        const isGrowing = p.status === 'PLANTED' || p.status === 'GROWING' || (p as any).state === 'growing';
        const isEmpty = p.status === 'EMPTY' || p.status === 'PLOWED' || (p as any).state === 'empty' || (p as any).state === 'plowed';

        if (isReady) {
          if (taskFilter !== 'ALL' && taskFilter !== 'HARVEST_ONLY') continue;
          job = 'HARVEST';
        } else if (isGrowing && !p.isWatered) {
          if (taskFilter !== 'ALL' && taskFilter !== 'WATER_ONLY') continue;
          job = 'WATER';
        } else if (isEmpty) {
          if (taskFilter !== 'ALL' && taskFilter !== 'PLANT_CROPS') continue;
          const seedToPlant: CropType = p.cropType ?? callbacksRef.current.selectedSeed;
          if (!hasSeed(seedToPlant)) continue;
          job = 'REPLANT';
        }
        
        if (!job) continue;
        const key = `plot:${p.id}:${job}`;
        if (isSkipped(key)) continue;
        const pos = new THREE.Vector3(p.worldX, y, p.worldZ);
        const label =
          job === 'HARVEST' ? tr(`เก็บแปลง #${p.id}`, `Harvest #${p.id}`)
          : job === 'WATER' ? tr(`รดน้ำแปลง #${p.id}`, `Water #${p.id}`)
          : tr(`จัดแปลง #${p.id}`, `Replant #${p.id}`);
        candidates.push({
          pos, cargo: { kind: 'plot', job, id: String(p.id), label },
          dist: droneWorldPosRef.current.distanceTo(pos),
          priority: JOB_PRIORITY[job],
        });
      }

      /* ══ ต้นไม้ (เก็บผล) ══ */
      for (const trItem of trees) {
        if (trItem.stage !== 'ready' || !TREE_DEFINITIONS[trItem.type]?.isFruitTree) continue;
        if (taskFilter !== 'ALL' && taskFilter !== 'HARVEST_ONLY') continue;
        const key = `tree:${trItem.id}:HARVEST`;
        if (isSkipped(key)) continue;
        const pos = new THREE.Vector3(trItem.worldX, y, trItem.worldZ);
        candidates.push({
          pos,
          cargo: { kind: 'tree', job: 'HARVEST', id: trItem.id, label: getTreeName(trItem.type) },
          dist: droneWorldPosRef.current.distanceTo(pos),
          priority: JOB_PRIORITY.HARVEST,
        });
      }

      /* ══ ปลูกต้นไม้ ══ */
      if (taskFilter === 'ALL' || taskFilter === 'PLANT_TREES') {
        const saplingTypes = availableSaplingTypes();
        if (saplingTypes.length > 0 && callbacksRef.current.plantTree && callbacksRef.current.isCellFree) {
          const spot = findFreeSpotForTree();
          if (spot) {
            const treeType = saplingTypes[0];
            const pos = new THREE.Vector3(spot.x, y, spot.z);
            const def = TREE_DEFINITIONS[treeType];
            candidates.push({
              pos,
              cargo: {
                kind: 'tree', job: 'PLANT_TREE',
                id: `plant_${spot.gx}_${spot.gz}`,
                label: tr(`ปลูก ${def.name}`, `Plant ${def.nameEn}`),
                treeType, gridX: spot.gx, gridZ: spot.gz,
              },
              dist: droneWorldPosRef.current.distanceTo(pos),
              priority: JOB_PRIORITY.PLANT_TREE,
            });
          }
        }
      }

      if (candidates.length === 0) return null;
      candidates.sort((a, b) => (b.priority !== a.priority ? b.priority - a.priority : a.dist - b.dist));
      return { pos: candidates[0].pos, cargo: candidates[0].cargo };
    };

    const doJob = (cargo: Cargo): boolean => {
      const cbs = callbacksRef.current;
      try {
        if (cargo.kind === 'tree') {
          if (cargo.job === 'HARVEST') {
            const tree = cbs.trees.find((x) => x.id === cargo.id);
            if (!tree || tree.stage !== 'ready') return false;
            return cbs.harvestTree(tree.id, cbs.addTreeHarvest, cbs.addXP);
          }
          if (cargo.job === 'PLANT_TREE') {
            if (!cbs.plantTree || !cbs.spendSapling) return false;
            if (!cargo.treeType || cargo.gridX === undefined || cargo.gridZ === undefined) return false;
            if (!hasSapling(cargo.treeType)) return false;
            return cbs.plantTree(cargo.gridX, cargo.gridZ, cargo.treeType, cbs.spendSapling, cbs.addXP,
              cbs.houses ?? [], cbs.plots, cbs.rocks ?? [], cbs.map2Unlocked ?? false);
          }
          return false;
        }

        const plot = cbs.plots.find((p) => String(p.id) === cargo.id);
        if (!plot) return false;

        if (cargo.job === 'HARVEST') {
          const isReady = plot.status === 'READY' || (plot as any).state === 'ready';
          if (!isReady) return false;
          const seed: CropType = plot.cropType ?? cbs.selectedSeed;
          try {
            cbs.interactPlot(plot.id, 'sickle', seed, 0, cbs.spendSeed, cbs.addCrop, cbs.addXP, cbs.spendCoins);
          } catch (err) {
            console.warn('[Drone] interactPlot error:', err);
            return false;
          }
          return true;
        }
        
        if (cargo.job === 'WATER') {
          if (plot.isWatered) return false;
          return cbs.waterPlot(plot.id);
        }
        
        if (cargo.job === 'REPLANT') {
          const isEmpty = plot.status === 'EMPTY' || plot.status === 'PLOWED' || (plot as any).state === 'empty' || (plot as any).state === 'plowed';
          if (!isEmpty) return false;
          const seed: CropType = plot.cropType ?? cbs.selectedSeed;
          if (!hasSeed(seed)) return false;
          return cbs.replantPlot(plot.id, seed, cbs.spendSeed);
        }
        return false;
      } catch (e) {
        console.warn('[Drone] job error', e);
        return false;
      }
    };

    const verifyJob = (cargo: Cargo): boolean => {
      const cbs = callbacksRef.current;
      if (cargo.kind === 'tree') {
        if (cargo.job === 'PLANT_TREE') {
          return !!cbs.trees.find((x) => x.gridX === cargo.gridX && x.gridZ === cargo.gridZ);
        }
        const tree = cbs.trees.find((x) => x.id === cargo.id);
        if (!tree) return true;
        return tree.stage !== 'ready';
      }
      const plot = cbs.plots.find((p) => String(p.id) === cargo.id);
      if (!plot) return true;
      
      if (cargo.job === 'HARVEST') {
        return plot.status !== 'READY' && (plot as any).state !== 'ready';
      }
      if (cargo.job === 'WATER') return plot.isWatered === true;
      if (cargo.job === 'REPLANT') {
        const isEmpty = plot.status === 'EMPTY' || plot.status === 'PLOWED' || (plot as any).state === 'empty' || (plot as any).state === 'plowed';
        return !isEmpty;
      }
      return true;
    };

    // ✅ FIX: ถ้าไม่มีงาน ไม่ต้องกลับฐาน แต่ให้เปลี่ยนเป็นสถานะ HOVERING (ลอยรอ)
    const goNextOrHome = () => {
      targetRef.current = null;
      timerRef.current = 0;
      const needCharge = batteryRef.current <= 0;
      const cargoFull = cargoRef.current.length >= CARGO_CAPACITY;

      if (cargoFull && !cargoFullSpokenRef.current) {
        cargoFullSpokenRef.current = true;
        say('fullCargo'); playSFX('warning');
      }
      if (!cargoFull) cargoFullSpokenRef.current = false;

      if (batteryRef.current <= 2 && batteryRef.current > 0 && !lowBatterySpokenRef.current) {
        lowBatterySpokenRef.current = true;
        say('lowBattery'); playSFX('warning');
      }
      if (batteryRef.current > 2) lowBatterySpokenRef.current = false;

      if (needCharge || cargoFull) {
        // ต้องกลับฐานจริงๆ (แบตหมด หรือของเต็ม)
        phaseRef.current = 'TRAVEL_HOME';
        setStatusIfChanged(tr(`กลับฐาน (${cargoRef.current.length} ชิ้น, 🔋${batteryRef.current})`,
          `Returning (${cargoRef.current.length} items, 🔋${batteryRef.current})`));
        return;
      }
      
      const more = pickNextTarget();
      if (more) {
        targetRef.current = more;
        phaseRef.current = 'TRAVEL_TO';
        setStatusIfChanged(tr(`บินไป ${more.cargo.label}`, `Flying to ${more.cargo.label}`));
      } else {
        // หากมีผลผลิตค้างในกระเป๋า ให้บินกลับฐานเพื่อส่งของและรับเหรียญ/XP
        if (cargoRef.current.length > 0) {
          phaseRef.current = 'TRAVEL_HOME';
          setStatusIfChanged(tr(`ส่งผลผลิตเข้าฐาน (${cargoRef.current.length} ชิ้น)`,
            `Depositing cargo (${cargoRef.current.length} items)`));
          return;
        }

        // ✅ ไม่มีงานและกระเป๋าว่าง → ลอยรอ (IDLE) เหนือฟาร์ม ไม่บินกลับฐาน
        phaseRef.current = 'IDLE'; 
        const task = taskModeRef.current;
        const noJobsMsg =
          task === 'HARVEST_ONLY' ? tr('ลอยรอผลผลิตที่สุก...', 'Hovering for ripe crops...')
          : task === 'WATER_ONLY' ? tr('ลอยรอแปลงที่ต้องรดน้ำ...', 'Hovering for unwatered plots...')
          : task === 'PLANT_CROPS' ? tr('ลอยรอแปลงว่างสำหรับปลูก...', 'Hovering for empty plots...')
          : task === 'PLANT_TREES' ? tr('ลอยรอที่ว่างสำหรับปลูกต้นไม้...', 'Hovering for free tree spots...')
          : tr('ลอยรอเป้าหมายที่สุก...', 'Hovering & scanning for ripe crops...');
        setStatusIfChanged(noJobsMsg);
      }
    };

    const finishJob = (cargo: Cargo, nextPhase: Phase) => {
      const ok = doJob(cargo);
      if (ok) {
        pendingVerifyRef.current = cargo;
        timerRef.current = 0; phaseRef.current = nextPhase;
        batteryRef.current = Math.max(0, batteryRef.current - 1);
        syncBattery();

        if (cargo.job === 'HARVEST') { playSFX('success'); say('harvest'); }
        else if (cargo.job === 'WATER') { playSFX('success'); say('water'); }
        else if (cargo.job === 'REPLANT') { playSFX('success'); say('replant'); }
        else if (cargo.job === 'PLANT_TREE') { playSFX('success'); say('plantTree'); }

        setStatusIfChanged(tr(`ตรวจสอบ ${cargo.label}`, `Verifying ${cargo.label}`));
      } else {
        markSkip(`${cargo.kind}:${cargo.id}:${cargo.job}`);
        playSFX('error'); goNextOrHome();
      }
    };

    const updateStatsOnSuccess = (cargo: Cargo) => {
      setStats((prev) => {
        const next = { ...prev };
        if (cargo.job === 'HARVEST') next.harvested += 1;
        else if (cargo.job === 'WATER') next.watered += 1;
        else if (cargo.job === 'REPLANT') next.replanted += 1;
        else if (cargo.job === 'PLANT_TREE') next.treesPlanted += 1;
        next.jobsCompleted += 1;
        return next;
      });
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;

      const drone = droneRef.current;
      if (!drone) return;

      /* ── stats: flight time ── */
      flightTimeAccumRef.current += dt;
      if (flightTimeAccumRef.current >= 1) {
        setStats((prev) => ({ ...prev, flightTime: prev.flightTime + Math.floor(flightTimeAccumRef.current) }));
        flightTimeAccumRef.current = 0;
      }

      /* ── stats: distance (throttle 0.5s) ── */
      const curPos = droneWorldPosRef.current;
      const dist = lastPosRef.current.distanceTo(curPos);
      if (dist > 0.001 && dist < 5) {
        distanceAccumRef.current += dist;
        if (distanceAccumRef.current >= 0.5) {
          const d = distanceAccumRef.current;
          distanceAccumRef.current = 0;
          setStats((prev) => ({ ...prev, totalDistance: prev.totalDistance + d }));
        }
      }
      lastPosRef.current.copy(curPos);

      /* ── takeoff ── */
      if (isTakingOffRef.current) {
        takeoffRef.current = Math.min(1, takeoffRef.current + dt / TAKEOFF_DURATION);
        const t = easeInOut(takeoffRef.current);
        const targetY = getAltitudeY(altitudeRef.current);
        droneWorldPosRef.current.y = 0.02 + (targetY - 0.02) * t;
        if (takeoffRef.current >= 1) { isTakingOffRef.current = false; takeoffRef.current = 0; }
      }

      /* ── landing ── */
      if (isLandingRef.current) {
        landingRef.current = Math.min(1, landingRef.current + dt / LANDING_DURATION);
        const t = easeInOut(landingRef.current);
        const startY = getAltitudeY(altitudeRef.current);
        droneWorldPosRef.current.y = startY - (startY - 0.02) * t;
        if (landingRef.current >= 1) { isLandingRef.current = false; landingRef.current = 0; }
      }

      /* ── propellers ── */
      const isGround = altitudeRef.current === 'GROUND';
      const spinSpeed = isGround
        ? phaseRef.current === 'IDLE' ? 8 : 20
        : phaseRef.current === 'IDLE' ? 18 : 40;
      propellersRef.current.forEach((p) => { p.rotation.y += dt * spinSpeed; });

      const phase = phaseRef.current;
      const mode = modeRef.current;
      const speed = getSpeed();
      const baseY = getAltitudeY(altitudeRef.current);

      /* ══════ PATROL ══════ */
      if (mode === 'PATROL') {
        if (phase !== 'PATROLLING') phaseRef.current = 'PATROLLING';
        const targetPos = computePatrolTarget(dt);
        const dir = _dirScratch.subVectors(targetPos, droneWorldPosRef.current);
        const d = moveVec(droneWorldPosRef.current, targetPos, dt, DRONE_SPEED);
        if (d > 0.1) rotateTowards(Math.atan2(dir.x, dir.z), dt);
        if (!isTakingOffRef.current && !isLandingRef.current) droneWorldPosRef.current.y = baseY;
        setStatusIfChanged(tr('🚁 บินตรวจการณ์รอบฟาร์ม', '🚁 Patrolling farm'));
        drone.position.copy(droneWorldPosRef.current);
        drone.rotation.y = droneHeadingRef.current;
        dronePosForMapRef.current = {
          x: droneWorldPosRef.current.x, z: droneWorldPosRef.current.z,
          targetX: targetPos.x, targetZ: targetPos.z, heading: droneHeadingRef.current,
        };
        targetPosForMapRef.current = { x: targetPos.x, z: targetPos.z };
        return;
      }

      /* ══════ FOLLOW / LEAD ══════ */
      if (mode === 'FOLLOW' || mode === 'LEAD') {
        const wantPhase: Phase = mode === 'FOLLOW' ? 'FOLLOWING' : 'LEADING';
        if (phase !== wantPhase) phaseRef.current = wantPhase;
        const targetPos = mode === 'FOLLOW' ? computeFollowTarget() : computeLeadTarget();
        const distToTarget = droneWorldPosRef.current.distanceTo(targetPos);
        const speedCap = Math.min(MAX_FOLLOW_SPEED, distToTarget * 4);
        _moveScratch.subVectors(targetPos, droneWorldPosRef.current);
        if (distToTarget > 0.001) {
          _moveScratch.normalize().multiplyScalar(Math.min(distToTarget, speedCap * dt));
          droneWorldPosRef.current.add(_moveScratch);
        }
        if (!isTakingOffRef.current && !isLandingRef.current) droneWorldPosRef.current.y = baseY;
        const vx = targetPos.x - droneWorldPosRef.current.x;
        const vz = targetPos.z - droneWorldPosRef.current.z;
        if (Math.hypot(vx, vz) > 0.1) rotateTowards(Math.atan2(vx, vz), dt);
        else rotateTowards(playerPosRef.current.heading, dt);

        setStatusIfChanged(
          mode === 'FOLLOW' ? tr('🚁 ตามหลังผู้เล่น', '🚁 Following player')
          : tr('🚁 นำหน้าผู้เล่น', '🚁 Leading player')
        );

        const bob = isGround ? Math.sin(now * 0.004) * 0.02 : Math.sin(now * 0.003) * 0.15;
        drone.position.copy(droneWorldPosRef.current);
        drone.position.y += bob;
        drone.rotation.y = droneHeadingRef.current;
        drone.rotation.z = isGround ? Math.sin(now * 0.008) * 0.03 : 0;
        dronePosForMapRef.current = {
          x: droneWorldPosRef.current.x, z: droneWorldPosRef.current.z,
          targetX: targetPos.x, targetZ: targetPos.z, heading: droneHeadingRef.current,
        };
        targetPosForMapRef.current = { x: targetPos.x, z: targetPos.z };
        return;
      }

      /* ══════ AUTO MODE ══════ */
      if (phase === 'IDLE') {
        if (!enabledRef.current) {
          setStatusIfChanged(tr('ปิด', 'Off'));
        } else {
          // สแกนหางานใหม่เป็นจังหวะทุก 0.8s เพื่อประหยัด CPU 60fps
          timerRef.current += dt;
          if (timerRef.current >= 0.8) {
            timerRef.current = 0;
            const next = pickNextTarget();
            if (next) {
              targetRef.current = next;
              phaseRef.current = 'TRAVEL_TO';
              setStatusIfChanged(tr(`บินไป ${next.cargo.label}`, `Flying to ${next.cargo.label}`));
            } else if (cargoRef.current.length > 0) {
              phaseRef.current = 'TRAVEL_HOME';
              setStatusIfChanged(tr(`ส่งผลผลิตเข้าฐาน (${cargoRef.current.length} ชิ้น)`,
                `Depositing cargo (${cargoRef.current.length} items)`));
            } else {
              const task = taskModeRef.current;
              const noJobsMsg =
                task === 'HARVEST_ONLY' ? tr('ลอยรอผลผลิตที่สุก...', 'Hovering for ripe crops...')
                : task === 'WATER_ONLY' ? tr('ลอยรอแปลงที่ต้องรดน้ำ...', 'Hovering for unwatered plots...')
                : task === 'PLANT_CROPS' ? tr('ลอยรอแปลงว่างสำหรับปลูก...', 'Hovering for empty plots...')
                : task === 'PLANT_TREES' ? tr('ลอยรอที่ว่างสำหรับปลูกต้นไม้...', 'Hovering for free tree spots...')
                : tr('ลอยรอเป้าหมายที่สุก...', 'Hovering & scanning for ripe crops...');
              setStatusIfChanged(noJobsMsg);
            }
          }
        }
      } else if (phase === 'TRAVEL_TO' && targetRef.current) {
        const tgt = targetRef.current.pos;
        const safeTgt = avoidObstacles(droneWorldPosRef.current, tgt);
        const dir = _dirScratch.subVectors(safeTgt, droneWorldPosRef.current);
        const d = moveVec(droneWorldPosRef.current, safeTgt, dt, speed);
        if (d > 0.1) rotateTowards(Math.atan2(dir.x, dir.z), dt);
        if (!isTakingOffRef.current && !isLandingRef.current) droneWorldPosRef.current.y = baseY;
        if (d < 0.15) {
          timerRef.current = 0;
          const job = targetRef.current.cargo.job;
          phaseRef.current = job === 'HARVEST' ? 'HARVESTING'
            : job === 'WATER' ? 'WATERING'
            : job === 'REPLANT' ? 'REPLANTING' : 'PLANTING_TREE';
          setStatusIfChanged(tr(`ทำ ${targetRef.current.cargo.label}`, `Doing ${targetRef.current.cargo.label}`));
        }
      } else if (phase === 'HARVESTING' && targetRef.current) {
        timerRef.current += dt;
        if (timerRef.current >= HARVEST_DELAY) finishJob(targetRef.current.cargo, 'VERIFYING');
      } else if (phase === 'WATERING' && targetRef.current) {
        timerRef.current += dt;
        if (timerRef.current >= WATER_DELAY) finishJob(targetRef.current.cargo, 'VERIFYING');
      } else if (phase === 'REPLANTING' && targetRef.current) {
        timerRef.current += dt;
        if (timerRef.current >= REPLANT_DELAY) finishJob(targetRef.current.cargo, 'VERIFYING');
      } else if (phase === 'PLANTING_TREE' && targetRef.current) {
        timerRef.current += dt;
        if (timerRef.current >= PLANT_TREE_DELAY) finishJob(targetRef.current.cargo, 'VERIFYING');
      } else if (phase === 'VERIFYING' && pendingVerifyRef.current) {
        timerRef.current += dt;
        if (timerRef.current >= VERIFY_DELAY) {
          const cargo = pendingVerifyRef.current;
          pendingVerifyRef.current = null;
          if (verifyJob(cargo)) { cargoRef.current.push(cargo); updateStatsOnSuccess(cargo); }
          else markSkip(`${cargo.kind}:${cargo.id}:${cargo.job}`);
          goNextOrHome();
        }
      } else if (phase === 'TRAVEL_HOME') {
        const homePos = getBasePos();
        const dir = _dirScratch.subVectors(homePos, droneWorldPosRef.current);
        const d = moveVec(droneWorldPosRef.current, homePos, dt, speed);
        if (d > 0.1) rotateTowards(Math.atan2(dir.x, dir.z), dt);
        if (!isTakingOffRef.current && !isLandingRef.current) droneWorldPosRef.current.y = baseY;
        if (d < 0.2) {
          timerRef.current = 0; phaseRef.current = 'UNLOADING';
          setStatusIfChanged(tr('ขนของลงฐาน...', 'Unloading cargo...'));
        }
      } else if (phase === 'UNLOADING') {
        timerRef.current += dt;
        if (timerRef.current >= UNLOAD_DELAY) {
          const n = cargoRef.current.length;
          if (n > 0) {
            const harvestCount = cargoRef.current.filter((c) => c.job === 'HARVEST').length;
            const otherCount = n - harvestCount;
            const coins = harvestCount * 2 + otherCount * 1;
            const xp = harvestCount * 2 + otherCount * 1;
            callbacksRef.current.earnCoins(coins);
            callbacksRef.current.addXP(xp);
            callbacksRef.current.addNotice(
              tr(`🚁 โดรนทำงาน ${n} งานสำเร็จ (+${coins} 🪙, +${xp} XP)`,
                `🚁 Drone completed ${n} jobs (+${coins} 🪙, +${xp} XP)`), '#22d3ee');
          }
          cargoRef.current = [];
          timerRef.current = 0;
          if (batteryRef.current <= 0) {
            phaseRef.current = 'CHARGING';
            setStatusIfChanged(tr('🔋 ชาร์จพลังงาน...', '🔋 Charging...'));
            playSFX('charging'); say('charging');
          } else {
            phaseRef.current = 'IDLE'; say('ready');
          }
        }
      } else if (phase === 'CHARGING') {
        timerRef.current += dt;
        if (timerRef.current >= CHARGE_DELAY) {
          batteryRef.current = BATTERY_MAX;
          lowBatterySpokenRef.current = false;
          syncBattery(); timerRef.current = 0; phaseRef.current = 'IDLE';
          setStatusIfChanged(tr('ชาร์จเต็ม - พร้อมทำงาน', 'Fully charged - Ready'));
          say('ready');
        }
      }

      /* ── apply position ── */
      if (!isTakingOffRef.current && !isLandingRef.current) droneWorldPosRef.current.y = baseY;
      drone.position.copy(droneWorldPosRef.current);
      const bob = isGround ? Math.sin(now * 0.004) * 0.02 : Math.sin(now * 0.003) * 0.15;
      drone.position.y += bob;
      drone.rotation.y = droneHeadingRef.current;
      drone.rotation.z = isGround ? Math.sin(now * 0.008) * 0.03 : 0;
      dronePosForMapRef.current = {
        x: droneWorldPosRef.current.x, z: droneWorldPosRef.current.z,
        targetX: targetRef.current?.pos.x ?? droneWorldPosRef.current.x,
        targetZ: targetRef.current?.pos.z ?? droneWorldPosRef.current.z,
        heading: droneHeadingRef.current,
      };
      targetPosForMapRef.current = targetRef.current
        ? { x: targetRef.current.pos.x, z: targetRef.current.pos.z } : null;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastT = performance.now();
    };
  }, [isActive, taskMode, setStatusIfChanged, syncBattery, getBasePos, getSpeed, getAltitudeY,
      hasSeed, hasSapling, availableSaplingTypes, say, playSFX]);

  const isNight = checkIsNight(timeOfDay);

  if (!isActive) return null;

  return (
    <>
      <DroneHUD
        status={status}
        battery={battery}
        currentAltitude={currentAltitude}
        isNight={isNight}
        mode={currentMode}
        onClick={() => setShowDashboardModal(true)}
      />
      <ModeButtonsGroup currentMode={currentMode} onChange={setMode} />
      <AltitudeButtonsGroup currentAltitude={currentAltitude} onChange={setAltitude} />
      <TaskModeButtonsGroup currentTask={taskMode} onChange={handleSetTaskMode} />
      <DashboardToggleButtons
        onToggleDashboard={() => setShowDashboard((v) => !v)}
        onToggleMiniMap={() => setShowMiniMap((v) => !v)}
      />
      <MiniMapPanel canvasRef={miniMapCanvasRef} show={showMiniMap} />
      <StatsDashboard show={showDashboard} stats={stats} onReset={() => setStats({ ...DEFAULT_STATS })} />

      <DroneDashboardModal
        show={showDashboardModal}
        onClose={() => setShowDashboardModal(false)}
        currentMode={currentMode}
        onModeChange={setMode}
        currentAltitude={currentAltitude}
        onAltitudeChange={setAltitude}
        currentTaskMode={taskMode}
        onTaskModeChange={handleSetTaskMode}
        battery={battery}
        onReturnToBase={() => {
          setMode('OFF');
          setShowDashboardModal(false);
        }}
        stats={stats}
        onResetStats={() => setStats({ ...DEFAULT_STATS })}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => {}}
        radarEnabled={showMiniMap}
        onToggleRadar={() => setShowMiniMap((v) => !v)}
      />
    </>
  );
};