import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppProvider, useGameInstance } from './AppProvider';
import { GameHUDState } from '../core/GameState';
import { useI18n } from '../localization/i18n';
import { languageManager } from '../localization/LanguageManager';
import type { LanguageCode } from '../localization/LanguageTypes';
import { PlatformManager } from '../platform/PlatformManager';
import { FishingState } from '../systems/fishing/FishingState';
import { OfflineIndicator } from '../ui/components/PWAInstallControl';
import { CatchResultModal } from '../ui/dialogs/CatchResultModal';
import { EquipmentModal } from '../ui/equipment/EquipmentModal';
import { DualTouchJoysticks } from '../ui/fishing/DualTouchJoysticks';
import { FishingBottomDock } from '../ui/fishing/FishingBottomDock';
import { ActiveModalType, TopNavBar } from '../ui/hud/TopNavBar';
import { InventoryModal } from '../ui/inventory/InventoryModal';
import { StatsModal } from '../ui/menus/StatsModal';
import { SettingsModal } from '../ui/settings/SettingsModal';

export interface FishingBridgeProps {
  /** ปิดโหมดตกปลาแล้วกลับไปที่ฟาร์ม */
  onExit?: () => void;
  /** จำนวนเหรียญปัจจุบันจากกระเป๋าฟาร์ม (Single Source of Truth) */
  playerCoins?: number;
  /** หักเหรียญจากกระเป๋าฟาร์มเมื่อซื้อคันเบ็ด/รอก/สายเอ็น/เหยื่อ */
  onSpendCoins?: (amount: number) => boolean;
  /** เรียกทุกครั้งที่ขายปลาในโหมดตกปลาเพื่อเพิ่มเหรียญเข้ากระเป๋าฟาร์ม */
  onCoinsEarned?: (amount: number) => void;
  /** เรียกเมื่อได้ XP จากการจับหรือปล่อยปลา */
  onXpEarned?: (amount: number) => void;
  /** ภาษาจากฟาร์ม (th/en) เพื่อให้ UI ตกปลาตรงกับภาษาของเกมหลัก */
  language?: LanguageCode;
}

