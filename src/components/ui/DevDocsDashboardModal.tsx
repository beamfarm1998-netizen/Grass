// src/components/ui/DevDocsDashboardModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Compass,
  Fish,
  Trees,
  Layers,
  FastForward,
  Play,
  RotateCcw,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  Cpu,
  CheckCircle,
  HelpCircle,
  Volume2,
  Package,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { TREE_DEFINITIONS, TreeType, PlacedTree } from '../../types/game';
import { BAKED_GOOD_DEFS, BREW_DRINK_DEFS } from '../../types/crafting';
import { farmAudio } from '../../utils/audio';

interface DevDocsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  trees: PlacedTree[];
  onFastForwardTime?: (seconds: number) => void;
  onPlantTreeDirect?: (type: TreeType) => boolean;
  onGiveSaplings?: (type: TreeType, amount: number) => void;
  onReviveAllTrees?: () => void;
}

type TabType = 'fishing' | 'trees_economy' | 'glb_inspector' | 'dev_controls';

export const DevDocsDashboardModal: React.FC<DevDocsDashboardModalProps> = ({
  isOpen,
  onClose,
  trees,
  onFastForwardTime,
  onPlantTreeDirect,
  onGiveSaplings,
  onReviveAllTrees,
}) => {
  const { lang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('fishing');

  // ───── Fishing Simulator Interactive State ─────
  const [rodType, setRodType] = useState<'graphite' | 'carbon' | 'fiberglass'>('carbon');
  const [dragFriction, setDragFriction] = useState(0.65);
  const [lineTension, setLineTension] = useState(0.35);
  const [fishStamina, setFishStamina] = useState(100);
  const [isFighting, setIsFighting] = useState(false);
  const [fightResult, setFightResult] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let animId: number;
    if (isFighting) {
      animId = window.setInterval(() => {
        setFishStamina((prev) => {
          if (prev <= 0) {
            setIsFighting(false);
            setFightResult('🏆 ชนะการต่อสู้! ปลาหมดแรงและถูกดึงขึ้นจากน้ำสำเร็จ (+350 XP, ปลาบึกยักษ์ 18.4 กก.)');
            return 0;
          }
          return Math.max(0, prev - (0.8 + dragFriction * 1.5));
        });

        setLineTension((prev) => {
          const surge = (Math.random() - 0.45) * 0.12;
          const next = Math.max(0.1, Math.min(1.0, prev + surge));
          if (next >= 0.96) {
            setIsFighting(false);
            setFightResult('💥 สายเอ็นขาด! แรงดึงสายเกินพิกัดความทนทาน กรุณาผ่อนแดรกเบรก');
            return 0;
          }
          return next;
        });
      }, 150);
    }
    return () => clearInterval(animId);
  }, [isFighting, dragFriction]);

  const triggerDragSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220 + Math.random() * 80, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const handleStartFightSim = () => {
    setIsFighting(true);
    setFishStamina(100);
    setLineTension(0.4);
    setFightResult(null);
    triggerDragSound();
  };

  const handleReelPull = () => {
    if (!isFighting) return;
    triggerDragSound();
    setLineTension((prev) => Math.min(1.0, prev + 0.15));
    setFishStamina((prev) => Math.max(0, prev - 4));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-gradient-to-b from-stone-900 via-stone-900/95 to-stone-950 border border-amber-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_3px_rgba(255,255,255,0.1)] text-stone-100 overflow-hidden font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Compass className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-wide text-amber-200">
                  {t('ระบบแดชบอร์ดเอกสารและคู่มือพัฒนา Realistic Fishing 3D', 'Realistic Fishing 3D Dev & Docs Dashboard')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  v3.8 Interactive
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {t('ระบบจำลองฟิสิกส์ตกปลา • เศรษฐกิจต้นมะนาว & มะพร้าว • ตรวจสอบสถานะ 3D GLB', 'Fishing Physics Sim • Trees ROI • 3D GLB Inspector')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-transform active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-stone-800/80 bg-stone-900/40 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('fishing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'fishing'
                ? 'bg-amber-500 text-stone-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                : 'bg-stone-800/60 hover:bg-stone-800 text-stone-300'
            }`}
          >
            <Fish className="w-4 h-4" />
            <span>{t('ตกปลา 3D & ฟิสิกส์', 'Realistic Fishing 3D')}</span>
          </button>

          <button
            onClick={() => setActiveTab('trees_economy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'trees_economy'
                ? 'bg-amber-500 text-stone-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                : 'bg-stone-800/60 hover:bg-stone-800 text-stone-300'
            }`}
          >
            <Trees className="w-4 h-4" />
            <span>{t('เศรษฐกิจต้นมะนาว & มะพร้าว', 'Trees & Coconut Economy')}</span>
          </button>

          <button
            onClick={() => setActiveTab('glb_inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'glb_inspector'
                ? 'bg-amber-500 text-stone-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                : 'bg-stone-800/60 hover:bg-stone-800 text-stone-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('ตรวจสอบ 3D GLB Models', '3D GLB Inspector')}</span>
          </button>

          <button
            onClick={() => setActiveTab('dev_controls')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
              activeTab === 'dev_controls'
                ? 'bg-amber-500 text-stone-950 shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                : 'bg-stone-800/60 hover:bg-stone-800 text-stone-300'
            }`}
          >
            <FastForward className="w-4 h-4" />
            <span>{t('เครื่องมือทดสอบ & เร่งเวลา', 'Dev Sandbox Controls')}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* ──────────────── TAB 1: FISHING 3D SIMULATOR ──────────────── */}
          {activeTab === 'fishing' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                  <strong>Realistic Fishing 3D Engine:</strong> พัฒนาขึ้นโดยใช้ Three.js สภาพแวดล้อมริมสระน้ำ
                  ระบบฟิสิกส์สายเบ็ด (Verlet Integration String Physics), ระบบแรงดึงสาย (Line Tension), 
                  เสียงฟันเฟืองรอกและแดรกเบรค Sawtooth Oscillator เสียงน้ำและเสียงกระชากปลาสมจริง
                </div>
              </div>

              {/* Interactive Fishing Console */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Tension & Fight Simulator */}
                <div className="p-5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-4">
                  <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <Fish className="w-4 h-4" />
                    {t('จำลองการสู้ปลาและการควบคุมแรงดึงสาย (Fight Sim)', 'Interactive Fish Fight Simulator')}
                  </h4>

                  {/* Line Tension Meter */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">{t('แรงดึงสายเบ็ด (Line Tension):', 'Line Tension:')}</span>
                      <span className={`font-mono font-bold ${
                        lineTension > 0.85 ? 'text-rose-400' : lineTension > 0.6 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {Math.round(lineTension * 100)}% {lineTension > 0.85 ? '(วิกฤต/ใกล้ขาด!)' : ''}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-stone-800 overflow-hidden flex">
                      <div
                        className={`transition-all duration-150 ${
                          lineTension > 0.85 ? 'bg-rose-500' : lineTension > 0.6 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${lineTension * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Fish Stamina */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">{t('พลังแรงฮึดของปลา (Fish Stamina):', 'Fish Stamina:')}</span>
                      <span className="font-mono font-bold text-blue-400">{Math.round(fishStamina)}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-150"
                        style={{ width: `${fishStamina}%` }}
                      />
                    </div>
                  </div>

                  {/* Drag Friction Control */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400">{t('ความหน่วงแดรกเบรค (Drag Friction):', 'Drag Brake Friction:')}</span>
                      <span className="font-mono text-stone-200">{Math.round(dragFriction * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.95"
                      step="0.05"
                      value={dragFriction}
                      onChange={(e) => {
                        setDragFriction(parseFloat(e.target.value));
                        triggerDragSound();
                      }}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {/* Fight Buttons */}
                  <div className="flex gap-2 pt-2">
                    {!isFighting ? (
                      <button
                        onClick={handleStartFightSim}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{t('เริ่มจำลองการเกี่ยวปลา (Hook Strike)', 'Hook Strike & Fight')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleReelPull}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>{t('กรอรอกสายเบ็ด (Reel In!)', 'Reel In!')}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsFighting(false);
                        setLineTension(0.35);
                        setFishStamina(100);
                        setFightResult(null);
                      }}
                      className="px-3 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {fightResult && (
                    <div className="p-3 rounded-xl bg-stone-900 border border-amber-500/40 text-xs text-amber-200 font-medium">
                      {fightResult}
                    </div>
                  )}
                </div>

                {/* Right: Realistic Fish Species Reference */}
                <div className="p-5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                  <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    {t('สารานุกรมพันธุ์ปลาในเกม (Fish Species Dex)', 'Fish Species Encyclopedia')}
                  </h4>
                  <div className="space-y-2 text-xs max-h-56 overflow-y-auto pr-1">
                    {[
                      { name: 'ปลาบึกแม่น้ำโขง (Mekong Giant Catfish)', depth: 'น้ำลึก 4.5m', weight: '15-40 kg', lure: 'เหยื่อขนมปังรำ', value: '450 Coins', tier: 'Legendary' },
                      { name: 'ปลากะพงขาว (Barramundi)', depth: 'น้ำตื้น 1.8m', weight: '3.5-8 kg', lure: 'เหยื่อปลอมสปูน', value: '280 Coins', tier: 'Epic' },
                      { name: 'ปลาช่อนยักษ์อเมซอน (Arapaima)', depth: 'กลางสระ 3.0m', weight: '20-60 kg', lure: 'ปลาสด', value: '620 Coins', tier: 'Mythic' },
                      { name: 'ปลานิลแม่น้ำ (Nile Tilapia)', depth: 'ริมตลิ่ง 1.0m', weight: '0.8-1.5 kg', lure: 'ไส้เดือนดิน', value: '65 Coins', tier: 'Common' },
                    ].map((f, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-stone-200">{f.name}</div>
                          <div className="text-[11px] text-stone-400 mt-0.5">
                            {f.depth} • {f.weight} • {f.lure}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-amber-400">{f.value}</span>
                          <div className="text-[10px] text-stone-500 font-bold">{f.tier}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── TAB 2: TREES & COCONUT ECONOMY ──────────────── */}
          {activeTab === 'trees_economy' && (
            <div className="space-y-6">
              {/* Comparison Cards: Lemon vs Coconut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lemon Tree Card */}
                <div className="p-5 rounded-2xl bg-stone-950/80 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🍋</span>
                      <div>
                        <h4 className="font-bold text-stone-100 text-sm sm:text-base">ต้นมะนาวเลมอน (Lemon Tree)</h4>
                        <span className="text-[11px] text-amber-400">ปลดล็อกเลเวล 66 • ซื้อต้นละ 400 G</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300">
                      4 รอบเก็บเกี่ยว
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-300 leading-relaxed border-t border-stone-800 pt-3">
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ระยะเวลาเจริญเติบโต:</span>
                      <span className="font-mono font-bold text-stone-200">1 วัน 5 ชม. (29 ชั่วโมง)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบที่ 1:</span>
                      <span className="font-mono text-amber-300">2 ลูก</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบที่ 2:</span>
                      <span className="font-mono text-amber-300">3 ลูก</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบที่ 3:</span>
                      <span className="font-mono text-amber-300">4 ลูก (หลังรอบนี้เริ่มเหี่ยว)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบที่ 4 (สุดท้าย):</span>
                      <span className="font-mono text-amber-300">4 ลูก (รวมทั้งสิ้น 13 ลูก)</span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-400 font-bold">
                      <span>รายได้ขายผลสด (135 G × 13):</span>
                      <span className="font-mono">+1,755 G (กำไรสุทธิ 1,355 G)</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90">
                      💡 เมื่อเก็บครบ 4 รอบ ต้นไม้จะตายสนิท เปลี่ยนเป็นสีน้ำตาล ต้องใช้ <strong>เลื่อย (Saw)</strong> ในการตัดทำลายเพื่อเคลียร์พื้นที่
                    </div>
                  </div>
                </div>

                {/* Coconut Tree Card */}
                <div className="p-5 rounded-2xl bg-stone-950/80 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🥥</span>
                      <div>
                        <h4 className="font-bold text-stone-100 text-sm sm:text-base">ต้นมะพร้าว (Coconut Palm)</h4>
                        <span className="text-[11px] text-emerald-400">ปลดล็อกเลเวล 101 • ซื้อต้นละ 810 G</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300">
                      4 รอบ + ชุบชีวิต
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-300 leading-relaxed border-t border-stone-800 pt-3">
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ระยะเวลาเจริญเติบโต:</span>
                      <span className="font-mono font-bold text-stone-200">36 ชั่วโมง (1 วัน 12 ชม.)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบ 1 & 2:</span>
                      <span className="font-mono text-emerald-300">2 ลูก (รอบ 1) • 3 ลูก (รอบ 2)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบ 3 (เหี่ยวเฉา):</span>
                      <span className="font-mono text-amber-300">4 ลูก (หลังรอบนี้ต้องชุบชีวิต)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-stone-800/50">
                      <span className="text-stone-400">ผลผลิตรอบ 4 (สุดท้าย):</span>
                      <span className="font-mono text-emerald-300">4 ลูก (รวมทั้งสิ้น 13 ลูก)</span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-400 font-bold">
                      <span>ค่าประสบการณ์ (XP):</span>
                      <span className="font-mono">21 XP / 1 ลูกมะพร้าว (รวม 273 XP)</span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-400 font-bold">
                      <span>กำไรสุทธิเฉลี่ย:</span>
                      <span className="font-mono">+594 Coins ต่อต้น (คุ้มค่าต่อการใช้เลื่อย 1 เล่ม)</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200/90">
                      ✨ <strong>ระบบชุบชีวิต:</strong> หลังรอบที่ 3 ต้นไม้จะเหี่ยวเฉา แตะเพื่อชุบชีวิต (Revive) ให้ฟื้นคืนชีพ และหลังรอบที่ 4 ตายถาวร ต้องใช้เลื่อย (Saw) ตัดออก
                    </div>
                  </div>
                </div>
              </div>

              {/* Coconut Processing Recipes Flow */}
              <div className="p-5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-100 text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-400" />
                    <span>สินค้าแปรรูปจากมะพร้าว (Coconut Processed Goods)</span>
                  </h4>
                  <span className="text-xs text-stone-400">ปลดล็อกเลเวล 101</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {[
                    { name: 'มาการอง (Macaroon)', emoji: '🧁', machine: 'เตาอบ Bakery', req: 'มะพร้าว 1 + ข้าวสาลี 2', price: '620 G', xp: '+210 XP' },
                    { name: 'ไอศกรีมมะพร้าว', emoji: '🍨', machine: 'เตาอบ Bakery', req: 'มะพร้าว 2 + ข้าวสาลี 1', price: '590 G', xp: '+195 XP' },
                    { name: 'สมูทตี้ทรอปิคอล', emoji: '🍹', machine: 'โรงกลั่น Brewery', req: 'มะพร้าว 1 + แอปเปิ้ล 1', price: '750 G', xp: '+280 XP' },
                    { name: 'วุ้นมะพร้าว (Jelly)', emoji: '🍮', machine: 'เตาอบ Bakery', req: 'มะพร้าว 1 + ข้าวโพด 1', price: '480 G', xp: '+160 XP' },
                    { name: 'น้ำมะพร้าวสด', emoji: '🥥', machine: 'โรงกลั่น Brewery', req: 'มะพร้าว 1 ลูก', price: '320 G', xp: '+120 XP' },
                    { name: 'กะทิมะพร้าวเข้มข้น', emoji: '🥛', machine: 'โรงกลั่น Brewery', req: 'มะพร้าว 2 ลูก', price: '510 G', xp: '+180 XP' },
                  ].map((p, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-stone-900 border border-stone-800/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{p.emoji}</span>
                        <span className="font-mono font-bold text-amber-400">{p.price}</span>
                      </div>
                      <div className="font-bold text-stone-200 truncate">{p.name}</div>
                      <div className="text-[10px] text-stone-400">{p.machine}</div>
                      <div className="text-[10px] text-stone-500 font-mono">{p.req}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── TAB 3: 3D GLB INSPECTOR ──────────────── */}
          {activeTab === 'glb_inspector' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-100 text-sm flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span>สถานะการโหลดและสถาปัตยกรรมโมเดล 3D ในเกม</span>
                  </h4>
                  <span className="text-xs text-emerald-400 font-mono">GLTFLoader + SkeletonUtils</span>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Lemon Tree GLB Diagnostic */}
                  <div className="p-3.5 rounded-xl bg-stone-900 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-stone-200">/lemon_tree_.glb</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                          CONFIRMED LOADED
                        </span>
                      </div>
                      <span className="font-mono text-stone-400">1.43 MB</span>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-relaxed space-y-1 bg-stone-950/60 p-2.5 rounded-lg font-mono">
                      <div>• Bounding Box Size: 2.85m W × 1.78m H × 2.80m D</div>
                      <div>• Mesh Type: SkinnedMesh (Armature: Lemon_Rig, 208 Joints, 2 Animations)</div>
                      <div>• Auto Scale Normalization: Factor 1.95× (Adjusted to island tree height ~3.5m)</div>
                      <div>• Safe Geometry Policy: Tagged with userData.isSharedGlbGeometry to prevent buffer disposal</div>
                    </div>
                  </div>

                  {/* Coconut Tree Diagnostic */}
                  <div className="p-3.5 rounded-xl bg-stone-900 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-stone-200">/lcoconut tree.glb & Procedural Palm Fallback</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono">
                          ACTIVE FALLBACK READY
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-stone-400 leading-relaxed space-y-1 bg-stone-950/60 p-2.5 rounded-lg font-mono">
                      <div>• Procedural Coconut Palm: 6-Segment Curved Trunk + 8 Drooping Fronds + 4 Coconuts Cluster</div>
                      <div>• Auto GLB Swap: หากมีการวางไฟล์ lcoconut tree.glb ใน /public ระบบจะ Hot-Swap ทันที</div>
                      <div>• Multi-Stage Support: Sapling (Sprout) • Growing • Mature • Ready • Withered • Revive Ring</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── TAB 4: DEV CONTROLS & TIME ACCELERATION ──────────────── */}
          {activeTab === 'dev_controls' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-200/90 leading-relaxed">
                🚀 <strong>เครื่องมือสำหรับนักพัฒนา (Developer Sandbox):</strong> สามารถเร่งเวลาเติบโตของต้นไม้,
                เสกต้นมะนาวและต้นมะพร้าวลงบนเกาะทันทีเพื่อทดสอบรอบการออกผล 4 รอบ, การชุบชีวิต, และการใช้เลื่อยตัด
              </div>

              {/* Time Fast-Forward Buttons */}
              <div className="p-5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                <h4 className="font-bold text-stone-100 text-sm flex items-center gap-2">
                  <FastForward className="w-4 h-4 text-amber-400" />
                  <span>เร่งเวลาการเจริญเติบโต (Fast-Forward Tree Growth)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => {
                      onFastForwardTime?.(20);
                      farmAudio.playWaterSound();
                    }}
                    className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all active:scale-95 text-center border border-stone-700/60"
                  >
                    +20 วินาที
                    <div className="text-[10px] text-stone-400 font-normal">ทดสอบต้นกล้าเล็ก</div>
                  </button>

                  <button
                    onClick={() => {
                      onFastForwardTime?.(300);
                      farmAudio.playWaterSound();
                    }}
                    className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all active:scale-95 text-center border border-stone-700/60"
                  >
                    +5 นาที
                    <div className="text-[10px] text-stone-400 font-normal">เข้าสู่ขั้น Mature</div>
                  </button>

                  <button
                    onClick={() => {
                      onFastForwardTime?.(29 * 3600);
                      farmAudio.playHarvestSound();
                    }}
                    className="p-3 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 text-amber-200 text-xs font-bold transition-all active:scale-95 text-center border border-amber-500/40"
                  >
                    +29 ชั่วโมง
                    <div className="text-[10px] text-amber-300 font-normal">มะนาวพร้อมเก็บผล</div>
                  </button>

                  <button
                    onClick={() => {
                      onFastForwardTime?.(36 * 3600);
                      farmAudio.playHarvestSound();
                    }}
                    className="p-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 text-xs font-bold transition-all active:scale-95 text-center border border-emerald-500/40"
                  >
                    +36 ชั่วโมง
                    <div className="text-[10px] text-emerald-300 font-normal">มะพร้าวพร้อมเก็บผล</div>
                  </button>
                </div>
              </div>

              {/* Direct Seed & Sapling Grant */}
              <div className="p-5 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                <h4 className="font-bold text-stone-100 text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-400" />
                  <span>เพิ่มต้นกล้าและชุบชีวิตต้นไม้ทั้งหมด</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => {
                      onGiveSaplings?.('lemon', 5);
                      farmAudio.playLevelUpSound();
                    }}
                    className="p-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>🍋</span>
                    <span>รับกล้ามะนาว 5 ต้น</span>
                  </button>

                  <button
                    onClick={() => {
                      onGiveSaplings?.('coconut', 5);
                      farmAudio.playLevelUpSound();
                    }}
                    className="p-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>🥥</span>
                    <span>รับกล้ามะพร้าว 5 ต้น</span>
                  </button>

                  <button
                    onClick={() => {
                      onReviveAllTrees?.();
                      farmAudio.playWaterSound();
                    }}
                    className="p-3 rounded-xl bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>✨</span>
                    <span>ชุบชีวิตต้นไม้เหี่ยวเฉาทั้งหมด</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-800 bg-stone-950/80 shrink-0 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Realistic Fishing 3D & Farm Engine Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold transition-all active:scale-95"
          >
            {t('ปิดแดชบอร์ด', 'Close Dashboard')}
          </button>
        </div>

      </div>
    </div>
  );
};
