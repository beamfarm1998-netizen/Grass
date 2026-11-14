// src/components/ui/LevelUpModal.tsx
import React, { useEffect, useRef } from 'react';
import { Award, Sparkles, Coins, Zap, Check } from 'lucide-react';
import { farmAudio } from '../../utils/audio';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  GLASS_PILL,
  GLASS_CIRCLE,
  TEXT_SHARP_HALO,
  TEXT_LIGHT_HALO,
  BTN_AMBER,
} from './glassTokens'; // <-- ตอนนี้จะไม่ Error แล้ว เพราะมีไฟล์นี้อยู่

interface LevelUpModalProps {
  reward: {
    level: number;
    coins: number;
    gems: number;
  } | null;
  onClose: () => void;
}

const LEVEL_UNLOCKS_TH: Record<number, string[]> = {
  2: ['แปลงทุ่งหญ้าฝั่งใต้ (South Meadow)', 'เมล็ดแครอทสดกรอบ'],
  3: ['ไร่ผลไม้ฝั่งตะวันตก (West Orchard)', 'ต้นแอปเปิ้ล & มะนาวส้ม', 'ไก่ฟาร์มเพิ่ม'],
  4: ['ไร่ข้าวโพดริมเขา (East Hillside)', 'ข้าวโพดหวาน', 'หมูชมพูแสนซน'],
  5: ['ต้นสนภูเขา & ต้นโอ๊ค', 'ฟักทองยักษ์', 'แพะภูเขาเล็มหญ้า'],
  6: ['สตรอว์เบอร์รีหวานฉ่ำ', 'วัวนมฮอลสไตน์ลายคลาสสิก'],
  7: ['หมาฟาร์มแสนรู้ (Shiba Inu) ขี้เล่น'],
  8: ['แมวสามสีฟาร์ม (Calico Cat) คลอเคลีย'],
  10: [
    'แดนรกร้างทองคำ (Barren Prairie Frontier Lv.10)',
    'ขยายแปลงปลูกเพิ่ม 12 แปลง',
    'คฤหาสน์ชาวไร่หรูหรา',
  ],
};

