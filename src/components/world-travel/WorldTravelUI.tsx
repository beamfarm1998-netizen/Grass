// src/components/world-travel/WorldTravelUI.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FarmerGender, PlayerOutfitConfig } from '../../types/game';
import { HuaHinFishBridgeWorld } from '../../worlds/hua-hin-fish-bridge/HuaHinFishBridgeWorld';
import { WORLD_IDS, getWorldDefinition } from '../../core/world/WorldRegistry';
import { getCurrentLang } from '../../i18n/translations';
import type { VendorInfo } from '../../worlds/hua-hin-fish-bridge/environment/PierVendors';
import { vendorOffer } from '../../worlds/hua-hin-fish-bridge/market/VendorMarket';
import type { CaughtFishRecord } from '../../fishing/storage/SaveSchema';
import { loadFishBag, sellFishAtPrice, subscribeFishBagChanged } from '../../utils/fishMarketStorage';
import { farmAudio } from '../../utils/audio';
import { TalkToVendorButton, VendorTradeModal } from './VendorTradeUI';
import { buyPrice, getGood } from '../../worlds/hua-hin-fish-bridge/market/SeafoodGoods';
import {
  SEAFOOD_BAG_MAX_UNITS, addToSeafoodBag, loadSeafoodBag, subscribeSeafoodBag, totalUnits, type SeafoodLot,
} from '../../worlds/hua-hin-fish-bridge/market/SeafoodBag';

const fish = getWorldDefinition(WORLD_IDS.HUA_HIN_FISH_BRIDGE);

/** ปุ่มโผล่เมื่อผู้เล่นเดินมาถึงป้ายไม้ "ไปสะพานปลาหัวหิน" → กดเพื่อเข้าไป (สไตล์เดียวกับปุ่มตกปลาที่บ่อ) */
export const TravelToFishBridgeButton: React.FC<{ visible: boolean; disabled: boolean; onTravel: () => void }> = ({
  visible,
  disabled,
  onTravel,
}) => {
  if (!visible) return null;
  const th = getCurrentLang() === 'th';
  return (
    <div
      data-ui
      className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw] safe-bottom"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onTravel}
        className="flex items-center gap-2 bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-sky-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-50"
      >
        <span className="text-base">{fish.icon}</span>
        <span>{th ? `เข้าไป${fish.nameTh}` : `Enter ${fish.nameEn}`}</span>
      </button>
    </div>
  );
};

interface OverlayProps {
  gender: FarmerGender;
  outfit?: PlayerOutfitConfig;
  isCompact: boolean;
  onReady: () => void;
  onFail: () => void;
  onReturn: () => void;
  /** เหรียญปัจจุบัน (แสดงในหน้าต่างซื้อขาย) + ฟังก์ชันให้เหรียญ/XP/ข้อความแจ้งเตือนชุดเดียวกับร้านรับซื้อที่ฟาร์ม */
  coins: number;
  earnCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addXP: (amount: number) => void;
  addNotice: (text: string, color?: string) => void;
}

