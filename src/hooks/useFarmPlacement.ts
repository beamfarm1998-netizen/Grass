// src/hooks/useFarmPlacement.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AnimalType,
  PlacedAnimal,
  PlacedHouse,
  PlacedRock,
  RockType,
  ROCK_DEFS,
  PlacingState,
  ANIMAL_DEFS,
  HOUSE_DEFS,
  HOUSE_PART_KEYS,
  getMaxForHouseType,
  type HousePartKey,
  type PartStyleConfig,
  GRID_MIN_X,
  GRID_MAX_X,
  GRID_MIN_Z,
  GRID_MAX_Z,
  worldToGrid,
  gridToWorld,
} from '../types/game';
import type { GhostState } from '../components/3d/FarmHouses';
import type { AnimalGhostState } from '../components/3d/FarmAnimals';
import type { RockGhostState } from '../components/3d/FarmRocks';
import { farmAudio } from '../utils/audio';
import { isTerrainBlocked } from '../data/terrainFeatures';
import {
  createAutoSaveChannel,
  hydrateHousesTexturesFromIdb,
  packHousesForStorage,
  safeGetLocalStorageItem,
  safeSetLocalStorageItem,
  unpackHousesFromStorageSync,
} from '../utils/farmAutoSave';
import { isSaveSuppressed } from '../utils/saveReset';
import {
  tr,
  getAnimalName,
  getHouseName,
  getRockName,
  translatePlacementReason,
} from '../i18n/translations';

const STORAGE_KEY = 'beam_farm_3d_save_map_v2';
const ROCKS_STORAGE_KEY = 'beam_farm_3d_rocks_v1';
const FISH_SHOP_SEED_KEY = 'beam_farm_fish_shop_seeded_v1';

/** หินเริ่มต้นในฟาร์ม (เริ่มเกมใหม่เป็นพื้นที่ว่าง) */
export const INITIAL_ROCKS: PlacedRock[] = [];

function ensureStarterFishShop(initialHouses: PlacedHouse[]): PlacedHouse[] {
  if (safeGetLocalStorageItem(FISH_SHOP_SEED_KEY) === 'true') {
    return initialHouses;
  }
  safeSetLocalStorageItem(FISH_SHOP_SEED_KEY, 'true');

  if (initialHouses.some((h) => h.type === 29)) {
    return initialHouses;
  }

  const candidateSpots = [
    { x: -25, z: -28 },
    { x: -25, z: -33 },
    { x: -20, z: -28 },
    { x: -20, z: -33 },
  ];
  const chosen =
    candidateSpots.find(
      (pt) => !initialHouses.some((h) => Math.hypot(h.x - pt.x, h.z - pt.z) < 6.5)
    ) ?? candidateSpots[0];

  const next: PlacedHouse[] = [
    ...initialHouses,
    {
      id: 'house_29_pond_shop',
      type: 29,
      x: chosen.x,
      z: chosen.z,
      rot: 0,
    },
  ];
  safeSetLocalStorageItem(
    STORAGE_KEY + '_houses',
    JSON.stringify(packHousesForStorage(next))
  );
  return next;
}

export interface PlacementVerdict {
  valid: boolean;
  reason: string;
}

export type ValidatePlacement = (
  x: number,
  z: number,
  placing: PlacingState
) => PlacementVerdict;

