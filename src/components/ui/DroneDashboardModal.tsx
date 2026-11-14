// src/components/ui/DroneDashboardModal.tsx
// 🚁 หน้าต่างควบคุมและแดชบอร์ดศูนย์บัญชาการโดรน 3 แท็บ
import React, { useState } from 'react';
import { X, BatteryCharging, Radio, Compass, BarChart3, BookOpen, RotateCcw, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { DroneMode, DroneAltitude, DroneTaskMode, DroneStats } from '../../types/drone';
import { DRONE_MODE_CONFIG } from '../../types/drone';

interface DroneDashboardModalProps {
  show: boolean;
  onClose: () => void;
  currentMode: DroneMode;
  onModeChange: (m: DroneMode) => void;
  currentAltitude: DroneAltitude;
  onAltitudeChange: (a: DroneAltitude) => void;
  currentTaskMode?: DroneTaskMode;
  onTaskModeChange?: (t: DroneTaskMode) => void;
  battery: number;
  batteryMax?: number;
  onReturnToBase: () => void;
  stats: DroneStats;
  onResetStats: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  radarEnabled: boolean;
  onToggleRadar: () => void;
}

export const DroneDashboardModal: React.FC<DroneDashboardModalProps> = ({
  show,
  onClose,
  currentMode,
  onModeChange,
  currentAltitude,
  onAltitudeChange,
  currentTaskMode = 'ALL',
  onTaskModeChange,
  battery,
  batteryMax = DRONE_MODE_CONFIG.batteryMax,
  onReturnToBase,
  stats,
  onResetStats,
  voiceEnabled,
  onToggleVoice,
  radarEnabled,
  onToggleRadar,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'controls' | 'stats' | 'manual'>('controls');

  if (!show) return null;

  const batteryPercent = Math.round((battery / batteryMax) * 100);
  const batteryColor =
    batteryPercent > 50
      ? 'from-emerald-500 to-green-400'
      : batteryPercent > 20
      ? 'from-amber-500 to-yellow-400'
      : 'from-red-600 to-rose-400 animate-pulse';

  const modes: { id: DroneMode; icon: string; nameTh: string; nameEn: string; descTh: string; descEn: string }[] = [
    { id: 'AUTO', icon: '🤖', nameTh: 'อัตโนมัติ (AUTO)', nameEn: 'Auto-Farm', descTh: 'สแกนเก็บเกี่ยว รดน้ำ หว่านเมล็ด ปลูกต้นไม้', descEn: 'Harvest, water, replant, plant trees' },
    { id: 'FOLLOW', icon: '👣', nameTh: 'ตามหลัง (FOLLOW)', nameEn: 'Follow Player', descTh: 'บินตามผู้เล่นระยะ 2.2m ไม่แย่งงาน', descEn: 'Follow behind player at 2.2m' },
    { id: 'LEAD', icon: '⭐', nameTh: 'นำหน้า (LEAD)', nameEn: 'Lead Scout', descTh: 'บินนำหน้าผู้เล่นระยะ 2.5m เปิดทาง', descEn: 'Scout ahead of player at 2.5m' },
    { id: 'PATROL', icon: '🎯', nameTh: 'ตรวจการณ์ (PATROL)', nameEn: 'Patrol Orbit', descTh: 'บินวนรอบฟาร์ม รัศมี 14m รักษาความปลอดภัย', descEn: 'Circle farm orbit radius 14m' },
    { id: 'OFF', icon: '⏹', nameTh: 'พักเครื่อง (OFF)', nameEn: 'Off / Dock', descTh: 'บินกลับแท่นชาร์จ ดับเครื่อง และชาร์จไฟ', descEn: 'Dock at helipad & standby' },
  ];

  const altitudes: { id: DroneAltitude; icon: string; nameTh: string; nameEn: string; height: string }[] = [
    { id: 'GROUND', icon: '🚶', nameTh: 'เรี่ยพื้น', nameEn: 'Ground', height: '0.75m' },
    { id: 'LOW', icon: '🛬', nameTh: 'ระดับต่ำ', nameEn: 'Low', height: '2.0m' },
    { id: 'NORMAL', icon: '✈️', nameTh: 'ระดับกลาง', nameEn: 'Normal', height: '4.0m' },
    { id: 'HIGH', icon: '🚀', nameTh: 'ระดับสูง', nameEn: 'High', height: '8.0m' },
  ];

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/80 backdrop-blur-md safe-inset">
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-950 border-2 border-cyan-500/40 shadow-2xl overflow-hidden text-cyan-100">
        
        {/* Header with Title & Battery */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 border-b border-cyan-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🚁</span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-cyan-200">
                  {t('ศูนย์บัญชาการโดรนอัจฉริยะ v3', 'Smart Drone Command Hub v3')}
                </h2>
                <p className="text-[11px] text-cyan-400/70">
                  Autonomous Agricultural Flight System
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Battery Status Bar */}
          <div className="flex items-center gap-3 bg-slate-900/90 p-2.5 rounded-2xl border border-cyan-500/30">
            <BatteryCharging className={`w-5 h-5 shrink-0 ${batteryPercent < 20 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
            <div className="flex-1">
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-cyan-300">{t('ระดับพลังงานแบตเตอรี่', 'Battery Status')}</span>
                <span className="font-mono">{batteryPercent}% ({battery}/{batteryMax})</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${batteryColor} transition-all duration-300`}
                  style={{ width: `${batteryPercent}%` }}
                />
              </div>
            </div>
            <button
              onClick={onReturnToBase}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white text-xs font-bold whitespace-nowrap shadow-md transition"
            >
              {t('กลับฐานชาร์จ', 'Return to Base')}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-cyan-500/20 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'controls'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{t('โหมด & ความสูง', 'Mode & Alt')}</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'stats'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{t('สถิติปฏิบัติการ', 'Flight Stats')}</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === 'manual'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{t('คู่มือ & ข้อจำกัด', 'Manual & Limits')}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: CONTROLS & ALTITUDE */}
          {activeTab === 'controls' && (
            <div className="space-y-4">
              {/* Flight Modes */}
              <div>
                <label className="block text-xs font-bold text-cyan-300 mb-2">
                  1. {t('เลือกโหมดการบิน (Flight Mode)', 'Select Flight Mode')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {modes.map((m) => {
                    const isActive = currentMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => onModeChange(m.id)}
                        className={`p-3 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                          isActive
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400'
                            : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-850 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{m.icon}</span>
                          <span className="text-xs sm:text-sm font-bold">{t(m.nameTh, m.nameEn)}</span>
                        </div>
                        <p className="text-[10px] text-cyan-300/70">{t(m.descTh, m.descEn)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Altitudes */}
              <div>
                <label className="block text-xs font-bold text-cyan-300 mb-2">
                  2. {t('เลือกระดับความสูง (Flight Altitude)', 'Select Flight Altitude')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {altitudes.map((a) => {
                    const isActive = currentAltitude === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => onAltitudeChange(a.id)}
                        className={`p-3 rounded-2xl border text-center transition-all active:scale-[0.98] ${
                          isActive
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                            : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-850 text-slate-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{a.icon}</div>
                        <div className="text-xs font-bold">{t(a.nameTh, a.nameEn)}</div>
                        <div className="text-[10px] text-amber-400/80 mt-0.5">{a.height}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles: Voice & Minimap */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={onToggleVoice}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    voiceEnabled
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span>{voiceEnabled ? t('เสียงตอบกลับ: เปิด', 'Voice TTS: ON') : t('เสียงตอบกลับ: ปิด', 'Voice TTS: OFF')}</span>
                </button>

                <button
                  onClick={onToggleRadar}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    radarEnabled
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {radarEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span>{radarEnabled ? t('เรดาร์มินิแมพ: แสดง', 'Radar Minimap: ON') : t('เรดาร์มินิแมพ: ซ่อน', 'Radar Minimap: OFF')}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FLIGHT STATS */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300">{t('สถิติสะสมของโดรน', 'Cumulative Drone Performance')}</span>
                <button
                  onClick={onResetStats}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('รีเซ็ตสถิติ', 'Reset Stats')}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20">
                  <div className="text-lg">🌾</div>
                  <div className="text-base sm:text-lg font-black text-white mt-1">{stats.harvested}</div>
                  <div className="text-[10px] text-cyan-300/70">{t('เก็บเกี่ยวพืชผล', 'Crops Harvested')}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20">
                  <div className="text-lg">💧</div>
                  <div className="text-base sm:text-lg font-black text-white mt-1">{stats.watered}</div>
                  <div className="text-[10px] text-cyan-300/70">{t('รดน้ำแปลงดิน', 'Plots Watered')}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20">
                  <div className="text-lg">🌱</div>
                  <div className="text-base sm:text-lg font-black text-white mt-1">{stats.replanted}</div>
                  <div className="text-[10px] text-cyan-300/70">{t('หว่านเมล็ดพืช', 'Seeds Replanted')}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20">
                  <div className="text-lg">🌳</div>
                  <div className="text-base sm:text-lg font-black text-white mt-1">{stats.treesPlanted}</div>
                  <div className="text-[10px] text-cyan-300/70">{t('ปลูกต้นไม้ใหม่', 'Trees Planted')}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20">
                  <div className="text-lg">📏</div>
                  <div className="text-base sm:text-lg font-black text-white mt-1">
                    {stats.totalDistance >= 1000
                      ? `${(stats.totalDistance / 1000).toFixed(2)} km`
                      : `${Math.floor(stats.totalDistance)} m`}
                  </div>
                  <div className="text-[10px] text-cyan-300/70">{t('ระยะทางบินรวม', 'Total Distance')}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/20">
                  <div className="text-lg">⏱️</div>
                  <div className="text-base sm:text-lg font-black text-white mt-1">{formatSecs(stats.flightTime)}</div>
                  <div className="text-[10px] text-cyan-300/70">{t('เวลาบินสะสม', 'Total Flight Time')}</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs flex items-center justify-between">
                <span>{t('ภารกิจเสร็จสมบูรณ์ทั้งหมด', 'Total Completed Jobs')}:</span>
                <span className="font-mono font-bold text-cyan-200 text-sm">{stats.jobsCompleted} {t('งาน', 'jobs')}</span>
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL & LIMITS */}
          {activeTab === 'manual' && (
            <div className="space-y-4 text-xs">
              {/* What Drone CAN Do */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
                <div className="font-bold text-emerald-300 text-sm flex items-center gap-1.5">
                  <span>✅</span>
                  <span>{t('งานที่โดรนทำได้ในโหมด AUTO', 'Tasks Drone Performs in AUTO Mode')}</span>
                </div>
                <ul className="space-y-1.5 text-emerald-100/90 pl-1">
                  <li>• <strong>{t('เก็บเกี่ยวพืชผลและผลไม้', 'Harvest Crops & Fruits')}</strong>: สแกนแปลงผักที่สุก (READY) และต้นไม้ที่มีผลสุก</li>
                  <li>• <strong>{t('รดน้ำแปลงดิน', 'Water Soil')}</strong>: รดน้ำแปลงผักที่แห้งแล้งเพื่อเร่งการเจริญเติบโต x2</li>
                  <li>• <strong>{t('ไถพรวนและหว่านเมล็ดใหม่', 'Till & Replant')}</strong>: หว่านเมล็ดผักลงในแปลงว่างอัตโนมัติตามเมล็ดที่เลือก</li>
                  <li>• <strong>{t('ปลูกต้นไม้ทดแทน', 'Plant Tree Saplings')}</strong>: นำต้นกล้าผลไม้หรือต้นไม้ซุงไปปลูกในจุดว่างที่เหมาะสม</li>
                  <li>• <strong>{t('หลบสิ่งกีดขวาง & สปอตไลต์กลางคืน', 'Obstacle Avoidance & Night Spotlight')}</strong>: ยกเพดานบินข้ามบ้านพัก และเปิดโคมไฟส่องสว่างเมื่อค่ำ</li>
                </ul>
              </div>

              {/* What Drone CANNOT Do */}
              <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-2">
                <div className="font-bold text-rose-300 text-sm flex items-center gap-1.5">
                  <span>🚫</span>
                  <span>{t('รายการสิ่งที่โดรน "ยังทำไม่ได้" (ต้องทำด้วยตัวเอง)', 'Tasks Drone CANNOT Do (Manual Action Required)')}</span>
                </div>
                <ol className="space-y-1.5 text-rose-100/90 list-decimal list-inside pl-1">
                  <li><strong>{t('ตัดต้นไม้ / โค่นต้นไม้', 'Chop / Fell Trees')}</strong> — ต้องใช้ขวานตัดด้วยตนเองเพื่อเก็บซุงไม้</li>
                  <li><strong>{t('ให้อาหารสัตว์ / เก็บไข่เป็ด', 'Feed Animals / Collect Duck Eggs')}</strong> — ต้องเดินไปดูแลสัตว์และเก็บไข่สดที่เล้า</li>
                  <li><strong>{t('ผลิตของในโรงงาน', 'Factory Production')}</strong> — การต้มเบียร์, อบขนมปัง, หรือโม่ผสมอาหารสัตว์ต้องตั้งคิวด้วยตัวเอง</li>
                  <li><strong>{t('ตกปลาที่สระน้ำ', 'Pond Fishing')}</strong> — มินิเกมตกปลา 3D ผู้เล่นต้องเหวี่ยงคันเบ็ดและสู้ปลาด้วยตัวเอง</li>
                  <li><strong>{t('ขุดหิน / เก็บแร่', 'Mine Rocks / Mineral Ore')}</strong> — หินและแร่ธาตุต้องใช้เสียมขุดด้วยตนเอง</li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/80 border-t border-cyan-500/20 text-center text-[11px] text-cyan-400/60">
          Beam Farm 3D • Smart Agricultural Drone Firmware v3.0
        </div>

      </div>
    </div>
  );
};
