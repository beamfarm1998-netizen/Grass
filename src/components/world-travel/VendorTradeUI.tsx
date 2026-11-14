// src/components/world-travel/VendorTradeUI.tsx
// ปุ่ม "คุยกับพ่อค้า" + หน้าต่างขายปลาที่สะพานปลา (ขั้นที่ 1–2)
// - ปลาในกระเป๋าเดียวกับร้านรับซื้อที่ฟาร์ม (fishMarketStorage) → ขายที่ไหนก็หักจากกระเป๋าเดียวกัน
// - ราคา/สิ่งที่รับซื้อมาจาก market/VendorMarket.ts (แต่ละหมวดรับไม่เหมือนกัน + ราคาขึ้นลงรายวัน)
import React, { useEffect, useMemo, useState } from 'react';
import type { CaughtFishRecord } from '../../fishing/storage/SaveSchema';
import type { VendorInfo } from '../../worlds/hua-hin-fish-bridge/environment/PierVendors';
import {
  ROLE_BUY_RULES,
  dailyMultiplier,
  getDayKey,
  trendOf,
  vendorAccepts,
  vendorOffer,
} from '../../worlds/hua-hin-fish-bridge/market/VendorMarket';
import { getFishSpeciesInfo } from '../../utils/fishMarketStorage';
import { getCurrentLang } from '../../i18n/translations';
import { GOODS, buyPrice, farmDaily, farmSellPrice, freshnessMultiplier, getGood, goodsOfRole, pierDaily, timeOfDayLabel } from '../../worlds/hua-hin-fish-bridge/market/SeafoodGoods';
import {
  SEAFOOD_BAG_MAX_UNITS, loadSeafoodBag, subscribeSeafoodBag, takeAllSeafood, totalUnits, type SeafoodLot,
} from '../../worlds/hua-hin-fish-bridge/market/SeafoodBag';
import { getDayKey as dayKeyNow } from '../../worlds/hua-hin-fish-bridge/market/VendorMarket';

export const TalkToVendorButton: React.FC<{ vendor: VendorInfo | null; onTalk: () => void }> = ({ vendor, onTalk }) => {
  if (!vendor || !vendor.role) return null;
  return (
    <div
      data-ui
      className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto max-w-[92vw] safe-bottom"
    >
      <button
        type="button"
        onClick={onTalk}
        className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-amber-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
      >
        <span className="text-base">{vendor.role.icon}</span>
        <span>คุยกับ{vendor.name} · {vendor.role.label}</span>
      </button>
    </div>
  );
};

const TREND_ICON = { up: '📈', flat: '➖', down: '📉' } as const;
const TREND_TH = { up: 'วันนี้ราคาดี', flat: 'ราคาปกติ', down: 'วันนี้ราคาต่ำ' } as const;

interface TradeProps {
  vendor: VendorInfo;
  coins: number;
  fishBag: CaughtFishRecord[];
  onSell: (ids: string[], vendorId: string) => void;
  onClose: () => void;
  /** ขั้น 3: ซื้อสินค้าทะเลมาขายต่อ */
  seafoodLots: SeafoodLot[];
  onBuy: (goodId: string, qty: number) => void;
}

