// src/components/ui/OutfitMenuPanel.tsx
import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ImagePlus,
  RotateCcw,
  Shirt,
} from 'lucide-react';
import {
  PLAYER_OUTFIT_PRESETS,
  STRUCTURE_COLOR_PRESETS,
  type AccessoryStyleId,
  type FarmerGender,
  type HatStyleId,
  type OutfitPartKey,
  type PartStyleConfig,
  type PlayerOutfitConfig,
} from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  getBuiltInOutfitPngPresets,
  processStructurePngFile,
} from '../../utils/pngStructureSkin';

export interface OutfitMenuPanelProps {
  farmerGender: FarmerGender;
  onToggleFarmerGender?: () => void;
  isPlayerHidden?: boolean;
  onTogglePlayerHidden?: () => void;
  playerOutfit: PlayerOutfitConfig;
  onUpdateOutfit: (
    updater: PlayerOutfitConfig | ((prev: PlayerOutfitConfig) => PlayerOutfitConfig)
  ) => void;
  onResetOutfit: () => void;
  onFocusPlayer?: () => void;
  onNotice?: (text: string, color?: string) => void;
}

const OUTFIT_PARTS_UI: ReadonlyArray<{
  key: OutfitPartKey;
  icon: string;
  labelTh: string;
  labelEn: string;
  defaultHex: string;
}> = [
  { key: 'hat', icon: '🎩', labelTh: 'หมวก', labelEn: 'Hat', defaultHex: '#f2c14e' },
  { key: 'shirt', icon: '👕', labelTh: 'เสื้อ', labelEn: 'Shirt', defaultHex: '#d9483b' },
  { key: 'bottom', icon: '👖', labelTh: 'กางเกง/เอี๊ยม', labelEn: 'Bottoms', defaultHex: '#245582' },
  { key: 'shoes', icon: '🥾', labelTh: 'รองเท้าบูท', labelEn: 'Boots', defaultHex: '#4e342e' },
  { key: 'accessory', icon: '🧣', labelTh: 'เครื่องประดับ', labelEn: 'Accessory', defaultHex: '#eab308' },
];

const HAT_STYLES_UI: ReadonlyArray<{
  id: HatStyleId;
  icon: string;
  labelTh: string;
  labelEn: string;
}> = [
  { id: 'straw', icon: '👒', labelTh: 'หมวกฟาง', labelEn: 'Straw Hat' },
  { id: 'cap', icon: '🧢', labelTh: 'หมวกแก๊ป', labelEn: 'Farm Cap' },
  { id: 'cowboy', icon: '🤠', labelTh: 'คาวบอย', labelEn: 'Cowboy' },
  { id: 'bucket', icon: '🎣', labelTh: 'บักเก็ต', labelEn: 'Bucket Hat' },
  { id: 'crown', icon: '👑', labelTh: 'มงกุฎ', labelEn: 'Crown' },
  { id: 'none', icon: '🚫', labelTh: 'ถอดหมวก', labelEn: 'No Hat' },
];

const ACCESSORY_STYLES_UI: ReadonlyArray<{
  id: AccessoryStyleId;
  icon: string;
  labelTh: string;
  labelEn: string;
}> = [
  { id: 'none', icon: '🚫', labelTh: 'ไม่ใส่', labelEn: 'None' },
  { id: 'bandana', icon: '🧣', labelTh: 'ผ้าพันคอ', labelEn: 'Bandana' },
  { id: 'apron', icon: '🎽', labelTh: 'ผ้ากันเปื้อน', labelEn: 'Apron' },
  { id: 'cape', icon: '🦸', labelTh: 'ผ้าคลุมไหล่', labelEn: 'Cape' },
  { id: 'backpack', icon: '🎒', labelTh: 'กระเป๋าเป้', labelEn: 'Backpack' },
];

