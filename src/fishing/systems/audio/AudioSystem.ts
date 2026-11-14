import { WeatherType } from '../../core/GameConfig';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private muted = false;
  private paused = false;
  private volume = 0.65;
  private lastReelClickMs = 0;

  // Weather Ambience (Realistic Rain Drizzle, Droplet Patters & Rolling Thunder)
  private currentWeather: WeatherType = 'clear';
  private rainLoopSource: AudioBufferSourceNode | null = null;
  private rainMasterGain: GainNode | null = null;
  private rainWindLfo: OscillatorNode | null = null;
  private rainWindLfoGain: GainNode | null = null;
  private rainBuffer: AudioBuffer | null = null;
  private dropletAccumulator = 0;
  private thunderCooldownSec = 6.5;
  private onThunderFlashCallback: ((intensity: number) => void) | null = null;

  setThunderFlashListener(cb: ((intensity: number) => void) | null): void {
    this.onThunderFlashCallback = cb;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Unlocks Web Audio on user touch/pointer/keyboard gesture and starts rain loop if weather is rain.
   */
  unlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (ctx && this.currentWeather === 'rain' && !this.paused) {
      this.ensureRainLoopRunning(ctx);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncRainGainTarget();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.syncRainGainTarget();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.syncRainGainTarget();
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  getWeatherAmbience(): WeatherType {
    return this.currentWeather;
  }

  setWeatherAmbience(weather: WeatherType): void {
    const prev = this.currentWeather;
    this.currentWeather = weather;

    if (weather === 'rain') {
      // Trigger an atmospheric distant thunder roll shortly after rain starts
      if (prev !== 'rain') {
        this.thunderCooldownSec = 1.6;
      }
      if (!this.muted && !this.paused) {
        const ctx = this.ensureContext();
        if (ctx) {
          this.ensureRainLoopRunning(ctx);
        }
      }
    }
    this.syncRainGainTarget();
  }

  private createPinkNoiseRainBuffer(ctx: AudioContext): AudioBuffer {
    if (this.rainBuffer && this.rainBuffer.sampleRate === ctx.sampleRate) {
      return this.rainBuffer;
    }
    // 3.5-second seamless Paul Kellet pink-noise buffer for warm, natural rain wash on water
    const durationSec = 3.5;
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    const fadeSamples = Math.floor(ctx.sampleRate * 0.08);
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.042;
      b6 = white * 0.115926;

      // Cross-smooth loop boundaries to avoid any seam click
      let env = 1;
      if (i < fadeSamples) {
        env = 0.75 + 0.25 * (i / fadeSamples);
      } else if (i > length - fadeSamples) {
        env = 0.75 + 0.25 * ((length - i) / fadeSamples);
      }
      output[i] = pink * env;
    }

    this.rainBuffer = buffer;
    return buffer;
  }

  private ensureRainLoopRunning(ctx: AudioContext): void {
    if (this.rainLoopSource && this.rainMasterGain) {
      this.syncRainGainTarget();
      return;
    }

    const buffer = this.createPinkNoiseRainBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Bandpass + gentle high-shelf shaping for realistic drizzle hitting lake surface & pine needles
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1180, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.58, ctx.currentTime);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(3400, ctx.currentTime);

    // Subtle wind breeze LFO modulating rain wash filter frequency
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.19, ctx.currentTime);
    lfoGain.gain.setValueAtTime(260, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(bandpass.frequency);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    source.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(masterGain);
    masterGain.connect(ctx.destination);

    source.start();
    lfo.start();

    this.rainLoopSource = source;
    this.rainMasterGain = masterGain;
    this.rainWindLfo = lfo;
    this.rainWindLfoGain = lfoGain;
    this.syncRainGainTarget();
  }

  private syncRainGainTarget(): void {
    if (!this.ctx || !this.rainMasterGain) return;
    const now = this.ctx.currentTime;
    const shouldPlay = this.currentWeather === 'rain' && !this.muted && !this.paused;
    const targetGain = shouldPlay ? 0.24 * this.volume : 0.0001;
    this.rainMasterGain.gain.cancelScheduledValues(now);
    this.rainMasterGain.gain.setTargetAtTime(targetGain, now, shouldPlay ? 0.35 : 0.22);
  }

  /**
   * Advances stochastic raindrop patters on lake water/pier and distant rolling thunder.
   */
  updateAmbience(dt: number): void {
    if (this.currentWeather !== 'rain' || this.muted || this.paused) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    this.ensureRainLoopRunning(this.ctx);

    // 1. Delicate raindrop water plinks & timber pier patters (~10 droplets/sec)
    this.dropletAccumulator += dt * 10.5;
    while (this.dropletAccumulator >= 1) {
      this.dropletAccumulator -= 1;
      if (Math.random() < 0.72) {
        this.playRainDroplet();
      }
    }

    // 2. Distant rolling sky thunder ("เสียงฟ้าร้องคำราม") every ~13..26s
    this.thunderCooldownSec -= dt;
    if (this.thunderCooldownSec <= 0) {
      const intensity = 0.55 + Math.random() * 0.45;
      this.thunderCooldownSec = 13 + Math.random() * 13;
      this.onThunderFlashCallback?.(intensity);
      this.playThunderRoll(intensity);
    }
  }

  private playRainDroplet(): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + Math.random() * 0.05;
    const isWoodPatter = Math.random() < 0.26;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    if (isWoodPatter) {
      // Soft raindrop hitting wooden pier plank
      const baseF = 340 + Math.random() * 240;
      osc.frequency.setValueAtTime(baseF, now);
      osc.frequency.exponentialRampToValueAtTime(baseF * 0.55, now + 0.022);
      gain.gain.setValueAtTime(0.018 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.025);
      osc.connect(gain);
    } else {
      // Crisp water droplet bubble plink on lake surface
      const startF = 1150 + Math.random() * 1350;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(startF * 1.32, now + 0.026);
      gain.gain.setValueAtTime(0.015 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.03);
      osc.connect(gain);
    }

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime((Math.random() * 2 - 1) * 0.78, now);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.034);
  }

  playThunderRoll(intensity = 0.8): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.18; // Slight acoustic delay after cloud lightning shimmer
    const duration = 2.9 + intensity * 1.35;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Integrated brownian rumble with multi-crest mountain echo envelope
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.045 * white) / 1.045;

      // Three natural rolling thunder crests + long atmospheric tail
      const crest1 = Math.exp(-Math.pow((t - 0.11) / 0.075, 2));
      const crest2 = 0.78 * Math.exp(-Math.pow((t - 0.29) / 0.12, 2));
      const crest3 = 0.48 * Math.exp(-Math.pow((t - 0.54) / 0.19, 2));
      const tail = Math.pow(Math.max(0, 1 - t), 1.65) * 0.35;
      const env = Math.min(1, crest1 + crest2 + crest3 + tail);

      data[i] = lastOut * 3.1 * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(195 + intensity * 75, now);
    lowpass.frequency.exponentialRampToValueAtTime(54, now + duration * 0.92);
    lowpass.Q.setValueAtTime(0.85, now);

    const subBoost = ctx.createBiquadFilter();
    subBoost.type = 'peaking';
    subBoost.frequency.setValueAtTime(72, now);
    subBoost.gain.setValueAtTime(5.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.34 * intensity * this.volume, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    noise.connect(lowpass);
    lowpass.connect(subBoost);
    subBoost.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  playCast(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.34);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * this.volume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  playSplash(intensity = 0.7): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.28);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.28));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520 + intensity * 380, now);
    filter.Q.setValueAtTime(1.4, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24 * intensity * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  playNibble(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.09);

    gain.gain.setValueAtTime(0.08 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playBiteAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 880].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18 * this.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  playReelClick(tensionRatio: number, isDragSlipping = false): void {
    const nowMs = performance.now();
    const intervalMs = isDragSlipping ? 42 : 78;
    if (nowMs - this.lastReelClickMs < intervalMs) return;
    this.lastReelClickMs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isDragSlipping ? 'sawtooth' : 'triangle';
    const baseFreq = isDragSlipping ? 920 : 420;
    osc.frequency.setValueAtTime(baseFreq + tensionRatio * 480, now);

    gain.gain.setValueAtTime((isDragSlipping ? 0.09 : 0.05) * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  playCatchSuccess(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + i * 0.085;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.16 * this.volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  }

  playLineSnap(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);
    gain.gain.setValueAtTime(0.22 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  dispose(): void {
    try {
      this.rainLoopSource?.stop();
      this.rainWindLfo?.stop();
    } catch {
      // Ignore already stopped nodes
    }
    this.rainLoopSource = null;
    this.rainMasterGain = null;
    this.rainWindLfo = null;
    this.rainWindLfoGain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
