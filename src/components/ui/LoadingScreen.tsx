// src/components/ui/LoadingScreen.tsx
import React, { useState, useEffect } from 'react';
import { Sparkles, Sprout, CheckCircle2 } from 'lucide-react';
import { farmAudio } from '../../utils/audio';
import { useLanguage } from '../../i18n/LanguageContext';

interface LoadingScreenProps {
  isOpen: boolean;
  onFinish: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ isOpen, onFinish }) => {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  const tips = [
    t(
      'กำลังสร้างภูมิประเทศและเกาะฟาร์ม 3 มิติ...',
      'Generating 3D farm island terrain...'
    ),
    t(
      'เตรียมความพร้อมสัตว์เลี้ยง ไก่ หมู วัว แพะ หมา แมว...',
      'Preparing chickens, cows, sheep, dogs & cats...'
    ),
    t(
      'คำนวณวงแหวนต้นไม้และระบบกริดผืนดิน...',
      'Initializing orchard trees & soil grid...'
    ),
    t(
      'กำลังจัดระบบเศรษฐกิจและร้านค้าชนบท...',
      'Setting up farm market & offline cache...'
    ),
    t(
      'โหลดเสร็จสมบูรณ์ 100% พร้อมเข้าสู่ฟาร์ม!',
      '100% Ready — Welcome to Beam Farm 3D!'
    ),
  ];

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setTipIndex(0);
      return;
    }

    farmAudio.playLevelUpSound();

    let cur = 0;
    const interval = setInterval(() => {
      cur += Math.floor(Math.random() * 8) + 4;
      if (cur >= 100) {
        cur = 100;
        setProgress(100);
        setTipIndex(4);
        clearInterval(interval);
        farmAudio.playCoinSound();
        setTimeout(() => {
          onFinish();
        }, 1100);
      } else {
        setProgress(cur);
        if (cur > 75) setTipIndex(3);
        else if (cur > 50) setTipIndex(2);
        else if (cur > 25) setTipIndex(1);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isOpen, onFinish]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#120c09] text-stone-100 select-none animate-fade-in">
      <div className="absolute inset-0 bg-radial from-amber-600/15 via-transparent to-black pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-md w-full">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-700 p-0.5 shadow-2xl mb-5 overflow-hidden">
          <img
            src="/pwa-192x192.png"
            alt="Beam Farm 3D"
            className="w-full h-full rounded-[22px] object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="w-full h-full bg-[#1e130e] rounded-[22px] flex items-center justify-center text-amber-400">
            <Sprout className="w-10 h-10" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-amber-200 tracking-wider drop-shadow-md">
          BEAM FARM 3D
        </h1>
        <p className="text-xs font-mono text-amber-500/90 tracking-widest mt-1 mb-8">
          Web • PWA • Android APK • Offline Ready
        </p>

        <div className="w-full bg-[#2a1a12] border-2 border-[#543b27] rounded-full p-1.5 shadow-inner mb-3">
          <div
            className="h-4 bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 rounded-full transition-all duration-150 relative overflow-hidden"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 w-full text-xs font-mono px-1 mb-3">
          <span className="text-stone-400 flex items-center gap-1.5 min-w-0">
            {progress === 100 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
            )}
            <span className="truncate">{tips[tipIndex]}</span>
          </span>
          <span className="font-bold text-amber-300 text-sm shrink-0">{progress}%</span>
        </div>

        {progress === 100 && (
          <button
            onClick={onFinish}
            className="mt-4 min-h-[42px] px-6 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm shadow-xl transition-all active:scale-95 animate-fade-in"
          >
            {t('เข้าสู่ฟาร์มทันที ✨', 'Enter Your Farm ✨')}
          </button>
        )}
      </div>

      <div className="absolute bottom-6 text-center text-[11px] text-stone-500 font-mono safe-bottom px-4">
        {t(
          'Beam Farm 3D • รองรับคอมพิวเตอร์ มือถือ และออฟไลน์',
          'Beam Farm 3D • Desktop, Mobile & Offline Ready'
        )}
      </div>
    </div>
  );
};
