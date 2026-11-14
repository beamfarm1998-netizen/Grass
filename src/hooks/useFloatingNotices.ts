import { useState, useCallback } from 'react';
import { FloatingText } from '../types/game';

export function useFloatingNotices() {
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  const addNotice = useCallback((text: string, color: string = '#ffd54f') => {
    const id = Math.random().toString();
    setFloatingTexts((prev) => [
      ...prev.slice(-4),
      {
        id,
        text,
        color,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2 - 40,
        timestamp: Date.now(),
      },
    ]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((t) => t.id !== id));
    }, 2200);
  }, []);

  return { floatingTexts, addNotice };
}
