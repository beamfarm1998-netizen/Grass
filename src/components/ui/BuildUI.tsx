// src/components/ui/BuildUI.tsx
import React, { useEffect, useState } from 'react';
import {
  Home, Hammer, Check, X, RotateCw, Move, Trash2, ChevronLeft, Sparkles,
  Heart, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MapPin, Wrench, Coins,
  Sun, Moon, Sunset, Volume2, VolumeX, Settings, Camera, Lock, Unlock, 
  Globe, Palette, Shirt, Play, Backpack, BookOpen, Download, Compass, Hand,
  HelpCircle, MousePointerClick, CheckCircle, Info
} from 'lucide-react';
import {
  HOUSE_DEFS, getMaxForHouseType, PlacedHouse, PlacingState, ANIMAL_DEFS,
  AnimalType, PlacedAnimal, ROCK_DEFS, RockType, PlacedRock, TimeOfDay,
  CameraMode, FarmerGender, DEFAULT_PLAYER_OUTFIT,
  type HousePartKey, type PlayerOutfitConfig,
} from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  getAnimalName, getHouseName, getRockName, translatePlacementReason,
} from '../../i18n/translations';
import {
  getAnimalGlbCandidates,
  getHouseGlbCandidates,
  getRockGlbCandidates,
} from '../../utils/glbThumbnail';
import { GlbAutoIcon } from './GlbAutoIcon';
import { HouseDecorMenuPanel } from './HouseDecorMenuPanel';
import { OutfitMenuPanel } from './OutfitMenuPanel';

function useAutoOrientation() {
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsCompactLandscape(e.matches);
    update(mql);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return { isCompactLandscape };
}

// ... (Interface BuildUIProps เหมือนเดิม) ...
interface BuildUIProps {
  houses: PlacedHouse[];
  animals: PlacedAnimal[];
  rocks?: PlacedRock[];
  placing: PlacingState | null;
  ghostValid: boolean;
  ghostReason?: string;
  ghostPos?: { x: number; z: number } | null;
  selectedHouse: PlacedHouse | null;
  selectedAnimal: PlacedAnimal | null;
  selectedRock?: PlacedRock | null;
  playerCoins: number;
  playerGems?: number;
  playerDay?: number;
  timeOfDay?: TimeOfDay;
  onCycleTimeOfDay?: () => void;
  isMovementLocked?: boolean;
  onToggleMovementLock?: () => void;
  isPlayerHidden?: boolean;
  onTogglePlayerHidden?: () => void;
  fingerSwipeEnabled?: boolean;
  onToggleFingerSwipe?: () => void;
  farmerGender?: FarmerGender;
  onToggleFarmerGender?: () => void;
  cameraMode?: CameraMode;
  onCycleCameraMode?: () => void;
  isMovingPlotMode?: boolean;
  onToggleMovingPlotMode?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  onOpenExpansion?: () => void;
  onOpenInventory?: () => void;
  onOpenGuide?: () => void;
  onOpenDevDocs?: () => void;
  onResetCamera?: () => void;
  onOpenSettings?: () => void;
  onOpenInstall?: () => void;
  onStartPlaceHouse: (type: number) => void;
  onStartPlaceAnimal: (animalType: AnimalType) => void;
  onStartPlaceRock?: (rockType: RockType) => void;
  onRotatePlacing: () => void;
  onNudgePlacing?: (dx: number, dz: number) => void;
  onConfirmPlace: () => void;
  onCancelPlace: () => void;
  onMoveSelectedHouse: () => void;
  onRotateSelectedHouse: () => void;
  onColorSelectedHouse?: (color: string | undefined) => void;
  onTextureSelectedHouse?: (textureDataUrl: string | undefined, repeat?: number) => void;
  onStyleHousePart?: (
    houseId: string,
    part: HousePartKey | 'all',
    patch: { color?: string | null; textureDataUrl?: string | null; textureRepeat?: number }
  ) => void;
  onResetHouseStyle?: (houseId: string, part?: HousePartKey | 'all') => void;
  onFocusHouseCamera?: (x: number, z: number) => void;
  playerOutfit?: PlayerOutfitConfig;
  onUpdatePlayerOutfit?: (
    updater: PlayerOutfitConfig | ((prev: PlayerOutfitConfig) => PlayerOutfitConfig)
  ) => void;
  onResetPlayerOutfit?: () => void;
  onFocusPlayerCamera?: () => void;
  onNotice?: (text: string, color?: string) => void;
  onOpenFishShop?: (houseId: string) => void;
  onInteractSelectedHouse?: (houseId: string) => void;
  onDeleteSelectedHouse: () => void;
  onCloseSelectedHouse: () => void;
  onMoveSelectedAnimal: () => void;
  onRotateSelectedAnimal: () => void;
  onDeleteSelectedAnimal: () => void;
  onPetSelectedAnimal: () => void;
  onCloseSelectedAnimal: () => void;
  onMoveSelectedRock?: () => void;
  onRotateSelectedRock?: () => void;
  onDeleteSelectedRock?: () => void;
  onCloseSelectedRock?: () => void;
  isOpen?: boolean;
  isAnyDrawerOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  adjacentMenu?: React.ReactNode;
}

