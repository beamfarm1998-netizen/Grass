import { Capacitor } from '@capacitor/core';

export type RuntimePlatform = 'web' | 'pwa' | 'android' | 'ios';

export class PlatformManager {
  static detectPlatform(): RuntimePlatform {
    try {
      if (Capacitor.isNativePlatform()) {
        const nativePlatform = Capacitor.getPlatform();
        if (nativePlatform === 'android') return 'android';
        if (nativePlatform === 'ios') return 'ios';
      }
      if (typeof window !== 'undefined') {
        const isStandalone =
          window.matchMedia?.('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        if (isStandalone) return 'pwa';
      }
    } catch {
      // Fallback to web
    }
    return 'web';
  }

  static registerServiceWorker(): void {
    // Root Service Worker registration is managed centrally by VitePWA without forced reloads.
  }

  static attachBackButton(onBack: () => void): () => void {
    if (typeof document === 'undefined') return () => {};
    const handler = (e: Event) => {
      e.preventDefault();
      onBack();
    };
    document.addEventListener('backbutton', handler, false);
    return () => document.removeEventListener('backbutton', handler, false);
  }
}
