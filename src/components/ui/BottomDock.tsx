// src/components/ui/BottomDock.tsx
import React, { useState } from 'react';
import {
  ToolType,
  CropType,
  TreeType,
  CROP_DEFINITIONS,
  TREE_DEFINITIONS,
} from '../../types/game';
import {
  ChevronLeft,
  Sprout,
  Hand,
  TreePine,
  Grid,
  Axe,
  Wheat,
  Radar,
  Wrench,
} from 'lucide-react';
import { HoeIcon, WateringCanIcon, SickleIcon, SeedBagIcon } from './CustomIcons';
import { GlbAutoIcon } from './GlbAutoIcon';
import { getToolGlbCandidates, getTreeGlbCandidates } from '../../utils/glbThumbnail';
import { useLanguage } from '../../i18n/LanguageContext';
import { getCropName, getTreeName } from '../../i18n/translations';

interface BottomDockProps {
  activeTool: ToolType;
  selectedSeed: CropType;
  seedCounts: Record<CropType, number>;
  selectedSapling: TreeType;
  saplingCounts: Record<TreeType, number>;
  gridVisible: boolean;
  onSelectTool: (tool: ToolType) => void;
  onSelectSeed: (seed: CropType) => void;
  onSelectSapling: (sapling: TreeType) => void;
  onToggleGrid: () => void;
  harvestModeActive?: boolean;
  onToggleHarvestMode?: () => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenInventory?: (tab?: 'harvests' | 'processing' | 'shop') => void; // ✅ เพิ่ม prop นี้
}