export const OutfitMenuPanel: React.FC<OutfitMenuPanelProps> = ({
  farmerGender,
  onToggleFarmerGender,
  isPlayerHidden = false,
  onTogglePlayerHidden,
  playerOutfit,
  onUpdateOutfit,
  onResetOutfit,
  onFocusPlayer,
  onNotice,
}) => {
  const { lang, t } = useLanguage();
  const [activePart, setActivePart] = useState<OutfitPartKey>('shirt');
  const [isProcessingPng, setIsProcessingPng] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const builtInFabrics = useMemo(() => getBuiltInOutfitPngPresets(), []);
  const textShadow = 'drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]';

  const activeMeta =
    OUTFIT_PARTS_UI.find((p) => p.key === activePart) ?? OUTFIT_PARTS_UI[1];
  const currentPartCfg: PartStyleConfig = playerOutfit.parts[activePart] ?? {};
  const partLabel = lang === 'th' ? activeMeta.labelTh : activeMeta.labelEn;

  const patchPart = (
    part: OutfitPartKey,
    patch: { color?: string | null; textureDataUrl?: string | null; textureRepeat?: number }
  ) => {
    onUpdateOutfit((prev) => {
      const nextParts = { ...prev.parts };
      const cur: PartStyleConfig = { ...(nextParts[part] ?? {}) };

      if (patch.color !== undefined) {
        if (patch.color) cur.color = patch.color;
        else delete cur.color;
      }
      if (patch.textureDataUrl !== undefined) {
        if (patch.textureDataUrl) {
          cur.textureDataUrl = patch.textureDataUrl;
          cur.textureRepeat = patch.textureRepeat ?? cur.textureRepeat ?? 2;
        } else {
          delete cur.textureDataUrl;
          delete cur.textureRepeat;
        }
      } else if (patch.textureRepeat !== undefined && cur.textureDataUrl) {
        cur.textureRepeat = patch.textureRepeat;
      }

      if (cur.color || cur.textureDataUrl) {
        nextParts[part] = cur;
      } else {
        delete nextParts[part];
      }

      // Auto-equip bandana if customizing accessory while 'none' is selected
      const nextAccStyle =
        part === 'accessory' &&
        prev.accessoryStyle === 'none' &&
        Boolean(cur.color || cur.textureDataUrl)
          ? 'bandana'
          : prev.accessoryStyle;

      const nextHatStyle =
        part === 'hat' && prev.hatStyle === 'none' && Boolean(cur.color || cur.textureDataUrl)
          ? 'straw'
          : prev.hatStyle;

      return {
        ...prev,
        hatStyle: nextHatStyle,
        accessoryStyle: nextAccStyle,
        parts: nextParts,
      };
    });
  };

  const handleUploadFabricPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessingPng(true);
    try {
      const processed = await processStructurePngFile(file);
      patchPart(activePart, {
        color: null,
        textureDataUrl: processed.dataUrl,
        textureRepeat: currentPartCfg.textureRepeat ?? 2,
      });
      onNotice?.(
        t(
          `👕 นำไฟล์รูป "${file.name}" มาใส่ลาย "${partLabel}" เรียบร้อย!`,
          `👕 Applied "${file.name}" pattern to ${partLabel}!`
        ),
        '#6ee7b7'
      );
    } catch {
      onNotice?.(
        t(
          '❌ ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ กรุณาเลือกไฟล์ .png',
          '❌ Failed to read image — please choose a .png file'
        ),
        '#ef5350'
      );
    } finally {
      setIsProcessingPng(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
      {isPlayerHidden && onTogglePlayerHidden && (
        <button
          type="button"
          onClick={onTogglePlayerHidden}
          className="flex items-center justify-between gap-2 w-full rounded-xl px-3 py-2 bg-sky-500/35 hover:bg-sky-500/50 border border-sky-300/60 text-left text-xs font-black text-white transition-all active:scale-95"
        >
          <span className={textShadow}>
            {t(
              '👁️ ตอนนี้ซ่อนตัวละครชาย/หญิงอยู่ — แตะเพื่อแสดงตัวละครบนฟาร์ม',
              '👁️ Farmer is hidden — Tap to show male/female character on farm'
            )}
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-emerald-400 text-stone-950 text-[10px] font-black shrink-0">
            {t('แสดงตัวละคร', 'Show')}
          </span>
        </button>
      )}

      {/* 1. แถบตัวละคร & ซ่อน/แสดง & ซูมดูชุด & รีเซ็ต */}
      <div className="flex items-center justify-between gap-1.5 bg-white/[0.04] border border-white/15 rounded-xl p-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {onToggleFarmerGender && (
            <button
              type="button"
              onClick={onToggleFarmerGender}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-black text-white transition-all active:scale-95 whitespace-nowrap"
            >
              <span className={textShadow}>
                {farmerGender === 'female'
                  ? t('👩 ชาวไร่หญิง', '👩 Female')
                  : farmerGender === 'boy'
                    ? t('👦 เด็กชาย', '👦 Boy')
                    : farmerGender === 'girl'
                      ? t('👧 เด็กหญิง', '👧 Girl')
                      : t('👨 ชาวไร่ชาย', '👨 Male')}
              </span>
            </button>
          )}
          {onTogglePlayerHidden && (
            <button
              type="button"
              onClick={onTogglePlayerHidden}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-black text-white transition-all active:scale-95 whitespace-nowrap ${
                isPlayerHidden
                  ? 'bg-emerald-500/45 hover:bg-emerald-500/60 border-emerald-300/60'
                  : 'bg-white/10 hover:bg-white/20 border-white/20'
              }`}
            >
              <span className={textShadow}>
                {isPlayerHidden ? t('👁️ แสดงตัวละคร', '👁️ Show') : t('🙈 ซ่อนตัวละคร', '🙈 Hide')}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onFocusPlayer}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/35 hover:bg-sky-500/55 border border-sky-300/50 text-[11px] font-black text-white transition-all active:scale-95 whitespace-nowrap"
          >
            <Camera className="w-3.5 h-3.5 text-sky-200 shrink-0" />
            <span className={textShadow}>{t('ซูมดูตัวละคร', 'Zoom Character')}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onResetOutfit}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-white transition-all active:scale-95 whitespace-nowrap"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span className={textShadow}>{t('ชุดดั้งเดิม', 'Default')}</span>
        </button>
      </div>

      {/* 2. เซ็ตชุดสำเร็จรูป (Outfit Presets) */}
      <div className="flex flex-col gap-1.5 bg-white/[0.04] border border-white/15 rounded-xl p-2">
        <div className={`flex items-center gap-1.5 text-[11px] font-black text-amber-200 ${textShadow}`}>
          <Shirt className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span>{t('เซ็ตชุดแฟชั่นสำเร็จรูป', 'Complete Outfit Sets')}</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {PLAYER_OUTFIT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                onUpdateOutfit({
                  hatStyle: preset.config.hatStyle,
                  accessoryStyle: preset.config.accessoryStyle,
                  parts: { ...preset.config.parts },
                });
                onFocusPlayer?.();
              }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/[0.06] hover:bg-amber-400/25 border border-white/15 hover:border-amber-200/50 text-left transition-all active:scale-95"
            >
              <span className="text-sm leading-none shrink-0">{preset.icon}</span>
              <span className={`text-[10px] font-black text-white leading-tight line-clamp-2 ${textShadow}`}>
                {lang === 'th' ? preset.nameTh : preset.nameEn}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. เลือกชิ้นส่วนเครื่องแต่งกาย (หมวก / เสื้อ / กางเกง / รองเท้า / เครื่องประดับ) */}
      <div className="flex flex-col gap-2 bg-white/[0.04] border border-white/15 rounded-xl p-2">
        <span className={`text-[11px] font-black text-cyan-200 ${textShadow}`}>
          {t('เลือกส่วนของชุดที่ต้องการแต่งสี / ลาย .PNG', 'Select Clothing Part')}
        </span>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {OUTFIT_PARTS_UI.map((item) => {
            const selected = activePart === item.key;
            const partCfg = playerOutfit.parts[item.key];
            const customized = Boolean(partCfg?.color || partCfg?.textureDataUrl);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePart(item.key)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1.5 rounded-xl border text-[10px] font-black transition-all active:scale-95 ${
                  selected
                    ? 'bg-cyan-500/45 border-cyan-200/75 text-white shadow-md'
                    : 'bg-white/[0.05] hover:bg-white/[0.12] border-white/15 text-white/80'
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span className={`truncate max-w-full ${textShadow}`}>
                  {lang === 'th' ? item.labelTh : item.labelEn}
                </span>
                {customized && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300" />
                )}
              </button>
            );
          })}
        </div>

        {/* ทรงหมวก 3D */}
        {activePart === 'hat' && (
          <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
            <span className={`text-[10px] font-bold text-white/80 ${textShadow}`}>
              {t('ทรงหมวก 3D:', '3D Hat Style:')}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {HAT_STYLES_UI.map((h) => {
                const active = playerOutfit.hatStyle === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                      onUpdateOutfit((prev) => ({ ...prev, hatStyle: h.id }))
                    }
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-[10px] font-black transition-all active:scale-95 ${
                      active
                        ? 'bg-amber-400/45 border-amber-200/75 text-white'
                        : 'bg-white/[0.05] hover:bg-white/[0.14] border-white/15 text-white/80'
                    }`}
                  >
                    <span>{h.icon}</span>
                    <span className={`truncate ${textShadow}`}>
                      {lang === 'th' ? h.labelTh : h.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ทรงเครื่องประดับ 3D */}
        {activePart === 'accessory' && (
          <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
            <span className={`text-[10px] font-bold text-white/80 ${textShadow}`}>
              {t('รูปแบบเครื่องประดับ 3D:', '3D Accessory Type:')}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {ACCESSORY_STYLES_UI.map((acc) => {
                const active = playerOutfit.accessoryStyle === acc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() =>
                      onUpdateOutfit((prev) => ({ ...prev, accessoryStyle: acc.id }))
                    }
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-[10px] font-black transition-all active:scale-95 ${
                      active
                        ? 'bg-amber-400/45 border-amber-200/75 text-white'
                        : 'bg-white/[0.05] hover:bg-white/[0.14] border-white/15 text-white/80'
                    }`}
                  >
                    <span>{acc.icon}</span>
                    <span className={`truncate ${textShadow}`}>
                      {lang === 'th' ? acc.labelTh : acc.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. ปรับสีของชิ้นส่วนชุดที่เลือก */}
      <div className="flex flex-col gap-2 bg-white/[0.04] border border-white/15 rounded-xl p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-black text-white ${textShadow}`}>
            {t(`🎨 สี${partLabel}`, `🎨 ${partLabel} Color`)}
          </span>
          {(currentPartCfg.color || currentPartCfg.textureDataUrl) && (
            <button
              type="button"
              onClick={() => patchPart(activePart, { color: null, textureDataUrl: null })}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-white transition-all active:scale-95"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span className={textShadow}>{t('คืนค่าชิ้นนี้', 'Reset Part')}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-6 gap-2 place-items-center py-0.5">
          {STRUCTURE_COLOR_PRESETS.map((preset) => {
            const isActive = currentPartCfg.color?.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => patchPart(activePart, { color: preset.hex })}
                title={lang === 'th' ? preset.name : preset.nameEn}
                className={`relative w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 transition-transform active:scale-90 hover:scale-110 flex items-center justify-center shadow-md ${preset.swatchClass} ${
                  isActive
                    ? 'border-white ring-2 ring-cyan-300 scale-110'
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
              value={currentPartCfg.color || activeMeta.defaultHex}
              onChange={(e) => patchPart(activePart, { color: e.target.value })}
              className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent p-0 shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className={`text-xs font-black text-white truncate ${textShadow}`}>
                {t('เลือกสีเสื้อผ้าเองตามชอบ', 'Custom Outfit Color')}
              </span>
              <span className="text-[10px] font-mono text-white/75 uppercase truncate">
                {currentPartCfg.color
                  ? currentPartCfg.color
                  : currentPartCfg.textureDataUrl
                    ? t('แสดงสีจริงตามไฟล์ .PNG', 'True .PNG Pattern')
                    : t('สีชุดมาตรฐาน', 'Default Fabric')}
              </span>
            </div>
          </label>
          {currentPartCfg.color && currentPartCfg.textureDataUrl && (
            <button
              type="button"
              onClick={() => patchPart(activePart, { color: null })}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-bold text-white whitespace-nowrap transition-all active:scale-95"
            >
              <span className={textShadow}>{t('สีจริง PNG', 'Pure PNG')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. นำเข้าไฟล์รูป .PNG มาทำลายเสื้อผ้า + ลายผ้าสำเร็จรูป */}
      <div className="flex flex-col gap-2 bg-white/[0.04] border border-white/15 rounded-xl p-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,image/png,image/*"
          onChange={handleUploadFabricPng}
          className="hidden"
        />

        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-black text-cyan-200 ${textShadow}`}>
            {t(`🖼️ ลายผ้า / รูป .PNG (${partLabel})`, `🖼️ Fabric .PNG (${partLabel})`)}
          </span>
          {currentPartCfg.textureDataUrl && (
            <button
              type="button"
              onClick={() => patchPart(activePart, { textureDataUrl: null })}
              className="px-2 py-0.5 rounded-lg bg-rose-500/35 hover:bg-rose-500/55 border border-rose-300/50 text-[10px] font-bold text-white transition-all active:scale-95"
            >
              <span className={textShadow}>{t('ลบลาย PNG', 'Clear PNG')}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={isProcessingPng}
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-cyan-500/45 hover:bg-cyan-500/65 border border-cyan-300/65 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md"
        >
          <ImagePlus className="w-4 h-4 text-cyan-100 shrink-0 drop-shadow-md" />
          <span className={textShadow}>
            {isProcessingPng
              ? t('กำลังแปลงไฟล์ .PNG...', 'Processing .PNG...')
              : t(
                  `นำไฟล์รูป .PNG มาใส่ลาย (${partLabel})`,
                  `Import .PNG Fabric (${partLabel})`
                )}
          </span>
        </button>

        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
          {builtInFabrics.map((preset) => {
            const active = currentPartCfg.textureDataUrl === preset.dataUrl;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  patchPart(activePart, {
                    color: null,
                    textureDataUrl: preset.dataUrl,
                    textureRepeat: preset.defaultRepeat,
                  })
                }
                className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-left transition-all active:scale-95 ${
                  active
                    ? 'bg-cyan-500/35 border-amber-300 text-white shadow-sm'
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

        {currentPartCfg.textureDataUrl && (
          <div className="flex items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-xl p-2 mt-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={currentPartCfg.textureDataUrl}
                alt="Active Outfit PNG"
                className="w-8 h-8 rounded-lg object-cover border border-white/30 bg-white shrink-0"
              />
              <span className={`text-[10px] font-bold text-white/85 truncate ${textShadow}`}>
                {t('ความถี่ลายผ้า', 'Pattern Scale')}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {([1, 2, 3, 4] as const).map((rep) => {
                const curRep = currentPartCfg.textureRepeat ?? 2;
                const active = curRep === rep;
                return (
                  <button
                    key={rep}
                    type="button"
                    onClick={() => patchPart(activePart, { textureRepeat: rep })}
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