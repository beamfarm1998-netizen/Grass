// src/components/3d/drone/DroneUI.tsx
// 🎨 UI Components ทั้งหมดของโดรน
import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { DroneMode, DroneAltitude, DroneTaskMode, DroneStats } from './types';
import { BATTERY_MAX } from './types';
import { formatTime } from './utils';

/* ═══════════════ StatRow ═══════════════ */
export const StatRow: React.FC<{
  icon: string; label: string; value: number | string;
}> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-cyan-300/80">{icon} {label}</span>
    <span className="font-bold text-cyan-100">{value}</span>
  </div>
);

/* ═══════════════ ModeButton ═══════════════ */
export const ModeButton: React.FC<{
  label: string; icon: string; active: boolean; onClick: () => void; highlight?: boolean;
}> = ({ label, icon, active, onClick, highlight }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow transition-all active:scale-95 ${
      active
        ? 'bg-cyan-500 text-white border-2 border-cyan-300 scale-105'
        : highlight
        ? 'bg-amber-600/90 text-amber-50 border border-amber-400/60 hover:bg-amber-500'
        : 'bg-stone-800/90 text-stone-200 border border-stone-600 hover:bg-stone-700'
    }`}
    title={label}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

/* ═══════════════ DroneHUD ═══════════════ */
export const DroneHUD: React.FC<{
  status: string;
  battery: number;
  currentAltitude: DroneAltitude;
  isNight: boolean;
  mode?: DroneMode;
  onClick?: () => void;
}> = ({ status, battery, currentAltitude, isNight, mode = 'AUTO', onClick }) => {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-4 right-3 sm:right-4 z-40 select-none safe-bottom safe-right">
      <button
        onClick={onClick}
        className="px-3.5 py-2 rounded-xl bg-cyan-950/95 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 text-xs sm:text-sm font-bold shadow-xl whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 cursor-pointer pointer-events-auto"
        title={t('กดเพื่อเปิดแผงควบคุมโดรน', 'Tap to open Drone Dashboard')}
      >
        <span>🚁</span>
        <span className="px-1.5 py-0.5 rounded-md bg-cyan-800/60 text-[10px] text-cyan-300 font-mono">[{mode}]</span>
        <span>{status}</span>
        <span className="text-cyan-400 text-[11px] font-mono">🔋{battery}/{BATTERY_MAX}</span>
        <span className="text-amber-300 text-[11px]">
          {currentAltitude === 'GROUND' ? '🚶' : currentAltitude === 'LOW' ? '🛬'
            : currentAltitude === 'NORMAL' ? '✈️' : '🚀'}
        </span>
        {isNight && <span className="text-yellow-300 text-[11px]">🔦</span>}
      </button>
    </div>
  );
};

/* ═══════════════ ModeButtonsGroup ═══════════════ */
export const ModeButtonsGroup: React.FC<{
  currentMode: DroneMode; onChange: (m: DroneMode) => void;
}> = ({ currentMode, onChange }) => {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-4 left-3 sm:left-4 z-40 flex flex-col gap-1.5 pointer-events-auto safe-bottom safe-left">
      <ModeButton label={t('อัตโนมัติ', 'Auto')} icon="🤖" active={currentMode === 'AUTO'} onClick={() => onChange('AUTO')} />
      <ModeButton label={t('ตามหลัง', 'Follow')} icon="👣" active={currentMode === 'FOLLOW'} onClick={() => onChange('FOLLOW')} />
      <ModeButton label={t('นำหน้า', 'Lead')} icon="⭐" active={currentMode === 'LEAD'} onClick={() => onChange('LEAD')} highlight />
      <ModeButton label={t('ตรวจการณ์', 'Patrol')} icon="🎯" active={currentMode === 'PATROL'} onClick={() => onChange('PATROL')} />
      <ModeButton label={t('ปิด', 'Off')} icon="⏹" active={false} onClick={() => onChange('OFF')} />
    </div>
  );
};

/* ═══════════════ AltitudeButtonsGroup ═══════════════ */
export const AltitudeButtonsGroup: React.FC<{
  currentAltitude: DroneAltitude; onChange: (a: DroneAltitude) => void;
}> = ({ currentAltitude, onChange }) => {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-4 left-[110px] sm:left-[120px] z-40 flex flex-col gap-1.5 pointer-events-auto safe-bottom">
      <ModeButton label={t('พื้น', 'Ground')} icon="🚶" active={currentAltitude === 'GROUND'} onClick={() => onChange('GROUND')} highlight />
      <ModeButton label={t('ต่ำ', 'Low')} icon="🛬" active={currentAltitude === 'LOW'} onClick={() => onChange('LOW')} />
      <ModeButton label={t('ปกติ', 'Normal')} icon="✈️" active={currentAltitude === 'NORMAL'} onClick={() => onChange('NORMAL')} />
      <ModeButton label={t('สูง', 'High')} icon="🚀" active={currentAltitude === 'HIGH'} onClick={() => onChange('HIGH')} />
    </div>
  );
};

/* ✅ NEW: TaskModeButton ═══════════════ */
const TaskModeButton: React.FC<{
  label: string; icon: string; active: boolean; onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow transition-all active:scale-95 whitespace-nowrap ${
      active
        ? 'bg-emerald-500 text-white border-2 border-emerald-300 scale-105'
        : 'bg-stone-800/90 text-stone-200 border border-stone-600 hover:bg-stone-700'
    }`}
    title={label}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