export const VendorTradeModal: React.FC<TradeProps> = ({ vendor, coins, fishBag, onSell, onClose, seafoodLots, onBuy }) => {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const role = vendor.role;
  const lang = getCurrentLang() === 'en' ? 'en' : 'th';
  const dayKey = getDayKey();

  const { sellable, rejected, total } = useMemo(() => {
    if (!role) return { sellable: [] as CaughtFishRecord[], rejected: [] as CaughtFishRecord[], total: 0 };
    const ok = fishBag.filter((f) => vendorAccepts(role.id, f));
    const no = fishBag.filter((f) => !vendorAccepts(role.id, f));
    return { sellable: ok, rejected: no, total: ok.reduce((sum, f) => sum + vendorOffer(role.id, f, dayKey), 0) };
  }, [fishBag, role, dayKey]);

  if (!role) return null;
  const rule = ROLE_BUY_RULES[role.id];
  const mult = dailyMultiplier(role.id, dayKey);
  const trend = trendOf(mult);

  return (
    <div data-ui className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-2 pointer-events-auto">
      <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-3xl bg-[#fff8e6] border-2 border-amber-300 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-2 bg-gradient-to-r from-amber-300 to-orange-300 px-4 py-3">
          <div>
            <div className="text-base font-black text-stone-900">{role.icon} {vendor.name} · {role.label}</div>
            <div className="text-xs text-stone-800 mt-0.5">“{role.greeting}”</div>
          </div>
          <button type="button" onClick={onClose} className="min-h-[40px] min-w-[40px] rounded-full bg-white/70 font-black text-stone-900">✕</button>
        </div>

        <div className="px-4 py-2 text-xs text-stone-700 border-b border-amber-200 flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span>🪙 เหรียญคุณ: <b>{coins}</b></span>
          <span>{TREND_ICON[trend]} {TREND_TH[trend]} (×{mult.toFixed(2)})</span>
          <span className="basis-full text-stone-500">{rule.thNote}</span>
        </div>

        <div className="flex gap-2 px-4 pt-2">
          {(['buy', 'sell'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`min-h-[38px] flex-1 rounded-full text-xs font-black border ${tab === k ? 'bg-amber-400 border-amber-500 text-stone-900' : 'bg-white/70 border-amber-200 text-stone-600'}`}
            >
              {k === 'buy' ? '🛒 ซื้อไปขายต่อ' : '🐟 ขายปลาที่ตกได้'}
            </button>
          ))}
        </div>

        {tab === 'buy' && (
          <BuyPanel roleId={role.id} coins={coins} seafoodLots={seafoodLots} onBuy={onBuy} />
        )}

        <div className={`flex-1 overflow-y-auto px-4 py-2 space-y-1.5 ${tab === 'buy' ? 'hidden' : ''}`}>
          {sellable.length === 0 && (
            <div className="text-sm text-stone-600 py-6 text-center">
              {rule.accepts.length === 0
                ? 'หมวดนี้ยังไม่รับปลาน้ำจืด ลองไปคุยกับลุงชม/ป้าน้อย/ลุงเหลืองก่อนนะ'
                : fishBag.length === 0
                  ? 'ยังไม่มีปลาในกระเป๋า ไปตกปลาที่สระน้ำที่ฟาร์มก่อนนะ'
                  : 'ปลาที่มีอยู่ ร้านนี้ไม่รับ ลองถามร้านอื่นดู'}
            </div>
          )}
          {sellable.map((f) => {
            const sp = getFishSpeciesInfo(f.speciesId, lang);
            const price = vendorOffer(role.id, f, dayKey);
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/80 border border-amber-100 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-stone-900 truncate">🐟 {sp.name}</div>
                  <div className="text-[11px] text-stone-500">{f.weightKg.toFixed(2)} kg · {f.rarity}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSell([f.id], vendor.id)}
                  className="min-h-[40px] shrink-0 rounded-full bg-gradient-to-b from-[#8fb351] to-[#6a8a32] px-4 text-xs font-black text-white active:scale-95"
                >
                  ขาย +{price} 🪙
                </button>
              </div>
            );
          })}
          {rejected.length > 0 && sellable.length > 0 && (
            <div className="text-[11px] text-stone-500 pt-1">มีปลาอีก {rejected.length} ตัวที่ร้านนี้ไม่รับ</div>
          )}
        </div>

        <div className={`border-t border-amber-200 px-4 py-3 flex items-center justify-between gap-2 bg-amber-50 ${tab === 'buy' ? 'hidden' : ''}`}>
          <div className="text-xs text-stone-700">รวมที่ขายได้: <b>{total}</b> 🪙 ({sellable.length} ตัว)</div>
          <button
            type="button"
            disabled={sellable.length === 0}
            onClick={() => onSell(sellable.map((f) => f.id), vendor.id)}
            className="min-h-[42px] rounded-full bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] px-5 text-xs font-black text-[#3a2a05] disabled:opacity-40 active:scale-95"
          >
            ขายทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
};


