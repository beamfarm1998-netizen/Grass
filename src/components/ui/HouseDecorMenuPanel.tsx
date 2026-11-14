// src/components/ui/HouseDecorMenuPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Home,
  ImagePlus,
  Palette,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';
import {
  HOUSE_DEFS,
  HOUSE_PART_KEYS,
  HOUSE_PART_META,
  STRUCTURE_COLOR_PRESETS,
  type HousePartKey,
  type PartStyleConfig,
  type PlacedHouse,
} from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import { getHouseName } from '../../i18n/translations';
import { getHouseGlbCandidates } from '../../utils/glbThumbnail';
import {
  getBuiltInHousePngPresets,
  processStructurePngFile,
} from '../../utils/pngStructureSkin';
import { GlbAutoIcon } from './GlbAutoIcon';

export interface HouseDecorMenuPanelProps {
  mode: 'menu' | 'popover';
  houses: PlacedHouse[];
  targetHouse?: PlacedHouse | null;
  onStyleHousePart: (
    houseId: string,
    part: HousePartKey | 'all',
    patch: { color?: string | null; textureDataUrl?: string | null; textureRepeat?: number }
  ) => void;
  onResetHouseStyle: (houseId: string, part?: HousePartKey | 'all') => void;
  onFocusHouse?: (x: number, z: number) => void;
  onQuickBuildCabin?: () => void;
  onNotice?: (text: string, color?: string) => void;
}

const RESIDENTIAL_HOUSE_TYPES = new Set<number>([0, 1, 2, 3, 4, 17, 18]);

function getEffectivePartStyle(
  house: PlacedHouse,
  part: HousePartKey | 'all'
): PartStyleConfig {
  if (part === 'all') {
    return {
      color: house.customColor,
      textureDataUrl: house.customTexture,
      textureRepeat: house.customTextureRepeat ?? 1,
    };
  }
  const sp = house.partStyles?.[part];
  if (sp && (sp.color || sp.textureDataUrl)) {
    return {
      color: sp.color,
      textureDataUrl: sp.textureDataUrl,
      textureRepeat: sp.textureRepeat ?? 1,
    };
  }
  return {
    color: house.customColor,
    textureDataUrl: house.customTexture,
    textureRepeat: house.customTextureRepeat ?? 1,
  };
}

function isPartCustomized(house: PlacedHouse, part: HousePartKey): boolean {
  const sp = house.partStyles?.[part];
  return Boolean(sp?.color || sp?.textureDataUrl);
}

function hasAnyHouseStyle(house: PlacedHouse): boolean {
  if (house.customColor || house.customTexture) return true;
  return HOUSE_PART_KEYS.some((k) => isPartCustomized(house, k));
}