/** World สะพานปลา: สถานะ Loading → พร้อม → ปุ่มกลับฟาร์ม (ปุ่มลอย + Return Gateway ในฉาก) */
export const FishBridgeWorldOverlay: React.FC<OverlayProps> = ({
  gender, outfit, isCompact, onReady, onFail, onReturn, coins, earnCoins, spendCoins, addXP, addNotice,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HuaHinFishBridgeWorld | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearGateway, setNearGateway] = useState(false);
  const [nearVendor, setNearVendor] = useState<VendorInfo | null>(null);
  const [tradeVendor, setTradeVendor] = useState<VendorInfo | null>(null);
  const [fishBag, setFishBag] = useState<CaughtFishRecord[]>([]);
  const [seafoodLots, setSeafoodLots] = useState<SeafoodLot[]>(() => loadSeafoodBag());
  const th = getCurrentLang() === 'th';
  const cb = useRef({ onReady, onFail });
  cb.current = { onReady, onFail };
  const econ = useRef({ earnCoins, spendCoins, addXP, addNotice });
  econ.current = { earnCoins, spendCoins, addXP, addNotice };

  useEffect(() => subscribeSeafoodBag(() => setSeafoodLots(loadSeafoodBag())), []);

  const handleBuy = useCallback((goodId: string, qty: number) => {
    const g = getGood(goodId);
    if (!g || qty <= 0) return;
    const unit = buyPrice(g.id);
    const cost = unit * qty;
    if (totalUnits(loadSeafoodBag()) + qty > SEAFOOD_BAG_MAX_UNITS) {
      econ.current.addNotice('🎒 กระเป๋าเต็มแล้ว ไปขายที่ฟาร์มก่อนนะ', '#f87171');
      return;
    }
    if (!econ.current.spendCoins(cost)) {
      econ.current.addNotice('🪙 เหรียญไม่พอ', '#f87171');
      return;
    }
    if (!addToSeafoodBag(g.id, qty, unit)) { econ.current.earnCoins(cost); return; } // ใส่ไม่ได้ → คืนเงิน
    farmAudio.playCoinSound();
    econ.current.addNotice(`${g.icon} ซื้อ${g.nameTh} ×${qty} (-${cost} 🪙)`, '#38bdf8');
  }, []);

  const refreshBag = useCallback(() => {
    void loadFishBag().then(setFishBag);
  }, []);
  useEffect(() => {
    refreshBag();
    return subscribeFishBagChanged(refreshBag);
  }, [refreshBag]);

  const openTrade = useCallback(() => {
    if (!nearVendor?.role) return;
    refreshBag();
    worldRef.current?.setInputEnabled(false); // หยุดเดินระหว่างคุยกับพ่อค้า
    setTradeVendor(nearVendor);
  }, [nearVendor, refreshBag]);

  const closeTrade = useCallback(() => {
    setTradeVendor(null);
    worldRef.current?.setInputEnabled(true);
  }, []);

  const handleSell = useCallback(
    (ids: string[], vendorId: string) => {
      const role = tradeVendor && tradeVendor.id === vendorId ? tradeVendor.role : null;
      if (!role) return;
      void sellFishAtPrice(ids, (rec) => vendorOffer(role.id, rec)).then((res) => {
        if (res.count <= 0) return;
        setFishBag(res.remaining);
        farmAudio.playCoinSound();
        econ.current.earnCoins(res.coinsEarned);
        econ.current.addXP(res.xpEarned);
        econ.current.addNotice(
          `${role.icon} ขายปลา ${res.count} ตัว (${res.totalWeightKg.toFixed(2)} kg) ให้${tradeVendor?.name} +${res.coinsEarned} 🪙 (+${res.xpEarned} XP)`,
          '#facc15'
        );
      });
    },
    [tradeVendor]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let world: HuaHinFishBridgeWorld | null = null;
    let raf = 0;
    try {
      world = new HuaHinFishBridgeWorld({
        container: host, gender, outfit, isCompact,
        onNearGatewayChange: setNearGateway,
        onNearVendorChange: setNearVendor,
      });
      worldRef.current = world;
      world.setInputEnabled(false);
      // เฟรมแรกเรนเดอร์แล้วค่อยเปิดอินพุต
      raf = requestAnimationFrame(() => {
        world?.setInputEnabled(true);
        setLoading(false);
        cb.current.onReady();
      });
    } catch (err) {
      console.error('[FishBridge] init failed', err);
      cb.current.onFail();
    }
    return () => {
      cancelAnimationFrame(raf);
      try {
        world?.setInputEnabled(false);
        world?.savePosition(); // บันทึกก่อนออกจาก World
      } catch {
        /* ignore */
      }
      world?.dispose();
      worldRef.current = null;
    };
    // สร้างครั้งเดียวต่อการเข้า World (ไม่สร้างซ้อน)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[55] bg-[#9fd8f0] select-none">
      <div ref={hostRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b2b3a] text-sky-100">
          <div className="text-3xl">{fish.icon}</div>
          <div className="text-sm font-bold">{th ? `กำลังไป${fish.nameTh}...` : `Traveling to ${fish.nameEn}...`}</div>
        </div>
      )}
      {!loading && (
        <>
          <div
            className="absolute left-2 top-2 rounded-xl bg-black/45 px-3 py-1.5 text-xs font-bold text-sky-100"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
          >
            {fish.icon} {th ? fish.nameTh : fish.nameEn}
          </div>
          <button
            type="button"
            onClick={onReturn}
            className={`absolute right-2 top-2 min-h-[44px] rounded-2xl px-3 py-2 text-xs font-black shadow-lg cursor-pointer ${
              nearGateway ? 'bg-amber-400 text-stone-950 animate-pulse' : 'bg-stone-900/80 text-amber-100 border border-amber-400/40'
            }`}
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
          >
            🌾 {th ? 'กลับฟาร์ม' : 'Back to Farm'}
          </button>
          {!tradeVendor && <TalkToVendorButton vendor={nearVendor} onTalk={openTrade} />}
          {tradeVendor && (
            <VendorTradeModal vendor={tradeVendor} coins={coins} fishBag={fishBag} onSell={handleSell} onClose={closeTrade} seafoodLots={seafoodLots} onBuy={handleBuy} />
          )}
        </>
      )}
    </div>
  );
};
