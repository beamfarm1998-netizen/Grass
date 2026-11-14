// src/components/ui/FishShopModal.tsx
import React, { useMemo, useState } from 'react';
import { Coins, Fish, Scale, Sparkles, Waves, X } from 'lucide-react';
import type { CaughtFishRecord } from '../../fishing/storage/SaveSchema';
import type { FarmerGender } from '../../types/game';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  FISH_SHOP_BONUS_RATE,
  getAllFishSpeciesCatalog,
  getFishRarityInfo,
  getFishShopPrice,
  getFishShopPricePerKg,
  getFishShopXp,
  getFishSpeciesInfo,
} from '../../utils/fishMarketStorage';

export interface FishShopModalProps {
  isOpen: boolean;
  fishShopHouseId: string | null;
  playerGender: FarmerGender;
  coins: number;
  fishBag: CaughtFishRecord[];
  onSellFish: (recordId: string) => void;
  onSellAllFish: () => void;
  onGoFishing?: () => void;
  onClose: () => void;
}

// ============================================================
// DESIGN TOKENS (ตรงกับ BreweryModal)
// ============================================================
const GLASS_PILL =
  'relative overflow-hidden bg-gradient-to-br from-white/70 via-white/20 to-white/10 backdrop-blur-xl border border-white/60 shadow-[inset_0_2px_10px_rgba(255,255,255,0.9),inset_0_-2px_5px_rgba(255,255,255,0.3),0_10px_20px_rgba(0,0,0,0.1),-2px_0_3px_rgba(255,100,100,0.3),2px_0_3px_rgba(100,150,255,0.3)]';
const GLASS_CIRCLE =
  'relative overflow-hidden flex items-center justify-center rounded-full bg-gradient-to-br from-white/80 via-white/30 to-white/10 backdrop-blur-md border border-white/70 shadow-[inset_0_2px_8px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(255,255,255,0.4),0_8px_16px_rgba(0,0,0,0.15),-1px_0_2px_rgba(255,150,150,0.4),1px_0_2px_rgba(150,200,255,0.4)]';

const TEXT_SHARP_HALO =
  '[text-shadow:0_0_1px_rgba(255,255,255,1),0_0_3px_rgba(255,255,255,0.95),0_0_6px_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.25)]';
const TEXT_SOFT_HALO =
  '[text-shadow:0_0_1px_rgba(255,255,255,1),0_0_2px_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.2)]';
const TEXT_LIGHT_HALO =
  '[text-shadow:0_0_1px_rgba(255,255,255,1),0_0_2px_rgba(255,255,255,0.85)]';

const BTN_GREEN =
  'min-h-[42px] px-6 py-2 rounded-full font-bold text-xs transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#8fb351] to-[#6a8a32] text-white border-[#6a8a32] shadow-[0_4px_10px_rgba(106,138,50,0.4),inset_0_2px_4px_rgba(255,255,255,0.5)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100';
const BTN_AMBER =
  'min-h-[42px] px-6 py-2 rounded-full font-bold text-xs transition-all active:scale-95 whitespace-nowrap border bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] text-[#3a2a05] border-[#c9a03a] shadow-[0_4px_10px_rgba(201,160,58,0.3),inset_0_2px_4px_rgba(255,255,255,0.6)] hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed';

