// src/hooks/useDroneVoice.ts
// 🔊 ระบบเสียงตอบกลับโดรน (TTS + SFX + Priority Queue + Cooldown)
import { useCallback, useEffect, useRef, useState } from 'react';

/* ═══════════════ Types ═══════════════ */
export type VoiceEvent =
  | 'activate'
  | 'deactivate'
  | 'harvest'
  | 'water'
  | 'replant'
  | 'plantTree'
  | 'noSeed'
  | 'noSapling'
  | 'fullCargo'
  | 'lowBattery'
  | 'charging'
  | 'ready'
  | 'modeChange'
  | 'altitudeChange'
  | 'patrolStart';

export type SFXType =
  | 'beep'
  | 'success'
  | 'error'
  | 'warning'
  | 'charging'
  | 'takeoff'
  | 'landing';

interface UseDroneVoiceOptions {
  enabled?: boolean;
  sfxEnabled?: boolean;
  volume?: number;
  rate?: number;
  pitch?: number;
  language?: 'th-TH' | 'en-US';
  cooldownMs?: number;
  maxQueueSize?: number;
  stripEmojiInSpeech?: boolean;
}

interface VoiceQueueItem {
  event: VoiceEvent;
  text: string;
  priority: number;
  timestamp: number;
}

/* ═══════════════ ข้อความที่จะพูด ═══════════════ */
const VOICE_MESSAGES: Record<VoiceEvent, { th: string; en: string; priority: number }> = {
  activate:       { th: 'โดรนพร้อมทำงานครับเจ้านาย',           en: 'Drone activated',              priority: 5 },
  deactivate:     { th: 'ปิดโดรนครับเจ้านาย',                  en: 'Drone deactivated',            priority: 5 },
  harvest:        { th: 'เก็บเกี่ยวสำเร็จครับเจ้านาย',           en: 'Harvested successfully',       priority: 3 },
  water:          { th: 'รดน้ำสำเร็จครับเจ้านาย',               en: 'Watered successfully',         priority: 3 },
  replant:        { th: 'จัดแปลงสำเร็จครับเจ้านาย',             en: 'Replanted successfully',       priority: 3 },
  plantTree:      { th: 'ปลูกต้นไม้สำเร็จครับเจ้านาย',          en: 'Tree planted',                 priority: 4 },
  noSeed:         { th: 'ไม่มีเมล็ดในกระเป๋าครับเจ้านาย',       en: 'No seeds in bag',              priority: 7 },
  noSapling:      { th: 'ไม่มีกล้าไม้ในกระเป๋าครับเจ้านาย',     en: 'No saplings in bag',           priority: 7 },
  fullCargo:      { th: 'คิวเต็ม กลับฐานครับเจ้านาย',           en: 'Cargo full, returning',        priority: 6 },
  lowBattery:     { th: 'แบตเตอรี่ต่ำครับเจ้านาย',              en: 'Low battery',                  priority: 8 },
  charging:       { th: 'กำลังชาร์จแบตเตอรี่ครับเจ้านาย',       en: 'Charging battery',             priority: 6 },
  ready:          { th: 'พร้อมทำงานครับเจ้านาย',                en: 'Ready to work',                priority: 2 },
  modeChange:     { th: 'เปลี่ยนโหมดครับเจ้านาย',               en: 'Mode changed',                 priority: 4 },
  altitudeChange: { th: 'เปลี่ยนระดับความสูงครับเจ้านาย',       en: 'Altitude changed',             priority: 4 },
  patrolStart:    { th: 'เริ่มบินตรวจการณ์ครับเจ้านาย',          en: 'Patrol started',               priority: 5 },
};

/* ═══════════════ Helper: stripEmoji ═══════════════ */
export function stripEmoji(text: string): string {
  return text
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}]/gu,
      ''
    )
    .trim();
}

/* ═══════════════ SFX (Web Audio API) ═══════════════ */
class DroneSoundFX {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playBeep(freq = 800, duration = 0.08, volume = 0.15, type: OscillatorType = 'sine'): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  success(): void {
    this.playBeep(523, 0.1, 0.12);
    setTimeout(() => this.playBeep(659, 0.12, 0.12), 100);
  }
  error(): void {
    this.playBeep(659, 0.1, 0.12, 'square');
    setTimeout(() => this.playBeep(440, 0.15, 0.12, 'square'), 100);
  }
  warning(): void {
    this.playBeep(880, 0.08, 0.12, 'triangle');
    setTimeout(() => this.playBeep(880, 0.08, 0.12, 'triangle'), 120);
  }
  charging(): void {
    for (let i = 0; i < 3; i++) setTimeout(() => this.playBeep(400 + i * 200, 0.06, 0.1), i * 80);
  }
  takeoff(): void {
    for (let i = 0; i < 5; i++) setTimeout(() => this.playBeep(300 + i * 150, 0.05, 0.1), i * 50);
  }
  landing(): void {
    for (let i = 0; i < 5; i++) setTimeout(() => this.playBeep(900 - i * 150, 0.05, 0.1), i * 50);
  }
}

const soundFX = new DroneSoundFX();

