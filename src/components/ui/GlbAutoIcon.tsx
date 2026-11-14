// src/components/ui/GlbAutoIcon.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  getCachedGlbThumbnail,
  resolveGlbThumbnail,
  subscribeGlbDiscovery,
} from '../../utils/glbThumbnail';

export interface GlbAutoIconProps {
  candidates: readonly string[];
  alt: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  fallbackIcon?: React.ReactNode;
}

const AUTO_DISCOVERY_POLL_MS = 5000;

/**
 * แสดงไอคอน 3 มิติที่เรนเดอร์จากไฟล์ `.glb` จริงโดยอัตโนมัติ:
 * - หากมีไฟล์ `.glb` ที่ถูกต้อง จะเรนเดอร์ภาพตัวอย่าง 3 มิติของโมเดลนั้นทันที
 * - หากยังไม่มีไฟล์ `.glb` (หรือไฟล์ว่าง 0 byte) จะไม่แสดงไอคอนสำรองใดๆ (`null`)
 * - หากนำไฟล์ `.glb` มาใส่ใน `/public/` ภายหลัง จะตรวจพบและอัปเดตไอคอนเองโดยอัตโนมัติ
 */
export const GlbAutoIcon: React.FC<GlbAutoIconProps> = React.memo(
  ({ candidates, alt, disabled = false, size = 'md', className = '', fallbackIcon }) => {
    const candidateKey = useMemo(() => candidates.join('|'), [candidates]);
    const stableCandidates = useMemo(
      () => (candidateKey ? candidateKey.split('|') : []),
      [candidateKey]
    );

    const [thumbUrl, setThumbUrl] = useState<string | null>(() =>
      getCachedGlbThumbnail(stableCandidates)
    );

    useEffect(() => {
      let active = true;

      const existing = getCachedGlbThumbnail(stableCandidates);
      if (existing) {
        setThumbUrl(existing);
        return;
      }

      setThumbUrl(null);
      if (stableCandidates.length === 0) return;

      const checkNow = (forceReprobe: boolean) => {
        void resolveGlbThumbnail(stableCandidates, { forceReprobe }).then((url) => {
          if (active && url) {
            setThumbUrl(url);
          }
        });
      };

      checkNow(false);

      const unsubscribe = subscribeGlbDiscovery((resolvedUrl, dataUrl) => {
        if (!active) return;
        if (stableCandidates.includes(resolvedUrl)) {
          setThumbUrl(dataUrl);
        }
      });

      const handleFocusOrVisible = () => {
        if (document.visibilityState === 'hidden') return;
        if (!getCachedGlbThumbnail(stableCandidates)) {
          checkNow(true);
        }
      };

      window.addEventListener('focus', handleFocusOrVisible);
      document.addEventListener('visibilitychange', handleFocusOrVisible);

      const pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        if (getCachedGlbThumbnail(stableCandidates)) {
          window.clearInterval(pollTimer);
          return;
        }
        checkNow(true);
      }, AUTO_DISCOVERY_POLL_MS);

      return () => {
        active = false;
        unsubscribe();
        window.removeEventListener('focus', handleFocusOrVisible);
        document.removeEventListener('visibilitychange', handleFocusOrVisible);
        window.clearInterval(pollTimer);
      };
    }, [stableCandidates]);

    if (!thumbUrl) {
      if (!fallbackIcon) return null;
      return (
        <span
          aria-hidden="true"
          className={`inline-flex items-center justify-center select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] ${
            size === 'sm' ? 'text-sm leading-none shrink-0' : 'text-2xl sm:text-[26px] leading-none mb-0.5 shrink-0'
          } ${disabled ? 'grayscale opacity-40' : ''} ${className}`}
        >
          {fallbackIcon}
        </span>
      );
    }

    const sizeClass =
      size === 'sm'
        ? 'w-5 h-5 shrink-0'
        : 'w-10 h-10 sm:w-11 sm:h-11 mb-0.5 shrink-0';

    return (
      <img
        src={thumbUrl}
        alt={alt}
        draggable={false}
        className={`${sizeClass} object-contain select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-opacity ${
          disabled ? 'grayscale opacity-40' : ''
        } ${className}`}
      />
    );
  }
);

GlbAutoIcon.displayName = 'GlbAutoIcon';