export const FishShopModal: React.FC<FishShopModalProps> = ({
  isOpen,
  playerGender,
  coins,
  fishBag,
  onSellFish,
  onSellAllFish,
  onGoFishing,
  onClose,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'sell' | 'rates'>('sell');

  const summary = useMemo(() => {
    let totalWeightKg = 0;
    let totalCoins = 0;
    let totalXp = 0;
    for (const item of fishBag) {
      totalWeightKg += item.weightKg || 0;
      totalCoins += getFishShopPrice(item);
      totalXp += getFishShopXp(item);
    }
    return {
      count: fishBag.length,
      totalWeightKg,
      totalCoins,
      totalXp,
    };
  }, [fishBag]);

  const catalog = useMemo(() => getAllFishSpeciesCatalog(), []);

  if (!isOpen) return null;

  const bonusPct = Math.round((FISH_SHOP_BONUS_RATE - 1) * 100);

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 animate-fade-in">
      {/* Backdrop สำหรับกดพื้นที่ว่างตรงไหนก็ปิดหน้าเมนูได้ทันที */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs pointer-events-auto cursor-pointer"
        onClick={onClose}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl flex flex-col max-h-[92dvh] pointer-events-auto overflow-visible z-10"
      >
        {/* ================================================== */}
        {/* HEADER                                            */}
        {/* ================================================== */}
        <div
          className={`${GLASS_PILL} flex items-center justify-between gap-3 px-4 sm:px-6 py-3 rounded-[2.5rem] mb-4`}
        >
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3/4 h-1.5 bg-white/90 blur-[1.5px] rounded-full pointer-events-none" />

          <div className="flex items-center gap-3 min-w-0 z-10">
            <div className={`${GLASS_CIRCLE} w-11 h-11 text-[#0369a1] shrink-0`}>
              <Fish className="w-5 h-5 drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className={`text-lg sm:text-xl font-black text-[#0f1508] tracking-tight truncate ${TEXT_SHARP_HALO}`}
                >
                  {t('ร้านรับซื้อปลาสดริมบ่อ', 'Waterfront Fish-Buying Shop')}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/50 border border-amber-300/80 text-[#5a3a05] text-[10px] font-black tabular-nums ${TEXT_LIGHT_HALO}`}
                >
                  <Sparkles className="w-3 h-3 text-[#8a6a12] shrink-0" />
                  {t(`โบนัส +${bonusPct}%`, `+${bonusPct}%`)}
                </span>
              </div>
              <div
                className={`flex items-center gap-2 text-xs font-semibold text-[#2a3818] flex-wrap mt-0.5 ${TEXT_LIGHT_HALO}`}
              >
                <span>
                  {playerGender === 'female'
                    ? t('👩‍🌾 ชั่งกิโลรับซื้อปลาที่ตกได้ จ่ายเหรียญสดทันที', '👩‍🌾 Weigh & sell for instant coins')
                    : t('👨‍🌾 ชั่งกิโลรับซื้อปลาที่ตกได้ จ่ายเหรียญสดทันที', '👨‍🌾 Weigh & sell for instant coins')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 z-10">
            <div
              className={`${GLASS_PILL} flex items-center gap-1.5 px-4 py-2 rounded-full text-[#0f1508] font-mono font-bold text-xs sm:text-sm tabular-nums ${TEXT_LIGHT_HALO}`}
            >
              <Coins className="w-4 h-4 text-[#8a6a12] shrink-0 drop-shadow-sm" />
              <span>{coins.toLocaleString()}</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t('ปิดหน้าต่าง', 'Close')}
              className={`${GLASS_CIRCLE} min-h-[40px] min-w-[40px] px-3 py-2 text-[#1a2210] hover:bg-white/80 transition-colors active:scale-95`}
            >
              <X className="w-4 h-4 shrink-0 drop-shadow-sm" />
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* SCROLL AREA                                        */}
        {/* ================================================== */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* ================================================= */}
          {/* TABS                                              */}
          {/* ================================================= */}
          <div className="flex items-center gap-2 justify-center relative z-10">
            <button
              type="button"
              onClick={() => setActiveTab('sell')}
              className={`${
                activeTab === 'sell'
                  ? GLASS_PILL
                  : 'bg-white/10 backdrop-blur-sm border-white/20'
              } min-h-[40px] px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold text-[#0f1508] transition-all border shadow-sm hover:bg-white/50 flex items-center gap-2 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
            >
              <Scale className="w-4 h-4" />
              <span>
                {t('ขายปลาที่ตกได้', 'Sell Fish')} ({summary.count})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rates')}
              className={`${
                activeTab === 'rates'
                  ? GLASS_PILL
                  : 'bg-white/10 backdrop-blur-sm border-white/20'
              } min-h-[40px] px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold text-[#0f1508] transition-all border shadow-sm hover:bg-white/50 flex items-center gap-2 whitespace-nowrap ${TEXT_LIGHT_HALO}`}
            >
              <Waves className="w-4 h-4" />
              <span>{t('ใบราคารับซื้อ', 'Price Board')}</span>
            </button>
          </div>

          {/* ================================================= */}
          {/* CONTENT                                           */}
          {/* ================================================= */}
          {activeTab === 'sell' ? (
            <>
              {/* ---------- Summary & Sell-All ---------- */}
              <div className={`${GLASS_PILL} p-4 rounded-[2rem]`}>
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-white/80 blur-[1px] rounded-full pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div
                    className={`flex items-center gap-4 flex-wrap text-[#0f1508] ${TEXT_LIGHT_HALO}`}
                  >
                    <div>
                      <div className="text-[10px] font-bold text-[#2a3818] uppercase tracking-wider">
                        {t('ปลาในกระเป๋า', 'In Keepnet')}
                      </div>
                      <div className="text-base sm:text-lg font-black tabular-nums">
                        {summary.count} {t('ตัว', 'fish')}
                      </div>
                    </div>
                    <div className="h-8 w-px bg-black/10 hidden sm:block" />
                    <div>
                      <div className="text-[10px] font-bold text-[#2a3818] uppercase tracking-wider">
                        {t('น้ำหนักรวม', 'Total Weight')}
                      </div>
                      <div className="text-base sm:text-lg font-black text-[#0369a1] tabular-nums">
                        {summary.totalWeightKg.toFixed(2)} kg
                      </div>
                    </div>
                    <div className="h-8 w-px bg-black/10 hidden sm:block" />
                    <div>
                      <div className="text-[10px] font-bold text-[#2a3818] uppercase tracking-wider">
                        {t('ยอดรับซื้อรวม', 'Total Payout')}
                      </div>
                      <div className="text-base sm:text-lg font-black text-[#8a6a12] tabular-nums">
                        +{summary.totalCoins.toLocaleString()} 🪙{' '}
                        <span className="text-xs font-bold text-[#1f4d1a]">
                          (+{summary.totalXp} XP)
                        </span>
                      </div>
                    </div>
                  </div>

                  {summary.count > 0 && (
                    <button
                      type="button"
                      onClick={onSellAllFish}
                      className={`${BTN_AMBER} flex items-center justify-center gap-2 shrink-0`}
                    >
                      <Coins className="w-4 h-4 shrink-0" />
                      <span className="tabular-nums">
                        {t(
                          `ขายเหมาทั้งหมด (+${summary.totalCoins.toLocaleString()} 🪙)`,
                          `Sell All (+${summary.totalCoins.toLocaleString()} 🪙)`
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* ---------- Empty State ---------- */}
              {fishBag.length === 0 ? (
                <div className={`${GLASS_PILL} p-6 sm:p-8 text-center rounded-[2rem]`}>
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-white/80 blur-[1px] rounded-full pointer-events-none" />

                  <div className="relative z-10 space-y-3">
                    <div
                      className={`${GLASS_CIRCLE} w-16 h-16 mx-auto text-[#0369a1]`}
                    >
                      <Fish className="w-8 h-8 drop-shadow-sm" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                      <h3
                        className={`text-sm sm:text-base font-black text-[#0f1508] ${TEXT_SOFT_HALO}`}
                      >
                        {t(
                          'ยังไม่มีปลาสดในกระเป๋าเก็บปลา',
                          'Your fish keepnet is currently empty'
                        )}
                      </h3>
                      <p
                        className={`text-xs sm:text-sm font-medium text-[#2a3818] leading-relaxed ${TEXT_LIGHT_HALO}`}
                      >
                        {t(
                          'เดินไปที่สระน้ำริมฟาร์มเพื่อตกปลา แล้วกด "เก็บเข้ากระเป๋า" จากนั้นนำปลามาชั่งกิโลขายรับโบนัสที่นี่!',
                          'Catch fish at the pond, choose "Keep in Net", then bring them here for a fresh market payout!'
                        )}
                      </p>
                    </div>
                    {onGoFishing && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onGoFishing();
                          }}
                          className={`${BTN_GREEN} inline-flex items-center justify-center gap-2`}
                        >
                          <Waves className="w-4 h-4 shrink-0" />
                          <span>{t('ไปโหมดตกปลาที่สระน้ำ', 'Go Fishing at the Pond')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {fishBag.map((record) => {
                    const info = getFishSpeciesInfo(record.speciesId, lang);
                    const rarity = getFishRarityInfo(record.rarity, lang);
                    const shopPrice = getFishShopPrice(record);
                    const shopXp = getFishShopXp(record);

                    return (
                      <div
                        key={record.id}
                        className={`${GLASS_PILL} p-3.5 rounded-[2rem] flex items-center justify-between gap-3`}
                      >
                        <div className="absolute top-1 left-6 w-1/2 h-1 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

                        <div className="flex items-center gap-3 min-w-0 relative z-10">
                          <div
                            className={`${GLASS_CIRCLE} w-12 h-12 text-[#0369a1] shrink-0`}
                            title={info.name}
                          >
                            <Fish className="w-6 h-6 drop-shadow-sm" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm sm:text-base font-extrabold text-[#0f1508] truncate ${TEXT_SOFT_HALO}`}
                              >
                                {info.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rarity.badgeClass}`}
                              >
                                {rarity.label}
                              </span>
                            </div>
                            <div
                              className={`flex items-center gap-2.5 text-xs font-bold text-[#2a3818] tabular-nums mt-0.5 flex-wrap ${TEXT_LIGHT_HALO}`}
                            >
                              <span>
                                {t('น้ำหนัก', 'Weight')}:{' '}
                                <strong className="text-[#0f1508]">
                                  {record.weightKg.toFixed(2)} kg
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                {t('ยาว', 'Length')}:{' '}
                                <strong className="text-[#0f1508]">
                                  {record.lengthCm.toFixed(0)} cm
                                </strong>
                              </span>
                              <span>•</span>
                              <span className="text-[#1f4d1a]">
                                +{shopXp} XP
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSellFish(record.id)}
                          className={`${BTN_GREEN} shrink-0 flex items-center gap-1.5`}
                        >
                          <span className="tabular-nums">
                            {t(`ขาย +${shopPrice} 🪙`, `Sell +${shopPrice} 🪙`)}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ---------- Price Board ---------- */
            <div className="space-y-3">
              {catalog.map((spec) => {
                const info = getFishSpeciesInfo(spec.id, lang);
                const rarity = getFishRarityInfo(spec.rarity, lang);
                const shopPerKg = getFishShopPricePerKg(spec.baseCoinsPerKg);

                return (
                  <div
                    key={spec.id}
                    className={`${GLASS_PILL} p-3.5 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
                  >
                    <div className="absolute top-1 left-6 w-1/2 h-1 bg-white/90 blur-[1px] rounded-full pointer-events-none" />

                    <div className="min-w-0 space-y-1 relative z-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm sm:text-base font-extrabold text-[#0f1508] ${TEXT_SOFT_HALO}`}
                        >
                          {info.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${rarity.badgeClass}`}
                        >
                          {rarity.label}
                        </span>
                        <span
                          className={`text-xs font-bold text-[#2a3818] tabular-nums ${TEXT_LIGHT_HALO}`}
                        >
                          {spec.minWeightKg.toFixed(1)}–{spec.maxWeightKg.toFixed(1)} kg
                        </span>
                      </div>
                      <p
                        className={`text-xs font-medium text-[#2a3818] leading-snug ${TEXT_LIGHT_HALO}`}
                      >
                        {info.desc}
                      </p>
                    </div>

                    <div
                      className={`shrink-0 sm:text-right bg-amber-100/40 border border-amber-300/70 rounded-full px-3 py-2 relative z-10 ${TEXT_LIGHT_HALO}`}
                    >
                      <div className="text-[10px] font-bold text-[#5a3a05] uppercase tracking-wider">
                        {t(`ราคารับซื้อ (+${bonusPct}%)`, `Shop Rate (+${bonusPct}%)`)}
                      </div>
                      <div className="text-sm sm:text-base font-black text-[#3a2a05] tabular-nums">
                        {shopPerKg} 🪙 / kg
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};