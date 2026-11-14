// src/utils/droneSpeech.ts
// 🔊 ระบบเสียงโดรน 2 ส่วน: Web Speech API (TTS) + Web Audio API (Procedural SFX)
// 100% Zero External Asset Dependencies

let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      _audioCtx = new AudioContextClass();
    }
  }
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

/* ═══════════════ Web Audio API: Procedural SFX ═══════════════ */

/** 🚀 เสียงสตาร์ตเครื่องยนต์/เทคออฟ (Pitch sweep up) */
export function playTakeoff(volume = 0.35): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.45);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.5);
}

/** ✨ เสียง Chime เมื่อเก็บเกี่ยว/หว่าน/รดน้ำ/ปลูกสำเร็จ */
export function playTaskSuccess(volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const notes = [587.33, 880.0]; // D5 -> A5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + idx * 0.08;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  });
}

/** 💧 เสียงสเปรย์ฉีดน้ำลงแปลง */
export function playWaterSpray(volume = 0.25): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const bufferSize = ctx.sampleRate * 0.3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.setValueAtTime(2.0, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.3);
}

/** ⚠️ เสียงเตือน Beep เมื่อแบตเตอรี่ต่ำกว่า 20% */
export function playBatteryWarning(volume = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  [0, 0.12].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + offset;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t); // A5

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  });
}

/** ⚡ เสียง Chime เติมพลังงานเมื่อชาร์จเต็ม 100% */
export function playRechargeChime(volume = 0.35): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  chords.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + idx * 0.07;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.46);
  });
}

/* ═══════════════ Web Speech API: Voice TTS ═══════════════ */

export type DroneVoiceEvent =
  | 'activate'
  | 'deactivate'
  | 'harvest'
  | 'water'
  | 'replant'
  | 'plantTree'
  | 'lowBattery'
  | 'charging'
  | 'ready'
  | 'modeChange'
  | 'altitudeChange';

const TH_MESSAGES: Record<DroneVoiceEvent, string[]> = {
  activate: ['ครับเจ้านาย เปิดระบบโดรนแล้วครับ', 'โดรนพร้อมปฏิบัติหน้าที่ครับเจ้านาย'],
  deactivate: ['ครับเจ้านาย ลงจอดและพักเครื่องแล้วครับ'],
  harvest: ['ครับเจ้านาย เก็บเกี่ยวผลผลิตเรียบร้อยครับ'],
  water: ['ครับเจ้านาย รดน้ำชุ่มชื้นเรียบร้อยครับ'],
  replant: ['ครับเจ้านาย หว่านเมล็ดลงแปลงเรียบร้อยครับ'],
  plantTree: ['ครับเจ้านาย ปลูกต้นไม้ใหม่เรียบร้อยครับ'],
  lowBattery: ['ครับเจ้านาย แบตเตอรี่เหลือน้อย กำลังบินกลับแท่นชาร์จครับ'],
  charging: ['ครับเจ้านาย กำลังชาร์จไฟที่แท่นชาร์จครับ'],
  ready: ['ครับเจ้านาย แบตเตอรี่เต็ม พร้อมลุยงานแล้วครับ'],
  modeChange: ['ครับเจ้านาย สลับโหมดการบินแล้วครับ'],
  altitudeChange: ['ครับเจ้านาย ปรับระดับความสูงการบินแล้วครับ'],
};

const EN_MESSAGES: Record<DroneVoiceEvent, string[]> = {
  activate: ['Drone system active, ready for duty!'],
  deactivate: ['Drone landing and standing by.'],
  harvest: ['Crops harvested successfully.'],
  water: ['Plot watered and hydrated.'],
  replant: ['Seeds replanted in plot.'],
  plantTree: ['New tree sapling planted.'],
  lowBattery: ['Low battery! Returning to charging pad.'],
  charging: ['Docked at helipad, recharging.'],
  ready: ['Battery fully charged, ready!'],
  modeChange: ['Flight mode updated.'],
  altitudeChange: ['Flight altitude adjusted.'],
};

let lastSpeechTime = 0;
const SPEECH_COOLDOWN_MS = 2500;

export function speakDrone(event: DroneVoiceEvent, lang = 'th'): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const now = Date.now();
  if (now - lastSpeechTime < SPEECH_COOLDOWN_MS && event !== 'lowBattery') {
    return;
  }
  lastSpeechTime = now;

  const msgs = lang === 'th' ? TH_MESSAGES[event] : EN_MESSAGES[event];
  if (!msgs || msgs.length === 0) return;
  const text = msgs[Math.floor(Math.random() * msgs.length)];

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'th' ? 'th-TH' : 'en-US';
    utterance.volume = 0.85;
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[DroneSpeech] Failed to speak:', err);
  }
}
