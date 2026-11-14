// src/components/ui/LandExpansionModal.tsx
import React from 'react';
import { X, MapPin, Coins, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { ZONE_TEXT_EN } from '../../i18n/translations';

export interface ExpansionZone {
  id: number;
  name: string;
  desc: string;
  plotsCount: number;
  cost: number;
  requiredLevel: number;
}

interface LandExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedZones: number[];
  playerCoins: number;
  playerLevel: number;
  onUnlockZone: (zone: ExpansionZone) => boolean | void;
}

export const EXPANSION_ZONES: ExpansionZone[] = [
  {
    id: 1,
    name: 'พื้นที่ใจกลางฟาร์ม (เริ่มต้น)',
    desc: 'พื้นที่รอบกังหันลมและโรงนาหลัก',
    plotsCount: 12,
    cost: 0,
    requiredLevel: 1,
  },
  {
    id: 2,
    name: 'แปลงทุ่งหญ้าฝั่งใต้ (South Meadow)',
    desc: 'ขยายที่ดินลงมาทางทิศใต้ เพิ่มแปลงผักใหม่ 8 แปลง',
    plotsCount: 8,
    cost: 100,
    requiredLevel: 2,
  },
  {
    id: 3,
    name: 'ไร่ผลไม้ฝั่งตะวันตก (West Orchard)',
    desc: 'ขยายพื้นที่ถัดจากบ้านพักชาวไร่ เพิ่มแปลงผักใหม่ 8 แปลง',
    plotsCount: 8,
    cost: 250,
    requiredLevel: 3,
  },
  {
    id: 4,
    name: 'ไร่ข้าวโพดริมเขา (East Hillside)',
    desc: 'เปิดหน้าดินอุดมสมบูรณ์ริมเนินป่าสน เพิ่มแปลงผักใหม่ 8 แปลง',
    plotsCount: 8,
    cost: 500,
    requiredLevel: 4,
  },
  {
    id: 5,
    name: 'แดนรกร้างทองคำ (Barren Prairie Lv.10)',
    desc: 'พื้นที่ดินโล่งกว้างไร้หญ้า ปลดล็อกเมื่อถึง Lv.10 เพื่อบุกเบิกสร้างฟาร์มขนาดใหญ่ เพิ่มแปลงผัก 12 แปลง',
    plotsCount: 12,
    cost: 1500,
    requiredLevel: 10,
  },
];

export const LandExpansionModal: React.FC<LandExpansionModalProps> = ({
  isOpen,
  onClose,
  unlockedZones,
  playerCoins,
  playerLevel,
  onUnlockZone,
}) => {
  const { lang, t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/75 animate-fade-in backdrop-blur-xs cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-stone-100 truncate">
                {t('ขยายอาณาเขตฟาร์ม', 'Land Expansion')}
              </h2>
              <p className="text-xs text-stone-400 truncate">
                {t(
                  'ปลดล็อกพื้นที่เพื่อเพิ่มแปลงเพาะปลูกในฟาร์มของคุณ',
                  'Unlock new zones to expand your farm plots and frontier'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
          {EXPANSION_ZONES.map((zone) => {
            const isUnlocked = unlockedZones.includes(zone.id);
            const canAfford = playerCoins >= zone.cost;
            const levelMet = playerLevel >= zone.requiredLevel;
            const canUnlock = !isUnlocked && canAfford && levelMet;
            const zoneTitle = lang === 'en' ? ZONE_TEXT_EN[zone.id]?.name || zone.name : zone.name;
            const zoneDesc = lang === 'en' ? ZONE_TEXT_EN[zone.id]?.desc || zone.desc : zone.desc;

            return (
              <div
                key={zone.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-emerald-950/20 border-emerald-600/40'
                    : 'bg-stone-800/70 border-stone-700/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-stone-100 text-sm">{zoneTitle}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-700/60 text-stone-300">
                      +{zone.plotsCount} {t('แปลง', 'plots')}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">{zoneDesc}</p>

                  {!isUnlocked && (
                    <div className="flex items-center gap-3 text-xs pt-1">
                      <span className={levelMet ? 'text-emerald-400' : 'text-rose-400'}>
                        {lang === 'en'
                          ? `Requires Lv.${zone.requiredLevel} ${
                              levelMet ? '✓' : `(${zone.requiredLevel - playerLevel} more)`
                            }`
                          : `ต้องการเลเวล ${zone.requiredLevel} ${
                              levelMet ? '✓' : `(ขาดอีก ${zone.requiredLevel - playerLevel})`
                            }`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action / Status */}
                <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                  {isUnlocked ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-600/40 whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('เปิดใช้งานแล้ว', 'Unlocked')}</span>
                    </div>
                  ) : (
                    <button
                      disabled={!canUnlock}
                      onClick={() => {
                        onUnlockZone(zone);
                      }}
                      className="w-full sm:w-auto min-h-[38px] px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-bold rounded-xl text-xs shadow-md hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>
                        {t(`ซื้อที่ดิน (${zone.cost} G)`, `Unlock (${zone.cost} G)`)}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