// ───────────────────────── ขั้น 3: ซื้อสินค้าทะเล ─────────────────────────
const BuyPanel: React.FC<{
  roleId: import('../../worlds/hua-hin-fish-bridge/environment/PierVendors').VendorRoleId;
  coins: number;
  seafoodLots: SeafoodLot[];
  onBuy: (goodId: string, qty: number) => void;
}> = ({ roleId, coins, seafoodLots, onBuy }) => {
  const goods = goodsOfRole(roleId);
  const used = totalUnits(seafoodLots);
  const free = SEAFOOD_BAG_MAX_UNITS - used;
  const dayKey = dayKeyNow();
  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
      <div className="text-[11px] text-stone-600 flex flex-wrap gap-x-3">
        <span>{timeOfDayLabel()}</span>
        <span>🎒 กระเป๋า {used}/{SEAFOOD_BAG_MAX_UNITS}</span>
      </div>
      <div className="text-[11px] text-stone-500">ซื้อตอนเช้าถูกสุด แล้วเอาไปขายที่ร้านรับซื้อที่ฟาร์ม ของสดยิ่งค้างนานราคายิ่งตก</div>
      {goods.map((g) => {
        const price = buyPrice(g.id);
        const trend = trendOf(pierDaily(g.id, dayKey) / 1.05);
        return (
          <div key={g.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/80 border border-amber-100 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-900 truncate">{g.icon} {g.nameTh} {TREND_ICON[trend]}</div>
              <div className="text-[11px] text-stone-500">{price} 🪙 / หน่วย · สดได้ {g.freshDays} วัน</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {[1, 5].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={coins < price * q || free < q}
                  onClick={() => onBuy(g.id, q)}
                  className="min-h-[40px] rounded-full bg-gradient-to-b from-[#5ba8e0] to-[#2f78b8] px-3 text-xs font-black text-white disabled:opacity-40 active:scale-95"
                >
                  +{q}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {seafoodLots.length > 0 && (
        <div className="text-[11px] text-stone-600 pt-1">
          ในกระเป๋า: {seafoodLots.map((l) => `${getGood(l.goodId)?.icon ?? ''}×${l.qty}`).join(' ')}
        </div>
      )}
    </div>
  );
};

// ───────────────────── ฝั่งฟาร์ม: ขายสินค้าทะเลที่ซื้อมา ─────────────────────
/** โผล่เมื่อเปิดหน้าต่างร้านรับซื้อปลาที่ฟาร์ม และมีสินค้าทะเลในกระเป๋า */
export const SeafoodFarmSellPanel: React.FC<{
  visible: boolean;
  earnCoins: (n: number) => void;
  addXP: (n: number) => void;
  addNotice: (text: string, color?: string) => void;
}> = ({ visible, earnCoins, addXP, addNotice }) => {
  const [lots, setLots] = useState<SeafoodLot[]>(() => loadSeafoodBag());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const refresh = () => setLots(loadSeafoodBag());
    refresh();
    return subscribeSeafoodBag(refresh);
  }, [visible]);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);

  const now = new Date();
  const rows = useMemo(
    () => lots.map((l) => {
      const unit = farmSellPrice(l.goodId as never, l.boughtDay, now);
      return { lot: l, unit, total: unit * l.qty, profit: (unit - l.unitCost) * l.qty, fresh: freshnessMultiplier(l.goodId as never, l.boughtDay, now) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lots]
  );
  if (!visible || lots.length === 0) return null;
  const total = rows.reduce((s2, r) => s2 + r.total, 0);
  const profit = rows.reduce((s2, r) => s2 + r.profit, 0);

  const sellAll = () => {
    const taken = takeAllSeafood();
    if (taken.length === 0) return;
    const n = new Date();
    let coinsEarned = 0, xp = 0, units = 0;
    for (const l of taken) {
      coinsEarned += farmSellPrice(l.goodId as never, l.boughtDay, n) * l.qty;
      xp += (getGood(l.goodId)?.xp ?? 1) * l.qty;
      units += l.qty;
    }
    earnCoins(coinsEarned);
    addXP(xp);
    const p = coinsEarned - taken.reduce((s2, l) => s2 + l.unitCost * l.qty, 0);
    addNotice(`🦐 ขายสินค้าทะเล ${units} หน่วย +${coinsEarned} 🪙 (${p >= 0 ? 'กำไร +' : 'ขาดทุน '}${p}) (+${xp} XP)`, p >= 0 ? '#facc15' : '#f87171');
    setOpen(false);
  };

  return (
    <>
      <div data-ui className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] pointer-events-auto">
        <button type="button" onClick={() => setOpen(true)} className="rounded-2xl border-2 border-sky-200 bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-2.5 text-xs font-black text-stone-950 shadow-2xl active:scale-95">
          🦐 ขายสินค้าทะเลที่ซื้อมา ({totalUnits(lots)})
        </button>
      </div>
      {open && (
        <div data-ui className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center bg-black/50 p-2 pointer-events-auto">
          <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl bg-[#f2fbff] border-2 border-sky-300 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-300 to-cyan-200 px-4 py-3">
              <div className="text-base font-black text-stone-900">🦐 ขายสินค้าทะเล (ร้านรับซื้อฟาร์ม)</div>
              <button type="button" onClick={() => setOpen(false)} className="min-h-[40px] min-w-[40px] rounded-full bg-white/70 font-black">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
              {rows.map(({ lot, unit, profit: pf, fresh }) => {
                const g = getGood(lot.goodId);
                return (
                  <div key={`${lot.goodId}-${lot.boughtDay}-${lot.unitCost}`} className="rounded-xl bg-white/90 border border-sky-100 px-3 py-2 text-xs">
                    <div className="flex justify-between font-bold text-stone-900">
                      <span>{g?.icon} {g?.nameTh} ×{lot.qty}</span>
                      <span>{unit} 🪙/หน่วย</span>
                    </div>
                    <div className="text-[11px] text-stone-500">
                      ซื้อมา {lot.unitCost} 🪙 · {fresh >= 1 ? 'สด' : `ไม่สด (ราคา ×${fresh})`} · {pf >= 0 ? `กำไร +${pf}` : `ขาดทุน ${pf}`}
                    </div>
                  </div>
                );
              })}
              <div className="text-[11px] text-stone-500">ราคาฟาร์มวันนี้ขึ้นลงตามวัน (×{(GOODS.reduce((a, g) => a + farmDaily(g.id), 0) / GOODS.length).toFixed(2)} โดยเฉลี่ย)</div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-sky-200 bg-sky-50 px-4 py-3">
              <div className="text-xs text-stone-700">รวม <b>{total}</b> 🪙 · {profit >= 0 ? `กำไร +${profit}` : `ขาดทุน ${profit}`}</div>
              <button type="button" onClick={sellAll} className="min-h-[42px] rounded-full bg-gradient-to-b from-[#f4d06f] to-[#c9a03a] px-5 text-xs font-black text-[#3a2a05] active:scale-95">ขายทั้งหมด</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
