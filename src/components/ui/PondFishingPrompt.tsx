// src/components/ui/PondFishingPrompt.tsx
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface PondFishingPromptProps {
  /** true เมื่อผู้เล่นยืนใกล้สระและไม่มีเมนู/โมดอลอื่นเปิดอยู่ */
  visible: boolean;
  onOpen: () => void;
}

/**
 * ปุ่มโต้ตอบที่ลอยขึ้นมาเมื่อผู้เล่นเดินเข้าใกล้บ่อน้ำ → กดเพื่อเข้าโหมดตกปลา
 * (ตำแหน่งเดียวกับปุ่มของสิ่งปลูกสร้าง จึงไม่ซ้อนกัน — ถ้ามีสิ่งปลูกสร้างใกล้ ๆ จะซ่อนปุ่มนี้)
 */
export const PondFishingPrompt: React.FC<PondFishingPromptProps> = ({ visible, onOpen }) => {
  const { t } = useLanguage();
  if (!visible) return null;

  return (
    <div
      data-ui
      className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw] safe-bottom"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-2 bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-stone-950 font-black px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border-2 border-sky-200 shadow-2xl text-xs sm:text-sm transition-all active:scale-95"
      >
        <span className="text-base">🎣</span>
        <span>{t('ตกปลาที่บ่อน้ำ', 'Fish at the Pond')}</span>
      </button>
    </div>
  );
};