/* ═══════════════ Hook ═══════════════ */
export function useDroneVoice(options: UseDroneVoiceOptions = {}) {
  const {
    enabled = true,
    sfxEnabled = true,
    volume = 0.8,
    rate = 1.05,
    pitch = 1.1,
    language = 'th-TH',
    cooldownMs = 2500,
    maxQueueSize = 8,
    stripEmojiInSpeech = true,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [queueSize, setQueueSize] = useState(0);

  const lastSpokenRef = useRef<Map<VoiceEvent, number>>(new Map());
  const queueRef = useRef<VoiceQueueItem[]>([]);
  const isSpeakingRef = useRef(false);
  const lastUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const stripEmojiRef = useRef(stripEmojiInSpeech);
  const optsRef = useRef({ language, volume, rate, pitch });

  useEffect(() => { optsRef.current = { language, volume, rate, pitch }; }, [language, volume, rate, pitch]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { stripEmojiRef.current = stripEmojiInSpeech; }, [stripEmojiInSpeech]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const setSpeaking = useCallback((v: boolean) => {
    isSpeakingRef.current = v;
    if (mountedRef.current) setIsSpeaking(v);
  }, []);

  const syncQueueSize = useCallback(() => {
    if (mountedRef.current) setQueueSize(queueRef.current.length);
  }, []);

  const processQueue = useCallback(() => {
    if (!mountedRef.current) { setSpeaking(false); return; }
    if (!enabledRef.current) { queueRef.current = []; setSpeaking(false); syncQueueSize(); return; }
    if (queueRef.current.length === 0) { setSpeaking(false); syncQueueSize(); return; }
    if (typeof window === 'undefined' || !window.speechSynthesis) { setSpeaking(false); return; }

    const item = queueRef.current.shift()!;
    setSpeaking(true);
    syncQueueSize();
    lastSpokenRef.current.set(item.event, Date.now());

    const utt = new SpeechSynthesisUtterance(item.text);
    const { language: lang, volume: vol, rate: r, pitch: p } = optsRef.current;
    utt.lang = lang; utt.volume = vol; utt.rate = r; utt.pitch = p;

    const voices = window.speechSynthesis.getVoices();
    const matchLang = voices.find((v) => v.lang === lang);
    if (matchLang) utt.voice = matchLang;

    lastUtteranceRef.current = utt;
    utt.onend = () => { if (mountedRef.current) processQueue(); };
    utt.onerror = () => { if (mountedRef.current) processQueue(); };

    try { window.speechSynthesis.speak(utt); } catch { setSpeaking(false); }
  }, [setSpeaking, syncQueueSize]);

  const speak = useCallback(
    (event: VoiceEvent, customText?: string) => {
      if (!enabled) return;
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      const now = Date.now();
      const last = lastSpokenRef.current.get(event) ?? 0;
      if (now - last < cooldownMs) return;

      const msg = VOICE_MESSAGES[event];
      if (!msg) return;
      if (queueRef.current.some((q) => q.event === event)) return;

      const rawText = customText ?? (language === 'th-TH' ? msg.th : msg.en);
      const text = stripEmojiRef.current ? stripEmoji(rawText) : rawText;
      if (!text) return;

      if (queueRef.current.length >= maxQueueSize) {
        let minIdx = 0;
        for (let i = 1; i < queueRef.current.length; i++) {
          if (queueRef.current[i].priority < queueRef.current[minIdx].priority) minIdx = i;
        }
        if (msg.priority > queueRef.current[minIdx].priority) queueRef.current.splice(minIdx, 1);
        else return;
      }

      queueRef.current.push({ event, text, priority: msg.priority, timestamp: now });
      queueRef.current.sort((a, b) => b.priority - a.priority);
      syncQueueSize();

      if (!isSpeakingRef.current) processQueue();
    },
    [enabled, language, cooldownMs, maxQueueSize, processQueue, syncQueueSize]
  );

  const stop = useCallback((resetCooldown = false) => {
    if (typeof window === 'undefined') return;
    try { window.speechSynthesis?.cancel(); } catch {}
    queueRef.current = [];
    setSpeaking(false);
    syncQueueSize();
    lastUtteranceRef.current = null;
    if (resetCooldown) lastSpokenRef.current.clear();
  }, [setSpeaking, syncQueueSize]);

  const playSFX = useCallback((type: SFXType) => {
    if (!sfxEnabled) return;
    switch (type) {
      case 'success': soundFX.success(); break;
      case 'error': soundFX.error(); break;
      case 'warning': soundFX.warning(); break;
      case 'charging': soundFX.charging(); break;
      case 'takeoff': soundFX.takeoff(); break;
      case 'landing': soundFX.landing(); break;
      case 'beep':
      default: soundFX.playBeep(); break;
    }
  }, [sfxEnabled]);

  const getCurrentUtterance = useCallback(() => lastUtteranceRef.current, []);

  useEffect(() => { if (!enabled) stop(false); }, [enabled, stop]);
  useEffect(() => () => stop(), [stop]);

  return { speak, stop, playSFX, isSpeaking, queueSize, getCurrentUtterance };
}

/* ═══════════════ Helper: เลือกภาษาตาม locale ═══════════════ */
export function resolveVoiceLanguage(lang: string): 'th-TH' | 'en-US' {
  return lang === 'th' || lang === 'th-TH' ? 'th-TH' : 'en-US';
}