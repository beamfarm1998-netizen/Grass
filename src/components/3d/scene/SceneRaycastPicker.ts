// src/components/3d/scene/SceneRaycastPicker.ts
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  FarmPlot,
  gridToWorld,
  PlacedAnimal,
  PlacedHouse,
  PlacedRock,
  PlacedTree,
  PlacingState,
  RockType,
  ToolType,
  TREE_DEFINITIONS,
  worldToGrid,
} from '../../../types/game';
import type { HarvestPhase, HarvestTarget } from '../../../hooks/useHarvestMode';
import type { FarmTerrain3D } from '../FarmTerrain';
import type { FarmTerrainMap2 } from '../FarmTerrainMap2';
import type { FarmCrops3D } from '../FarmCrops';
import type { FarmTrees3D } from '../FarmTrees';
import type { FarmGridOverlay3D } from '../FarmGridOverlay';
import type { FarmPlayer3D } from '../FarmPlayer';
import type { FarmCameraControls, PointerSource } from '../FarmCameraControls';
import type { FarmHouses3D } from '../FarmHouses';
import type { FarmAnimals3D } from '../FarmAnimals';
import type { FarmRocks3D } from '../FarmRocks';
import {
  moveActiveGhostAtPoint,
  type AnyGhostState,
  type DoubleTapPlacementTracker,
  type GhostReporter,
} from './SceneGhostPreview';

import { POND } from '../../../data/terrainFeatures';

export interface SceneRaycastState {
  onPlotClick: (plotId: number) => void;
  onPlayerMove?: (pos: { x: number; z: number; heading?: number }) => void;
  activeTool: ToolType;
  placing: PlacingState | null;
  plots: FarmPlot[];
  houses: PlacedHouse[];
  animals: PlacedAnimal[];
  rocks: PlacedRock[];
  trees: PlacedTree[];
  gridVisible: boolean;
  selectedHouseId?: string | null;
  selectedRockId?: string | null;
  onHouseSelect?: (id: string | null) => void;
  onHouseMove?: (id: string) => void;
  onHouseInteract?: (id: string) => void;
  onPondInteract?: () => void;
  onClearFingerHouse?: () => void;
  onGhostChange?: (g: AnyGhostState | null) => void;
  onConfirmPlace?: (g?: AnyGhostState | null) => void;
  onAnimalSelect?: (id: string | null) => void;
  onAnimalPet?: (animal: PlacedAnimal) => void;
  onRockSelect?: (id: string | null) => void;
  onRockMove?: (id: string) => void;
  onTreeClick?: (treeId: string) => void;
  onGridCellClick?: (gx: number, gz: number) => void;
  isCellFree?: (gx: number, gz: number) => { free: boolean; reason?: string };
  canPlacePlotAt?: (gx: number, gz: number) => { valid: boolean; reason?: string };
  isPlayerLocked: boolean;
  isPlayerHidden?: boolean;
  isMovingPlotMode: boolean;
  selectedPlotToMove?: number | null;
  unlockedZones?: number[];
  onOpenExpansionModal?: () => void;
  harvestPhase?: HarvestPhase;
  onHarvestHover?: (target: HarvestTarget | null) => void;
  onHarvestToggle?: (target: HarvestTarget) => void;
  structureEditEnabled?: boolean;
  structureEditClickMode?: 'double' | 'single';
  touchSlideEnabled?: boolean;
}

export interface SceneRaycastContext {
  container: HTMLElement;
  camera: THREE.PerspectiveCamera;
  player: FarmPlayer3D;
  cameraControls: FarmCameraControls;
  callbacksRef: MutableRefObject<SceneRaycastState>;
  terrainRef: MutableRefObject<FarmTerrain3D | null>;
  terrainMap2Ref: MutableRefObject<FarmTerrainMap2 | null>;
  cropsRef: MutableRefObject<FarmCrops3D | null>;
  treesRef: MutableRefObject<FarmTrees3D | null>;
  gridOverlayRef: MutableRefObject<FarmGridOverlay3D | null>;
  housesRef: MutableRefObject<FarmHouses3D | null>;
  animalsRef: MutableRefObject<FarmAnimals3D | null>;
  rocksRef: MutableRefObject<FarmRocks3D | null>;
  ghostReporter: GhostReporter;
  tapTracker: DoubleTapPlacementTracker;
  validateRockFn: (gx: number, gz: number, type: RockType) => { valid: boolean; reason?: string };
}

