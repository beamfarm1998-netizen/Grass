// src/components/ui/FishingOverlay.tsx
import React, { Component, Suspense, lazy, useCallback, useRef, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

// โหลดโมดูลตกปลา (three.js scene + fish AI + physics) แบบ lazy
// → ไม่เพิ่มขนาด bundle ตอนเปิดเกมฟาร์ม จะดาวน์โหลดก็ต่อเมื่อผู้เล่นกดตกปลาครั้งแรก
const RealisticFishingApp = lazy(() =>
  import('../../fishing/app/App').then((m) => ({ default: m.FishingApp || m.RealisticFishingApp }))
);

/** อัตราแปลงเหรียญที่ได้จากการขายปลา → เหรียญฟาร์ม (1 = เท่ากัน) */
export const FISH_TO_FARM_COIN_RATE = 1;
/** อัตราแปลง XP การตกปลา → XP ฟาร์ม */
export const FISH_TO_FARM_XP_RATE = 1;

interface FishingErrorBoundaryProps {
  onRetry: () => void;
  onExit: () => void;
  titleText: string;
  retryText: string;
  backText: string;
  children: React.ReactNode;
}

interface FishingErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class FishingErrorBoundary extends Component<
  FishingErrorBoundaryProps,
  FishingErrorBoundaryState
> {
  state: FishingErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): FishingErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#07131f] px-6 text-center text-sky-100">
          <div className="text-3xl">🎣</div>
          <p className="text-base font-bold">{this.props.titleText}</p>
          {this.state.message && (
            <p className="max-w-md text-xs text-slate-400 break-words">{this.state.message}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                this.props.onRetry();
              }}
              className="rounded-xl bg-sky-500 hover:bg-sky-400 px-5 py-2.5 text-xs font-black text-slate-950 transition-colors cursor-pointer"
            >
              {this.props.retryText}
            </button>
            <button
              type="button"
              onClick={this.props.onExit}
              className="rounded-xl border border-white/20 bg-slate-800 hover:bg-slate-700 px-5 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              {this.props.backText}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface FishingOverlayProps {
  onExit: () => void;
  playerCoins: number;
  spendCoins: (amount: number) => boolean;
  earnCoins: (amount: number) => void;
  addXP: (amount: number) => void;
  addNotice: (text: string, color?: string) => void;
}

export const FishingOverlay: React.FC<FishingOverlayProps> = ({
  onExit,
  playerCoins,
  spendCoins,
  earnCoins,
  addXP,
  addNotice,
}) => {
  const { t, lang } = useLanguage();
  const sessionCoinsEarnedRef = useRef(0);
  const sessionCoinsSpentRef = useRef(0);
  const [mountKey, setMountKey] = useState(0);

  const handleSpendCoins = useCallback(
    (amount: number): boolean => {
      if (!Number.isFinite(amount) || amount < 0) return false;
      const farmCost = Math.max(0, Math.round(amount * FISH_TO_FARM_COIN_RATE));
      if (farmCost === 0) return true;
      const ok = spendCoins(farmCost);
      if (ok) {
        sessionCoinsSpentRef.current += farmCost;
      }
      return ok;
    },
    [spendCoins]
  );

  const handleCoins = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const farmCoins = Math.max(0, Math.round(amount * FISH_TO_FARM_COIN_RATE));
      if (farmCoins <= 0) return;
      sessionCoinsEarnedRef.current += farmCoins;
      earnCoins(farmCoins);
    },
    [earnCoins]
  );

  const handleXp = useCallback(
    (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      const farmXp = Math.max(0, Math.round(amount * FISH_TO_FARM_XP_RATE));
      if (farmXp > 0) addXP(farmXp);
    },
    [addXP]
  );

  const handleExit = useCallback(() => {
    const earned = sessionCoinsEarnedRef.current;
    const spent = sessionCoinsSpentRef.current;
    if (earned > 0 && spent > 0) {
      addNotice(
        t(
          `🎣 ตกปลา: ขายปลา +${earned} 🪙 • ซื้ออุปกรณ์ -${spent} 🪙`,
          `🎣 Fishing: Sold fish +${earned} 🪙 • Tackle -${spent} 🪙`
        ),
        '#38bdf8'
      );
    } else if (earned > 0) {
      addNotice(
        t(
          `🎣 ขายปลาได้ +${earned} 🪙 เข้ากระเป๋าฟาร์ม`,
          `🎣 Fishing earned +${earned} 🪙 for the farm`
        ),
        '#38bdf8'
      );
    } else if (spent > 0) {
      addNotice(
        t(
          `🎣 อัปเกรดอุปกรณ์ตกปลา -${spent} 🪙 จากกระเป๋าฟาร์ม`,
          `🎣 Purchased fishing tackle (-${spent} 🪙)`
        ),
        '#fbbf24'
      );
    }
    sessionCoinsEarnedRef.current = 0;
    sessionCoinsSpentRef.current = 0;
    onExit();
  }, [addNotice, onExit, t]);

  return (
    <div data-ui>
      <FishingErrorBoundary
        onRetry={() => setMountKey((k) => k + 1)}
        onExit={handleExit}
        titleText={t('ไม่สามารถเปิดบ่อตกปลาได้ชั่วคราว', 'Could not open the fishing pond')}
        retryText={t('ลองใหม่อีกครั้ง', 'Try Again')}
        backText={t('กลับไปที่ฟาร์ม', 'Back to Farm')}
      >
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#07131f] text-sky-200 text-sm font-bold">
              🎣 {t('กำลังเตรียมบ่อตกปลา...', 'Preparing the fishing pond...')}
            </div>
          }
        >
          <RealisticFishingApp
            key={mountKey}
            onExit={handleExit}
            playerCoins={playerCoins}
            onSpendCoins={handleSpendCoins}
            onCoinsEarned={handleCoins}
            onXpEarned={handleXp}
            language={lang}
          />
        </Suspense>
      </FishingErrorBoundary>
    </div>
  );
};
