// src/app/drone/page.tsx
// 🚁 หน้าควบคุมโดรน — แผงเสียง + สถานะ
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDroneVoice, type VoiceEvent, type SFXType } from '../../hooks/useDroneVoice';

export default function DronePage() {
  /* ── state ── */
  const [muted, setMuted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [lastEvent, setLastEvent] = useState<VoiceEvent | null>(null);
  const [log, setLog] = useState<string[]>([]);

  /* ── hook ── */
  const { speak, playSFX, stop, isSpeaking, queueSize } = useDroneVoice({
    enabled: !muted,
    sfxEnabled: !muted,
    language: 'th-TH',
    volume: 0.8,
    rate: 1.05,
    pitch: 1.1,
    cooldownMs: 2000,
    maxQueueSize: 8,
    stripEmojiInSpeech: true,
  });

  const unlockDoneRef = useRef(false);

  /* ── helper: log ── */
  const pushLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('th-TH');
    setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 10));
  }, []);

  /* ── 1. ปลดล็อกเสียงอัตโนมัติเมื่อคลิกครั้งแรก ── */
  useEffect(() => {
    const unlock = () => {
      if (unlockDoneRef.current) return;
      unlockDoneRef.current = true;

      playSFX('beep'); // ปลดล็อก AudioContext

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          const u = new SpeechSynthesisUtterance(' ');
          u.volume = 0;
          window.speechSynthesis.speak(u);
        } catch {}
      }

      setUnlocked(true);
      pushLog('🔓 ปลดล็อกเสียงแล้ว');
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [playSFX, pushLog]);

  /* ── 2. handlers ── */
  const handleSpeak = useCallback(
    (event: VoiceEvent, label: string) => {
      setLastEvent(event);
      speak(event);
      pushLog(`🗣️ ${label} (${event})`);
    },
    [speak, pushLog]
  );

  const handleSFX = useCallback(
    (type: SFXType) => {
      playSFX(type);
      pushLog(`🎵 SFX: ${type}`);
    },
    [playSFX, pushLog]
  );

  const handleStop = useCallback(() => {
    stop(true); // reset cooldown ด้วย
    pushLog('⏹️ หยุดเสียง + reset cooldown');
  }, [stop, pushLog]);

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      pushLog(m ? '🔊 เปิดเสียง' : '🔇 ปิดเสียง');
      return !m;
    });
  }, [pushLog]);

  /* ── 3. รายการ event ── */
  const voiceEvents: { event: VoiceEvent; label: string; emoji: string }[] = [
    { event: 'activate',       label: 'เปิดโดรน',        emoji: '🚁' },
    { event: 'deactivate',     label: 'ปิดโดรน',         emoji: '🛑' },
    { event: 'harvest',        label: 'เก็บเกี่ยว',       emoji: '🌾' },
    { event: 'water',          label: 'รดน้ำ',           emoji: '💧' },
    { event: 'replant',        label: 'จัดแปลง',         emoji: '🌱' },
    { event: 'plantTree',      label: 'ปลูกต้นไม้',      emoji: '🌳' },
    { event: 'noSeed',         label: 'ไม่มีเมล็ด',      emoji: '❌' },
    { event: 'noSapling',      label: 'ไม่มีกล้าไม้',    emoji: '❌' },
    { event: 'fullCargo',      label: 'คิวเต็ม',          emoji: '📦' },
    { event: 'lowBattery',     label: 'แบตต่ำ',          emoji: '🔋' },
    { event: 'charging',       label: 'กำลังชาร์จ',      emoji: '⚡' },
    { event: 'ready',          label: 'พร้อมทำงาน',      emoji: '✅' },
    { event: 'modeChange',     label: 'เปลี่ยนโหมด',     emoji: '🔀' },
    { event: 'altitudeChange', label: 'เปลี่ยนความสูง',  emoji: '📐' },
    { event: 'patrolStart',    label: 'เริ่มตรวจการณ์',   emoji: '👁️' },
  ];

  const sfxList: SFXType[] = [
    'beep',
    'success',
    'error',
    'warning',
    'charging',
    'takeoff',
    'landing',
  ];

  /* ── 4. render ── */
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">

        {/* header */}
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">🚁 แผงควบคุมเสียงโดรน</h1>
              <p className="mt-1 text-sm text-slate-400">TTS + SFX + Priority Queue</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* สถานะกำลังพูด */}
              <span
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  isSpeaking
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isSpeaking ? 'animate-pulse bg-green-400' : 'bg-slate-500'
                  }`}
                />
                {isSpeaking ? 'กำลังพูด...' : 'เงียบ'}
              </span>

              {/* คิว */}
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
                คิว: {queueSize}
              </span>

              {/* สถานะปลดล็อก */}
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  unlocked
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'bg-yellow-500/20 text-yellow-300'
                }`}
              >
                {unlocked ? '🔓 ปลดล็อกแล้ว' : '🔒 รอคลิก'}
              </span>

              {/* ปุ่ม mute */}
              <button
                onClick={handleToggleMute}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  muted
                    ? 'bg-red-600 text-white hover:bg-red-500'
                    : 'bg-green-600 text-white hover:bg-green-500'
                }`}
              >
                {muted ? '🔇 เปิดเสียง' : '🔊 ปิดเสียง'}
              </button>

              {/* ปุ่ม stop */}
              <button
                onClick={handleStop}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-600"
              >
                ⏹️ หยุด
              </button>
            </div>
          </div>
        </div>

        {/* แจ้งเตือนถ้ายังไม่ปลดล็อก */}
        {!unlocked && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            ⚠️ คลิกที่ไหนก็ได้ในหน้าเว็บ 1 ครั้ง เพื่อปลดล็อกเสียง (browser บล็อกเสียงอัตโนมัติ)
          </div>
        )}

        {/* TTS */}
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">🗣️ เสียงพูด (TTS)</h2>
          <div className="flex flex-wrap gap-2">
            {voiceEvents.map(({ event, label, emoji }) => (
              <button
                key={event}
                onClick={() => handleSpeak(event, label)}
                disabled={muted}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  lastEvent === event
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                } ${muted ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {emoji} {label}
              </button>
            ))}
          </div>
        </div>

        {/* SFX */}
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">🎵 เอฟเฟกต์เสียง (SFX)</h2>
          <div className="flex flex-wrap gap-2">
            {sfxList.map((type) => (
              <button
                key={type}
                onClick={() => handleSFX(type)}
                disabled={muted}
                className={`rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 ${
                  muted ? 'cursor-not-allowed opacity-40' : ''
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* log */}
        <div className="rounded-2xl bg-slate-900 p-6 shadow-xl">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">📜 บันทึกกิจกรรม</h2>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-400">
            {log.length === 0 ? (
              <p className="text-slate-600">— ยังไม่มีกิจกรรม —</p>
            ) : (
              log.map((line, i) => <p key={i}>{line}</p>)
            )}
          </div>
        </div>

      </div>
    </main>
  );
}