export function useFarmPlacement(
  addNotice: (text: string, color?: string) => void,
  validatePlacement?: ValidatePlacement,
  map2Unlocked: boolean = false
) {
  const needsIdbTexHydrationRef = useRef<{ raw: PlacedHouse[] | null }>({ raw: null });

  const [houses, setHouses] = useState<PlacedHouse[]>(() => {
    let loaded: PlacedHouse[] = [];
    try {
      const saved = safeGetLocalStorageItem(STORAGE_KEY + '_houses');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const { houses: unpacked, needsAsyncHydration } = unpackHousesFromStorageSync(parsed);
          loaded = unpacked;
          if (needsAsyncHydration) {
            needsIdbTexHydrationRef.current.raw = parsed;
          }
        }
      }
    } catch {}
    return ensureStarterFishShop(loaded);
  });

  const [animals, setAnimals] = useState<PlacedAnimal[]>(() => {
    try {
      const saved = safeGetLocalStorageItem(STORAGE_KEY + '_animals');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [rocks, setRocks] = useState<PlacedRock[]>(() => {
    try {
      const saved = safeGetLocalStorageItem(ROCKS_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_ROCKS;
  });

  const [placing, setPlacing] = useState<PlacingState | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [selectedHouseId, _setSelectedHouseId] = useState<string | null>(null);
  const [selectedAnimalId, _setSelectedAnimalId] = useState<string | null>(null);
  const [selectedRockId, _setSelectedRockId] = useState<string | null>(null);
  const [lastPetTimes, setLastPetTimes] = useState<Record<string, number>>({});

  const housesRef = useRef(houses);
  housesRef.current = houses;
  const animalsRef = useRef(animals);
  animalsRef.current = animals;
  const rocksRef = useRef(rocks);
  rocksRef.current = rocks;
  const placingRef = useRef(placing);
  placingRef.current = placing;
  const selectedHouseIdRef = useRef(selectedHouseId);
  selectedHouseIdRef.current = selectedHouseId;
  const selectedAnimalIdRef = useRef(selectedAnimalId);
  selectedAnimalIdRef.current = selectedAnimalId;
  const selectedRockIdRef = useRef(selectedRockId);
  selectedRockIdRef.current = selectedRockId;

  const setHousesSync = useCallback(
    (updater: PlacedHouse[] | ((prev: PlacedHouse[]) => PlacedHouse[])) => {
      const next = typeof updater === 'function' ? updater(housesRef.current) : updater;
      housesRef.current = next;
      setHouses(next);
    },
    []
  );

  const setAnimalsSync = useCallback(
    (updater: PlacedAnimal[] | ((prev: PlacedAnimal[]) => PlacedAnimal[])) => {
      const next = typeof updater === 'function' ? updater(animalsRef.current) : updater;
      animalsRef.current = next;
      setAnimals(next);
    },
    []
  );

  const setRocksSync = useCallback(
    (updater: PlacedRock[] | ((prev: PlacedRock[]) => PlacedRock[])) => {
      const next = typeof updater === 'function' ? updater(rocksRef.current) : updater;
      rocksRef.current = next;
      setRocks(next);
    },
    []
  );

  const setPlacingSync = useCallback(
    (
      updater:
        | PlacingState
        | null
        | ((prev: PlacingState | null) => PlacingState | null)
    ) => {
      const next = typeof updater === 'function' ? updater(placingRef.current) : updater;
      placingRef.current = next;
      setPlacing(next);
    },
    []
  );

  const setSelectedHouseId = useCallback((id: string | null) => {
    selectedHouseIdRef.current = id;
    _setSelectedHouseId(id);
  }, []);

  const setSelectedAnimalId = useCallback((id: string | null) => {
    selectedAnimalIdRef.current = id;
    _setSelectedAnimalId(id);
  }, []);

  const setSelectedRockId = useCallback((id: string | null) => {
    selectedRockIdRef.current = id;
    _setSelectedRockId(id);
  }, []);

  useEffect(() => {
    const rawToHydrate = needsIdbTexHydrationRef.current.raw;
    if (!rawToHydrate) return;
    needsIdbTexHydrationRef.current.raw = null;
    void hydrateHousesTexturesFromIdb(rawToHydrate).then((hydrated) => {
      const byId = new Map(hydrated.map((h) => [h.id, h]));
      setHousesSync((prev) =>
        prev.map((cur) => {
          const hyd = byId.get(cur.id);
          if (!hyd) return cur;
          return {
            ...cur,
            customTexture: cur.customTexture ?? hyd.customTexture,
            partStyles: hyd.partStyles
              ? { ...hyd.partStyles, ...(cur.partStyles ?? {}) }
              : cur.partStyles,
          };
        })
      );
    });
  }, [setHousesSync]);

  const placementPersistRef = useRef({ houses, animals, rocks });
  placementPersistRef.current = { houses, animals, rocks };

  const writePlacementToStorage = useCallback(() => {
    if (isSaveSuppressed()) return;
    const cur = placementPersistRef.current;
    safeSetLocalStorageItem(
      STORAGE_KEY + '_houses',
      JSON.stringify(packHousesForStorage(cur.houses))
    );
    safeSetLocalStorageItem(STORAGE_KEY + '_animals', JSON.stringify(cur.animals));
    safeSetLocalStorageItem(ROCKS_STORAGE_KEY, JSON.stringify(cur.rocks));
  }, []);

  const saveChannelRef = useRef<ReturnType<typeof createAutoSaveChannel> | null>(null);
  useEffect(() => {
    const channel = createAutoSaveChannel(writePlacementToStorage, {
      delayMs: 200,
      maxWaitMs: 1000,
    });
    saveChannelRef.current = channel;
    channel.schedule();
    return () => {
      channel.dispose();
      saveChannelRef.current = null;
    };
  }, [writePlacementToStorage]);

  useEffect(() => {
    saveChannelRef.current?.schedule();
  }, [houses, animals, rocks]);

  // ซิงค์ตำแหน่งม้าและวัวให้ตรงกับคอกเสมอ หากย้ายคอก สัตว์ก็จะย้ายตามเข้าไปอยู่ในคอกทันที
  useEffect(() => {
    const stable = houses.find((h) => h.type === 15);
    const cowPen = houses.find((h) => h.type === 16);
    if (!stable && !cowPen) return;

    setAnimalsSync((prev) => {
      let changed = false;
      const next = prev.map((a) => {
        if (a.type === 'horse' && stable) {
          const dist = Math.hypot(a.x - stable.x, a.z - stable.z);
          if (dist > 3.5 || Math.hypot(a.homeX - stable.x, a.homeZ - stable.z) > 1.0) {
            changed = true;
            return {
              ...a,
              x: stable.x,
              z: stable.z + 0.5,
              homeX: stable.x,
              homeZ: stable.z + 0.5,
            };
          }
        }
        if (a.type === 'cow' && cowPen) {
          const dist = Math.hypot(a.x - cowPen.x, a.z - cowPen.z);
          if (dist > 3.5 || Math.hypot(a.homeX - cowPen.x, a.homeZ - cowPen.z) > 1.0) {
            changed = true;
            return {
              ...a,
              x: cowPen.x,
              z: cowPen.z + 0.5,
              homeX: cowPen.x,
              homeZ: cowPen.z + 0.5,
            };
          }
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [houses, setAnimalsSync]);

  const handleStartPlaceHouse = useCallback(
    (type: number) => {
      setSelectedHouseId(null);
      setSelectedAnimalId(null);
      setSelectedRockId(null);
      setGhost({ x: 0, z: 0, valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' });
      setPlacingSync({ category: 'house', type, rot: 0, x: 0, z: 0 });
    },
    [setSelectedHouseId, setSelectedAnimalId, setSelectedRockId, setPlacingSync]
  );

  const handleStartPlaceAnimal = useCallback(
    (animalType: AnimalType) => {
      setSelectedHouseId(null);
      setSelectedAnimalId(null);
      setSelectedRockId(null);
      setGhost({ x: 0, z: 0, valid: true, reason: 'ตำแหน่งนี้วางได้อิสระ' });
      setPlacingSync({ category: 'animal', type: 0, animalType, rot: 0, x: 0, z: 0 });
    },
    [setSelectedHouseId, setSelectedAnimalId, setSelectedRockId, setPlacingSync]
  );

  const handleStartPlaceRock = useCallback(
    (rockType: RockType) => {
      setSelectedHouseId(null);
      setSelectedAnimalId(null);
      setSelectedRockId(null);
      setGhost({ x: 0, z: 0, valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' });
      setPlacingSync({ category: 'rock', type: 0, rockType, rot: 0, x: 0, z: 0 });
    },
    [setSelectedHouseId, setSelectedAnimalId, setSelectedRockId, setPlacingSync]
  );

  const handleRotatePlacing = useCallback(() => {
    setPlacingSync((p) => (p ? { ...p, rot: (p.rot + Math.PI / 2) % (Math.PI * 2) } : p));
  }, [setPlacingSync]);

  const handleNudgePlacing = useCallback(
    (dx: number, dz: number) => {
      const curPlacing = placingRef.current;
      if (!curPlacing) return;

      const baseX = ghost?.x ?? curPlacing.x ?? 0;
      const baseZ = ghost?.z ?? curPlacing.z ?? 0;

      const nx = Math.round((baseX + dx) * 2) / 2;
      const nz = Math.round((baseZ + dz) * 2) / 2;

      const nextPlacing: PlacingState = { ...curPlacing, x: nx, z: nz };

      let verdict: PlacementVerdict;
      if (validatePlacement) {
        verdict = validatePlacement(nx, nz, nextPlacing);
      } else {
        if (nextPlacing.category === 'animal') {
          const minX = map2Unlocked ? -88 : -48;
          if (nx < minX || nx > 48 || Math.abs(nz) > 35) {
            verdict = { valid: false, reason: 'ชิดขอบเกาะเกินไป' };
          } else {
            const terrain = nx > -43 ? isTerrainBlocked(nx, nz) : { blocked: false, reason: undefined };
            verdict = terrain.blocked
              ? { valid: false, reason: terrain.reason || 'อยู่บนพื้นที่ต้องห้าม' }
              : { valid: true, reason: 'ตำแหน่งนี้วางได้อิสระ' };
          }
        } else if (nextPlacing.category === 'rock') {
          const minX = map2Unlocked ? -88 : -50;
          if (nx < minX || nx > 50 || Math.abs(nz) > 37) {
            verdict = { valid: false, reason: 'อยู่นอกขอบเขตเกาะฟาร์ม' };
          } else {
            verdict = { valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' };
          }
        } else {
          const minX = map2Unlocked ? -88 : -50.5;
          const maxX = 50.5;
          if (nx < minX || nx > maxX || Math.abs(nz) > 37.5) {
            verdict = { valid: false, reason: 'ชิดขอบเกาะเกินไป' };
          } else {
            verdict = { valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' };
          }
        }
      }

      setPlacingSync(nextPlacing);
      setGhost({ x: nx, z: nz, valid: verdict.valid, reason: verdict.reason });
    },
    [ghost, validatePlacement, map2Unlocked, setPlacingSync]
  );

  const handleCancelPlacing = useCallback(() => {
    setPlacingSync(null);
    setGhost(null);
  }, [setPlacingSync]);

  const handleConfirmPlace = useCallback(
    (
      coins: number,
      spendCoins: (amt: number) => boolean,
      gems?: number,
      spendGems?: (amt: number) => boolean,
      targetGhost?: GhostState | AnimalGhostState | RockGhostState | null,
      earnGems?: (amt: number) => void
    ) => {
      const curPlacing = placingRef.current;
      if (!curPlacing) return;

      const activeGhost = targetGhost ?? ghost;

      if (!activeGhost || !activeGhost.valid) {
        addNotice(
          activeGhost?.reason
            ? `❌ ${translatePlacementReason(activeGhost.reason) || activeGhost.reason}`
            : tr(
                '❌ ตำแหน่งนี้วางไม่ได้ กรุณาแตะพื้นหรือเลื่อนหาจุดที่ว่าง',
                '❌ Invalid spot — tap open ground or nudge to a free tile'
              ),
          '#ef5350'
        );
        return;
      }

      if (curPlacing.category === 'animal' && curPlacing.animalType) {
        const def = ANIMAL_DEFS[curPlacing.animalType];
        const aName = getAnimalName(curPlacing.animalType);
        const isNew = !curPlacing.editId;

        if (isNew) {
          if (def.gemCost && (gems === undefined || gems < def.gemCost)) {
            addNotice(
              tr(
                `❌ เพชรไม่พอสำหรับรับเลี้ยง ${def.name} (ต้องการ ${def.gemCost} 💎)`,
                `❌ Need ${def.gemCost} 💎 Gems for ${aName}`
              ),
              '#ef5350'
            );
            return;
          }

          if (coins < def.buyCost) {
            addNotice(
              tr(
                `❌ เหรียญทองไม่พอสำหรับซื้อ ${def.name} (ต้องการ ${def.buyCost} 🪙)`,
                `❌ Need ${def.buyCost} 🪙 Coins for ${aName}`
              ),
              '#ef5350'
            );
            return;
          }

          let gemsSpent = 0;
          if (def.gemCost && def.gemCost > 0) {
            if (!spendGems || !spendGems(def.gemCost)) {
              addNotice(
                tr(
                  `❌ เพชรไม่พอสำหรับรับเลี้ยง ${def.name} (ต้องการ ${def.gemCost} 💎)`,
                  `❌ Need ${def.gemCost} 💎 Gems for ${aName}`
                ),
                '#ef5350'
              );
              return;
            }
            gemsSpent = def.gemCost;
          }

          if (def.buyCost > 0 && !spendCoins(def.buyCost)) {
            if (gemsSpent > 0) {
              earnGems?.(gemsSpent);
            }
            addNotice(
              tr(
                `❌ เหรียญทองไม่พอสำหรับซื้อ ${def.name} (ต้องการ ${def.buyCost} 🪙)`,
                `❌ Need ${def.buyCost} 🪙 Coins for ${aName}`
              ),
              '#ef5350'
            );
            return;
          }
        }

        setPlacingSync(null);
        const id =
          curPlacing.editId ??
          `animal_${curPlacing.animalType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setAnimalsSync((prev) => [
          ...prev.filter((a) => a.id !== id),
          {
            id,
            type: curPlacing.animalType!,
            x: activeGhost.x,
            z: activeGhost.z,
            rot: curPlacing.rot,
            homeX: activeGhost.x,
            homeZ: activeGhost.z,
          },
        ]);

        if (curPlacing.animalType === 'cow') farmAudio.playCowSound();
        else if (curPlacing.animalType === 'pig') farmAudio.playPigSound();
        else if (curPlacing.animalType === 'chicken') farmAudio.playChickenSound();
        else if (curPlacing.animalType === 'goat') farmAudio.playGoatSound();
        else if (curPlacing.animalType === 'dog') farmAudio.playDogSound();
        else if (curPlacing.animalType === 'cat') farmAudio.playCatSound();

        addNotice(
          tr(
            `🐾 ${curPlacing.editId ? 'ย้าย' : 'พา'}${def.name}มาที่ฟาร์มสำเร็จ!`,
            `🐾 ${curPlacing.editId ? 'Moved' : 'Added'} ${aName} to the farm!`
          ),
          '#a5d6a7'
        );
      } else if (curPlacing.category === 'rock' && curPlacing.rockType) {
        const def = ROCK_DEFS[curPlacing.rockType];
        const rName = getRockName(curPlacing.rockType);
        const isNew = !curPlacing.editId;

        if (isNew && (coins < def.cost || (def.cost > 0 && !spendCoins(def.cost)))) {
          addNotice(
            tr(
              `❌ เหรียญทองไม่พอสำหรับสร้าง ${def.name} (ต้องการ ${def.cost} 🪙)`,
              `❌ Need ${def.cost} 🪙 Coins for ${rName}`
            ),
            '#ef5350'
          );
          return;
        }

        setPlacingSync(null);
        const x = Math.round(activeGhost.x * 2) / 2;
        const z = Math.round(activeGhost.z * 2) / 2;
        const { gx, gz } = worldToGrid(x, z);
        const id =
          curPlacing.editId ??
          `rock_${curPlacing.rockType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        setRocksSync((prev) => [
          ...prev.filter((r) => r.id !== id),
          {
            id,
            type: curPlacing.rockType!,
            gridX: gx,
            gridZ: gz,
            x,
            z,
            rot: curPlacing.rot,
          },
        ]);

        farmAudio.playHoeSound();
        addNotice(
          tr(
            `🪨 ${curPlacing.editId ? 'ย้าย' : 'วาง'}${def.name}สำเร็จแล้ว`,
            `🪨 ${curPlacing.editId ? 'Moved' : 'Placed'} ${rName}`
          ),
          '#6ee7b7'
        );
      } else {
        const def = HOUSE_DEFS[curPlacing.type];
        const hName = getHouseName(curPlacing.type);
        const isNew = !curPlacing.editId;

        if (isNew) {
          const maxAllowed = getMaxForHouseType(curPlacing.type);
          const existingCount = housesRef.current.filter((h) => h.type === curPlacing.type).length;
          if (existingCount >= maxAllowed) {
            addNotice(
              tr(
                `❌ สร้าง${def ? def.name : 'สิ่งก่อสร้าง'}ครบจำนวนสูงสุดแล้ว (${maxAllowed} หลัง)`,
                `❌ Maximum limit reached for ${hName} (${maxAllowed})`
              ),
              '#ef5350'
            );
            setPlacingSync(null);
            setGhost(null);
            return;
          }

          if (def?.gemCost && (gems === undefined || gems < def.gemCost)) {
            addNotice(
              tr(
                `❌ เพชรไม่พอสำหรับสร้าง ${def.name} (ต้องการ ${def.gemCost} 💎)`,
                `❌ Need ${def.gemCost} 💎 Gems to build ${hName}`
              ),
              '#ef5350'
            );
            return;
          }

          if (def?.cost && coins < def.cost) {
            addNotice(
              tr(
                `❌ เหรียญทองไม่พอสำหรับสร้าง ${def.name} (ต้องการ ${def.cost} 🪙)`,
                `❌ Need ${def.cost} 🪙 Coins to build ${hName}`
              ),
              '#ef5350'
            );
            return;
          }

          let gemsSpent = 0;
          if (def?.gemCost && def.gemCost > 0) {
            if (!spendGems || !spendGems(def.gemCost)) {
              addNotice(
                tr(
                  `❌ เพชรไม่พอสำหรับสร้าง ${def.name} (ต้องการ ${def.gemCost} 💎)`,
                  `❌ Need ${def.gemCost} 💎 Gems to build ${hName}`
                ),
                '#ef5350'
              );
              return;
            }
            gemsSpent = def.gemCost;
          }

          if (def?.cost && def.cost > 0 && !spendCoins(def.cost)) {
            if (gemsSpent > 0) {
              earnGems?.(gemsSpent);
            }
            addNotice(
              tr(
                `❌ เหรียญทองไม่พอสำหรับสร้าง ${def.name} (ต้องการ ${def.cost} 🪙)`,
                `❌ Need ${def.cost} 🪙 Coins to build ${hName}`
              ),
              '#ef5350'
            );
            return;
          }
        }

        setPlacingSync(null);
        const id =
          curPlacing.editId ??
          `house_${curPlacing.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setHousesSync((prev) => [
          ...prev.filter((h) => h.id !== id),
          {
            id,
            type: curPlacing.type,
            x: activeGhost.x,
            z: activeGhost.z,
            rot: curPlacing.rot,
            ...(curPlacing.customColor ? { customColor: curPlacing.customColor } : {}),
            ...(curPlacing.customTexture ? { customTexture: curPlacing.customTexture } : {}),
            ...(curPlacing.customTextureRepeat
              ? { customTextureRepeat: curPlacing.customTextureRepeat }
              : {}),
            ...(curPlacing.partStyles && Object.keys(curPlacing.partStyles).length > 0
              ? { partStyles: curPlacing.partStyles }
              : {}),
          },
        ]);
        farmAudio.playDoorSound();
        const icon = def?.icon || '🏠';
        addNotice(
          tr(
            `${icon} ${curPlacing.editId ? 'ย้าย' : 'สร้าง'}${def ? def.name : 'สิ่งก่อสร้าง'}สำเร็จ!`,
            `${icon} ${curPlacing.editId ? 'Moved' : 'Built'} ${hName}!`
          ),
          '#a5d6a7'
        );
      }

      setGhost(null);
      setSelectedHouseId(null);
      setSelectedAnimalId(null);
      setSelectedRockId(null);
    },
    [
      ghost,
      addNotice,
      setPlacingSync,
      setAnimalsSync,
      setRocksSync,
      setHousesSync,
      setSelectedHouseId,
      setSelectedAnimalId,
      setSelectedRockId,
    ]
  );

  const selectedHouse = houses.find((h) => h.id === selectedHouseId) ?? null;

  const handleMoveHouseById = useCallback(
    (id: string) => {
      const target = housesRef.current.find((h) => h.id === id);
      if (!target) return;
      setGhost({ x: target.x, z: target.z, valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' });
      setPlacingSync({
        category: 'house',
        type: target.type,
        rot: target.rot,
        editId: target.id,
        x: target.x,
        z: target.z,
        customColor: target.customColor,
        customTexture: target.customTexture,
        customTextureRepeat: target.customTextureRepeat,
        partStyles: target.partStyles,
      });
      setSelectedHouseId(null);
      setSelectedAnimalId(null);
      setSelectedRockId(null);
    },
    [setPlacingSync, setSelectedHouseId, setSelectedAnimalId, setSelectedRockId]
  );

  const handleMoveSelectedHouse = useCallback(() => {
    const id = selectedHouseIdRef.current;
    if (!id) return;
    handleMoveHouseById(id);
  }, [handleMoveHouseById]);

  const handleRotateSelectedHouse = useCallback(() => {
    const id = selectedHouseIdRef.current;
    if (!id) return;
    setHousesSync((prev) =>
      prev.map((h) => (h.id === id ? { ...h, rot: (h.rot + Math.PI / 2) % (Math.PI * 2) } : h))
    );
  }, [setHousesSync]);

  const handleStyleHousePart = useCallback(
    (
      houseId: string,
      part: HousePartKey | 'all',
      patch: { color?: string | null; textureDataUrl?: string | null; textureRepeat?: number }
    ) => {
      if (!houseId) return;
      setHousesSync((prev) =>
        prev.map((h) => {
          if (h.id !== houseId) return h;

          if (part === 'all') {
            const next: PlacedHouse = { ...h };
            if (patch.color !== undefined) {
              if (patch.color) next.customColor = patch.color;
              else delete next.customColor;
            }
            if (patch.textureDataUrl !== undefined) {
              if (patch.textureDataUrl) {
                next.customTexture = patch.textureDataUrl;
                next.customTextureRepeat = patch.textureRepeat ?? next.customTextureRepeat ?? 1;
              } else {
                delete next.customTexture;
                delete next.customTextureRepeat;
              }
            } else if (patch.textureRepeat !== undefined && next.customTexture) {
              next.customTextureRepeat = patch.textureRepeat;
            }

            // Clear per-part overrides for the patched dimension so 'all' updates every part cleanly
            if (next.partStyles) {
              const updatedParts: Partial<Record<HousePartKey, PartStyleConfig>> = {};
              for (const k of HOUSE_PART_KEYS) {
                const curPart = next.partStyles[k];
                if (!curPart) continue;
                const copy: PartStyleConfig = { ...curPart };
                if (patch.color !== undefined) delete copy.color;
                if (patch.textureDataUrl !== undefined) {
                  delete copy.textureDataUrl;
                  delete copy.textureRepeat;
                }
                if (copy.color || copy.textureDataUrl) {
                  updatedParts[k] = copy;
                }
              }
              if (Object.keys(updatedParts).length > 0) {
                next.partStyles = updatedParts;
              } else {
                delete next.partStyles;
              }
            }
            return next;
          }

          // Specific part ('roof' | 'wall' | 'fence' | 'floor' | 'chimney')
          const nextParts: Partial<Record<HousePartKey, PartStyleConfig>> = {
            ...(h.partStyles ?? {}),
          };

          // Materialize any top-level whole-house style onto other parts so editing/resetting 1 part isolates cleanly
          if (h.customColor || h.customTexture) {
            for (const other of HOUSE_PART_KEYS) {
              if (!nextParts[other]) {
                nextParts[other] = {
                  ...(h.customColor ? { color: h.customColor } : {}),
                  ...(h.customTexture
                    ? {
                         textureDataUrl: h.customTexture,
                         textureRepeat: h.customTextureRepeat ?? 1,
                      }
                    : {}),
                };
              }
            }
          }

          const curCfg: PartStyleConfig = { ...(nextParts[part] ?? {}) };
          if (patch.color !== undefined) {
            if (patch.color) curCfg.color = patch.color;
            else delete curCfg.color;
          }
          if (patch.textureDataUrl !== undefined) {
            if (patch.textureDataUrl) {
              curCfg.textureDataUrl = patch.textureDataUrl;
              curCfg.textureRepeat = patch.textureRepeat ?? curCfg.textureRepeat ?? 1;
            } else {
              delete curCfg.textureDataUrl;
              delete curCfg.textureRepeat;
            }
          } else if (patch.textureRepeat !== undefined && curCfg.textureDataUrl) {
            curCfg.textureRepeat = patch.textureRepeat;
          }

          if (curCfg.color || curCfg.textureDataUrl) {
            nextParts[part] = curCfg;
          } else {
            delete nextParts[part];
          }

          const nextHouse: PlacedHouse = { ...h };
          delete nextHouse.customColor;
          delete nextHouse.customTexture;
          delete nextHouse.customTextureRepeat;
          if (Object.keys(nextParts).length > 0) {
            nextHouse.partStyles = nextParts;
          } else {
            delete nextHouse.partStyles;
          }
          return nextHouse;
        })
      );
    },
    [setHousesSync]
  );

  const handleResetHouseStyle = useCallback(
    (houseId: string, part: HousePartKey | 'all' = 'all') => {
      if (!houseId) return;
      if (part === 'all') {
        setHousesSync((prev) =>
          prev.map((h) => {
            if (h.id !== houseId) return h;
            const next: PlacedHouse = { ...h };
            delete next.customColor;
            delete next.customTexture;
            delete next.customTextureRepeat;
            delete next.partStyles;
            return next;
          })
        );
        return;
      }
      handleStyleHousePart(houseId, part, { color: null, textureDataUrl: null });
    },
    [handleStyleHousePart, setHousesSync]
  );

  const handleColorSelectedHouse = useCallback(
    (color: string | undefined) => {
      const id = selectedHouseIdRef.current;
      if (!id) return;
      handleStyleHousePart(id, 'all', { color: color ?? null });
    },
    [handleStyleHousePart]
  );

  const handleTextureSelectedHouse = useCallback(
    (textureDataUrl: string | undefined, repeat?: number) => {
      const id = selectedHouseIdRef.current;
      if (!id) return;
      handleStyleHousePart(id, 'all', {
        textureDataUrl: textureDataUrl ?? null,
        textureRepeat: repeat,
      });
    },
    [handleStyleHousePart]
  );

  const handleDeleteSelectedHouse = useCallback(
    (earnCoins?: (amt: number) => void) => {
      const targetId = selectedHouseIdRef.current;
      if (!targetId) return;
      const target = housesRef.current.find((h) => h.id === targetId);
      if (!target) {
        setSelectedHouseId(null);
        return;
      }
      setSelectedHouseId(null);
      setHousesSync((prev) => prev.filter((h) => h.id !== target.id));

      const def = HOUSE_DEFS[target.type];
      const refund = target.id === 'house_29_pond_shop' ? 0 : (def?.cost ?? 0);
      if (refund > 0 && earnCoins) {
        earnCoins(refund);
      }
      farmAudio.playDoorSound();
      const hName = getHouseName(target.type);
      addNotice(
        refund > 0
          ? tr(
              `📦 เก็บ${def?.name ?? 'สิ่งปลูกสร้าง'}เรียบร้อย คืนเงิน +${refund} 🪙`,
              `📦 Stored ${hName} (+${refund} 🪙 refund)`
            )
          : tr(
              `📦 เก็บ${def?.name ?? 'สิ่งปลูกสร้าง'}ออกจากฉากเรียบร้อย`,
              `📦 Stored ${hName}`
            ),
        '#ffd54f'
      );
    },
    [addNotice, setSelectedHouseId, setHousesSync]
  );

  const selectedAnimal = animals.find((a) => a.id === selectedAnimalId) ?? null;

  const handleMoveSelectedAnimal = useCallback(() => {
    const targetId = selectedAnimalIdRef.current;
    if (!targetId) return;
    const target = animalsRef.current.find((a) => a.id === targetId);
    if (!target) return;
    setGhost({
      x: target.x,
      z: target.z,
      valid: true,
      reason: 'ตำแหน่งนี้วางได้อิสระ',
    });
    setPlacingSync({
      category: 'animal',
      type: 0,
      animalType: target.type,
      rot: target.rot,
      editId: target.id,
      x: target.x,
      z: target.z,
    });
    setSelectedAnimalId(null);
  }, [setPlacingSync, setSelectedAnimalId]);

  const handleRotateSelectedAnimal = useCallback(() => {
    const targetId = selectedAnimalIdRef.current;
    if (!targetId) return;
    setAnimalsSync((prev) =>
      prev.map((a) =>
        a.id === targetId ? { ...a, rot: (a.rot + Math.PI / 2) % (Math.PI * 2) } : a
      )
    );
  }, [setAnimalsSync]);

  const handleDeleteSelectedAnimal = useCallback(
    (earnCoins: (amt: number) => void) => {
      const targetId = selectedAnimalIdRef.current;
      if (!targetId) return;
      const target = animalsRef.current.find((a) => a.id === targetId);
      if (!target) {
        setSelectedAnimalId(null);
        return;
      }
      setSelectedAnimalId(null);
      setAnimalsSync((prev) => prev.filter((a) => a.id !== target.id));

      const def = ANIMAL_DEFS[target.type];
      const refund = Math.round(def.buyCost * 0.7);
      if (refund > 0) {
        earnCoins(refund);
      }
      addNotice(
        tr(
          `เก็บ ${def.name} เข้าคอก ได้รับเงินคืน +${refund} 🪙`,
          `Returned ${getAnimalName(target.type)} to barn (+${refund} 🪙)`
        ),
        '#ffd54f'
      );
    },
    [addNotice, setSelectedAnimalId, setAnimalsSync]
  );

  const handlePetAnimal = useCallback(
    (animal: PlacedAnimal, onPetBonus?: (xp: number) => void) => {
      if (animal.type === 'cow') farmAudio.playCowSound();
      else if (animal.type === 'pig') farmAudio.playPigSound();
      else if (animal.type === 'chicken') farmAudio.playChickenSound();
      else if (animal.type === 'duck') farmAudio.playDuckSound();
      else if (animal.type === 'goat') farmAudio.playGoatSound();
      else if (animal.type === 'dog') farmAudio.playDogSound();
      else if (animal.type === 'cat') farmAudio.playCatSound();
      else if (animal.type === 'horse') farmAudio.playHorseSound();

      const def = ANIMAL_DEFS[animal.type];
      const aName = getAnimalName(animal.type);
      const now = Date.now();
      const lastPet = lastPetTimes[animal.id] || 0;

      if (now - lastPet < 45000) {
        addNotice(
          tr(
            `❤️ ลูบตัว${def.name}อย่างเอ็นดู (สัตว์อารมณ์ดีอยู่แล้ว)`,
            `❤️ Petted ${aName} gently (already happy!)`
          ),
          '#f48fb1'
        );
        return;
      }

      setLastPetTimes((prev) => ({ ...prev, [animal.id]: now }));
      onPetBonus?.(5);
      addNotice(
        tr(
          `❤️ ลูบตัว${def.name}อย่างมีความสุข (+5 XP)`,
          `❤️ Petted ${aName} happily! (+5 XP)`
        ),
        '#f48fb1'
      );
    },
    [addNotice, lastPetTimes]
  );

  const selectedRock = rocks.find((r) => r.id === selectedRockId) ?? null;

  const handleMoveRockById = useCallback(
    (id: string) => {
      const target = rocksRef.current.find((r) => r.id === id);
      if (!target) return;
      setGhost({ x: target.x, z: target.z, valid: true, reason: 'วางได้อย่างอิสระทุกพื้นที่' });
      setPlacingSync({
        category: 'rock',
        type: 0,
        rockType: target.type,
        rot: target.rot,
        editId: target.id,
        x: target.x,
        z: target.z,
      });
      setSelectedRockId(null);
      setSelectedHouseId(null);
      setSelectedAnimalId(null);
    },
    [setPlacingSync, setSelectedRockId, setSelectedHouseId, setSelectedAnimalId]
  );

  const handleMoveSelectedRock = useCallback(() => {
    const targetId = selectedRockIdRef.current;
    if (!targetId) return;
    handleMoveRockById(targetId);
  }, [handleMoveRockById]);

  const handleRotateSelectedRock = useCallback(() => {
    const targetId = selectedRockIdRef.current;
    if (!targetId) return;
    setRocksSync((prev) =>
      prev.map((r) =>
        r.id === targetId ? { ...r, rot: (r.rot + Math.PI / 2) % (Math.PI * 2) } : r
      )
    );
  }, [setRocksSync]);

  const handleDeleteSelectedRock = useCallback(
    (earnCoins?: (amt: number) => void) => {
      const targetId = selectedRockIdRef.current;
      if (!targetId) return;
      const target = rocksRef.current.find((r) => r.id === targetId);
      if (!target) {
        setSelectedRockId(null);
        return;
      }
      setSelectedRockId(null);
      setRocksSync((prev) => prev.filter((r) => r.id !== target.id));

      const def = ROCK_DEFS[target.type];
      if (def.cost > 0 && earnCoins) {
        earnCoins(def.cost);
      }
      farmAudio.playHoeSound();
      addNotice(
        tr(
          `⛏️ ขุด ${def.name} ออกจากฟาร์ม คืนเงิน +${def.cost} 🪙`,
          `⛏️ Cleared ${getRockName(target.type)} (+${def.cost} 🪙 refund)`
        ),
        '#ffd54f'
      );
    },
    [addNotice, setSelectedRockId, setRocksSync]
  );

  return {
    houses,
    animals,
    rocks,
    placing,
    ghost,
    setGhost,
    selectedHouse,
    selectedHouseId,
    setSelectedHouseId,
    selectedAnimal,
    selectedAnimalId,
    setSelectedAnimalId,
    selectedRock,
    selectedRockId,
    setSelectedRockId,
    handleStartPlaceHouse,
    handleStartPlaceAnimal,
    handleStartPlaceRock,
    handleRotatePlacing,
    handleNudgePlacing,
    handleCancelPlacing,
    handleConfirmPlace,
    handleMoveHouseById,
    handleMoveSelectedHouse,
    handleRotateSelectedHouse,
    handleColorSelectedHouse,
    handleTextureSelectedHouse,
    handleStyleHousePart,
    handleResetHouseStyle,
    handleDeleteSelectedHouse,
    handleMoveSelectedAnimal,
    handleRotateSelectedAnimal,
    handleDeleteSelectedAnimal,
    handlePetAnimal,
    handleMoveRockById,
    handleMoveSelectedRock,
    handleRotateSelectedRock,
    handleDeleteSelectedRock,
  };
}