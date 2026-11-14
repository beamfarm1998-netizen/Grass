import { Capacitor } from '@capacitor/core';

interface CapacitorHapticsPlugin {
  vibrate?: (options?: { duration?: number }) => Promise<void>;
  impact?: (options?: { style?: 'HEAVY' | 'MEDIUM' | 'LIGHT' }) => Promise<void>;
}

export class HapticsManager {
  private enabled = true;
  private lastFightPulseMs = 0;
  private rumbleIntensity = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  static isSupported(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      return true;
    }
    try {
      if (Capacitor.isNativePlatform()) return true;
    } catch {
      // Ignore environment check failure
    }
    return false;
  }

  getRumbleIntensity(): number {
    return this.rumbleIntensity;
  }

  decayVisualRumble(dt: number): void {
    this.rumbleIntensity = Math.max(0, this.rumbleIntensity - dt * 3.4);
  }

  private vibratePattern(pattern: number | number[], nativeImpact?: 'LIGHT' | 'MEDIUM' | 'HEAVY'): void {
    if (!this.enabled) return;

    // 1. Standard Web Vibration API (Android Chrome, Mobile Web, PWA, Android WebView)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore blocked vibration before user gesture
    }

    // 2. Capacitor Native Haptics fallback when packaged as Android/iOS app
    try {
      const plugins = (Capacitor as unknown as { Plugins?: { Haptics?: CapacitorHapticsPlugin } }).Plugins;
      const haptics = plugins?.Haptics;
      if (haptics) {
        if (nativeImpact && typeof haptics.impact === 'function') {
          void haptics.impact({ style: nativeImpact }).catch(() => {});
        } else if (typeof haptics.vibrate === 'function') {
          const dur = Array.isArray(pattern) ? pattern[0] ?? 40 : pattern;
          if (dur > 0) {
            void haptics.vibrate({ duration: dur }).catch(() => {});
          }
        }
      }
    } catch {
      // Ignore native bridge absence on web
    }
  }

  pulseCastLaunch(power: number): void {
    if (!this.enabled) return;
    const ms = Math.round(16 + Math.max(0, Math.min(1, power)) * 28);
    this.rumbleIntensity = Math.max(this.rumbleIntensity, 0.28);
    this.vibratePattern(ms, 'LIGHT');
  }

  pulseNibble(): void {
    if (!this.enabled) return;
    this.rumbleIntensity = Math.max(this.rumbleIntensity, 0.22);
    this.vibratePattern(20, 'LIGHT');
  }

  pulseBiteAlert(): void {
    if (!this.enabled) return;
    this.rumbleIntensity = 0.85;
    this.vibratePattern([55, 38, 95], 'HEAVY');
  }

  pulseHookStrike(quality: 'perfect' | 'good'): void {
    if (!this.enabled) return;
    this.rumbleIntensity = quality === 'perfect' ? 0.95 : 0.72;
    this.vibratePattern(quality === 'perfect' ? [85, 28, 65] : 70, 'HEAVY');
  }

  updateFightRumble(
    tensionRatio: number,
    isBursting: boolean,
    isDragSlipping: boolean,
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now()
  ): void {
    if (!this.enabled) {
      this.rumbleIntensity = 0;
      return;
    }

    const clampedTension = Math.max(0, Math.min(1.2, tensionRatio));
    const targetVisual = Math.min(
      1,
      clampedTension * 0.68 + (isBursting ? 0.25 : 0) + (isDragSlipping ? 0.18 : 0)
    );
    this.rumbleIntensity = Math.max(this.rumbleIntensity, targetVisual);

    const intervalMs = isBursting || clampedTension > 0.78 ? 135 : 195;
    if (nowMs - this.lastFightPulseMs < intervalMs) return;
    this.lastFightPulseMs = nowMs;

    if (clampedTension > 0.82 || (isBursting && isDragSlipping)) {
      // Heavy rod-bucking surge & drag scream vibration
      this.vibratePattern([58, 24, 48], 'HEAVY');
    } else if (isBursting || clampedTension > 0.48) {
      const dur = Math.round(28 + clampedTension * 42);
      this.vibratePattern(dur, 'MEDIUM');
    } else if (clampedTension > 0.14) {
      const dur = Math.round(14 + clampedTension * 22);
      this.vibratePattern(dur, 'LIGHT');
    }
  }

  pulseLineSnap(): void {
    if (!this.enabled) return;
    this.rumbleIntensity = 1.0;
    this.vibratePattern([135, 35, 165], 'HEAVY');
  }

  pulseLanded(): void {
    if (!this.enabled) return;
    this.rumbleIntensity = 0.65;
    this.vibratePattern([45, 45, 115], 'MEDIUM');
  }

  stop(): void {
    this.rumbleIntensity = 0;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    } catch {
      // Ignore
    }
  }
}