const BottomDockInner: React.FC<BottomDockProps> = ({
  activeTool,
  selectedSeed,
  seedCounts,
  selectedSapling,
  saplingCounts,
  gridVisible,
  onSelectTool,
  onSelectSeed,
  onSelectSapling,
  onToggleGrid,
  harvestModeActive = false,
  onToggleHarvestMode,
  isOpen,
  onOpenChange,
  onOpenInventory, // ✅ รับค่ามาใช้งาน
}) => {
  const { lang, t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'seeds' | 'saplings'>('tools');

  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) {
      onOpenChange(resolved);
    } else {
      setInternalOpen(resolved);
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const cropsList = Object.values(CROP_DEFINITIONS);
  const treesList = Object.values(TREE_DEFINITIONS);

  const selectedCropDef = CROP_DEFINITIONS[selectedSeed];
  const selectedTreeDef = TREE_DEFINITIONS[selectedSapling];
  const currentSeedCount = seedCounts[selectedSeed] || 0;
  const currentSaplingCount = saplingCounts[selectedSapling] || 0;

  const totalSeeds = cropsList.reduce((acc, c) => acc + (seedCounts[c.id] || 0), 0);
  const totalSaplings = treesList.reduce((acc, t) => acc + (saplingCounts[t.id] || 0), 0);

  const toolMeta: Record<
    string,
    { label: string; shortLabel: string; icon: React.ReactNode; swatchClass: string }
  > = {
    hand: {
      label: t('มือเปล่า', 'Hand'),
      shortLabel: t('มือเปล่า', 'Hand'),
      icon: <Hand className="w-5 h-5" />,
      swatchClass: 'bg-white/10 text-white',
    },
    hoe: {
      label: t('จอบ', 'Hoe'),
      shortLabel: t('จอบ', 'Hoe'),
      icon: (
        <GlbAutoIcon
          candidates={getToolGlbCandidates('hoe')}
          alt="Hoe"
          size="sm"
          fallbackIcon={<HoeIcon className="w-6 h-6" />}
        />
      ),
      swatchClass: 'bg-amber-300/25 text-amber-50',
    },
    seed_bag: {
      label: t('เมล็ดพืช', 'Seeds'),
      shortLabel: `${selectedCropDef?.iconEmoji ?? '🌱'}`,
      icon: <SeedBagIcon className="w-6 h-6" />,
      swatchClass: 'bg-lime-300/25 text-lime-50',
    },
    tree_sapling: {
      label: t('ปลูกต้นไม้', 'Plant Tree'),
      shortLabel: `${selectedTreeDef?.iconEmoji ?? '🌳'}`,
      icon: (
        <GlbAutoIcon
          candidates={getTreeGlbCandidates(selectedSapling)}
          alt="Tree"
          size="sm"
          fallbackIcon={<TreePine className="w-6 h-6" />}
        />
      ),
      swatchClass: 'bg-emerald-300/25 text-emerald-50',
    },
    watering_can: {
      label: t('บัวรดน้ำ', 'Watering Can'),
      shortLabel: t('บัวรดน้ำ', 'Water'),
      icon: (
        <GlbAutoIcon
          candidates={getToolGlbCandidates('watering_can')}
          alt="Watering Can"
          size="sm"
          fallbackIcon={<WateringCanIcon className="w-6 h-6" />}
        />
      ),
      swatchClass: 'bg-sky-300/25 text-sky-50',
    },
    sickle: {
      label: t('เคียว', 'Sickle'),
      shortLabel: t('เคียว', 'Sickle'),
      icon: (
        <GlbAutoIcon
          candidates={getToolGlbCandidates('sickle')}
          alt="Sickle"
          size="sm"
          fallbackIcon={<SickleIcon className="w-6 h-6" />}
        />
      ),
      swatchClass: 'bg-yellow-300/25 text-yellow-50',
    },
    axe: {
      label: t('ขวาน', 'Axe'),
      shortLabel: t('ขวาน', 'Axe'),
      icon: (
        <GlbAutoIcon
          candidates={getToolGlbCandidates('axe')}
          alt="Axe"
          size="sm"
          fallbackIcon={<Axe className="w-5 h-5" />}
        />
      ),
      swatchClass: 'bg-orange-300/25 text-orange-50',
    },
    drone: {
      label: t('โดรน', 'Drone'),
      shortLabel: t('โดรน', 'Drone'),
      icon: (
        <GlbAutoIcon
          candidates={getToolGlbCandidates('drone')}
          alt="Drone"
          size="sm"
          fallbackIcon={<Radar className="w-5 h-5" />}
        />
      ),
      swatchClass: 'bg-cyan-300/25 text-cyan-50',
    },
  };

  const currentMeta = toolMeta[activeTool] || toolMeta.hoe;

  // ─── GPU-FAST DARK SURFACE TOKENS (NO BACKDROP-BLUR OVER WEBGL) ─────────────
  const glass =
    'bg-stone-950/92 border border-white/15 shadow-xl shadow-black/35 ring-1 ring-inset ring-white/10';

  const glassBtn =
    'bg-stone-950/88 hover:bg-stone-900/95 text-white border border-white/15';

  // ✅ Custom Text Shadow เพื่อให้ตัวหนังสือคมชัดที่สุดบนพื้นหลังใส
  const textShadow = 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]';

  const handleEquipAndClose = (tool: ToolType) => {
    onSelectTool(tool);
    setOpen(false);
  };

  return (
    <>
      {/* 🔵 ปุ่มเปิดเมนู อุปกรณ์ทำฟาร์ม (แบบวงกลม) */}
      <div data-ui className="order-2 pointer-events-auto">
        <button
          onClick={() => setOpen((o) => !o)}
          title={t('อุปกรณ์ทำฟาร์ม', 'Farm Tools')}
          className={`relative flex items-center justify-center w-14 h-14 short:w-10 short:h-10 rounded-full border transition-all active:scale-95 shadow-lg shadow-black/30 ${
            open
              ? 'bg-amber-600/85 text-white border-amber-200/60 font-bold hover:bg-amber-500/90'
              : harvestModeActive
                ? 'bg-emerald-800/90 text-emerald-50 border-emerald-200/50 hover:bg-emerald-700/90'
                : `${glassBtn} hover:bg-stone-800/95`
          }`}
        >
          {/* ไอคอนหลัก */}
          {open ? (
            <ChevronLeft className="w-6 h-6 shrink-0 drop-shadow-md" />
          ) : harvestModeActive ? (
            <Wheat className="w-6 h-6 text-emerald-200 shrink-0 drop-shadow-md" />
          ) : (
            <span className={`text-amber-200 shrink-0 drop-shadow-md scale-125 short:scale-100`}>
              {currentMeta.icon}
            </span>
          )}

          {/* Badge สถานะมุมขวาบน (แสดงเมื่อไม่ได้เปิดเมนู) */}
          {!open && (
            <span
              className={`absolute -top-1.5 -right-2 text-[10px] px-2 py-0.5 rounded-full font-black shadow-md whitespace-nowrap z-10 border ${textShadow} ${
                harvestModeActive
                  ? 'bg-emerald-400 text-stone-900 border-emerald-200/60'
                  : activeTool === 'drone'
                    ? 'bg-cyan-400 text-stone-900 border-cyan-200/60'
                    : 'bg-amber-300 text-stone-900 border-amber-200/60'
              }`}
            >
              {harvestModeActive ? t('ON', 'ON') : currentMeta.shortLabel}
            </span>
          )}
        </button>
      </div>

      {/* แผงรายการอุปกรณ์ทำฟาร์ม */}
      {open && (
        <>
          {/* Backdrop ใส กดตรงไหนข้างนอกก็ปิดเมนูได้ทันที */}
          <div
            data-ui-backdrop
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 pointer-events-auto bg-transparent"
          />
          
          {/* ✅ เปลี่ยน Layout หลักเป็น flex-col เพื่อให้ปุ่มลัดไปอยู่ด้านล่างของแผง */}
          <div 
            data-ui 
            className="order-3 relative z-30 flex flex-col gap-2 short:fixed short:top-1 short:left-[calc(4.25rem_+_env(safe-area-inset-left,0px))] short:w-auto"
          >
            {/* 1. ตัวแผงอุปกรณ์หลัก */}
            <div
              onPointerDown={stopPropagation}
              onPointerUp={stopPropagation}
              onClick={stopPropagation}
              className={`pointer-events-auto w-[min(23.5rem,calc(100vw-1rem))] sm:w-[25rem] max-h-[calc(100dvh-7.5rem)] sm:max-h-[calc(100dvh-9rem)] short:max-h-[calc(100dvh-0.5rem)] short:w-[min(22rem,62vw)] overflow-y-auto rounded-2xl p-2.5 sm:p-3 short:p-2 flex flex-col gap-2.5 short:gap-1.5 ${glass}`}
            >
              {/* 1. แถบสถานะอุปกรณ์ปัจจุบัน */}
              <div className="flex items-center justify-between gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl p-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/10 min-w-0">
                  <span className="text-amber-200 shrink-0 drop-shadow-md">
                    {harvestModeActive ? <Wheat className="w-4 h-4 text-emerald-200" /> : currentMeta.icon}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-extrabold text-white truncate ${textShadow}`}>
                    {harvestModeActive
                      ? t('โหมดเก็บเกี่ยว (ON)', 'Harvest Mode (ON)')
                      : activeTool === 'seed_bag'
                        ? `${t('เมล็ด', 'Seed')}: ${selectedCropDef?.iconEmoji} ${getCropName(selectedSeed, lang)} (${currentSeedCount})`
                        : activeTool === 'tree_sapling'
                          ? `${t('กล้าไม้', 'Sapling')}: ${selectedTreeDef?.iconEmoji} ${getTreeName(selectedSapling, lang)} (${currentSaplingCount})`
                          : `${t('กำลังถือ', 'Active')}: ${currentMeta.label}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleEquipAndClose('hand')}
                    className={`flex items-center gap-1 min-h-[32px] border rounded-lg px-2 py-1 text-[11px] font-bold transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'hand' && !harvestModeActive
                        ? 'bg-amber-300/35 text-white border-amber-200/50 font-black shadow-sm'
                        : 'bg-white/[0.05] hover:bg-white/[0.12] text-white border-white/15'
                    }`}
                  >
                    <Hand className="w-3.5 h-3.5 shrink-0" />
                    <span className={textShadow}>{t('มือเปล่า', 'Hand')}</span>
                  </button>

                  <button
                    onClick={onToggleGrid}
                    className={`flex items-center gap-1 min-h-[32px] border rounded-lg px-2 py-1 text-[11px] font-bold transition-all active:scale-95 backdrop-blur-md ${
                      gridVisible
                        ? 'bg-emerald-300/20 text-emerald-50 border-emerald-200/40 hover:bg-emerald-300/30'
                        : 'bg-white/[0.05] text-white/70 border-white/15 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5 shrink-0" />
                    <span className={textShadow}>{gridVisible ? t('กริด: เปิด', 'Grid: ON') : t('กริด: ปิด', 'Grid: OFF')}</span>
                  </button>
                </div>
              </div>

              {/* 2. Tab Selector */}
              <div className="flex bg-white/[0.04] p-0.5 rounded-xl border border-white/10 backdrop-blur-md">
                <button
                  onClick={() => setActiveTab('tools')}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'tools'
                      ? 'bg-amber-300/40 text-white shadow-md backdrop-blur-md border border-amber-200/50'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  <span className={`truncate ${textShadow}`}>{t('อุปกรณ์หลัก', 'Tools')}</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('seeds');
                    onSelectTool('seed_bag');
                  }}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'seeds'
                      ? 'bg-amber-300/40 text-white shadow-md backdrop-blur-md border border-amber-200/50'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sprout className="w-3.5 h-3.5 shrink-0" />
                  <span className={`truncate ${textShadow}`}>
                    {t('เมล็ดพืช', 'Seeds')} ({totalSeeds})
                  </span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('saplings');
                    onSelectSapling(selectedSapling);
                  }}
                  className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'saplings'
                      ? 'bg-amber-300/40 text-white shadow-md backdrop-blur-md border border-amber-200/50'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <TreePine className="w-3.5 h-3.5 shrink-0" />
                  <span className={`truncate ${textShadow}`}>
                    {t('ปลูกต้นไม้', 'Trees')} ({totalSaplings})
                  </span>
                </button>
              </div>

              {/* 3. Tab Content: รายการอุปกรณ์ */}
              {activeTab === 'tools' && (
                <div className="grid grid-cols-3 gap-2 max-h-[40vh] sm:max-h-72 short:max-h-[34vh] overflow-y-auto p-1">
                  {/* จอบ */}
                  <button
                    onClick={() => handleEquipAndClose('hoe')}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'hoe' && !harvestModeActive
                        ? 'bg-amber-300/40 border-amber-200/50 text-white shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <GlbAutoIcon
                      candidates={getToolGlbCandidates('hoe')}
                      alt="Hoe"
                      size="md"
                      className="mb-1"
                      fallbackIcon={<HoeIcon className="w-8 h-8 drop-shadow-md" />}
                    />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('จอบ', 'Hoe')}</span>
                    {activeTool === 'hoe' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* เมล็ดพืช */}
                  <button
                    onClick={() => {
                      onSelectTool('seed_bag');
                      setActiveTab('seeds');
                    }}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'seed_bag' && !harvestModeActive
                        ? 'bg-amber-300/40 border-amber-200/50 text-white shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <SeedBagIcon className="w-8 h-8 mb-1 drop-shadow-md" />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('เมล็ดพืช', 'Seeds')}</span>
                    {activeTool === 'seed_bag' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* ปลูกต้นไม้ */}
                  <button
                    onClick={() => {
                      onSelectSapling(selectedSapling);
                      setActiveTab('saplings');
                    }}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'tree_sapling' && !harvestModeActive
                        ? 'bg-amber-300/40 border-amber-200/50 text-white shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <GlbAutoIcon
                      candidates={getTreeGlbCandidates(selectedSapling)}
                      alt="Tree"
                      size="md"
                      className="mb-1"
                      fallbackIcon={<TreePine className="w-8 h-8 drop-shadow-md" />}
                    />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('ปลูกต้นไม้', 'Plant Tree')}</span>
                    {activeTool === 'tree_sapling' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* บัวรดน้ำ */}
                  <button
                    onClick={() => handleEquipAndClose('watering_can')}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'watering_can' && !harvestModeActive
                        ? 'bg-amber-300/40 border-amber-200/50 text-white shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <GlbAutoIcon
                      candidates={getToolGlbCandidates('watering_can')}
                      alt="Watering Can"
                      size="md"
                      className="mb-1"
                      fallbackIcon={<WateringCanIcon className="w-8 h-8 drop-shadow-md" />}
                    />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('บัวรดน้ำ', 'Watering Can')}</span>
                    {activeTool === 'watering_can' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* เคียว */}
                  <button
                    onClick={() => handleEquipAndClose('sickle')}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'sickle' && !harvestModeActive
                        ? 'bg-amber-300/40 border-amber-200/50 text-white shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <GlbAutoIcon
                      candidates={getToolGlbCandidates('sickle')}
                      alt="Sickle"
                      size="md"
                      className="mb-1"
                      fallbackIcon={<SickleIcon className="w-8 h-8 drop-shadow-md" />}
                    />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('เคียว', 'Sickle')}</span>
                    {activeTool === 'sickle' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* ขวาน */}
                  <button
                    onClick={() => handleEquipAndClose('axe')}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'axe' && !harvestModeActive
                        ? 'bg-amber-300/40 border-amber-200/50 text-white shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <GlbAutoIcon
                      candidates={getToolGlbCandidates('axe')}
                      alt="Axe"
                      size="md"
                      className="mb-1"
                      fallbackIcon={<Axe className="w-7 h-7 drop-shadow-md" />}
                    />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('ขวาน', 'Axe')}</span>
                    {activeTool === 'axe' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* โดรน */}
                  <button
                    onClick={() => handleEquipAndClose('drone')}
                    className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                      activeTool === 'drone' && !harvestModeActive
                        ? 'bg-cyan-300/40 border-cyan-200/50 text-white shadow-[0_0_14px_rgba(103,232,249,0.3)]'
                        : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                    }`}
                  >
                    <GlbAutoIcon
                      candidates={getToolGlbCandidates('drone')}
                      alt="Drone"
                      size="md"
                      className="mb-1"
                      fallbackIcon={<Radar className="w-7 h-7 drop-shadow-md" />}
                    />
                    <span className={`text-[11px] font-black ${textShadow}`}>{t('โดรน', 'Drone')}</span>
                    {activeTool === 'drone' && !harvestModeActive && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-cyan-300 rounded-full shadow-md" />
                    )}
                  </button>

                  {/* โหมดเก็บเกี่ยว */}
                  {onToggleHarvestMode && (
                    <button
                      onClick={() => {
                        onToggleHarvestMode();
                        setOpen(false);
                      }}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all active:scale-95 col-span-2 backdrop-blur-md ${
                        harvestModeActive
                          ? 'bg-emerald-300/40 border-emerald-200/50 text-white shadow-[0_0_14px_rgba(110,231,183,0.3)]'
                          : 'bg-white/[0.05] border-white/15 text-white/90 hover:text-white hover:bg-white/[0.12]'
                      }`}
                    >
                      <Wheat className="w-7 h-7 mb-1 drop-shadow-md" />
                      <span className={`text-[11px] font-black ${textShadow}`}>
                        {t('โหมดเก็บเกี่ยว', 'Batch Harvest Mode')}
                      </span>
                      {harvestModeActive && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-300 rounded-full shadow-md" />
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* 4. Tab Content: เลือกเมล็ดพันธุ์พืช */}
              {activeTab === 'seeds' && (
                <div className="flex flex-col gap-1.5 max-h-[40vh] sm:max-h-72 short:max-h-[34vh] overflow-y-auto pr-0.5">
                  <div className="bg-amber-400/20 border border-amber-300/40 backdrop-blur-md rounded-xl p-2 text-[11px] text-white leading-tight shadow-sm">
                    <span className={`font-black ${textShadow}`}>🌱 {t('เลือกเมล็ดพืช:', 'Choose Seeds:')}</span>{' '}
                    <span className={textShadow}>{t('แตะเลือกพืชที่ต้องการปลูก', 'Tap a crop seed to plant in tilled plots')}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-1">
                    {cropsList.map((crop) => {
                      const count = seedCounts[crop.id] || 0;
                      const isSelected = selectedSeed === crop.id && activeTool === 'seed_bag';
                      return (
                        <button
                          key={crop.id}
                          onClick={() => {
                            onSelectSeed(crop.id);
                            onSelectTool('seed_bag');
                            setOpen(false);
                          }}
                          className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                            isSelected
                              ? 'bg-amber-300/40 border-amber-200/50 shadow-[0_0_14px_rgba(252,211,77,0.3)]'
                              : 'bg-white/[0.05] border-white/15 hover:bg-white/[0.12]'
                          }`}
                        >
                          <span className="text-2xl mb-1 drop-shadow-md">{crop.iconEmoji}</span>
                          <span className={`text-[10px] font-black text-white truncate w-full text-center ${textShadow}`}>
                            {getCropName(crop.id, lang)}
                          </span>
                          <span
                            className={`absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-md border ${
                              count > 0
                                ? 'bg-black/70 text-amber-200 border-white/20'
                                : 'bg-red-500/80 text-white border-red-300/50'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Tab Content: เลือกกล้าไม้ยืนต้นและไม้ผล */}
              {activeTab === 'saplings' && (
                <div className="flex flex-col gap-1.5 max-h-[40vh] sm:max-h-72 short:max-h-[34vh] overflow-y-auto pr-0.5">
                  <div className="bg-emerald-400/20 border border-emerald-300/40 backdrop-blur-md rounded-xl p-2 text-[11px] text-white leading-tight shadow-sm">
                    <span className={`font-black ${textShadow}`}>🌳 {t('เลือกกล้าไม้:', 'Choose Saplings:')}</span>{' '}
                    <span className={textShadow}>
                      {t(
                        'แตะเลือกพันธุ์ไม้ แล้วคลิกวางบนช่องกริด',
                        'Tap a tree sapling, then tap any open soil grid cell'
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-1">
                    {treesList.map((tree) => {
                      const count = saplingCounts[tree.id] || 0;
                      const isSelected =
                        selectedSapling === tree.id && activeTool === 'tree_sapling';
                      return (
                        <button
                          key={tree.id}
                          onClick={() => {
                            onSelectSapling(tree.id);
                            setOpen(false);
                          }}
                          className={`relative flex flex-col items-center justify-center p-2 aspect-square rounded-xl border transition-all active:scale-95 backdrop-blur-md ${
                            isSelected
                              ? 'bg-emerald-300/40 border-emerald-200/50 shadow-[0_0_14px_rgba(110,231,183,0.3)]'
                              : 'bg-white/[0.05] border-white/15 hover:bg-white/[0.12]'
                          }`}
                        >
                          <GlbAutoIcon
                            candidates={getTreeGlbCandidates(tree.id)}
                            alt={getTreeName(tree.id, lang)}
                            size="md"
                            className="mb-1"
                            fallbackIcon={<span className="text-2xl drop-shadow-md">{tree.iconEmoji}</span>}
                          />
                          <span className={`text-[10px] font-black text-white truncate w-full text-center ${textShadow}`}>
                            {getTreeName(tree.id, lang)}
                          </span>
                          <span
                            className={`absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-md border ${
                              count > 0
                                ? 'bg-black/70 text-emerald-200 border-white/20'
                                : 'bg-red-500/80 text-white border-red-300/50'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. ✅ ปุ่มลัดเปิดกระเป๋า (อยู่ใต้แผงอุปกรณ์) */}
            {onOpenInventory && (
              <div className="flex flex-row gap-2 pointer-events-auto w-[min(23.5rem,calc(100vw-1rem))] sm:w-[25rem] short:w-[min(22rem,62vw)] shrink-0">
                <button
                  onClick={() => {
                    onOpenInventory('shop');
                    setOpen(false); // ปิดแผงอุปกรณ์เมื่อเปิดกระเป๋า
                  }}
                  className="flex-1 py-2.5 px-2 rounded-xl border border-amber-300/50 bg-amber-500/30 text-amber-100 text-[11px] sm:text-xs font-black backdrop-blur-md hover:bg-amber-500/40 active:scale-95 transition-all text-center flex items-center justify-center gap-1 shadow-lg shadow-black/20"
                >
                  🏪 <span className="truncate">{t('ร้านค้าเมล็ด & ต้นกล้า', 'Seed & Sapling Shop')}</span>
                </button>
                <button
                  onClick={() => {
                    onOpenInventory('harvests');
                    setOpen(false); // ปิดแผงอุปกรณ์เมื่อเปิดกระเป๋า
                  }}
                  className="flex-1 py-2.5 px-2 rounded-xl border border-white/20 bg-white/10 text-white text-[11px] sm:text-xs font-black backdrop-blur-md hover:bg-white/15 active:scale-95 transition-all text-center flex items-center justify-center gap-1 shadow-lg shadow-black/20"
                >
                  🧺 <span className="truncate">{t('ผลผลิตในคลัง', 'Harvest Storage')}</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export const BottomDock = React.memo(BottomDockInner);