const LEVEL_UNLOCKS_EN: Record<number, string[]> = {
  2: ['South Meadow Expansion', 'Crisp Carrot Seeds'],
  3: ['West Orchard Expansion', 'Apple & Mandarin Saplings', 'Extra Farm Chickens'],
  4: ['East Hillside Expansion', 'Sweet Corn', 'Playful Pink Pig'],
  5: ['Mountain Pine & Ancient Oak', 'Giant Golden Pumpkin', 'Grazing Mountain Goat'],
  6: ['Fragrant Strawberries', 'Classic Holstein Dairy Cow'],
  7: ['Loyal Shiba Inu Farm Dog'],
  8: ['Affectionate Calico Farm Cat'],
  10: [
    'Golden Frontier Expansion (Lv.10)',
    '+12 Extra Crop Plots',
    'Grand Homestead Villa',
  ],
};

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ reward, onClose }) => {
  const { lang, t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!reward) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = ['#f59e0b', '#10b981', '#38bdf8', '#ec4899', '#fbbf24', '#a855f7'];
    const particles = Array.from({ length: 80 }).map(() => ({
      x: width * 0.5 + (Math.random() - 0.5) * 80,
      y: height * 0.45,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.8) * 14 - 3,
      size: Math.random() * 9 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      gravity: 0.28,
      alpha: 1.0,
    }));

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rot += p.vRot;
        p.alpha -= 0.005;

        if (p.alpha > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (particles.some((p) => p.alpha > 0)) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [reward]);

  if (!reward) return null;

  const unlocks =
    lang === 'en'
      ? LEVEL_UNLOCKS_EN[reward.level] || ['Faster Harvest Bonus', 'Increased Max Stamina']
      : LEVEL_UNLOCKS_TH[reward.level] || ['โบนัสผลิตผลโตเร็วขึ้น', 'เพิ่มขีดจำกัดพลังงานสูงสุด'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm animate-in fade-in duration-200">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      <div
        className={`${GLASS_PILL} z-20 w-full max-w-md rounded-[2.5rem] max-h-[92dvh] flex flex-col`}
      >
        <div className="relative z-10 p-5 sm:p-6 text-center flex flex-col items-center gap-5 overflow-y-auto">
          {/* Level Badge */}
          <div className="relative mt-1">
            <div className="absolute inset-0 bg-amber-400/40 blur-xl rounded-full" />
            <div className={`${GLASS_CIRCLE} w-20 h-20 flex-col text-[#8a5a05]`}>
              <Award className="w-6 h-6 stroke-[2.5]" />
              <span className={`text-xl font-black leading-none text-[#0f1508] ${TEXT_SHARP_HALO}`}>
                LV.{reward.level}
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <h2
              className={`text-2xl font-black text-[#0f1508] tracking-wide flex items-center justify-center gap-2 ${TEXT_SHARP_HALO}`}
            >
              <Sparkles className="w-5 h-5 text-[#c9a03a]" />
              <span>{t('เลเวลอัปสำเร็จ!', 'Level Up!')}</span>
              <Sparkles className="w-5 h-5 text-[#c9a03a]" />
            </h2>
            <p className={`text-xs font-semibold text-[#2a3818] mt-1 ${TEXT_LIGHT_HALO}`}>
              {t(
                'ความพยายามของคุณผลิบานเป็นฟาร์มที่รุ่งเรือง รับรางวัลโบนัสพิเศษ!',
                'Your hard work is blossoming into a thriving farm — claim your bonus rewards!'
              )}
            </p>
          </div>

          {/* Bonus Rewards Card */}
          <div className="w-full bg-white/40 border border-white/60 rounded-[2rem] p-4 flex justify-around items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className={`${GLASS_CIRCLE} w-10 h-10 text-[#8a5a05]`}>
                <Coins className="w-5 h-5" />
              </div>
              <span className={`text-xs text-[#2a3818] font-bold ${TEXT_LIGHT_HALO}`}>
                {t('เหรียญทอง', 'Coins')}
              </span>
              <span
                className={`text-lg font-black text-[#8a5a05] font-mono tabular-nums ${TEXT_LIGHT_HALO}`}
              >
                +{reward.coins.toLocaleString()}
              </span>
            </div>

            <div className="w-px h-10 bg-white/60" />

            <div className="flex flex-col items-center gap-1">
              <div className={`${GLASS_CIRCLE} w-10 h-10 text-xl`}>💎</div>
              <span className={`text-xs text-[#2a3818] font-bold ${TEXT_LIGHT_HALO}`}>
                {t('เพชรล้ำค่า', 'Gems')}
              </span>
              <span
                className={`text-lg font-black text-[#1d5f8a] font-mono tabular-nums ${TEXT_LIGHT_HALO}`}
              >
                +{reward.gems}
              </span>
            </div>

            <div className="w-px h-10 bg-white/60" />

            <div className="flex flex-col items-center gap-1">
              <div className={`${GLASS_CIRCLE} w-10 h-10 text-[#4a6a1a]`}>
                <Zap className="w-5 h-5" />
              </div>
              <span className={`text-xs text-[#2a3818] font-bold ${TEXT_LIGHT_HALO}`}>
                {t('พลังงาน', 'Stamina')}
              </span>
              <span className={`text-lg font-black text-[#1f4d1a] font-mono ${TEXT_LIGHT_HALO}`}>
                {t('เต็ม 100%', '100% Full')}
              </span>
            </div>
          </div>

          {/* Unlocked Features */}
          <div className="w-full bg-white/40 border border-white/60 rounded-[2rem] p-3.5 text-left">
            <span
              className={`text-xs font-black text-[#8a5a05] flex items-center gap-1 mb-2 ${TEXT_LIGHT_HALO}`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('สิ่งใหม่ที่ปลดล็อกในระดับนี้:', 'Unlocked at this level:')}</span>
            </span>
            <ul className="flex flex-col gap-1.5 text-xs font-semibold text-[#0f1508]">
              {unlocks.map((item, idx) => (
                <li key={idx} className={`flex items-center gap-2 ${TEXT_LIGHT_HALO}`}>
                  <Check className="w-3.5 h-3.5 text-[#4a6a1a] shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Claim Button */}
          <button
            onClick={() => {
              farmAudio.playCoinSound();
              onClose();
            }}
            className={`${BTN_AMBER} w-full py-3 text-sm`}
          >
            {t('รับรางวัลและลุยต่อ!', 'Claim Rewards & Continue!')}
          </button>
        </div>
      </div>
    </div>
  );
};