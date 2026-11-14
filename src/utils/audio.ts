// src/utils/audio.ts
/**
 * Procedural Web Audio System for Beam Farm 3D
 * Generates all sound effects and ambient wind breeze using Web Audio API oscillators and noise buffers.
 * Zero external audio files (0% chance of 404).
 */

class FarmAudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;
  private ambientBirdInterval: number | null = null;

  // Ambient Wind Audio Nodes
  private windSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windLfo: OscillatorNode | null = null;
  private windLfoGain: GainNode | null = null;
  private windLfoVol: OscillatorNode | null = null;
  private windLfoVolGain: GainNode | null = null;

  /**
   * Create (or resume) the shared AudioContext.
   * Returns the context so callers can bail out early if unavailable.
   */
  private initContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    if (this.isMuted === muted) return;
    this.isMuted = muted;

    if (!muted) {
      // Ensure the context is running when SFX are unmuted
      this.initContext();
    }
  }

  public setMusicEnabled(enabled: boolean) {
    if (this.isMusicEnabled === enabled) return;
    this.isMusicEnabled = enabled;
    if (!enabled) {
      this.stopAmbiance();
      return;
    }
    this.startAmbientMusic();
  }

  // ──────────────────────── 🌾 เสียงลมธรรมชาติในฟาร์ม (Ambient Wind Breeze) ────────────────────────
  public startAmbientMusic() {
    if (this.windSource) return; // กำลังเล่นเสียงลมอยู่แล้ว
    if (!this.isMusicEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      // 1. สร้าง Buffer คลื่น Pink/Brown Noise สำหรับเสียงลม (5 วินาที Loop)
      const bufferSize = ctx.sampleRate * 5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brownian Integration: กรองเสียงซ่าแหลมออก ให้เหลือเฉพาะลมทึบนุ่มหู
        output[i] = (lastOut + 0.022 * white) / 1.022;
        lastOut = output[i];
        output[i] *= 4.0;
      }

      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;

      // 2. Bandpass Filter: กำหนดความถี่เสียงหวีดหวิวของลม
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);
      filter.Q.setValueAtTime(2.2, ctx.currentTime);

      // Lowpass Filter: ตัดเสียงรบกวนความถี่สูงเกินไป
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(700, ctx.currentTime);

      // 3. LFO 1: ให้ความถี่ลมกวัดแกว่งตามธรรมชาติ (Wind Gust Sweeps: 180Hz - 480Hz)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.13, ctx.currentTime); // ลมพัดระลอกทุกๆ ~7.5 วินาที

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(160, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // 4. LFO 2: ควบคุมความดัง-เบาของลม (Volume Swell & Fade)
      const lfoVol = ctx.createOscillator();
      lfoVol.type = 'sine';
      lfoVol.frequency.setValueAtTime(0.08, ctx.currentTime);

      const lfoVolGain = ctx.createGain();
      lfoVolGain.gain.setValueAtTime(0.045, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, ctx.currentTime);

      lfoVol.connect(lfoVolGain);
      lfoVolGain.connect(gain.gain);

      // 5. เชื่อมต่อสายสัญญาณ Audio Graph
      src.connect(filter);
      filter.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(ctx.destination);

      // 6. เริ่มการทำงานของเสียงลม
      src.start(ctx.currentTime);
      lfo.start(ctx.currentTime);
      lfoVol.start(ctx.currentTime);

      // Store refs only after successful start.
      this.windSource = src;
      this.windFilter = filter;
      this.windLfo = lfo;
      this.windLfoGain = lfoGain;
      this.windLfoVol = lfoVol;
      this.windLfoVolGain = lfoVolGain;
      this.windGain = gain;

      // 7. เสียงนกร้องไกลๆ แทรกตามธรรมชาติเป็นระยะ
      this.ambientBirdInterval = window.setInterval(() => {
        if (!this.isMuted && this.isMusicEnabled && Math.random() > 0.45) {
          this.playBirdChirp();
        }
      }, 7000);
    } catch (e) {
      console.warn('ไม่สามารถเล่นเสียงลมบรรยากาศได้:', e);
      this.stopAmbiance();
    }
  }

  public stopAmbiance() {
    if (this.ambientBirdInterval !== null) {
      clearInterval(this.ambientBirdInterval);
      this.ambientBirdInterval = null;
    }

    // 🐛 FIX #1: snapshot nodes then null the class refs *synchronously*
    // so `startAmbientMusic()` can rebuild immediately if the user
    // toggles off → on faster than the 450 ms fade-out.
    const src = this.windSource;
    const gain = this.windGain;
    const filter = this.windFilter;
    const lfo = this.windLfo;
    const lfoGain = this.windLfoGain;
    const lfoVol = this.windLfoVol;
    const lfoVolGain = this.windLfoVolGain;

    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.windLfo = null;
    this.windLfoGain = null;
    this.windLfoVol = null;
    this.windLfoVolGain = null;

    if (gain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.4);
      } catch {}
    }

    // Deferred teardown of the *old* nodes only. Each call gets its own
    // isolated capture, so overlapping teardowns never double-stop.
    window.setTimeout(() => {
      try {
        src?.stop();
        src?.disconnect();
        lfo?.stop();
        lfo?.disconnect();
        lfoVol?.stop();
        lfoVol?.disconnect();
        filter?.disconnect();
        lfoGain?.disconnect();     // 🐛 FIX #11: was missing
        lfoVolGain?.disconnect();  // 🐛 FIX #11: was missing
        gain?.disconnect();
      } catch {}
    }, 450);
  }

  /** Tear down the whole audio system (useful for HMR / unmount). */
  public dispose() {
    this.stopAmbiance();
    try {
      void this.ctx?.close();
    } catch {}
    this.ctx = null;
  }

  // ──────────────────────── Farming & Game Sound Effects ────────────────────────
  public playTillSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.linearRampToValueAtTime(120, t + 0.16);

    // 🐛 FIX #4: short linear attack prevents click on first sample.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.19);
  }

  public playHoeSound() {
    this.playTillSound();
  }

  public playWaterSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.23);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(750, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(1100, t + 0.18);
    gain2.gain.setValueAtTime(0, t + 0.05);
    gain2.gain.linearRampToValueAtTime(0.15, t + 0.058);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.26);
  }

  public playPlantSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playHarvestSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const base = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const t = base + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playStepSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.06);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playCoinSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(987.77, t);
    osc2.frequency.setValueAtTime(1318.51, t + 0.07);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(t);
    osc1.stop(t + 0.15);
    osc2.start(t + 0.07);
    osc2.stop(t + 0.32);
  }

  public playLevelUpSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const base = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const t = base + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  public playBirdChirp() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(3200, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.16);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playCowSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.4);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.9);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 1.0);
  }

  public playPigSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.12);
    osc.frequency.linearRampToValueAtTime(240, t + 0.22);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.32);
  }

  public playChickenSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.06);
    osc.frequency.linearRampToValueAtTime(540, t + 0.18);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  public playDuckSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const base = ctx.currentTime;

    // เสียงเป็ดร้อง "ก๊าบ ก๊าบ!" 2 จังหวะแบบธรรมชาติด้วย Sawtooth + Nasal Bandpass Filter
    [0, 0.19].forEach((offset, idx) => {
      const st = base + offset;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const startFreq = idx === 0 ? 310 : 295;
      osc.frequency.setValueAtTime(startFreq, st);
      osc.frequency.linearRampToValueAtTime(startFreq * 1.12, st + 0.035);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.72, st + 0.14);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(920, st);
      filter.frequency.exponentialRampToValueAtTime(540, st + 0.14);
      filter.Q.setValueAtTime(3.2, st);

      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(0.22, st + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(st);
      osc.stop(st + 0.16);
    });
  }

  public playGoatSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(295, t + 0.1);
    osc.frequency.linearRampToValueAtTime(270, t + 0.2);
    osc.frequency.linearRampToValueAtTime(285, t + 0.35);
    osc.frequency.linearRampToValueAtTime(260, t + 0.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.6);
  }

  public playDogSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const base = ctx.currentTime;

    [0, 0.12].forEach((offset) => {
      const st = base + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, st);
      osc.frequency.exponentialRampToValueAtTime(140, st + 0.1);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, st);

      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(0.24, st + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.11);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(st);
      osc.stop(st + 0.12);
    });
  }

  public playCatSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.linearRampToValueAtTime(720, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.45);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  public playHorseSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Carrier Oscillator for horse whinny
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';

    // Vibrato / Flutter LFO (14Hz) for equine neigh flutter
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(14, t);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(45, t);
    lfoGain.gain.exponentialRampToValueAtTime(15, t + 0.6);

    lfo.connect(osc.frequency);

    // Whinny pitch contour: starts mid-high, sweeps up, then trails off lower
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.linearRampToValueAtTime(820, t + 0.12);
    osc.frequency.linearRampToValueAtTime(740, t + 0.35);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.72);

    // Formant filter to soften sawtooth into natural vocal tract sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, t);
    filter.Q.setValueAtTime(2.2, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.05);
    gain.gain.setValueAtTime(0.22, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.78);
    osc.stop(t + 0.78);
  }

  public playDoorSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.18);
    osc.frequency.setValueAtTime(90, t + 0.2);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playRoosterSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const base = ctx.currentTime;

    const freqs = [350, 440, 580, 520];
    const times = [0, 0.15, 0.32, 0.55];
    freqs.forEach((f, i) => {
      const st = base + times[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, st);
      osc.frequency.exponentialRampToValueAtTime(f * 0.9, st + 0.18);

      // 🐛 FIX #2: envelope must be relative to the *note start* (st),
      // not the base time. Previously the 3rd/4th notes ended before
      // they started.
      gain.gain.setValueAtTime(0, st);
      gain.gain.linearRampToValueAtTime(0.18, st + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(st);
      osc.stop(st + 0.22);
    });
  }

  public playClickSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.05);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playBuildSound() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.14);
  }
}

export const farmAudio = new FarmAudioSystem();