export const HouseDecorMenuPanel: React.FC<HouseDecorMenuPanelProps> = ({
  mode,
  houses,
  targetHouse,
  onStyleHousePart,
  onResetHouseStyle,
  onFocusHouse,
  onQuickBuildCabin,
  onNotice,
}) => {
  const { lang, t } = useLanguage();
  const [selectedHouseId, setSelectedHouseId] = useState<string>('');
  const [activePart, setActivePart] = useState<HousePartKey | 'all'>('roof');
  const [isProcessingPng, setIsProcessingPng] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedHouses = useMemo(() => {
    return [...houses].sort((a, b) => {
      const aRes = RESIDENTIAL_HOUSE_TYPES.has(a.type) ? 0 : 1;
      const bRes = RESIDENTIAL_HOUSE_TYPES.has(b.type) ? 0 : 1;
      if (aRes !== bRes) return aRes - bRes;
      return a.type - b.type;
    });
  }, [houses]);

  const hasResidentialPlaced = useMemo(
    () => houses.some((h) => RESIDENTIAL_HOUSE_TYPES.has(h.type)),
    [houses]
  );

  useEffect(() => {
    if (mode === 'popover') return;
    if (sortedHouses.length === 0) {
      setSelectedHouseId('');
      return;
    }
    if (!sortedHouses.some((h) => h.id === selectedHouseId)) {
      const initial = sortedHouses[0];
      setSelectedHouseId(initial.id);
      onFocusHouse?.(initial.x, initial.z);
    }
  }, [mode, sortedHouses, selectedHouseId, onFocusHouse]);

  const activeHouse: PlacedHouse | null = useMemo(() => {
    if (mode === 'popover') return targetHouse ?? null;
    return sortedHouses.find((h) => h.id === selectedHouseId) ?? sortedHouses[0] ?? null;
  }, [mode, targetHouse, sortedHouses, selectedHouseId]);

  const builtInPngs = useMemo(() => getBuiltInHousePngPresets(), []);
  const textShadow = 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]';

  if (!activeHouse) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl bg-white/[0.05] border border-white/15 p-4 text-center">
        <Home className="w-8 h-8 text-amber-300 drop-shadow-md" />
        <div className={`text-xs font-black text-white ${textShadow}`}>
          {t('ยังไม่มีบ้านหรือสิ่งปลูกสร้างในฟาร์ม', 'No buildings placed on your farm yet')}
        </div>
        <p className={`text-[11px] text-white/75 leading-relaxed ${textShadow}`}>
          {t(
            'วางบ้านก่อนเพื่อตกแต่งสีและอัปโหลดไฟล์ .PNG แยกส่วนหลังคา ผนัง รั้ว พื้น และปล่องไฟ',
            'Place a house first to customize its roof, walls, fence, floor, and chimney'
          )}
        </p>
        {onQuickBuildCabin && (
          <button
            type="button"
            onClick={onQuickBuildCabin}
            className="mt-1 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400/50 hover:bg-amber-400/70 border border-amber-200/60 text-white text-xs font-black transition-all active:scale-95 shadow-md"
          >
            <PlusCircle className="w-4 h-4 text-amber-100" />
            <span className={textShadow}>
              {t('วางกระท่อมไม้เล็ก (ฟรี)', 'Place Cozy Cabin (Free)')}
            </span>
          </button>
        )}
      </div>
    );
  }

  const houseDef = HOUSE_DEFS[activeHouse.type];
  const houseDisplayName = getHouseName(activeHouse.type, lang);
  const currentStyle = getEffectivePartStyle(activeHouse, activePart);
  const anyStyled = hasAnyHouseStyle(activeHouse);
  const partLabel =
    activePart === 'all'
      ? t('ทั้งหลัง', 'Whole House')
      : lang === 'th'
        ? HOUSE_PART_META.find((m) => m.key === activePart)?.labelTh ?? ''
        : HOUSE_PART_META.find((m) => m.key === activePart)?.labelEn ?? '';

  const handleUploadPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessingPng(true);
    try {
      const processed = await processStructurePngFile(file);
      onStyleHousePart(activeHouse.id, activePart, {
        color: null,
        textureDataUrl: processed.dataUrl,
        textureRepeat: currentStyle.textureRepeat ?? 2,
      });
      onNotice?.(
        t(
          `🖼️ นำไฟล์ "${file.name}" มาใส่ส่วน "${partLabel}" ของ ${houseDisplayName} เรียบร้อย!`,
          `🖼️ Applied "${file.name}" to ${partLabel} of ${houseDisplayName}!`
        ),
        '#f0abfc'
      );
    } catch {
      onNotice?.(
        t(
          '❌ ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกไฟล์ .png',
          '❌ Could not load image — please choose a .png file'
        ),
        '#ef5350'
      );
    } finally {
      setIsProcessingPng(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
      {/* 1. เลือกบ้านที่ต้องการตกแต่ง (เฉพาะโหมดเมนูในหน้าสิ่งก่อสร้าง) */}
      {mode === 'menu' && (
        <div className="flex flex-col gap-1.5 bg-white/[0.04] border border-white/15 rounded-xl p-2">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[11px] font-black text-amber-200 ${textShadow}`}>
              {t('1. เลือกบ้าน/อาคารที่ต้องการตกแต่ง', '1. Select Building to Decorate')}
            </span>
            <button
              type="button"
              onClick={() => onFocusHouse?.(activeHouse.x, activeHouse.z)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/35 hover:bg-sky-500/55 border border-sky-300/50 text-[10px] font-black text-white transition-all active:scale-95 whitespace-nowrap"
            >
              <Camera className="w-3 h-3 text-sky-200 shrink-0" />
              <span className={textShadow}>{t('ส่องดูบ้าน', 'Focus View')}</span>
            </button>
          </div>

          {!hasResidentialPlaced && onQuickBuildCabin && (
            <button
              type="button"
              onClick={onQuickBuildCabin}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-500/35 hover:bg-emerald-500/55 border border-emerald-300/50 text-[11px] font-black text-white transition-all active:scale-95"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span className={textShadow}>
                {t('🏡 ยังไม่มีบ้านพัก — กดวางกระท่อมไม้เล็ก (ฟรี)', '🏡 Place Starter Cabin (Free)')}
              </span>
            </button>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {sortedHouses.map((h, idx) => {
              const def = HOUSE_DEFS[h.type];
              const name = getHouseName(h.type, lang);
              const isSelected = h.id === activeHouse.id;
              const customized = hasAnyHouseStyle(h);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSelectedHouseId(h.id);
                    onFocusHouse?.(h.x, h.z);
                  }}
                  className={`relative shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-left transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-400/35 border-amber-200/70 text-white shadow-md'
                      : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/15 text-white/80'
                  }`}
                >
                  {def && (
                    <GlbAutoIcon
                      candidates={getHouseGlbCandidates(def)}
                      alt={name}
                      size="sm"
                    />
                  )}
                  <div className="flex flex-col min-w-0 max-w-[7.5rem]">
                    <span className={`text-[11px] font-black truncate ${textShadow}`}>
                      {name}
                    </span>
                    <span className="text-[9px] font-mono text-white/70">
                      #{idx + 1} • ({Math.round(h.x)},{Math.round(h.z)})
                    </span>
                  </div>
                  {customized && (
                    <span className="w-2 h-2 rounded-full bg-fuchsia-400 ring-2 ring-white/80 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. เลือกชิ้นส่วนของบ้าน (หลังคา, ผนังบ้าน, รั้วบ้าน, พื้นบ้าน, ปล่องไฟ, ทั้งหลัง) */}
      <div className="flex flex-col gap-1.5 bg-white/[0.04] border border-white/15 rounded-xl p-2">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 text-[11px] font-black text-pink-200 ${textShadow}`}>
            <Palette className="w-3.5 h-3.5 text-pink-300 shrink-0" />
            <span>
              {mode === 'menu'
                ? t('2. เลือกส่วนของบ้านที่จะเปลี่ยนสี / รูป .PNG', '2. Choose House Part')
                : t('เลือกส่วนของบ้านที่จะเปลี่ยนสี / รูป .PNG', 'Choose House Part')}
            </span>
          </div>
          <button
            type="button"
            disabled={!anyStyled}
            onClick={() => onResetHouseStyle(activeHouse.id, 'all')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all active:scale-95 whitespace-nowrap ${
              anyStyled
                ? 'bg-white/10 hover:bg-white/20 text-white border-white/25'
                : 'bg-white/[0.02] text-white/35 border-white/10 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-2.5 h-2.5 shrink-0" />
            <span className={textShadow}>{t('รีเซ็ตทั้งหลัง', 'Reset All')}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {HOUSE_PART_META.map((meta) => {
            const selected = activePart === meta.key;
            const hasCustom = isPartCustomized(activeHouse, meta.key);
            return (
              <button
                key={meta.key}
                type="button"
                onClick={() => setActivePart(meta.key)}
                className={`relative flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-[11px] font-black transition-all active:scale-95 ${
                  selected
                    ? 'bg-fuchsia-500/45 border-fuchsia-200/75 text-white shadow-md'
                    : 'bg-white/[0.05] hover:bg-white/[0.14] border-white/15 text-white/85'
                }`}
              >
                <span className="text-xs leading-none">{meta.icon}</span>
                <span className={`truncate ${textShadow}`}>
                  {lang === 'th' ? meta.labelTh : meta.labelEn}
                </span>
                {hasCustom && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300" />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActivePart('all')}
            className={`relative flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-[11px] font-black transition-all active:scale-95 ${
              activePart === 'all'
                ? 'bg-amber-500/45 border-amber-200/75 text-white shadow-md'
                : 'bg-white/[0.05] hover:bg-white/[0.14] border-white/15 text-white/85'
            }`}
          >
            <span className="text-xs leading-none">✨</span>
            <span className={`truncate ${textShadow}`}>{t('ทั้งหลัง', 'All Parts')}</span>
            {Boolean(activeHouse.customColor || activeHouse.customTexture) && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300" />
            )}
          </button>
        </div>
      </div>

      {/* 3. ปรับเฉดสีของส่วนที่เลือก */}
      <div className="flex flex-col gap-2 bg-white/[0.04] border border-white/15 rounded-xl p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-black text-white ${textShadow}`}>
            {t(`🎨 เลือกสี: ${partLabel}`, `🎨 Color: ${partLabel}`)}
          </span>
          {activePart !== 'all' &&
            (Boolean(currentStyle.color) || Boolean(currentStyle.textureDataUrl)) && (
              <button
                type="button"
                onClick={() => onResetHouseStyle(activeHouse.id, activePart)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-white transition-all active:scale-95"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span className={textShadow}>{t('คืนค่าส่วนนี้', 'Reset Part')}</span>
              </button>
            )}
        </div>

        <div className="grid grid-cols-6 gap-2 place-items-center py-0.5">
          {STRUCTURE_COLOR_PRESETS.map((preset) => {
            const isActive = currentStyle.color?.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onStyleHousePart(activeHouse.id, activePart, { color: preset.hex })
                }
                title={lang === 'th' ? preset.name : preset.nameEn}
                aria-label={lang === 'th' ? preset.name : preset.nameEn}
                className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-transform active:scale-90 hover:scale-110 flex items-center justify-center shadow-md ${preset.swatchClass} ${
                  isActive
                    ? 'border-white ring-2 ring-amber-300 scale-110'
                    : 'border-white/40 hover:border-white/90'
                }`}
              >
                {isActive && (
                  <Check
                    className={`w-3.5 h-3.5 ${
                      preset.id === 'warm_cream' || preset.id === 'sunflower'
                        ? 'text-stone-900'
                        : 'text-white'
                    } drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 bg-white/[0.06] hover:bg-white/[0.14] border border-white/20 rounded-xl px-2.5 py-1.5 transition-all">
            <input
              type="color"
              value={currentStyle.color || houseDef?.swatch || '#a67c52'}
              onChange={(e) =>
                onStyleHousePart(activeHouse.id, activePart, { color: e.target.value })
              }
              className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0 shrink-0"
              aria-label={t('เลือกสีเองตามชอบ', 'Pick custom color')}
            />
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-black text-white truncate ${textShadow}`}>
                {t('ผสมสีเองตามใจชอบ', 'Custom Color Picker')}
              </span>
              <span className="text-[10px] font-mono text-white/75 uppercase truncate">
                {currentStyle.color
                  ? currentStyle.color
                  : currentStyle.textureDataUrl
                    ? t('แสดงสีจริงตามไฟล์ .PNG', 'True .PNG Colors')
                    : t('สีวัสดุต้นฉบับ', 'Original Material')}
              </span>
            </div>
          </label>
          {currentStyle.color && currentStyle.textureDataUrl && (
            <button
              type="button"
              onClick={() => onStyleHousePart(activeHouse.id, activePart, { color: null })}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-bold text-white whitespace-nowrap transition-all active:scale-95"
            >
              <span className={textShadow}>{t('สีจริง PNG', 'Pure PNG')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. นำไฟล์รูป .PNG มาเปลี่ยนลวดลาย + ลายสำเร็จรูป */}
      <div className="flex flex-col gap-2 bg-white/[0.04] border border-white/15 rounded-xl p-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,image/png,image/*"
          onChange={handleUploadPng}
          className="hidden"
        />

        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-black text-fuchsia-200 ${textShadow}`}>
            {t(`🖼️ ลวดลายไฟล์ .PNG (${partLabel})`, `🖼️ .PNG Texture (${partLabel})`)}
          </span>
          {currentStyle.textureDataUrl && (
            <button
              type="button"
              onClick={() =>
                onStyleHousePart(activeHouse.id, activePart, { textureDataUrl: null })
              }
              className="px-2 py-0.5 rounded-lg bg-rose-500/35 hover:bg-rose-500/55 border border-rose-300/50 text-[10px] font-bold text-white transition-all active:scale-95"
            >
              <span className={textShadow}>{t('ลบรูป PNG', 'Clear PNG')}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={isProcessingPng}
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-fuchsia-500/45 hover:bg-fuchsia-500/65 border border-fuchsia-300/65 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
        >
          <ImagePlus className="w-4 h-4 text-fuchsia-100 shrink-0 drop-shadow-md" />
          <span className={textShadow}>
            {isProcessingPng
              ? t('กำลังแปลงไฟล์ .PNG...', 'Processing .PNG...')
              : t(
                  `นำไฟล์รูป .PNG มาเปลี่ยน (${partLabel})`,
                  `Import .PNG File (${partLabel})`
                )}
          </span>
        </button>

        {/* ลาย .PNG สถาปัตยกรรมสำเร็จรูปให้เลือกกดใช้ได้ทันที */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          {builtInPngs.map((preset) => {
            const active = currentStyle.textureDataUrl === preset.dataUrl;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onStyleHousePart(activeHouse.id, activePart, {
                    color: null,
                    textureDataUrl: preset.dataUrl,
                    textureRepeat: preset.defaultRepeat,
                  })
                }
                className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-left transition-all active:scale-95 ${
                  active
                    ? 'bg-fuchsia-500/35 border-amber-300 text-white shadow-sm'
                    : 'bg-black/25 hover:bg-white/10 border-white/15 text-white/85'
                }`}
              >
                <img
                  src={preset.dataUrl}
                  alt={lang === 'th' ? preset.nameTh : preset.nameEn}
                  className="w-7 h-7 rounded-md object-cover border border-white/25 shrink-0 bg-white"
                />
                <span className={`text-[10px] font-black leading-tight line-clamp-2 ${textShadow}`}>
                  {lang === 'th' ? preset.nameTh : preset.nameEn}
                </span>
              </button>
            );
          })}
        </div>

        {currentStyle.textureDataUrl && (
          <div className="flex items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-xl p-2 mt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={currentStyle.textureDataUrl}
                alt="Active PNG Skin"
                className="w-8 h-8 rounded-lg object-cover border border-white/30 bg-white shrink-0"
              />
              <span className={`text-[10px] font-bold text-white/85 truncate ${textShadow}`}>
                {t('ความถี่ลาย .PNG', 'Tile Repeat')}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {([1, 2, 3, 4, 6] as const).map((rep) => {
                const curRep = currentStyle.textureRepeat ?? 1;
                const active = curRep === rep;
                return (
                  <button
                    key={rep}
                    type="button"
                    onClick={() =>
                      onStyleHousePart(activeHouse.id, activePart, { textureRepeat: rep })
                    }
                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-[10px] font-mono font-black border transition-all active:scale-95 ${
                      active
                        ? 'bg-amber-400 text-stone-950 border-amber-200'
                        : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                    }`}
                  >
                    {rep}×
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