const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _planeHitPoint = new THREE.Vector3();

function isModalOpeningHouseType(type: number): boolean {
  return (
    type === 0 ||
    type === 1 ||
    type === 2 ||
    type === 3 ||
    type === 4 ||
    type === 17 ||
    type === 20 ||
    type === 25 ||
    type === 26 ||
    type === 27 ||
    type === 28 ||
    type === 29
  );
}

/**
 * สร้างตัวจัดการ Raycast Picking / Hover / Swipe / Long-Press ทั้งหมดแยกออกจาก FarmScene.tsx
 */
export function createScenePickHandlers(ctx: SceneRaycastContext): {
  handlePick: (clientX: number, clientY: number, source?: PointerSource) => void;
  handleDoublePick: (clientX: number, clientY: number, source?: PointerSource) => void;
  handleLongPress: (clientX: number, clientY: number, source?: PointerSource) => void;
  handleSwipeBegin: () => void;
  handleSwipePick: (clientX: number, clientY: number, source?: PointerSource) => void;
  handleHover: (clientX: number, clientY: number) => void;
  handlePlacementMove: (clientX: number, clientY: number) => void;
} {
  const {
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
    validateRockFn,
  } = ctx;

  let lastStructureTap: { kind: 'house' | 'rock'; id: string; time: number } | null = null;
  let lastStructureSelect: { kind: 'house' | 'rock'; id: string; time: number } | null = null;
  let pendingHouseInteractTimer: number | null = null;
  const swipedKeysInStroke = new Set<string>();
  const DOUBLE_TAP_WINDOW_MS = 480;
  const SELECT_TO_MOVE_GUARD_MS = 320;
  const MODAL_HOUSE_TAP_DELAY_MS = 210;

  const cancelPendingHouseInteract = () => {
    if (pendingHouseInteractTimer !== null) {
      window.clearTimeout(pendingHouseInteractTimer);
      pendingHouseInteractTimer = null;
    }
  };

  const updateRayFromClient = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_pointer, camera);
  };

  const getRaycastGroundMeshes = (): THREE.Object3D[] => {
    const meshes: THREE.Object3D[] = [];
    if (terrainRef.current) meshes.push(terrainRef.current.groundMesh);
    if (callbacksRef.current.unlockedZones?.includes(5) && terrainMap2Ref.current) {
      meshes.push(terrainMap2Ref.current.groundMesh);
    }
    return meshes;
  };

  const isRayHittingPond = (): boolean => {
    const groundMeshes = getRaycastGroundMeshes();
    if (groundMeshes.length > 0) {
      const gh = _raycaster.intersectObjects(groundMeshes, false);
      if (gh.length > 0) {
        const px = gh[0].point.x;
        const pz = gh[0].point.z;
        if (Math.hypot(px - POND.x, pz - POND.z) <= POND.radius + 2.2) {
          return true;
        }
      }
    }
    if (_raycaster.ray.intersectPlane(_groundPlane, _planeHitPoint)) {
      if (Math.hypot(_planeHitPoint.x - POND.x, _planeHitPoint.z - POND.z) <= POND.radius + 2.0) {
        return true;
      }
    }
    return false;
  };

  const pickHarvestTarget = (): HarvestTarget | null => {
    if (treesRef.current) {
      const hitTreeId = treesRef.current.pickTree(_raycaster);
      if (hitTreeId) {
        const tree = callbacksRef.current.trees.find((t) => t.id === hitTreeId);
        if (tree) {
          return {
            type: 'tree',
            id: tree.id,
            isReady: tree.stage === 'ready' && Boolean(TREE_DEFINITIONS[tree.type]?.isFruitTree),
          };
        }
      }
    }
    if (cropsRef.current) {
      const hits = _raycaster.intersectObjects(cropsRef.current.interactiveMeshes, false);
      if (hits.length > 0) {
        const plotId = hits[0].object.userData.plotId;
        if (plotId !== undefined) {
          const plot = callbacksRef.current.plots.find((p) => p.id === plotId);
          if (plot) {
            return {
              type: 'plot',
              id: String(plot.id),
              isReady: plot.status === 'READY',
            };
          }
        }
      }
    }
    return null;
  };

  const handleSwipeBegin = () => {
    swipedKeysInStroke.clear();
  };

  const handleSwipePick = (clientX: number, clientY: number) => {
    const cb = callbacksRef.current;
    if (cb.placing || cb.isMovingPlotMode) return;
    if (cb.harvestPhase && cb.harvestPhase !== 'IDLE') {
      if (cb.harvestPhase === 'SELECTING') {
        updateRayFromClient(clientX, clientY);
        const target = pickHarvestTarget();
        if (target && target.isReady) {
          const key = `${target.type}:${target.id}`;
          if (!swipedKeysInStroke.has(key)) {
            swipedKeysInStroke.add(key);
            cb.onHarvestToggle?.(target);
          }
        }
      }
      return;
    }

    updateRayFromClient(clientX, clientY);

    // 1. ปาดนิ้วโดนแปลงผัก (ทั้ง mesh และตำแหน่งช่องดินใต้ปลายนิ้ว)
    let hitPlotId: number | undefined;
    if (cropsRef.current) {
      const hits = _raycaster.intersectObjects(cropsRef.current.interactiveMeshes, false);
      if (hits.length > 0 && hits[0].object.userData.plotId !== undefined) {
        hitPlotId = hits[0].object.userData.plotId as number;
      }
    }
    if (hitPlotId === undefined && _raycaster.ray.intersectPlane(_groundPlane, _planeHitPoint)) {
      const px = _planeHitPoint.x;
      const pz = _planeHitPoint.z;
      const found = cb.plots.find(
        (p) => Math.abs(p.worldX - px) <= 1.05 && Math.abs(p.worldZ - pz) <= 1.05
      );
      if (found) hitPlotId = found.id;
    }

    if (hitPlotId !== undefined) {
      const key = `plot:${hitPlotId}`;
      if (!swipedKeysInStroke.has(key)) {
        swipedKeysInStroke.add(key);
        cb.onPlotClick(hitPlotId);
      }
      return;
    }

    // 2. ปาดนิ้วเก็บผลไม้สุกหรือรดน้ำต้นไม้แห้งรวดเดียว
    if (treesRef.current) {
      const hitTreeId = treesRef.current.pickTree(_raycaster);
      if (hitTreeId) {
        const key = `tree:${hitTreeId}`;
        if (!swipedKeysInStroke.has(key)) {
          const targetTree = cb.trees.find((t) => t.id === hitTreeId);
          if (targetTree) {
            const isRipeFruit =
              targetTree.stage === 'ready' && Boolean(TREE_DEFINITIONS[targetTree.type]?.isFruitTree);
            const isDryGrowing = !targetTree.isWatered && targetTree.stage !== 'ready';
            if (isRipeFruit || isDryGrowing) {
              swipedKeysInStroke.add(key);
              treesRef.current.triggerShake(hitTreeId, 0.55);
              cb.onTreeClick?.(hitTreeId);
            }
          }
        }
      }
    }
  };

  const handleLongPress = (clientX: number, clientY: number) => {
    const cb = callbacksRef.current;
    cancelPendingHouseInteract();
    if (cb.placing || cb.isMovingPlotMode) return;
    if (cb.harvestPhase && cb.harvestPhase !== 'IDLE') return;

    updateRayFromClient(clientX, clientY);

    if (animalsRef.current) {
      const hitAnimal = animalsRef.current.pickAnimal(_raycaster);
      if (hitAnimal) {
        cb.onAnimalSelect?.(hitAnimal.id);
        return;
      }
    }

    const houseHit = housesRef.current?.pickHouseHit(_raycaster) ?? null;
    const rockHit = rocksRef.current?.pickRockHit(_raycaster) ?? null;
    const now = performance.now();

    if (houseHit && (!rockHit || houseHit.distance <= rockHit.distance)) {
      lastStructureTap = null;
      lastStructureSelect = { kind: 'house', id: houseHit.id, time: now };
      cb.onHouseSelect?.(houseHit.id);
      return;
    }

    if (rockHit) {
      lastStructureTap = null;
      lastStructureSelect = { kind: 'rock', id: rockHit.id, time: now };
      cb.onRockSelect?.(rockHit.id);
    }
  };

  const handlePick = (
    clientX: number,
    clientY: number,
    source: PointerSource = 'mouse'
  ) => {
    const cb = callbacksRef.current;
    const phase = cb.harvestPhase;
    // เมื่อซ่อนตัวละครชาย/หญิง (โหมดนิ้ว Hay Day) ไม่ต้องสั่งตัวละครที่ซ่อนอยู่เดินตามนิ้ว
    const canWalkByPointer =
      !cb.isPlayerHidden &&
      !cb.isPlayerLocked &&
      (source === 'touch' ? cb.touchSlideEnabled === false : true);
    const syncFollowIfFollowMode = () => {
      if (!cb.isPlayerHidden && cameraControls.cameraMode === 'follow') {
        cameraControls.followPlayer = true;
      }
    };

    if (phase === 'EXECUTING' || phase === 'COOLDOWN') {
      return;
    }

    updateRayFromClient(clientX, clientY);

    // 1. Harvest SELECTING mode
    if (phase === 'SELECTING') {
      const target = pickHarvestTarget();
      if (target) {
        let movePos: { x: number; z: number } | null = null;
        if (target.type === 'tree') {
          const t = cb.trees.find((x) => x.id === target.id);
          if (t) movePos = { x: t.worldX, z: t.worldZ + 1.2 };
        } else {
          const p = cb.plots.find((x) => String(x.id) === target.id);
          if (p) movePos = { x: p.worldX, z: p.worldZ + 1.2 };
        }
        if (movePos && canWalkByPointer) {
          syncFollowIfFollowMode();
          player.moveTo(movePos.x, movePos.z);
        }
        player.triggerToolSwing();
        cb.onHarvestToggle?.(target);
      }
      return;
    }

    // 2. Placement ghost mode (tap to move ghost, double-tap nearby to confirm)
    if (cb.placing) {
      const groundMeshes = getRaycastGroundMeshes();
      if (groundMeshes.length > 0) {
        const gh = _raycaster.intersectObjects(groundMeshes, false);
        if (gh.length > 0) {
          const px = gh[0].point.x;
          const pz = gh[0].point.z;
          const ghostResult = moveActiveGhostAtPoint(
            px,
            pz,
            cb.placing,
            { housesRef, animalsRef, rocksRef },
            validateRockFn
          );
          ghostReporter.report(ghostResult);

          if (tapTracker.checkConfirmOnTap(px, pz, Boolean(ghostResult?.valid))) {
            cb.onConfirmPlace?.(ghostResult);
          }
        }
      }
      return;
    }

    // 2.5 Plot relocation mode: resolve exact ground grid cell first so adjacent cells next to tall crops are never blocked
    if (cb.isMovingPlotMode) {
      const groundMeshes = getRaycastGroundMeshes();
      if (groundMeshes.length > 0) {
        const groundHits = _raycaster.intersectObjects(groundMeshes, false);
        if (groundHits.length > 0) {
          const hitX = groundHits[0].point.x;
          const hitZ = groundHits[0].point.z;
          const { gx, gz } = worldToGrid(hitX, hitZ);
          const { x: cellX, z: cellZ } = gridToWorld(gx, gz);

          const plotOnCell = cb.plots.find(
            (p) => Math.abs(p.worldX - cellX) < 0.98 && Math.abs(p.worldZ - cellZ) < 0.98
          );

          if (plotOnCell) {
            if (canWalkByPointer) {
              syncFollowIfFollowMode();
              player.moveTo(plotOnCell.worldX, plotOnCell.worldZ + 1.2);
            }
            player.triggerToolSwing();
            cb.onPlotClick(plotOnCell.id);
            return;
          }

          if (cb.selectedPlotToMove !== null && cb.selectedPlotToMove !== undefined) {
            if (canWalkByPointer) {
              syncFollowIfFollowMode();
              player.moveTo(cellX, cellZ + 1.2);
              player.triggerToolSwing();
            }
            cb.onGridCellClick?.(gx, gz);
            return;
          }
        }
      }
    }

    // 3. Frontier gate (Map 2 expansion)
    if (terrainMap2Ref.current) {
      const gateHits = _raycaster.intersectObjects(
        terrainMap2Ref.current.interactiveMeshes,
        false
      );
      if (gateHits.length > 0) {
        cb.onOpenExpansionModal?.();
        return;
      }
    }

    // 4. Tree click
    if (treesRef.current) {
      const hitTreeId = treesRef.current.pickTree(_raycaster);
      if (hitTreeId) {
        const targetTree = cb.trees.find((t) => t.id === hitTreeId);
        if (targetTree) {
          treesRef.current.triggerShake(hitTreeId, 0.6);
          if (canWalkByPointer) {
            syncFollowIfFollowMode();
            player.moveTo(targetTree.worldX, targetTree.worldZ + 1.2);
          }
          player.triggerToolSwing();
          cb.onTreeClick?.(hitTreeId);
          return;
        }
      }
    }

    // 5. Animal pet & select
    if (animalsRef.current) {
      const hitAnimal = animalsRef.current.pickAnimal(_raycaster);
      if (hitAnimal) {
        animalsRef.current.petAnimal(hitAnimal.id);
        cb.onAnimalPet?.(hitAnimal);
        cb.onAnimalSelect?.(hitAnimal.id);
        return;
      }
    }

    // 6. Crop plot click
    if (cropsRef.current) {
      const hits = _raycaster.intersectObjects(cropsRef.current.interactiveMeshes, false);
      if (hits.length > 0) {
        const plotId = hits[0].object.userData.plotId;
        if (plotId !== undefined) {
          const targetX = hits[0].object.parent?.position.x ?? 0;
          const targetZ = (hits[0].object.parent?.position.z ?? 0) + 1.2;
          if (canWalkByPointer) {
            syncFollowIfFollowMode();
            player.moveTo(targetX, targetZ);
          }
          player.triggerToolSwing();
          cb.onPlotClick(plotId);
          return;
        }
      }
    }

    // 7. House / structure click (ใช้นิ้วแตะเข้าใช้งาน/เก็บผลผลิตได้ทันทีแบบ Hay Day + กดค้างหรือดับเบิลคลิกเพื่อย้าย/ตกแต่ง)
    if (housesRef.current) {
      const hid = housesRef.current.pickHouse(_raycaster);
      if (hid) {
        const targetHouse = cb.houses.find((h) => h.id === hid);
        const editEnabled = cb.structureEditEnabled !== false;
        const clickMode = cb.structureEditClickMode ?? 'double';
        const now = performance.now();

        if (editEnabled) {
          const isSecondTap =
            lastStructureTap !== null &&
            lastStructureTap.kind === 'house' &&
            lastStructureTap.id === hid &&
            now - lastStructureTap.time <= DOUBLE_TAP_WINDOW_MS;

          if (clickMode === 'single' || isSecondTap) {
            cancelPendingHouseInteract();
            lastStructureTap = null;
            const recentlySelectedSame =
              lastStructureSelect !== null &&
              lastStructureSelect.kind === 'house' &&
              lastStructureSelect.id === hid &&
              now - lastStructureSelect.time <= SELECT_TO_MOVE_GUARD_MS;

            if (isSecondTap && cb.selectedHouseId === hid && !recentlySelectedSame && cb.onHouseMove) {
              lastStructureSelect = null;
              cb.onHouseMove(hid);
              return;
            }

            lastStructureSelect = { kind: 'house', id: hid, time: now };
            cb.onHouseSelect?.(hid);
            return;
          }

          lastStructureTap = { kind: 'house', id: hid, time: now };
        } else {
          lastStructureTap = null;
          lastStructureSelect = null;
          cb.onHouseSelect?.(null);
          cb.onAnimalSelect?.(null);
          cb.onRockSelect?.(null);
        }

        if (targetHouse && canWalkByPointer && !cb.placing) {
          syncFollowIfFollowMode();
          player.moveTo(targetHouse.x, targetHouse.z + 2.4);
        }

        if (targetHouse && !cb.placing) {
          cancelPendingHouseInteract();
          if (editEnabled && isModalOpeningHouseType(targetHouse.type)) {
            pendingHouseInteractTimer = window.setTimeout(() => {
              pendingHouseInteractTimer = null;
              callbacksRef.current.onHouseInteract?.(hid);
            }, MODAL_HOUSE_TAP_DELAY_MS);
          } else {
            cb.onHouseInteract?.(hid);
          }
        }
        return;
      }
    }

    // 8. Rock / decoration click (double-click / double-tap / long-press or single-click per setting)
    if (rocksRef.current) {
      const rid = rocksRef.current.pickRock(_raycaster);
      if (rid) {
        const editEnabled = cb.structureEditEnabled !== false;
        const clickMode = cb.structureEditClickMode ?? 'double';
        const now = performance.now();

        if (editEnabled) {
          const isSecondTap =
            lastStructureTap !== null &&
            lastStructureTap.kind === 'rock' &&
            lastStructureTap.id === rid &&
            now - lastStructureTap.time <= DOUBLE_TAP_WINDOW_MS;

          if (clickMode === 'single' || isSecondTap) {
            lastStructureTap = null;
            const recentlySelectedSame =
              lastStructureSelect !== null &&
              lastStructureSelect.kind === 'rock' &&
              lastStructureSelect.id === rid &&
              now - lastStructureSelect.time <= SELECT_TO_MOVE_GUARD_MS;

            if (isSecondTap && cb.selectedRockId === rid && !recentlySelectedSame && cb.onRockMove) {
              lastStructureSelect = null;
              cb.onRockMove(rid);
              return;
            }

            lastStructureSelect = { kind: 'rock', id: rid, time: now };
            cb.onRockSelect?.(rid);
            return;
          }

          lastStructureTap = { kind: 'rock', id: rid, time: now };
        } else {
          lastStructureTap = null;
          lastStructureSelect = null;
          cb.onHouseSelect?.(null);
          cb.onAnimalSelect?.(null);
          cb.onRockSelect?.(null);
        }

        const targetRock = cb.rocks.find((r) => r.id === rid);
        if (targetRock && canWalkByPointer && !cb.placing) {
          syncFollowIfFollowMode();
          player.moveTo(targetRock.x, targetRock.z + 1.2);
        }
        return;
      }
    }

    lastStructureTap = null;
    lastStructureSelect = null;

    // 8.5 สระน้ำตกปลา: ใช้นิ้วแตะที่บ่อน้ำเพื่อเข้าโหมดตกปลาได้ทันทีโดยไม่ต้องเดินไปยืนใกล้บ่อ
    if (cb.activeTool !== 'tree_sapling' && !cb.isMovingPlotMode && isRayHittingPond()) {
      cb.onHouseSelect?.(null);
      cb.onAnimalSelect?.(null);
      cb.onRockSelect?.(null);
      cb.onClearFingerHouse?.();
      if (canWalkByPointer) {
        syncFollowIfFollowMode();
        player.moveTo(POND.x + POND.radius + 1.2, POND.z + 1.2);
      }
      cb.onPondInteract?.();
      return;
    }

    // 9. Ground / grid click
    const groundMeshes = getRaycastGroundMeshes();
    if (groundMeshes.length > 0) {
      const groundHits = _raycaster.intersectObjects(groundMeshes, false);
      if (groundHits.length > 0) {
        cb.onHouseSelect?.(null);
        cb.onAnimalSelect?.(null);
        cb.onRockSelect?.(null);
        cb.onClearFingerHouse?.();

        const hitX = groundHits[0].point.x;
        const hitZ = groundHits[0].point.z;
        const { gx, gz } = worldToGrid(hitX, hitZ);

        if (cb.activeTool === 'tree_sapling' || cb.isMovingPlotMode) {
          const { x, z } = gridToWorld(gx, gz);
          if (canWalkByPointer) {
            syncFollowIfFollowMode();
            player.moveTo(x, z + 1.2);
            player.triggerToolSwing();
          }
          cb.onGridCellClick?.(gx, gz);
          return;
        }

        if (canWalkByPointer) {
          syncFollowIfFollowMode();
          player.moveTo(hitX, hitZ);
          cb.onPlayerMove?.({ x: hitX, z: hitZ });
        }
      }
    }
  };

  const handleHover = (clientX: number, clientY: number) => {
    const cb = callbacksRef.current;
    updateRayFromClient(clientX, clientY);

    if (cb.harvestPhase === 'SELECTING') {
      const target = pickHarvestTarget();
      cb.onHarvestHover?.(target);
      gridOverlayRef.current?.hideCursor();
      return;
    }

    const groundMeshes = getRaycastGroundMeshes();
    if (groundMeshes.length === 0) return;

    const gh = _raycaster.intersectObjects(groundMeshes, false);
    if (gh.length === 0) {
      gridOverlayRef.current?.hideCursor();
      return;
    }

    const hx = gh[0].point.x;
    const hz = gh[0].point.z;

    if (cb.placing) {
      ghostReporter.report(
        moveActiveGhostAtPoint(
          hx,
          hz,
          cb.placing,
          { housesRef, animalsRef, rocksRef },
          validateRockFn
        )
      );
      gridOverlayRef.current?.hideCursor();
      return;
    }

    const { gx, gz } = worldToGrid(hx, hz);
    const { x: cellX, z: cellZ } = gridToWorld(gx, gz);
    const isOverTree = cb.trees.some((t) => t.gridX === gx && t.gridZ === gz);
    const isOverPlot = cb.plots.some(
      (p) => Math.abs(p.worldX - cellX) < 0.98 && Math.abs(p.worldZ - cellZ) < 0.98
    );

    let status: 'valid' | 'invalid' | 'action' | 'neutral' = 'valid';
    if (cb.isMovingPlotMode) {
      if (cb.selectedPlotToMove !== null && cb.selectedPlotToMove !== undefined) {
        if (isOverPlot) {
          status = 'action';
        } else if (cb.canPlacePlotAt) {
          status = cb.canPlacePlotAt(gx, gz).valid ? 'valid' : 'invalid';
        } else {
          status = 'valid';
        }
      } else {
        status = isOverPlot ? 'action' : 'neutral';
      }
    } else if (isOverTree) {
      status = 'action';
    } else if (cb.isCellFree) {
      const check = cb.isCellFree(gx, gz);
      status = check.free ? 'valid' : 'invalid';
    }

    gridOverlayRef.current?.updateCursor(gx, gz, status, true);
  };

  const handlePlacementMove = (clientX: number, clientY: number) => {
    const curPlacing = callbacksRef.current.placing;
    const groundMeshes = getRaycastGroundMeshes();
    if (!curPlacing || groundMeshes.length === 0) return;

    updateRayFromClient(clientX, clientY);
    const gh = _raycaster.intersectObjects(groundMeshes, false);
    if (gh.length > 0) {
      ghostReporter.report(
        moveActiveGhostAtPoint(
          gh[0].point.x,
          gh[0].point.z,
          curPlacing,
          { housesRef, animalsRef, rocksRef },
          validateRockFn
        )
      );
    }
  };

  const handleDoublePick = (clientX: number, clientY: number) => {
    const cb = callbacksRef.current;
    cancelPendingHouseInteract();
    if (cb.structureEditEnabled === false) return;
    if (cb.placing || cb.isMovingPlotMode) return;
    if (
      cb.harvestPhase === 'SELECTING' ||
      cb.harvestPhase === 'EXECUTING' ||
      cb.harvestPhase === 'COOLDOWN'
    ) {
      return;
    }

    updateRayFromClient(clientX, clientY);

    let closestForegroundPlotDist = Infinity;
    if (cropsRef.current) {
      const cropHits = _raycaster.intersectObjects(cropsRef.current.interactiveMeshes, false);
      if (cropHits.length > 0 && cropHits[0].object.userData.plotId !== undefined) {
        closestForegroundPlotDist = cropHits[0].distance;
      }
    }

    const houseHit = housesRef.current?.pickHouseHit(_raycaster) ?? null;
    const rockHit = rocksRef.current?.pickRockHit(_raycaster) ?? null;
    const now = performance.now();

    if (
      houseHit &&
      houseHit.distance < closestForegroundPlotDist &&
      (!rockHit || houseHit.distance <= rockHit.distance)
    ) {
      const hid = houseHit.id;
      lastStructureTap = null;
      const recentlySelectedSame =
        lastStructureSelect !== null &&
        lastStructureSelect.kind === 'house' &&
        lastStructureSelect.id === hid &&
        now - lastStructureSelect.time <= SELECT_TO_MOVE_GUARD_MS;

      if (cb.selectedHouseId === hid && !recentlySelectedSame && cb.onHouseMove) {
        lastStructureSelect = null;
        cb.onHouseMove(hid);
        return;
      }

      if (!recentlySelectedSame) {
        lastStructureSelect = { kind: 'house', id: hid, time: now };
      }
      cb.onHouseSelect?.(hid);
      return;
    }

    if (rockHit && rockHit.distance < closestForegroundPlotDist) {
      const rid = rockHit.id;
      lastStructureTap = null;
      const recentlySelectedSame =
        lastStructureSelect !== null &&
        lastStructureSelect.kind === 'rock' &&
        lastStructureSelect.id === rid &&
        now - lastStructureSelect.time <= SELECT_TO_MOVE_GUARD_MS;

      if (cb.selectedRockId === rid && !recentlySelectedSame && cb.onRockMove) {
        lastStructureSelect = null;
        cb.onRockMove(rid);
        return;
      }

      if (!recentlySelectedSame) {
        lastStructureSelect = { kind: 'rock', id: rid, time: now };
      }
      cb.onRockSelect?.(rid);
    }
  };

  return {
    handlePick,
    handleDoublePick,
    handleLongPress,
    handleSwipeBegin,
    handleSwipePick,
    handleHover,
    handlePlacementMove,
  };
}
