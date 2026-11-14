// ============================================================================
// useHarvestQueue.ts
// คิวเก็บเกี่ยวอัตโนมัติทีละรายการ — re-validate ก่อน execute เสมอ
// ออกแบบให้ decouple จาก useHarvestMode (ใช้งานร่วมกันผ่าน parent)
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HarvestResult, HarvestTarget } from './useHarvestMode';

interface UseHarvestQueueOptions {
  /** เปิด/ปิดการทำงานของคิว (เช่น ผูกกับ harvest mode ที่ active) */
  isEnabled: boolean;
  /** ตรวจว่า target ยังพร้อมเก็บอยู่จริง ณ ตอน execute */
  isTargetReady: (target: HarvestTarget) => boolean;
  /** execute 1 รายการ — คืน null ถ้าล้มเหลว */
  executeOne: (target: HarvestTarget) => HarvestResult | null;
  onError?: (msg: string, target: HarvestTarget) => void;
  /** ระยะห่างระหว่างรายการ (default 350ms) */
  tickIntervalMs?: number;
}

interface QueueItem {
  target: HarvestTarget;
  addedAt: number;
}

export function useHarvestQueue(options: UseHarvestQueueOptions) {
  const {
    isEnabled,
    isTargetReady,
    executeOne,
    onError,
    tickIntervalMs = 350,
  } = options;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // ref สำหรับ tick อ่าน queue ล่าสุดแบบไม่ stale
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // ---------- Commands ----------
  const enqueue = useCallback((target: HarvestTarget) => {
    setQueue((prev) => {
      if (prev.some((q) => q.target.type === target.type && q.target.id === target.id)) {
        return prev;
      }
      return [...prev, { target, addedAt: Date.now() }];
    });
  }, []);

  const dequeue = useCallback((target: HarvestTarget) => {
    setQueue((prev) =>
      prev.filter((q) => !(q.target.type === target.type && q.target.id === target.id)),
    );
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // ---------- Process 1 item ----------
  const processOne = useCallback((): boolean => {
    const current = queueRef.current;
    if (current.length === 0) return false;

    const item = current[0];

    // re-validate: ถ้าไม่สุกแล้ว (เช่นถูกเก็บจากที่อื่น/เหี่ยว) → drop แล้วไปต่อ
    if (!isTargetReady(item.target)) {
      setQueue((prev) =>
        prev.filter((q) => !(q.target.type === item.target.type && q.target.id === item.target.id)),
      );
      return true;
    }

    const result = executeOne(item.target);
    // ไม่ว่า success หรือไม่ ลบ item ออกจากคิว (ไม่วนซ้ำ)
    setQueue((prev) =>
      prev.filter((q) => !(q.target.type === item.target.type && q.target.id === item.target.id)),
    );

    if (result === null) {
      onError?.('เก็บเกี่ยวไม่สำเร็จ', item.target);
    }
    return true;
  }, [executeOne, isTargetReady, onError]);

  // ---------- Auto tick ----------
  useEffect(() => {
    if (!isEnabled || queue.length === 0) {
      setIsRunning(false);
      return;
    }
    setIsRunning(true);

    const id = setInterval(() => {
      processOne();
    }, tickIntervalMs);

    return () => {
      clearInterval(id);
      setIsRunning(false);
    };
  }, [isEnabled, queue.length, processOne, tickIntervalMs]);

  // ---------- Clear when disabled ----------
  useEffect(() => {
    if (!isEnabled) {
      setQueue([]);
    }
  }, [isEnabled]);

  return {
    queue,
    queueLength: queue.length,
    isRunning,
    enqueue,
    dequeue,
    clearQueue,
    processOne,
  };
}