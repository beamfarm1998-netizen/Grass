// src/types/aspectRatio.ts
export type AspectRatioMode = 'auto' | '18:9' | '16:9' | '19.5:9' | 'full';

export interface AspectRatioOption {
  mode: AspectRatioMode;
  labelTh: string;
  labelEn: string;
  descTh: string;
  descEn: string;
  /** null = auto/full (คำนวณ runtime) */
  ratio: number | null;
  icon: string;
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    mode: 'auto',
    labelTh: 'ออโต้',
    labelEn: 'Auto',
    descTh: 'มือถือเต็มจอ 100% / คอมพิวเตอร์ล็อกกรอบมือถือ 18:9',
    descEn: 'Fullscreen on mobile / locked 18:9 phone frame on desktop',
    ratio: null,
    icon: '📱',
  },
  {
    mode: '18:9',
    labelTh: '18:9',
    labelEn: '18:9',
    descTh: 'มือถือจอกว้าง 2:1 (Galaxy, Pixel)',
    descEn: 'Wide phone 2:1 (Galaxy, Pixel)',
    ratio: 18 / 9,
    icon: '📱',
  },
  {
    mode: '16:9',
    labelTh: '16:9',
    labelEn: '16:9',
    descTh: 'มือถือมาตรฐานคลาสสิก (iPhone Plus)',
    descEn: 'Classic standard phone (iPhone Plus)',
    ratio: 16 / 9,
    icon: '📱',
  },
  {
    mode: '19.5:9',
    labelTh: '19.5:9',
    labelEn: '19.5:9',
    descTh: 'มือถือไร้ขอบ All-Screen (iPhone รุ่นใหม่)',
    descEn: 'All-screen bezel-less (modern iPhone)',
    ratio: 19.5 / 9,
    icon: '📱',
  },
  {
    mode: 'full',
    labelTh: 'เต็มจอ',
    labelEn: 'Full Window',
    descTh: 'เต็มหน้าต่างจอคอมพิวเตอร์',
    descEn: 'Fill entire desktop window',
    ratio: null,
    icon: '🖥️',
  },
];

const STORAGE_KEY = 'beam_farm_aspect_ratio';

export function getSavedAspectRatioMode(): AspectRatioMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && ASPECT_RATIO_OPTIONS.some((o) => o.mode === v)) {
      return v as AspectRatioMode;
    }
  } catch {}
  return 'auto';
}

export function saveAspectRatioMode(mode: AspectRatioMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {}
}

export function getNextAspectRatioMode(current: AspectRatioMode): AspectRatioMode {
  const idx = ASPECT_RATIO_OPTIONS.findIndex((o) => o.mode === current);
  const next = (idx + 1) % ASPECT_RATIO_OPTIONS.length;
  return ASPECT_RATIO_OPTIONS[next].mode;
}

export function getAspectRatioLabel(mode: AspectRatioMode): { th: string; en: string; icon: string } {
  const opt = ASPECT_RATIO_OPTIONS.find((o) => o.mode === mode) ?? ASPECT_RATIO_OPTIONS[0];
  return { th: opt.labelTh, en: opt.labelEn, icon: opt.icon };
}