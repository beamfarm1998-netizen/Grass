/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { FarmWorld } from './components/FarmWorld';
import { wipeAllFarmSaveData, resumeSavePersistence } from './utils/saveReset';
import {
  flushAllPendingFarmSaves,
  markFarmBootCompleted,
  recoverFarmSaveFromIdbIfEmpty,
  resetOfflineElapsedCache,
} from './utils/farmAutoSave';
import { LanguageProvider } from './i18n/LanguageContext';

declare global {
  interface Window {
    __BEAM_FARM_RUNNING__?: boolean;
  }
}

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  private handleClearCacheAndReload = async () => {
    try {
      flushAllPendingFarmSaves();
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#120c09] text-stone-100 p-6 text-center">
          <div className="max-w-md w-full rounded-2xl border border-amber-500/40 bg-stone-900/95 p-6 shadow-2xl space-y-4">
            <h1 className="text-xl font-black text-amber-300">
              เกิดข้อผิดพลาดขณะโหลดเกม
            </h1>
            <p className="text-xs text-stone-300 break-words font-mono bg-black/40 p-3 rounded-xl border border-stone-800">
              {this.state.error.message || 'Unknown runtime error'}
            </p>
            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors cursor-pointer"
            >
              ล้างแคชและเข้าเกมใหม่
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [gameSessionKey, setGameSessionKey] = useState(0);
  const [isFreshReset, setIsFreshReset] = useState(false);
  const [isBootReady, setIsBootReady] = useState(false);

  const handleResetGameSession = useCallback(() => {
    wipeAllFarmSaveData();
    resetOfflineElapsedCache();
    setIsFreshReset(true);
    setGameSessionKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let settled = false;
    const finishBoot = () => {
      if (settled) return;
      settled = true;
      markFarmBootCompleted();
      window.__BEAM_FARM_RUNNING__ = true;
      setIsBootReady(true);
    };

    const safetyTimer = window.setTimeout(finishBoot, 700);
    void recoverFarmSaveFromIdbIfEmpty().finally(() => {
      window.clearTimeout(safetyTimer);
      finishBoot();
    });

    return () => {
      window.clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (!isBootReady) return;
    resumeSavePersistence();
    if (gameSessionKey > 0) {
      flushAllPendingFarmSaves();
    }
  }, [gameSessionKey, isBootReady]);

  if (!isBootReady) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#120c09] text-amber-200 gap-2.5 select-none">
        <div className="text-[22px] font-extrabold tracking-wider">BEAM FARM 3D</div>
        <div className="text-[13px] text-stone-400">กำลังโหลดโลกฟาร์ม 3 มิติ...</div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <LanguageProvider>
        <FarmWorld
          key={gameSessionKey}
          isFreshReset={isFreshReset}
          onResetGameSession={handleResetGameSession}
        />
      </LanguageProvider>
    </AppErrorBoundary>
  );
}