/* ✅ NEW: TaskModeButtonsGroup ═══════════════ */
export const TaskModeButtonsGroup: React.FC<{
  currentTask: DroneTaskMode;
  onChange: (t: DroneTaskMode) => void;
}> = ({ currentTask, onChange }) => {
  const { t } = useLanguage();
  return (
    <div className="fixed bottom-[4.5rem] right-3 sm:right-4 z-40 flex flex-col gap-1.5 pointer-events-auto safe-bottom safe-right">
      <div className="px-2 py-1 rounded-lg bg-emerald-950/95 border border-emerald-500/50 text-emerald-200 text-[10px] font-bold text-center shadow-lg">
        {t('งานโดรน', 'Task')}
      </div>
      <TaskModeButton
        label={t('อัตโนมัติ', 'All')}
        icon="🔄"
        active={currentTask === 'ALL'}
        onClick={() => onChange('ALL')}
      />
      <TaskModeButton
        label={t('เก็บเกี่ยว', 'Harvest')}
        icon="🌾"
        active={currentTask === 'HARVEST_ONLY'}
        onClick={() => onChange('HARVEST_ONLY')}
      />
      <TaskModeButton
        label={t('รดน้ำ', 'Water')}
        icon="💧"
        active={currentTask === 'WATER_ONLY'}
        onClick={() => onChange('WATER_ONLY')}
      />
      <TaskModeButton
        label={t('ปลูกพืช', 'Plant Crops')}
        icon="🌱"
        active={currentTask === 'PLANT_CROPS'}
        onClick={() => onChange('PLANT_CROPS')}
      />
      <TaskModeButton
        label={t('ปลูกต้นไม้', 'Plant Trees')}
        icon="🌳"
        active={currentTask === 'PLANT_TREES'}
        onClick={() => onChange('PLANT_TREES')}
      />
    </div>
  );
};

/* ═══════════════ DashboardToggleButtons ═══════════════ */
export const DashboardToggleButtons: React.FC<{
  onToggleDashboard: () => void; onToggleMiniMap: () => void;
}> = ({ onToggleDashboard, onToggleMiniMap }) => {
  const { t } = useLanguage();
  return (
    <>
      <button onClick={onToggleDashboard} className="fixed top-3 right-3 z-40 px-3 py-2 rounded-xl bg-cyan-950/95 border border-cyan-500/50 text-cyan-200 text-xs font-bold shadow-lg pointer-events-auto hover:bg-cyan-900">
        📊 {t('สถิติ', 'Stats')}
      </button>
      <button onClick={onToggleMiniMap} className="fixed top-3 right-[90px] z-40 px-3 py-2 rounded-xl bg-cyan-950/95 border border-cyan-500/50 text-cyan-200 text-xs font-bold shadow-lg pointer-events-auto hover:bg-cyan-900">
        🗺️ {t('แผนที่', 'Map')}
      </button>
    </>
  );
};

/* ═══════════════ MiniMapPanel ═══════════════ */
export const MiniMapPanel: React.FC<{
  canvasRef: React.RefObject<HTMLCanvasElement | null>; show: boolean;
}> = ({ canvasRef, show }) => {
  if (!show) return null;
  return (
    <div className="fixed top-16 right-3 z-40 pointer-events-none">
      <div className="rounded-xl border-2 border-cyan-500/50 shadow-2xl overflow-hidden bg-slate-950/85">
        <canvas ref={canvasRef} width={220} height={220} className="block" />
        <div className="px-2 py-1 bg-cyan-950/95 text-[9px] text-cyan-300 flex items-center gap-2">
          <span>🟦 โดรน</span><span>🟨 ผู้เล่น</span><span>🟥 เป้าหมาย</span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════ StatsDashboard ═══════════════ */
export const StatsDashboard: React.FC<{
  show: boolean; stats: DroneStats; onReset: () => void;
}> = ({ show, stats, onReset }) => {
  const { t } = useLanguage();
  if (!show) return null;
  return (
    <div className="fixed top-16 right-[250px] z-40 w-56 pointer-events-auto">
      <div className="rounded-xl border-2 border-cyan-500/50 shadow-2xl bg-slate-950/95 text-cyan-100 text-xs">
        <div className="px-3 py-2 bg-cyan-900/60 rounded-t-lg font-bold flex items-center justify-between">
          <span>📊 {t('สถิติโดรน', 'Drone Stats')}</span>
          <button onClick={onReset} className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/50 hover:bg-red-500" title={t('รีเซ็ต', 'Reset')}>↺</button>
        </div>
        <div className="p-3 space-y-1.5">
          <StatRow icon="🌾" label={t('เก็บเกี่ยว', 'Harvested')} value={stats.harvested} />
          <StatRow icon="💧" label={t('รดน้ำ', 'Watered')} value={stats.watered} />
          <StatRow icon="🌱" label={t('จัดแปลง', 'Replanted')} value={stats.replanted} />
          <StatRow icon="🌳" label={t('ปลูกต้นไม้', 'Trees planted')} value={stats.treesPlanted} />
          <div className="border-t border-cyan-700/40 my-1.5" />
          <StatRow icon="✅" label={t('งานสำเร็จ', 'Jobs done')} value={stats.jobsCompleted} />
          <StatRow icon="📏" label={t('ระยะบิน', 'Distance')} value={`${Math.floor(stats.totalDistance)}m`} />
          <StatRow icon="⏱️" label={t('เวลาบิน', 'Flight time')} value={formatTime(stats.flightTime)} />
        </div>
      </div>
    </div>
  );
};