const BuildUIInner: React.FC<BuildUIProps> = ({
  houses, animals, rocks = [], placing, ghostValid, ghostReason, ghostPos,
  selectedHouse, selectedAnimal, selectedRock, playerCoins, playerGems = 0,
  playerDay = 1, timeOfDay = 'morning', onCycleTimeOfDay,
  isMovementLocked = false, onToggleMovementLock,
  isPlayerHidden = false, onTogglePlayerHidden,
  fingerSwipeEnabled = false, onToggleFingerSwipe,
  farmerGender = 'male', onToggleFarmerGender,
  cameraMode = 'isometric', onCycleCameraMode,
  isMovingPlotMode = false, onToggleMovingPlotMode,
  soundEnabled = true, onToggleSound,
  onOpenExpansion, onOpenInventory, onOpenGuide, onOpenDevDocs, onResetCamera, onOpenSettings, onOpenInstall,
  onStartPlaceHouse, onStartPlaceAnimal, onStartPlaceRock,
  onRotatePlacing, onNudgePlacing, onConfirmPlace, onCancelPlace,
  onMoveSelectedHouse, onRotateSelectedHouse,
  onColorSelectedHouse, onTextureSelectedHouse,
  onStyleHousePart, onResetHouseStyle, onFocusHouseCamera,
  playerOutfit = DEFAULT_PLAYER_OUTFIT, onUpdatePlayerOutfit, onResetPlayerOutfit, onFocusPlayerCamera,
  onNotice, onOpenFishShop, onInteractSelectedHouse, onDeleteSelectedHouse, onCloseSelectedHouse,
  onMoveSelectedAnimal, onRotateSelectedAnimal, onDeleteSelectedAnimal, onPetSelectedAnimal, onCloseSelectedAnimal,
  onMoveSelectedRock, onRotateSelectedRock, onDeleteSelectedRock, onCloseSelectedRock,
  isOpen, isAnyDrawerOpen = false, onOpenChange, adjacentMenu,
}) => {
  const { lang, toggleLang, t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  // ✅ เพิ่ม 'guide' เข้าไปใน type ของ activeTab
  const [activeTab, setActiveTab] = useState<'houses' | 'animals' | 'tools' | 'decor' | 'outfits' | 'guide'>('houses');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const { isCompactLandscape } = useAutoOrientation();

  useEffect(() => {
    setIsColorPickerOpen(false);
  }, [selectedHouse?.id]);

  useEffect(() => {
    setIsColorPickerOpen(false);
  }, [isCompactLandscape]);

  const timeLabels: Record<TimeOfDay, { label: string; icon: React.ReactNode; color: string }> = {
    morning: { label: t('เช้า (07:30)', 'Morning (07:30)'), icon: <Sun className="w-3.5 h-3.5 text-amber-700 shrink-0" />, color: 'bg-amber-200/60 text-amber-900 border-amber-400/50 hover:bg-amber-300/80' },
    day: { label: t('กลางวัน (12:00)', 'Noon (12:00)'), icon: <Sun className="w-3.5 h-3.5 text-yellow-600 shrink-0" />, color: 'bg-yellow-100/60 text-yellow-800 border-yellow-400/50 hover:bg-yellow-200/80' },
    sunset: { label: t('เย็น (17:45)', 'Sunset (17:45)'), icon: <Sunset className="w-3.5 h-3.5 text-orange-700 shrink-0" />, color: 'bg-orange-200/60 text-orange-900 border-orange-400/50 hover:bg-orange-300/80' },
    night: { label: t('ค่ำ (21:30)', 'Night (21:30)'), icon: <Moon className="w-3.5 h-3.5 text-indigo-800 shrink-0" />, color: 'bg-indigo-200/60 text-indigo-900 border-indigo-400/50 hover:bg-indigo-300/80' },
  };

  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) onOpenChange(resolved);
    else setInternalOpen(resolved);
  };

  const countOfHouse = (type: number) => houses.filter((h) => h.type === type).length;
  const countOfAnimal = (type: AnimalType) => animals.filter((a) => a.type === type).length;
  const countOfRock = (type: RockType) => rocks.filter((r) => r.type === type).length;

  const placingHouseDef = placing && placing.category === 'house' ? HOUSE_DEFS[placing.type] : null;
  const placingAnimalDef = placing && placing.category === 'animal' && placing.animalType ? ANIMAL_DEFS[placing.animalType] : null;
  const placingRockDef = placing && placing.category === 'rock' && placing.rockType ? ROCK_DEFS[placing.rockType] : null;
  const selectedHouseDef = selectedHouse ? HOUSE_DEFS[selectedHouse.type] : null;
  const selectedAnimalDef = selectedAnimal ? ANIMAL_DEFS[selectedAnimal.type] : null;
  const selectedRockDef = selectedRock ? ROCK_DEFS[selectedRock.type] : null;

  const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();
  const localizedReason = translatePlacementReason(ghostReason, lang);

  const parchmentBg = 'bg-[#f4ecd8] border-2 border-[#c8b890] shadow-[0_4px_15px_rgba(0,0,0,0.3)]';
  const parchmentBtn = 'bg-[#e8d8b0] hover:bg-[#d8c8a0] text-[#3e2723] border border-[#b8a880] active:scale-95 transition-all shadow-sm';
  const parchmentDisabled = 'bg-[#e0d8c8]/50 border-[#c8b890]/50 text-[#8b7d6b] cursor-not-allowed';
  const leatherTab = 'bg-[#6b4c3a] text-[#f4ecd8] hover:bg-[#5a3d2e] border border-[#4a2d1e] shadow-md';
  const leatherTabActive = 'bg-[#8b5a2b] text-white border border-[#5c3a21] shadow-inner font-black';
  const itemCard = 'bg-[#fdf5e6]/80 hover:bg-[#fdf5e6] border border-[#d2b48c] shadow-sm rounded-lg';

  const btn = 'pointer-events-auto flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-2 rounded-xl border text-xs sm:text-sm font-black transition-all active:scale-95 whitespace-nowrap';

  return (
    <>
      {/* ปุ่มเปิดเมนู */}
      {!placing && !selectedAnimal && !selectedHouse && !selectedRock && (
        <div
          data-ui
          className={`absolute z-30 flex flex-col items-start gap-2 sm:gap-3 max-w-[calc(100vw-1rem)] pointer-events-none safe-left ${
            isCompactLandscape
              ? 'left-2 top-2 gap-1.5'
              : 'left-2 sm:left-3 top-16 sm:top-20 short:top-12 short:gap-1.5'
          }`}
        >
          <button
            onClick={() => setOpen((o) => !o)}
            title={t('เปิดสมุดสิ่งก่อสร้าง', 'Open Build Book')}
            className={`order-1 pointer-events-auto relative flex items-center justify-center rounded-full border transition-all active:scale-95 shadow-lg shadow-black/30 ${
              isCompactLandscape ? 'w-10 h-10' : 'w-14 h-14 short:w-10 short:h-10'
            } ${open ? leatherTabActive : parchmentBtn}`}
          >
            {open ? (
              <ChevronLeft className="w-6 h-6 shrink-0 drop-shadow-md" />
            ) : (
              <Hammer className="w-6 h-6 text-[#5c3a21] shrink-0" />
            )}
            {!open && (
              <span className={`absolute -top-1.5 -right-2 text-[10px] px-2 py-0.5 rounded-full font-black shadow-md whitespace-nowrap z-10 border bg-[#8b5a2b] text-white border-[#5c3a21]`}>
                {t('สร้าง', 'Build')}
              </span>
            )}
          </button>
          {adjacentMenu}
        </div>
      )}

      {/* ─── MAIN BOOK MENU OVERLAY ─── */}
      {open && (
        <div
          data-ui-backdrop
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-1 sm:p-4 pointer-events-auto"
          onClick={() => setOpen(false)}
        >
          <div
            onPointerDown={stopPropagation}
            onPointerUp={stopPropagation}
            onClick={stopPropagation}
            className={`relative flex bg-[#f4ecd8] rounded-xl overflow-hidden shadow-2xl border-4 sm:border-[6px] border-[#5c3a21] transition-all duration-200 ${
              isCompactLandscape
                ? 'w-[96vw] h-[94dvh] max-h-[94dvh] flex-row'
                : 'w-[95vw] sm:w-[90vw] md:max-w-4xl lg:max-w-5xl h-[85dvh] sm:h-[80dvh] sm:max-h-[800px] flex-col sm:flex-row'
            }`}
            style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #fdf5e6 0%, #e8d8b0 100%)' }}
          >
            {/* Book Spine */}
            <div
              className={`${
                isCompactLandscape ? 'block left-1/3' : 'hidden sm:block sm:left-[35%] md:left-[30%]'
              } absolute top-0 bottom-0 w-6 -ml-3 bg-gradient-to-r from-transparent via-[#c8b890]/60 to-transparent z-10 pointer-events-none shadow-[inset_0_0_15px_rgba(0,0,0,0.2)]`}
            ></div>

            {/* LEFT PAGE - Categories */}
            <div
              className={`bg-[#ebe0c8]/50 border-[#c8b890] z-20 hide-scrollbar shrink-0 ${
                isCompactLandscape
                  ? 'w-1/3 max-w-[220px] h-full flex-col overflow-y-auto border-r p-1.5 gap-1'
                  : 'w-full sm:w-[35%] md:w-[30%] h-auto sm:h-full flex-row sm:flex-col overflow-x-auto sm:overflow-y-auto border-b sm:border-b-0 sm:border-r p-2 sm:p-4 gap-1.5'
              }`}
            >
              {/* Time & Currency */}
              <div className={`${isCompactLandscape ? 'flex' : 'hidden sm:flex'} flex-col gap-1 mb-1 w-full`}>
                <button onClick={onCycleTimeOfDay} className={`flex items-center gap-1.5 border px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold ${timeLabels[timeOfDay].color}`}>
                  {timeLabels[timeOfDay].icon}
                  <span className="truncate">{t(`วันที่ ${playerDay}`, `Day ${playerDay}`)} • {timeLabels[timeOfDay].label}</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 flex items-center justify-center gap-1 bg-[#fdf5e6] text-[#8b5a2b] border border-[#d2b48c] rounded-lg px-1.5 py-1 font-mono font-black text-[10px] sm:text-xs shadow-sm">
                    <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span>{playerCoins.toLocaleString()}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1 bg-[#fdf5e6] text-[#5c8a8a] border border-[#a8c8c8] rounded-lg px-1.5 py-1 font-mono font-black text-[10px] sm:text-xs shadow-sm">
                    <span className="text-[10px] leading-none sm:text-xs">💎</span> <span>{playerGems.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Bookmark Tabs (เพิ่ม Guide เข้าไป) */}
              <div className={`${isCompactLandscape ? 'flex flex-col' : 'flex flex-row sm:flex-col'} gap-1.5 w-full sm:w-[110%]`}>
                {(['houses', 'animals', 'tools', 'decor', 'outfits', 'guide'] as const).map((tab) => {
                  const label = 
                    tab === 'houses' ? t('สิ่งก่อสร้าง', 'Buildings') : 
                    tab === 'animals' ? t('สัตว์', 'Animals') : 
                    tab === 'tools' ? t('หินประดับ', 'Rocks') : 
                    tab === 'decor' ? t('ตกแต่งบ้าน', 'Home Decor') : 
                    tab === 'outfits' ? t('เสื้อผ้า', 'Outfits') : 
                    t('วิธีเล่น', 'How to Play');
                  const Icon = 
                    tab === 'houses' ? Home : 
                    tab === 'animals' ? Sparkles : 
                    tab === 'tools' ? Wrench : 
                    tab === 'decor' ? Palette : 
                    tab === 'outfits' ? Shirt : 
                    HelpCircle;
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === 'outfits') onFocusPlayerCamera?.();
                      }}
                      className={`relative flex-shrink-0 flex items-center justify-start gap-1.5 sm:gap-2 w-auto sm:w-full rounded-lg sm:rounded-r-lg sm:rounded-l-none transition-all font-bold ${
                        isCompactLandscape ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 sm:py-2 md:py-2.5 text-[11px] sm:text-xs md:text-sm'
                      } ${isActive ? leatherTabActive : leatherTab} ${isActive ? 'sm:translate-x-1.5 z-30' : 'sm:translate-x-0 z-20'}`}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
                      <span className="whitespace-nowrap">{label}</span>
                      {isActive && <div className="hidden sm:block absolute -right-2.5 top-0 bottom-0 w-2.5 bg-[#8b5a2b] [clip-path:polygon(0_0,100%_10%,100%_90%,0_100%)]"></div>}
                    </button>
                  );
                })}
              </div>

              {/* Mobile Top Bar */}
              <div className={`${isCompactLandscape ? 'hidden' : 'sm:hidden'} flex items-center gap-1 ml-auto`}>
                <button onClick={onCycleTimeOfDay} className={`flex items-center gap-0.5 border px-1.5 py-1 rounded-md text-[10px] font-bold ${timeLabels[timeOfDay].color}`}>
                  {timeLabels[timeOfDay].icon}
                </button>
                <div className="flex items-center gap-0.5 bg-[#fdf5e6] text-[#8b5a2b] border border-[#d2b48c] rounded-md px-1 py-1 font-mono font-black text-[10px]">
                  <Coins className="w-2.5 h-2.5" /> <span>{playerCoins}</span>
                </div>
                <div className="flex items-center gap-0.5 bg-[#fdf5e6] text-[#5c8a8a] border border-[#a8c8c8] rounded-md px-1 py-1 font-mono font-black text-[10px]">
                  <span>💎</span> <span>{playerGems}</span>
                </div>
              </div>
            </div>

            {/* RIGHT PAGE - Content */}
            <div
              className={`flex-1 flex flex-col overflow-y-auto z-20 min-w-0 ${
                isCompactLandscape ? 'p-1.5' : 'p-2 sm:p-4'
              }`}
            >
              <div className={`${isCompactLandscape ? 'mb-1 pb-1' : 'mb-2 pb-1.5'} border-b-2 border-[#d2b48c] border-dashed flex justify-between items-center`}>
                <h2 className={`${isCompactLandscape ? 'text-sm' : 'text-base sm:text-lg md:text-xl'} font-black text-[#5c3a21] font-serif capitalize`}>
                  {activeTab === 'houses' ? t('รายการสิ่งก่อสร้าง', 'Buildings') :
                   activeTab === 'animals' ? t('รายการสัตว์', 'Animals') :
                   activeTab === 'tools' ? t('รายการหินประดับ', 'Rocks') :
                   activeTab === 'decor' ? t('เครื่องมือตกแต่ง', 'Decor Tools') :
                   activeTab === 'outfits' ? t('ชุดและเครื่องแต่งกาย', 'Outfits') :
                   t('คู่มือวิธีเล่น', 'How to Play')}
                </h2>
                <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-[#d2b48c]/50 text-[#5c3a21] transition-colors">
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 pb-4">
                
                {/* ✅ UX HINT: แสดงข้อความแนะนำสั้นๆ ในแท็บการสร้าง */}
                {['houses', 'animals', 'tools'].includes(activeTab) && (
                  <div className="mb-3 p-2 bg-[#e8d8b0]/60 border border-[#d2b48c] rounded-lg flex items-start gap-2 shadow-sm">
                    <Info className="w-4 h-4 text-[#8b5a2b] shrink-0 mt-0.5" />
                    <div className="text-[10px] sm:text-xs text-[#5c3a21] font-medium leading-tight">
                      {t('💡 เคล็ดลับ: เลือกรายการที่ต้องการเพื่อเข้าสู่โหมดวางตำแหน่ง จากนั้นกด "วางตรงนี้" เพื่อยืนยัน', 
                         '💡 Tip: Select an item to enter placement mode, then tap "Place" to confirm.')}
                    </div>
                  </div>
                )}

                {activeTab === 'houses' && (
                  <div className={`grid gap-1.5 sm:gap-2 md:gap-3 ${isCompactLandscape ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6'}`}>
                    {HOUSE_DEFS.map((def) => {
                      const used = countOfHouse(def.type);
                      const maxAllowed = getMaxForHouseType(def.type);
                      const full = used >= maxAllowed;
                      const canAfford = !def.cost || playerCoins >= def.cost;
                      const disabled = full || !canAfford;
                      const houseName = getHouseName(def.type, lang);
                      return (
                        <button
                          key={def.type}
                          disabled={disabled}
                          onClick={() => { onStartPlaceHouse(def.type); setOpen(false); }}
                          className={`relative flex flex-col items-center justify-center p-1.5 md:p-2 aspect-square rounded-lg border transition-all ${
                            disabled ? parchmentDisabled : `${itemCard} active:scale-95`
                          }`}
                        >
                          <GlbAutoIcon candidates={getHouseGlbCandidates(def)} alt={houseName} disabled={disabled} fallbackIcon={def.type === 30 ? def.icon : undefined} />
                          <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-center leading-tight line-clamp-2 w-full mt-0.5 md:mt-1 text-[#3e2723]">{houseName}</span>
                          <span className="text-[8px] sm:text-[9px] md:text-[10px] text-[#8b5a2b] font-black">{def.cost ? `${def.cost}💰` : t('ฟรี', 'Free')}</span>
                          <span className="absolute top-0.5 right-0.5 text-[8px] md:text-[9px] bg-[#5c3a21] px-1 rounded text-[#f4ecd8] font-black font-mono">{used}/{maxAllowed}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'animals' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2 md:gap-3">
                    {(Object.keys(ANIMAL_DEFS) as AnimalType[]).map((atype) => {
                      const def = ANIMAL_DEFS[atype];
                      const count = countOfAnimal(atype);
                      const canAfford = playerCoins >= def.buyCost && (!def.gemCost || playerGems >= def.gemCost);
                      const animalName = getAnimalName(atype, lang);
                      return (
                        <button
                          key={atype}
                          disabled={!canAfford}
                          onClick={() => { onStartPlaceAnimal(atype); setOpen(false); }}
                          className={`relative flex flex-col items-center justify-center p-1.5 md:p-2 aspect-square rounded-lg border transition-all ${
                            !canAfford ? parchmentDisabled : `${itemCard} active:scale-95`
                          }`}
                        >
                          <GlbAutoIcon candidates={getAnimalGlbCandidates(atype)} alt={animalName} disabled={!canAfford} />
                          <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-center leading-tight line-clamp-2 w-full mt-0.5 md:mt-1 text-[#3e2723]">{animalName}</span>
                          <span className="text-[8px] sm:text-[9px] md:text-[10px] text-[#8b5a2b] font-black truncate max-w-full">{def.buyCost}💰{def.gemCost ? ` · ${def.gemCost}💎` : ''}</span>
                          <span className="absolute top-0.5 right-0.5 text-[8px] md:text-[9px] bg-[#5c3a21] px-1 rounded text-emerald-200 font-black font-mono">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'tools' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2 md:gap-3">
                    {(Object.keys(ROCK_DEFS) as RockType[]).map((rtype) => {
                      const def = ROCK_DEFS[rtype];
                      const count = countOfRock(rtype);
                      const canAfford = playerCoins >= def.cost;
                      const rockName = getRockName(rtype, lang);
                      return (
                        <button
                          key={rtype}
                          disabled={!canAfford}
                          onClick={() => { onStartPlaceRock?.(rtype); setOpen(false); }}
                          className={`relative flex flex-col items-center justify-center p-1.5 md:p-2 aspect-square rounded-lg border transition-all ${
                            !canAfford ? parchmentDisabled : `${itemCard} active:scale-95`
                          }`}
                        >
                          <GlbAutoIcon candidates={getRockGlbCandidates(rtype)} alt={rockName} disabled={!canAfford} />
                          <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-center leading-tight line-clamp-2 w-full mt-0.5 md:mt-1 text-[#3e2723]">{rockName}</span>
                          <span className="text-[8px] sm:text-[9px] md:text-[10px] text-[#8b5a2b] font-black">{def.cost}💰</span>
                          <span className="absolute top-0.5 right-0.5 text-[8px] md:text-[9px] bg-[#5c3a21] px-1 rounded text-[#f4ecd8] font-black font-mono">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'decor' && onStyleHousePart && onResetHouseStyle && (
                  <div className="text-[#3e2723] text-xs sm:text-sm">
                    <HouseDecorMenuPanel
                      mode="menu"
                      houses={houses}
                      onStyleHousePart={onStyleHousePart}
                      onResetHouseStyle={onResetHouseStyle}
                      onFocusHouse={onFocusHouseCamera}
                      onQuickBuildCabin={() => { onStartPlaceHouse(0); setOpen(false); }}
                      onNotice={onNotice}
                    />
                  </div>
                )}

                {activeTab === 'outfits' && onUpdatePlayerOutfit && onResetPlayerOutfit && (
                  <div className="flex flex-col h-full min-h-[300px]">
                    <div className="text-[#3e2723] text-xs sm:text-sm flex-1">
                      <OutfitMenuPanel
                        farmerGender={farmerGender}
                        onToggleFarmerGender={onToggleFarmerGender}
                        isPlayerHidden={isPlayerHidden}
                        onTogglePlayerHidden={onTogglePlayerHidden}
                        playerOutfit={playerOutfit}
                        onUpdateOutfit={onUpdatePlayerOutfit}
                        onResetOutfit={onResetPlayerOutfit}
                        onFocusPlayer={onFocusPlayerCamera}
                        onNotice={onNotice}
                      />
                    </div>

                    {/* Quick Tools Section */}
                    <div className="mt-auto pt-3 border-t border-[#d2b48c] border-dashed w-full">
                      <div className="text-[10px] text-[#8b5a2b] font-bold mb-1.5 px-1">{t('เมนูลัด', 'Quick Tools')}</div>
                      {/* Row 1: Main Menus */}
                      <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                        {onOpenInventory && (
                          <button onClick={() => { onOpenInventory(); setOpen(false); }} className={`flex flex-col items-center justify-center gap-1 min-h-[40px] rounded-md p-1 ${parchmentBtn}`} title={t('กระเป๋า', 'Bag')}>
                            <Backpack className="w-4 h-4 text-amber-800" />
                          </button>
                        )}
                        {onOpenGuide && (
                          <button onClick={() => { onOpenGuide(); setOpen(false); }} className={`flex flex-col items-center justify-center gap-1 min-h-[40px] rounded-md p-1 ${parchmentBtn}`} title={t('ภารกิจ', 'Quests')}>
                            <BookOpen className="w-4 h-4 text-emerald-800" />
                          </button>
                        )}
                        {onOpenExpansion && (
                          <button onClick={() => { onOpenExpansion(); setOpen(false); }} className={`flex flex-col items-center justify-center gap-1 min-h-[40px] rounded-md p-1 ${parchmentBtn}`} title={t('ขยายที่ดิน', 'Expand Land')}>
                            <MapPin className="w-4 h-4 text-red-800" />
                          </button>
                        )}
                        {onOpenDevDocs && (
                          <button onClick={() => { onOpenDevDocs(); setOpen(false); }} className={`flex flex-col items-center justify-center gap-1 min-h-[40px] rounded-md p-1 ${parchmentBtn}`} title={t('3D Dev', '3D Dev')}>
                            <Compass className="w-4 h-4 text-indigo-800" />
                          </button>
                        )}
                      </div>
                      {/* Row 2: Settings & Toggles */}
                      <div className="grid grid-cols-5 gap-1.5 mb-1.5">
                        <button onClick={onToggleMovementLock} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`} title={t('ล็อคเดิน', 'Lock Move')}>
                          {isMovementLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-emerald-700" />}
                        </button>
                        <button onClick={onCycleCameraMode} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`} title={t('กล้อง', 'Camera')}>
                          <Camera className="w-3.5 h-3.5 text-purple-800" />
                        </button>
                        {onToggleMovingPlotMode && (
                          <button onClick={onToggleMovingPlotMode} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${isMovingPlotMode ? 'bg-amber-400 border-amber-600' : parchmentBtn}`} title={t('ย้ายแปลง', 'Move Plots')}>
                            <Move className="w-3.5 h-3.5 text-amber-900" />
                          </button>
                        )}
                        {onResetCamera && (
                          <button onClick={onResetCamera} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`} title={t('จัดกลาง', 'Center')}>
                            <Compass className="w-3.5 h-3.5 text-sky-800" />
                          </button>
                        )}
                        <button onClick={toggleLang} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`} title={t('ภาษา', 'Lang')}>
                          <Globe className="w-3.5 h-3.5 text-blue-800" />
                        </button>
                      </div>
                      {/* Row 3: Extra */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <button onClick={onToggleSound} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`}>
                          {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-800" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
                        </button>
                        {onToggleFingerSwipe && (
                          <button onClick={onToggleFingerSwipe} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${fingerSwipeEnabled ? 'bg-emerald-200 border-emerald-400' : parchmentBtn}`}>
                            <Hand className="w-3.5 h-3.5 text-emerald-900" />
                          </button>
                        )}
                        {onOpenInstall && (
                          <button onClick={() => { onOpenInstall(); setOpen(false); }} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`}>
                            <Download className="w-3.5 h-3.5 text-amber-800" />
                          </button>
                        )}
                        {onOpenSettings && (
                          <button onClick={() => { onOpenSettings(); setOpen(false); }} className={`flex items-center justify-center min-h-[28px] rounded-md p-1 ${parchmentBtn}`}>
                            <Settings className="w-3.5 h-3.5 text-gray-700" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ✅ หน้าเนื้อหาวิธีเล่น (Guide) */}
                {activeTab === 'guide' && (
                  <div className="text-[#3e2723] text-xs sm:text-sm space-y-4 px-1">
                    <div className="flex gap-3 items-start">
                      <div className="bg-[#8b5a2b] text-white p-1.5 rounded-full shrink-0 shadow-sm"><MousePointerClick className="w-4 h-4" /></div>
                      <div>
                        <h3 className="font-bold text-[#5c3a21] text-sm">{t('1. การเลือกและวางสิ่งก่อสร้าง', '1. Selecting and Placing')}</h3>
                        <p className="text-xs mt-0.5 opacity-90">{t('เลือกไอเทมจากแท็บด้านซ้าย จากนั้นลาก/คลิกตำแหน่งบนพื้นดินเพื่อวาง กดปุ่ม "หมุน" เพื่อเปลี่ยนทิศทาง และกด "วางตรงนี้" เพื่อยืนยัน', 'Select an item from the left tab, drag/click on the ground to position. Use "Rotate" to change direction, and tap "Place" to confirm.')}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="bg-[#8b5a2b] text-white p-1.5 rounded-full shrink-0 shadow-sm"><Move className="w-4 h-4" /></div>
                      <div>
                        <h3 className="font-bold text-[#5c3a21] text-sm">{t('2. การจัดการไอเทม (ย้าย/ลบ)', '2. Managing Items (Move/Delete)')}</h3>
                        <p className="text-xs mt-0.5 opacity-90">{t('เมื่อวางของแล้ว คุณสามารถคลิกที่ตัวมันเพื่อเปิดเมนูจัดการ ปรับเปลี่ยนสี (ตกแต่ง), ย้าย, หมุน, หรือเก็บกลับเข้าคลังเพื่อรับเหรียญคืน', 'Once placed, click the item to open its menu. You can recolor (Decorate), move, rotate, or store it back to the inventory for a refund.')}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="bg-[#8b5a2b] text-white p-1.5 rounded-full shrink-0 shadow-sm"><Heart className="w-4 h-4" /></div>
                      <div>
                        <h3 className="font-bold text-[#5c3a21] text-sm">{t('3. การดูแลสัตว์', '3. Animal Care')}</h3>
                        <p className="text-xs mt-0.5 opacity-90">{t('คลิกที่สัตว์เลี้ยงของคุณเพื่อลูบ (Pet) เพิ่มความรัก และกด "ใช้งาน" ที่บ้านสัตว์เพื่อเก็บเกี่ยวผลผลิต', 'Click your pet to Pet them and increase affection. Click "Open" on animal houses to collect produce.')}</p>
                      </div>
                    </div>

                    <div className="flex gap-3 items-start">
                      <div className="bg-[#8b5a2b] text-white p-1.5 rounded-full shrink-0 shadow-sm"><Palette className="w-4 h-4" /></div>
                      <div>
                        <h3 className="font-bold text-[#5c3a21] text-sm">{t('4. การปรับแต่งบ้านและชุด', '4. Customization')}</h3>
                        <p className="text-xs mt-0.5 opacity-90">{t('คุณสามารถเปลี่ยนสีบ้านได้ที่ปุ่ม "ตกแต่ง" และเปลี่ยนเสื้อผ้าตัวละครได้ที่แท็บ "เสื้อผ้า"', 'You can change house colors via the "Decorate" button, and change character outfits in the "Outfits" tab.')}</p>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-[#e8d8b0]/80 border border-[#d2b48c] rounded-lg">
                      <div className="flex items-center gap-1.5 text-[#8b5a2b] font-bold mb-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>{t('เคล็ดลับสำหรับมือใหม่', 'Beginner Tips')}</span>
                      </div>
                      <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                        <li>{t('ใช้ปุ่มลูกศร (Nudge) เพื่อจัดตำแหน่งให้เป๊ะขึ้น', 'Use the arrow buttons (Nudge) for precise placement.')}</li>
                        <li>{t('เปลี่ยนเวลากลางวัน-กลางคืนเพื่อชมบรรยากาศที่ต่างกัน', 'Change time of day to see different atmospheres.')}</li>
                        <li>{t('ล็อคการเดิน (Lock Move) ป้องกันการเดินชนของขณะจัดสวน', 'Lock movement to prevent walking into objects while landscaping.')}</li>
                      </ul>
                    </div>
                  </div>
                )}

              </div>

              {/* Mobile Bottom Action Buttons */}
              <div className={`${isCompactLandscape ? 'hidden' : 'sm:hidden'} flex flex-wrap gap-1 mt-2 pt-2 border-t border-[#d2b48c]`}>
                {onOpenInventory && (
                  <button onClick={() => { onOpenInventory(); setOpen(false); }} className={`flex-1 flex items-center justify-center min-h-[32px] rounded-md p-1 ${parchmentBtn}`}>
                    <Backpack className="w-4 h-4 text-amber-800" />
                  </button>
                )}
                {onOpenGuide && (
                  <button onClick={() => { onOpenGuide(); setOpen(false); }} className={`flex-1 flex items-center justify-center min-h-[32px] rounded-md p-1 ${parchmentBtn}`}>
                    <BookOpen className="w-4 h-4 text-emerald-800" />
                  </button>
                )}
                {onOpenExpansion && (
                  <button onClick={() => { onOpenExpansion(); setOpen(false); }} className={`flex-1 flex items-center justify-center min-h-[32px] rounded-md p-1 ${parchmentBtn}`}>
                    <MapPin className="w-4 h-4 text-red-800" />
                  </button>
                )}
                <button onClick={onToggleMovementLock} className={`flex-1 flex items-center justify-center min-h-[32px] rounded-md p-1 ${parchmentBtn}`}>
                  {isMovementLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-emerald-700" />}
                </button>
                <button onClick={onCycleCameraMode} className={`flex-1 flex items-center justify-center min-h-[32px] rounded-md p-1 ${parchmentBtn}`}>
                  <Camera className="w-4 h-4 text-purple-800" />
                </button>
                <button onClick={toggleLang} className={`flex-1 flex items-center justify-center min-h-[32px] rounded-md p-1 ${parchmentBtn}`}>
                  <Globe className="w-4 h-4 text-blue-800" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ... (Placing UI, Selected UI, etc. เหมือนเดิม) ... */}
      
      {/* ─── PLACING UI ─── */}
      {placing && (
        <div
          data-ui
          className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 ${
            isCompactLandscape ? 'top-2 w-auto max-w-[80vw]' : 'top-16 sm:top-6 w-[95vw] sm:w-full sm:max-w-md md:max-w-lg'
          }`}
        >
          <div className={`pointer-events-auto w-full rounded-xl p-2.5 sm:p-3 flex flex-col gap-1.5 text-center ${parchmentBg}`}>
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs sm:text-sm font-black text-[#3e2723] flex items-center gap-1.5 truncate">
                <span>{placing.editId ? t('🔄 ย้าย', '🔄 Move') : t('✨ วาง', '✨ Place')}:</span>
                {placingHouseDef && <GlbAutoIcon candidates={getHouseGlbCandidates(placingHouseDef)} alt={getHouseName(placing.type, lang)} size="sm" fallbackIcon={placingHouseDef.type === 30 ? placingHouseDef.icon : undefined} />}
                {placingAnimalDef && placing.animalType && <GlbAutoIcon candidates={getAnimalGlbCandidates(placing.animalType)} alt={getAnimalName(placing.animalType, lang)} size="sm" />}
                {placingRockDef && placing.rockType && <GlbAutoIcon candidates={getRockGlbCandidates(placing.rockType)} alt={getRockName(placing.rockType, lang)} size="sm" />}
                <span className="truncate">
                  {placingRockDef && placing.rockType ? `${getRockName(placing.rockType, lang)}` : placingAnimalDef && placing.animalType ? getAnimalName(placing.animalType, lang) : placingHouseDef ? getHouseName(placing.type, lang) : ''}
                </span>
              </span>
              {ghostPos && (
                <span className="text-[10px] md:text-xs font-mono font-bold text-[#5c3a21] shrink-0 flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-[#8b5a2b]" /> <span>X:{ghostPos.x.toFixed(1)} Z:{ghostPos.z.toFixed(1)}</span>
                </span>
              )}
            </div>

            <div className={`text-[11px] sm:text-xs px-2 py-1 rounded-lg font-bold border flex items-center justify-center gap-1 ${
              ghostValid ? 'bg-emerald-100 border-emerald-400 text-emerald-900' : 'bg-red-100 border-red-400 text-red-900'
            }`}>
              <span>{ghostValid ? '✓' : '⚠️'}</span>
              <span>{localizedReason || (ghostValid ? t('ตำแหน่งนี้วางได้', 'Valid') : t('ตำแหน่งนี้ไม่สามารถวางได้', 'Cannot place'))}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-center pointer-events-auto">
            <button onClick={onConfirmPlace} className={`${btn} ${ghostValid ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 px-3 py-1.5 md:px-4 md:py-2.5' : parchmentDisabled}`}>
              <Check className="w-4 h-4" />
              <span>{t('วางตรงนี้', 'Place')}</span>
            </button>
            <button onClick={onRotatePlacing} className={`${btn} ${parchmentBtn}`}>
              <RotateCw className="w-4 h-4 text-[#5c3a21]" /> <span>{t('หมุน', 'Rotate')}</span>
            </button>
            {onNudgePlacing && (
              <div className="flex items-center bg-[#e8d8b0] border border-[#b8a880] rounded-xl p-0.5 shadow-md">
                <button onClick={() => onNudgePlacing(-2, 0)} className="p-1.5 md:p-2 hover:bg-[#d8c8a0] text-[#3e2723] rounded-lg"><ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                <button onClick={() => onNudgePlacing(0, -2)} className="p-1.5 md:p-2 hover:bg-[#d8c8a0] text-[#3e2723] rounded-lg"><ArrowUp className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                <button onClick={() => onNudgePlacing(0, 2)} className="p-1.5 md:p-2 hover:bg-[#d8c8a0] text-[#3e2723] rounded-lg"><ArrowDown className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
                <button onClick={() => onNudgePlacing(2, 0)} className="p-1.5 md:p-2 hover:bg-[#d8c8a0] text-[#3e2723] rounded-lg"><ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
              </div>
            )}
            <button onClick={onCancelPlace} className={`${btn} ${parchmentBtn}`}>
              <X className="w-4 h-4 text-red-700" /> <span>{t('ยกเลิก', 'Cancel')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── SELECTED HOUSE UI ─── */}
      {!placing && selectedHouse && selectedHouseDef && (
        <div
          data-ui
          onPointerDown={stopPropagation}
          onPointerUp={stopPropagation}
          onClick={stopPropagation}
          className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 ${
            isCompactLandscape ? 'top-2 w-auto max-w-[90vw]' : 'top-16 sm:top-6 w-[95vw] sm:w-auto sm:max-w-[95vw]'
          }`}
        >
          <div className={`pointer-events-auto rounded-xl px-3 py-1 text-xs md:text-sm font-black text-[#3e2723] flex items-center gap-1.5 ${parchmentBg}`}>
            <GlbAutoIcon candidates={getHouseGlbCandidates(selectedHouseDef)} alt={getHouseName(selectedHouse.type, lang)} size="sm" fallbackIcon={selectedHouseDef.type === 30 ? selectedHouseDef.icon : undefined} />
            <span>{getHouseName(selectedHouse.type, lang)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center pointer-events-auto">
            {selectedHouse.type === 29 && onOpenFishShop ? (
              <button onClick={() => { const targetId = selectedHouse.id; onCloseSelectedHouse(); onOpenFishShop(targetId); }} className={`${btn} bg-sky-600 hover:bg-sky-700 text-white border-sky-800 shadow-md`}>
                <span className="text-sm leading-none">🐟</span> <span>{t('ร้านปลา', 'Fish Shop')}</span>
              </button>
            ) : (
              selectedHouse.type !== 19 && selectedHouse.type !== 23 && onInteractSelectedHouse && (
                <button onClick={() => { const targetId = selectedHouse.id; onCloseSelectedHouse(); onInteractSelectedHouse(targetId); }} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 shadow-md`}>
                  <Play className="w-4 h-4 fill-white" /> <span>{t('ใช้งาน', 'Open')}</span>
                </button>
              )
            )}
            <button onClick={onMoveSelectedHouse} className={`${btn} bg-amber-500 hover:bg-amber-600 text-white border-amber-700 shadow-md`}>
              <Move className="w-4 h-4" /><span>{t('ย้าย', 'Move')}</span>
            </button>
            <button onClick={onRotateSelectedHouse} className={`${btn} ${parchmentBtn}`}>
              <RotateCw className="w-4 h-4 text-[#5c3a21]" /><span>{t('หมุน', 'Rotate')}</span>
            </button>
            {(onStyleHousePart || onColorSelectedHouse || onTextureSelectedHouse) && (
              <button onClick={() => setIsColorPickerOpen((prev) => !prev)} className={`${btn} ${isColorPickerOpen || selectedHouse.customColor || selectedHouse.customTexture || (selectedHouse.partStyles && Object.keys(selectedHouse.partStyles).length > 0) ? 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-fuchsia-800' : parchmentBtn}`}>
                <Palette className="w-4 h-4" /> <span>{t('ตกแต่ง', 'Decorate')}</span>
              </button>
            )}
            <button onClick={onDeleteSelectedHouse} className={`${btn} ${parchmentBtn}`}>
              <Trash2 className="w-4 h-4 text-red-700" />
              <span>{selectedHouseDef.cost ? t(`เก็บ (+${selectedHouseDef.cost}💰)`, `Store (+${selectedHouseDef.cost}💰)`) : t('เก็บ', 'Store')}</span>
            </button>
            <button onClick={onCloseSelectedHouse} className={`${btn} ${parchmentBtn}`}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {isColorPickerOpen && onStyleHousePart && onResetHouseStyle && (
            <div className={`pointer-events-auto w-[min(24.5rem,95vw)] rounded-xl p-2.5 md:p-3 flex flex-col gap-2 ${parchmentBg}`}>
              <HouseDecorMenuPanel mode="popover" houses={houses} targetHouse={selectedHouse} onStyleHousePart={onStyleHousePart} onResetHouseStyle={onResetHouseStyle} onNotice={onNotice} />
            </div>
          )}
        </div>
      )}

      {/* ─── SELECTED ROCK UI ─── */}
      {!placing && selectedRock && selectedRockDef && (
        <div
          data-ui
          onPointerDown={stopPropagation}
          onPointerUp={stopPropagation}
          onClick={stopPropagation}
          className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 ${
            isCompactLandscape ? 'top-2 w-auto max-w-[90vw]' : 'top-16 sm:top-6 w-[95vw] sm:w-auto sm:max-w-[95vw]'
          }`}
        >
          <div className={`pointer-events-auto rounded-xl px-3 py-1 text-xs md:text-sm font-black text-[#3e2723] flex items-center gap-1.5 ${parchmentBg}`}>
            <GlbAutoIcon candidates={getRockGlbCandidates(selectedRock.type)} alt={getRockName(selectedRock.type, lang)} size="sm" />
            <span>{getRockName(selectedRock.type, lang)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center pointer-events-auto">
            {onMoveSelectedRock && (
              <button onClick={onMoveSelectedRock} className={`${btn} bg-amber-500 hover:bg-amber-600 text-white border-amber-700 shadow-md`}>
                <Move className="w-4 h-4" /><span>{t('ย้าย', 'Move')}</span>
              </button>
            )}
            {onRotateSelectedRock && (
              <button onClick={onRotateSelectedRock} className={`${btn} ${parchmentBtn}`}>
                <RotateCw className="w-4 h-4 text-[#5c3a21]" /><span>{t('หมุน', 'Rotate')}</span>
              </button>
            )}
            {onDeleteSelectedRock && (
              <button onClick={onDeleteSelectedRock} className={`${btn} ${parchmentBtn}`}>
                <Trash2 className="w-4 h-4 text-red-700" />
                <span>{t(`เก็บ (+${selectedRockDef.cost}💰)`, `Store (+${selectedRockDef.cost}💰)`)}</span>
              </button>
            )}
            {onCloseSelectedRock && (
              <button onClick={onCloseSelectedRock} className={`${btn} ${parchmentBtn}`}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── SELECTED ANIMAL UI ─── */}
      {!placing && selectedAnimal && selectedAnimalDef && (
        <div
          data-ui
          onPointerDown={stopPropagation}
          onPointerUp={stopPropagation}
          onClick={stopPropagation}
          className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2 ${
            isCompactLandscape ? 'top-2 w-auto max-w-[90vw]' : 'top-16 sm:top-6 w-[95vw] sm:w-auto sm:max-w-[95vw]'
          }`}
        >
          <div className={`pointer-events-auto rounded-xl px-3 py-1 text-xs md:text-sm font-black text-[#3e2723] flex items-center gap-1.5 ${parchmentBg}`}>
            <GlbAutoIcon candidates={getAnimalGlbCandidates(selectedAnimal.type)} alt={getAnimalName(selectedAnimal.type, lang)} size="sm" />
            <span>{getAnimalName(selectedAnimal.type, lang)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center pointer-events-auto">
            <button onClick={onPetSelectedAnimal} className={`${btn} bg-pink-500 hover:bg-pink-600 text-white border-pink-700 shadow-md`}>
              <Heart className="w-4 h-4 fill-white" /><span>{t('ลูบ', 'Pet')}</span>
            </button>
            <button onClick={onMoveSelectedAnimal} className={`${btn} bg-amber-500 hover:bg-amber-600 text-white border-amber-700 shadow-md`}>
              <Move className="w-4 h-4" /><span>{t('ย้าย', 'Move')}</span>
            </button>
            <button onClick={onRotateSelectedAnimal} className={`${btn} ${parchmentBtn}`}>
              <RotateCw className="w-4 h-4 text-[#5c3a21]" /><span>{t('หมุน', 'Rotate')}</span>
            </button>
            <button onClick={onDeleteSelectedAnimal} className={`${btn} ${parchmentBtn}`}>
              <Trash2 className="w-4 h-4 text-red-700" /><span>{t('เก็บ', 'Store')}</span>
            </button>
            <button onClick={onCloseSelectedAnimal} className={`${btn} ${parchmentBtn}`}><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </>
  );
};

export const BuildUI = React.memo(BuildUIInner);