const GameViewportShell: React.FC<FishingBridgeProps> = ({
  onExit,
  playerCoins,
  onSpendCoins,
  onCoinsEarned,
  onXpEarned,
}) => {
  const game = useGameInstance();
  const { t } = useI18n();
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [hud, setHud] = useState<GameHUDState>(() => game.getHudSnapshot());
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const exitingRef = useRef(false);
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;

  const lookPointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  // ── Unified Wallet Bridge (Farm <-> Fishing Mode) ──
  const liveCoinsRef = useRef<number | undefined>(playerCoins);
  liveCoinsRef.current = playerCoins;
  const bridgeCallbacksRef = useRef({ onSpendCoins, onCoinsEarned, onXpEarned });
  bridgeCallbacksRef.current = { onSpendCoins, onCoinsEarned, onXpEarned };

  const handleRequestExit = useCallback(() => {
    if (!exitRef.current || exitingRef.current) return;
    exitingRef.current = true;
    void game.flushBeforeExit().finally(() => {
      exitRef.current?.();
    });
  }, [game]);

  // Auto-pause simulation & reset stuck inputs while any navigation modal is open
  useEffect(() => {
    game.setUiOverlayOpen(activeModal !== null);
  }, [game, activeModal]);

  // Stable WebGL Mount & Disposal
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    game.setWalletBridge({
      getCoins:
        liveCoinsRef.current !== undefined ? () => liveCoinsRef.current ?? 0 : undefined,
      spendCoins: (amount) => {
        if (!bridgeCallbacksRef.current.onSpendCoins) return true;
        const ok = bridgeCallbacksRef.current.onSpendCoins(amount);
        if (ok && liveCoinsRef.current !== undefined) {
          liveCoinsRef.current = Math.max(0, liveCoinsRef.current - amount);
        }
        return ok;
      },
      onCoinsEarned: (amount) => {
        if (liveCoinsRef.current !== undefined) {
          liveCoinsRef.current += amount;
        }
        bridgeCallbacksRef.current.onCoinsEarned?.(amount);
      },
      onXpEarned: (amount) => {
        bridgeCallbacksRef.current.onXpEarned?.(amount);
      },
    });

    const unsubscribeHud = game.events.on('hudUpdate', (nextState) => {
      setHud(nextState);
    });

    void game.init(container);

    const handleInternalBack = (): boolean => {
      if (activeModalRef.current) {
        setActiveModal(null);
        return true;
      }
      if (!hudRef.current.paused) {
        game.setPaused(true);
        return true;
      }
      return false;
    };

    const detachBack = PlatformManager.attachBackButton(() => {
      if (!handleInternalBack()) {
        handleRequestExit();
      }
    });

    const onBrowserBackIntercept = (e: Event) => {
      if (handleInternalBack()) {
        e.preventDefault();
      } else {
        void game.flushBeforeExit();
      }
    };
    window.addEventListener('beam-fishing-back-request', onBrowserBackIntercept);

    return () => {
      window.removeEventListener('beam-fishing-back-request', onBrowserBackIntercept);
      detachBack();
      unsubscribeHud();
      game.setWalletBridge(null);
      game.dispose();
    };
  }, [game, handleRequestExit]);

  useEffect(() => {
    if (playerCoins !== undefined && Number.isFinite(playerCoins)) {
      game.syncWalletCoins(playerCoins);
    }
  }, [game, playerCoins]);

  // Keyboard Controls (Space, Arrows/AD, Drag +/-, H Zen Mode, Escape) + Blur safety reset
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      game.unlockAudio();

      if (e.key === 'Escape') {
        e.stopPropagation();
        if (activeModalRef.current) {
          setActiveModal(null);
        } else if (hudRef.current.paused && exitRef.current) {
          handleRequestExit();
        } else {
          game.setPaused(!hudRef.current.paused);
        }
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }

      if (activeModalRef.current || hudRef.current.paused) return;

      const st = hudRef.current.fishingState;

      if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;
        if (st === FishingState.IDLE) {
          game.beginCastCharge();
        } else if (st === FishingState.BITE) {
          game.triggerStrike();
        } else if (
          st === FishingState.FIGHTING ||
          st === FishingState.REELING ||
          st === FishingState.WAITING
        ) {
          game.setReeling(true);
        } else if (st === FishingState.RESULT) {
          game.keepCaughtFish();
        } else if (
          st === FishingState.FISH_ESCAPED ||
          st === FishingState.HOOK_FAILED ||
          st === FishingState.LINE_BROKEN
        ) {
          game.dismissFailureOutcome();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        game.steerAim(-3);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        game.steerAim(3);
      } else if (e.key === 'ArrowUp' || e.key === ']') {
        game.adjustReelDrag(0.05);
      } else if (e.key === 'ArrowDown' || e.key === '[') {
        game.adjustReelDrag(-0.05);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const st = hudRef.current.fishingState;
        if (st === FishingState.IDLE) {
          game.releaseCastCharge();
        } else {
          game.setReeling(false);
        }
      }
    };

    const onWindowBlur = () => {
      lookPointerIdRef.current = null;
      game.resetAllInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [game, handleRequestExit]);

  const isOutcomeModalOpen =
    hud.fishingState === FishingState.RESULT ||
    hud.fishingState === FishingState.FISH_ESCAPED ||
    hud.fishingState === FishingState.HOOK_FAILED ||
    hud.fishingState === FishingState.LINE_BROKEN;

  return (
    <div className="fixed inset-0 z-[60] w-full h-full overflow-hidden bg-[#07131f]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        onPointerDown={(e) => {
          game.unlockAudio();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore synthetic pointer capture error
          }
          lookPointerIdRef.current = e.pointerId;
          lastPointerRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (lookPointerIdRef.current !== e.pointerId) return;
          const dx = e.clientX - lastPointerRef.current.x;
          const dy = e.clientY - lastPointerRef.current.y;
          lastPointerRef.current = { x: e.clientX, y: e.clientY };
          game.dragCameraLook(dx, dy);
        }}
        onPointerUp={(e) => {
          if (lookPointerIdRef.current === e.pointerId) {
            lookPointerIdRef.current = null;
          }
        }}
        onPointerCancel={(e) => {
          if (lookPointerIdRef.current === e.pointerId) {
            lookPointerIdRef.current = null;
          }
        }}
        onLostPointerCapture={() => {
          lookPointerIdRef.current = null;
        }}
        className="fixed inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Semantic UI Overlay Layer */}
      <div className="pointer-events-none relative z-10 flex flex-col justify-between w-full h-full">
        <TopNavBar
          onExit={onExit ? handleRequestExit : undefined}
          activeModal={activeModal}
          paused={hud.paused && !activeModal}
          onSelectModal={(modal) => {
            game.unlockAudio();
            setActiveModal(modal);
          }}
          onTogglePause={() => {
            game.unlockAudio();
            if (activeModal) {
              setActiveModal(null);
            } else {
              game.setPaused(!hud.paused);
            }
          }}
        />

        <OfflineIndicator />

        {/* Pause Banner */}
        {hud.paused && !activeModal && (
          <div className="pointer-events-auto self-center my-auto rounded-xl bg-slate-950/94 border border-white/14 px-8 py-6 text-center shadow-2xl">
            <h2 className="text-xl font-bold text-white">{t('settings.pausedTitle')}</h2>
            <p className="text-xs text-slate-400 mt-1.5">{t('game.subtitle')}</p>
            <button
              type="button"
              onClick={() => game.setPaused(false)}
              className="mt-5 min-h-[44px] px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-sm font-semibold text-slate-950 transition-colors cursor-pointer"
            >
              {t('menu.resume')}
            </button>
          </div>
        )}

        {/* Catch Result or Failure Recovery Dialog */}
        <CatchResultModal
          hud={hud}
          onKeepFish={() => game.keepCaughtFish()}
          onReleaseFish={() => game.releaseCaughtFish()}
          onDismissFailure={() => game.dismissFailureOutcome()}
        />

        {/* Mobile-Style Left & Right Virtual Joysticks */}
        {hud.virtualJoysticks && !hud.paused && !activeModal && !isOutcomeModalOpen && (
          <DualTouchJoysticks
            hud={hud}
            dockCollapsed={dockCollapsed}
            onLeftStickChange={(x, y) => game.setLeftJoystick(x, y)}
            onRightStickChange={(x, y, crankRadPerSec, active) =>
              game.setRightJoystick(x, y, crankRadPerSec, active)
            }
          />
        )}

        {/* Collapsible Unified Bottom Control Dock */}
        {!isOutcomeModalOpen && (
          <FishingBottomDock
            hud={hud}
            collapsed={dockCollapsed}
            onToggleCollapse={() => setDockCollapsed((c) => !c)}
            onToggleJoysticks={() => game.setVirtualJoysticks(!hud.virtualJoysticks)}
            onBeginCast={() => game.beginCastCharge()}
            onReleaseCast={() => game.releaseCastCharge()}
            onAimChange={(deg) => game.setAimAngle(deg)}
            onStrike={() => game.triggerStrike()}
            onReelStart={() => game.setReeling(true)}
            onReelStop={() => game.setReeling(false)}
            onCancelCast={() => game.cancelWaitingCast()}
            onAdjustDrag={(delta) => game.adjustReelDrag(delta)}
            onCameraPresetChange={(preset) => game.setCameraPreset(preset)}
          />
        )}
      </div>

      {/* Navigation Modals */}
      {activeModal === 'equipment' && (
        <EquipmentModal
          hud={hud}
          onBuyOrEquip={(cat, id) => game.buyOrEquipItem(cat, id)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'inventory' && (
        <InventoryModal
          hud={hud}
          onSellFish={(id) => game.sellFish(id)}
          onSellAll={() => game.sellAllFish()}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'stats' && (
        <StatsModal hud={hud} onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          hud={hud}
          onWeatherChange={(w) => game.setWeather(w)}
          onMuteToggle={(m) => game.setAudioMuted(m)}
          onVolumeChange={(v) => game.setAudioVolume(v)}
          onJoysticksToggle={(enabled) => game.setVirtualJoysticks(enabled)}
          onHapticsToggle={(enabled) => game.setHapticsEnabled(enabled)}
          onExportBackup={() => game.exportSaveBackup()}
          onResetSave={() => {
            void game.resetSaveData();
          }}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
};

export const RealisticFishingApp: React.FC<FishingBridgeProps> = (props) => {
  const { language } = props;
  useEffect(() => {
    // ซิงก์ภาษาจากฟาร์ม โดยไม่เขียนทับค่าภาษาที่บันทึกไว้ของโหมดตกปลา
    if (language) languageManager.setLanguage(language, false);
  }, [language]);

  return (
    <AppProvider>
      <GameViewportShell {...props} />
    </AppProvider>
  );
};

export const FishingApp = RealisticFishingApp;
export default RealisticFishingApp;
