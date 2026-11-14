import React from 'react';
import { X, CheckCircle, Compass, Sparkles, Award } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface QuestGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  cropsHarvestedCount: number;
  coinsEarnedCount: number;
  level: number;
}

export const QuestGuideModal: React.FC<QuestGuideModalProps> = ({
  isOpen,
  onClose,
  cropsHarvestedCount,
  coinsEarnedCount,
  level,
}) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const quests = [
    {
      title: t('เริ่มต้นชีวิตเกษตรกร', 'First Harvest'),
      desc: t(
        'พรวนดินและปลูกพืชชนิดแรกในฟาร์มของคุณ',
        'Till soil, plant seeds, and harvest your first crop'
      ),
      completed: cropsHarvestedCount > 0,
      reward: '50 XP',
    },
    {
      title: t('หยาดน้ำแห่งชีวิต', 'Drops of Life'),
      desc: t(
        'รดน้ำแปลงผักเพื่อให้ดินชุ่มชื้นและพืชเติบโตไวขึ้น 2 เท่า',
        'Water crop plots for 2× faster growth and harvest 3 crops'
      ),
      completed: cropsHarvestedCount >= 3,
      reward: '80 XP',
    },
    {
      title: t('ฤดูกาลแห่งการเก็บเกี่ยว', 'Harvest Season'),
      desc: t(
        `เก็บเกี่ยวผลผลิตรวมให้ครบ 10 ชิ้น (ปัจจุบัน: ${cropsHarvestedCount}/10)`,
        `Harvest 10 total crops (${cropsHarvestedCount}/10)`
      ),
      completed: cropsHarvestedCount >= 10,
      reward: '150 XP • 50 G',
    },
    {
      title: t('เศรษฐีบ้านไร่', 'Countryside Tycoon'),
      desc: t(
        `สร้างรายได้จากการขายผลผลิตรวม 200 เหรียญทอง (ปัจจุบัน: ${coinsEarnedCount}/200 G)`,
        `Earn 200 G from selling farm produce (${coinsEarnedCount}/200 G)`
      ),
      completed: coinsEarnedCount >= 200,
      reward: '300 XP • 100 G',
    },
    {
      title: t('ก้าวสู่ผู้เชี่ยวชาญ', 'Master Homestead'),
      desc: t(
        `ยกระดับฟาร์มถึงเลเวล 3 (ปัจจุบัน: Lv. ${level})`,
        `Reach Farm Level 3 (Current: Lv. ${level})`
      ),
      completed: level >= 3,
      reward: '500 XP',
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/70 animate-fade-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-stone-100 truncate">
                {t('คู่มือการเล่น & ภารกิจฟาร์ม', 'Controls Guide & Farm Quests')}
              </h2>
              <p className="text-xs text-stone-400 truncate">
                {t(
                  'วิธีทำฟาร์มและการควบคุมบนคอมพิวเตอร์และมือถือใน Beam Farm 3D',
                  'Desktop & mobile controls and milestones in Beam Farm 3D'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 text-stone-400 hover:text-white hover:bg-stone-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-5">
          {/* Controls Card */}
          <div className="p-4 bg-stone-800/80 border border-stone-700/60 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
              <Compass className="w-4 h-4 shrink-0" />
              <span>
                {t('การควบคุมบนมือถือและคอมพิวเตอร์', 'Desktop & Mobile Touch Controls')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-300">
              <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                <strong className="text-stone-100 block mb-0.5">
                  🚶‍♂️ {t('การเดิน:', 'Walking:')}
                </strong>
                {t(
                  'บนคอมพิวเตอร์กดปุ่ม W / A / S / D เพื่อเดิน (บนมือถือแตะที่พื้นดินเพื่อเดิน)',
                  'Press W / A / S / D on desktop to walk (tap ground on mobile)'
                )}
              </div>
              <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                <strong className="text-stone-100 block mb-0.5">
                  🌱 {t('การทำฟาร์มในแปลง:', 'Plot Farming:')}
                </strong>
                {t(
                  'เลือกจอบ/เมล็ด/บัวรดน้ำ/เคียว แล้วคลิกที่แปลงผัก',
                  'Equip Hoe, Seeds, Watering Can, or Sickle and tap a plot'
                )}
              </div>
              <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                <strong className="text-stone-100 block mb-0.5">
                  ⊞ {t('ตารางกริด & ปลูกต้นไม้:', 'Grid & Planting Trees:')}
                </strong>
                {t(
                  'เปิดแถบเครื่องมือเลือก "ปลูกต้นไม้" แล้วแตะช่องกริดบนพื้นดิน เพื่อปลูกต้นไม้ได้ทั่วทั้งเกาะฟาร์ม',
                  'Select "Plant Tree" in Farm Tools and tap any green soil grid cell'
                )}
              </div>
              <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                <strong className="text-stone-100 block mb-0.5">
                  🪓 {t('การเก็บผลไม้ & โค่นไม้:', 'Orchards & Timber:')}
                </strong>
                {t(
                  'ใช้บัวรดน้ำโคนต้นไม้ให้โตไว 2 เท่า ใช้เคียว/มือเก็บผลไม้ หรือใช้ขวานโค่นรับท่อนไม้ซุง',
                  'Water trees for 2× speed, harvest fruit with Sickle/Hand, or chop logs with Axe'
                )}
              </div>
              <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                <strong className="text-stone-100 block mb-0.5">
                  🔄 {t('การหมุนมุมมอง:', 'Camera Orbit:')}
                </strong>
                {t(
                  'ลากนิ้วหรือคลิกเมาส์ค้างเพื่อหมุนชมรอบฟาร์ม',
                  'Drag with 1 finger or left mouse button to orbit around the farm'
                )}
              </div>
              <div className="bg-stone-900/60 p-2.5 rounded-xl border border-stone-800">
                <strong className="text-stone-100 block mb-0.5">
                  🔍 {t('การซูม & เลื่อน:', 'Zoom & Pan:')}
                </strong>
                {t(
                  'บีบนิ้ว 2 นิ้วหรือหมุนลูกกลิ้งเมาส์เพื่อซูมเข้า/ออก (Shift+ลาก เพื่อเลื่อนฉาก)',
                  'Pinch with 2 fingers or scroll wheel to zoom (2-finger drag or Shift+drag to pan)'
                )}
              </div>
            </div>
          </div>

          {/* Quests */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-stone-200 text-sm font-bold">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('ภารกิจฟาร์มเพื่อรับค่าประสบการณ์ (XP)', 'Farm Milestones & XP')}</span>
            </div>

            <div className="space-y-2">
              {quests.map((q, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between gap-2 p-3.5 rounded-2xl border transition-all ${
                    q.completed
                      ? 'bg-emerald-950/20 border-emerald-600/40 text-stone-200'
                      : 'bg-stone-800/80 border-stone-700/60 text-stone-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {q.completed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-stone-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-100">{q.title}</h4>
                      <p className="text-xs text-stone-400">{q.desc}</p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-amber-400 bg-stone-900/80 px-2.5 py-1 rounded-lg border border-stone-700/80 shrink-0 whitespace-nowrap">
                    {q.reward}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
