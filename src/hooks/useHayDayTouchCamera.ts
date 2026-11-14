// src/hooks/useHayDayTouchCamera.ts
import { useEffect, useRef, type RefObject } from 'react';
import type {
  CameraHoverCallback,
  CameraPickCallback,
  HayDayCameraController,
} from '../engine/camera/HayDayCameraController';

export interface HayDayTouchHandlers {
  onPick?: CameraPickCallback;
  onDoublePick?: CameraPickCallback;
  onLongPress?: CameraPickCallback;
  onSwipeBegin?: () => void;
  onSwipePick?: CameraPickCallback;
  onHover?: CameraHoverCallback;
  onPlacementMove?: CameraHoverCallback;
}

export interface UseHayDayTouchCameraOptions {
  /** Container div ที่หุ้ม Canvas 3D */
  containerRef: RefObject<HTMLElement | null>;
  /** ตัวควบคุมกล้อง HayDayCameraController */
  controllerRef: RefObject<HayDayCameraController | null>;
  /** Callbacks สำหรับคลิกเก็บเกี่ยว/ปลูกผัก/ลากวางสิ่งก่อสร้าง */
  handlersRef: RefObject<HayDayTouchHandlers | null>;
  /** บล็อกอินพุตเมื่อเปิดหน้าต่าง Modal ทับจอ */
  isInputBlocked?: boolean;
  /** โหมดปาดนิ้วทำฟาร์มรวดเดียวแบบ Hay Day (ลาก 1 นิ้วเก็บเกี่ยว/รดน้ำ/ปลูกต่อเนื่อง, ใช้ 2 นิ้วเลื่อนจอ) */
  fingerSwipeEnabled?: boolean;
  /** บิด 2 นิ้วเพื่อหมุนมุมมองกล้องด้วยมือ (2-Finger Twist to Rotate Camera) */
  twoFingerRotateEnabled?: boolean;
}

const TOUCH_DRAG_THRESHOLD_PX = 7;
const MOUSE_DRAG_THRESHOLD_PX = 5;
const LONG_PRESS_DELAY_MS = 380;

/**
 * ตรวจสอบว่า Element ที่นิ้วหรือเมาส์กดลงไป อยู่ใน `<div data-ui>` หรือไม่
 * เพื่อป้องกันไม่ให้การกดปุ่ม UI ไปเผลอลากหน้าจอกล้อง 3D
 */
function isEventFromDataUi(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return target.closest('[data-ui]') !== null;
}

/**
 * useHayDayTouchCamera — Hook จัดการนิ้วและเมาส์สไตล์ Hay Day (Part 1)
 *
 * - ดักจับการลากนิ้ว/ซูม 2 นิ้ว/บิด 2 นิ้วหมุนกล้องด้วย Native DOM Listeners + useRef ล้วน 100%
 * - ไม่มี useState ภายในเลย จึงไม่เกิดการ Re-render ของ React ขณะลากจอ (วิ่งนิ่ง 60fps)
 * - รองรับกดค้าง (Long-Press) เพื่อย้าย/ตกแต่งสิ่งก่อสร้างแบบ Hay Day และโหมดปาดนิ้วทำฟาร์มต่อเนื่อง
 * - ข้ามทุกการสัมผัสที่เกิดขึ้นใน `<div data-ui>` อัตโนมัติ
 */
export function useHayDayTouchCamera({
  containerRef,
  controllerRef,
  handlersRef,
  isInputBlocked = false,
  fingerSwipeEnabled = false,
  twoFingerRotateEnabled = true,
}: UseHayDayTouchCameraOptions): void {
  const blockedRef = useRef<boolean>(isInputBlocked);
  blockedRef.current = isInputBlocked;

  const swipeModeRef = useRef<boolean>(fingerSwipeEnabled);
  swipeModeRef.current = fingerSwipeEnabled;

  const twoFingerRotateRef = useRef<boolean>(twoFingerRotateEnabled);
  twoFingerRotateRef.current = twoFingerRotateEnabled;

  const gestureRef = useRef({
    isPointerDown: false,
    hasDragged: false,
    longPressTriggered: false,
    longPressTimer: null as number | null,
    pointerButton: 0,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
    lastSwipePickX: 0,
    lastSwipePickY: 0,
    lastSwipePickMs: 0,
    pinchDist: null as number | null,
    pinchAngle: null as number | null,
    pinchMidX: 0,
    pinchMidY: 0,
    lastTouchTimeMs: 0,
    lastPickTimeMs: 0,
    lastHoverTimeMs: 0,
    cachedRect: { left: 0, top: 0, width: 1, height: 1 },
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const g = gestureRef.current;

    const clearLongPressTimer = () => {
      if (g.longPressTimer !== null) {
        window.clearTimeout(g.longPressTimer);
        g.longPressTimer = null;
      }
    };

    const scheduleLongPress = (clientX: number, clientY: number, source: 'touch' | 'mouse') => {
      clearLongPressTimer();
      g.longPressTriggered = false;
      const ctrl = controllerRef.current;
      if (!ctrl || ctrl.isPlacing || swipeModeRef.current || blockedRef.current) return;

      g.longPressTimer = window.setTimeout(() => {
        g.longPressTimer = null;
        if (!g.isPointerDown || g.hasDragged || blockedRef.current) return;
        g.longPressTriggered = true;
        handlersRef.current?.onLongPress?.(clientX, clientY, source);
      }, LONG_PRESS_DELAY_MS);
    };

    const refreshRect = () => {
      const r = container.getBoundingClientRect();
      g.cachedRect.left = r.left;
      g.cachedRect.top = r.top;
      g.cachedRect.width = Math.max(1, r.width);
      g.cachedRect.height = Math.max(1, r.height);
    };

    refreshRect();

    const resetGesture = (endControllerDrag: boolean) => {
      clearLongPressTimer();
      if (endControllerDrag && g.isPointerDown) {
        controllerRef.current?.endDrag(performance.now());
      }
      g.isPointerDown = false;
      g.hasDragged = false;
      g.pinchDist = null;
      g.pinchAngle = null;
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isEventFromDataUi(e.target)) return;
      e.preventDefault();
    };

    const handleDoubleClick = (e: MouseEvent) => {
      if (blockedRef.current || e.button !== 0) return;
      if (isEventFromDataUi(e.target)) return;
      if (performance.now() - g.lastTouchTimeMs < 500) return;
      const drift = Math.hypot(e.clientX - g.downX, e.clientY - g.downY);
      if (drift > 14) return;
      clearLongPressTimer();
      handlersRef.current?.onDoublePick?.(e.clientX, e.clientY, 'mouse');
    };

    const handleMouseHover = (e: MouseEvent) => {
      if (blockedRef.current || g.isPointerDown) return;
      if (performance.now() - g.lastTouchTimeMs < 500) return;
      if (isEventFromDataUi(e.target)) return;
      const now = performance.now();
      if (now - g.lastHoverTimeMs < 36) return;
      g.lastHoverTimeMs = now;
      handlersRef.current?.onHover?.(e.clientX, e.clientY);
    };

    // ─────────────────────── Touch Events (Mobile 60 FPS) ───────────────────────

    const handleTouchStart = (e: TouchEvent) => {
      const now = performance.now();
      g.lastTouchTimeMs = now;
      if (blockedRef.current) return;

      const ctrl = controllerRef.current;
      if (!ctrl) return;

      const isSecondFingerJoining = g.isPointerDown && e.touches.length >= 2;
      if (!isSecondFingerJoining) {
        if (isEventFromDataUi(e.target)) return;
        if (e.target !== container && !container.contains(e.target as Node)) return;
      }

      refreshRect();

      if (e.touches.length === 1) {
        const t0 = e.touches[0];
        g.isPointerDown = true;
        g.hasDragged = false;
        g.downX = t0.clientX;
        g.downY = t0.clientY;
        g.lastX = t0.clientX;
        g.lastY = t0.clientY;
        g.pinchDist = null;
        ctrl.beginDrag();

        if (ctrl.isPlacing) {
          clearLongPressTimer();
          handlersRef.current?.onPlacementMove?.(t0.clientX, t0.clientY);
        } else if (swipeModeRef.current) {
          clearLongPressTimer();
          g.lastSwipePickX = t0.clientX;
          g.lastSwipePickY = t0.clientY;
          g.lastSwipePickMs = now;
          handlersRef.current?.onSwipeBegin?.();
          handlersRef.current?.onSwipePick?.(t0.clientX, t0.clientY, 'touch');
        } else {
          scheduleLongPress(t0.clientX, t0.clientY, 'touch');
        }
      } else if (e.touches.length >= 2) {
        clearLongPressTimer();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        g.isPointerDown = true;
        g.hasDragged = true;
        g.pinchDist = Math.max(8, Math.hypot(dx, dy));
        g.pinchAngle = Math.atan2(dy, dx);
        g.pinchMidX = (t0.clientX + t1.clientX) * 0.5;
        g.pinchMidY = (t0.clientY + t1.clientY) * 0.5;
        ctrl.beginDrag();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const now = performance.now();
      g.lastTouchTimeMs = now;
      if (!g.isPointerDown || blockedRef.current) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      const ctrl = controllerRef.current;
      if (!ctrl) return;

      const rect = g.cachedRect;

      // 2 นิ้ว: Pinch-to-Zoom + หมุนมุมมองกล้องด้วยมือ (Twist) + เลื่อนกล้องพร้อมกันแบบ Hay Day
      if (e.touches.length >= 2) {
        clearLongPressTimer();
        g.hasDragged = true;
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dx = t0.clientX - t1.clientX;
        const dy = t0.clientY - t1.clientY;
        const dist = Math.max(8, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const midX = (t0.clientX + t1.clientX) * 0.5;
        const midY = (t0.clientY + t1.clientY) * 0.5;

        if (g.pinchDist === null || g.pinchAngle === null) {
          g.pinchDist = dist;
          g.pinchAngle = angle;
          g.pinchMidX = midX;
          g.pinchMidY = midY;
          return;
        }

        ctrl.panByScreenPoints(
          g.pinchMidX,
          g.pinchMidY,
          midX,
          midY,
          rect.left,
          rect.top,
          rect.width,
          rect.height
        );

        const zoomFactor = g.pinchDist / dist;
        ctrl.zoomAtScreenPoint(
          zoomFactor,
          midX,
          midY,
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          true
        );

        if (twoFingerRotateRef.current) {
          let deltaAngle = angle - g.pinchAngle;
          while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
          while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
          if (Math.abs(deltaAngle) > 0.012) {
            ctrl.theta += deltaAngle;
          }
        }

        g.pinchDist = dist;
        g.pinchAngle = angle;
        g.pinchMidX = midX;
        g.pinchMidY = midY;
        return;
      }

      if (e.touches.length === 0) return;

      const t0 = e.touches[0];
      const cx = t0.clientX;
      const cy = t0.clientY;
      const driftFromDown = Math.hypot(cx - g.downX, cy - g.downY);

      if (driftFromDown > TOUCH_DRAG_THRESHOLD_PX) {
        clearLongPressTimer();
      }

      // โหมดกำลังวางสิ่งก่อสร้าง/สัตว์/หิน: ลาก 1 นิ้วเพื่อเลื่อนตำแหน่งวัตถุบนพื้น
      if (ctrl.isPlacing) {
        if (driftFromDown > TOUCH_DRAG_THRESHOLD_PX) {
          g.hasDragged = true;
        }
        g.lastX = cx;
        g.lastY = cy;
        handlersRef.current?.onPlacementMove?.(cx, cy);
        return;
      }

      // โหมดปาดนิ้วทำฟาร์มรวดเดียวแบบ Hay Day (1 นิ้วปาดเก็บ/ปลูก/รดน้ำต่อเนื่อง)
      if (swipeModeRef.current) {
        if (driftFromDown > TOUCH_DRAG_THRESHOLD_PX) {
          g.hasDragged = true;
        }
        const swipeDist = Math.hypot(cx - g.lastSwipePickX, cy - g.lastSwipePickY);
        if (now - g.lastSwipePickMs >= 24 || swipeDist >= 10) {
          g.lastSwipePickX = cx;
          g.lastSwipePickY = cy;
          g.lastSwipePickMs = now;
          handlersRef.current?.onSwipePick?.(cx, cy, 'touch');
        }
        g.lastX = cx;
        g.lastY = cy;
        return;
      }

      // หากผู้เล่นเปิดโหมดจอยลากนิ้วเดินในหน้าตั้งค่าไว้ ให้ปล่อยให้ PlayerTouchSlideMove ขยับตัวละคร
      if (ctrl.touchSlideWalkEnabled) {
        if (driftFromDown > TOUCH_DRAG_THRESHOLD_PX) {
          g.hasDragged = true;
        }
        g.lastX = cx;
        g.lastY = cy;
        return;
      }

      // โหมดมาตรฐาน: ลากจอ 1 นิ้วแบบ Hay Day 100% ไหลลื่นไร้รอยต่อ
      if (!g.hasDragged) {
        if (driftFromDown > TOUCH_DRAG_THRESHOLD_PX) {
          g.hasDragged = true;
          // รีเซ็ต lastX, lastY ให้เท่ากับตำแหน่งปัจจุบันเพื่อป้องกันการกระตุกกระโดดในเฟรมแรก
          g.lastX = cx;
          g.lastY = cy;
        } else {
          return;
        }
      }

      ctrl.panByScreenPoints(
        g.lastX,
        g.lastY,
        cx,
        cy,
        rect.left,
        rect.top,
        rect.width,
        rect.height
      );
      g.lastX = cx;
      g.lastY = cy;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const now = performance.now();
      g.lastTouchTimeMs = now;
      if (!g.isPointerDown) return;

      // กรณียกออก 1 นิ้วจาก 2 นิ้ว: รีเซ็ตจุดอ้างอิงให้นิ้วที่เหลือลากต่อได้เนียนทันทีโดยไม่กระตุก
      if (e.touches.length > 0) {
        clearLongPressTimer();
        g.pinchDist = null;
        g.pinchAngle = null;
        g.hasDragged = true;
        g.lastX = e.touches[0].clientX;
        g.lastY = e.touches[0].clientY;
        return;
      }

      const wasDragged = g.hasDragged;
      const wasLongPress = g.longPressTriggered;
      const wasSwipeMode = swipeModeRef.current && !controllerRef.current?.isPlacing;
      resetGesture(true);
      g.longPressTriggered = false;

      if (blockedRef.current || wasDragged || wasLongPress || e.changedTouches.length === 0) {
        return;
      }

      if (isEventFromDataUi(e.target)) return;

      // ในโหมดปาดนิ้ว หากแตะจุดที่ไม่ใช่แปลงผัก (เช่น บ้าน บ่อน้ำ สัตว์) ให้ยังกดใช้งานได้ปกติ
      const t = e.changedTouches[0];
      if (wasSwipeMode) {
        handlersRef.current?.onPick?.(t.clientX, t.clientY, 'touch');
        return;
      }

      if (now - g.lastPickTimeMs < 75) return;
      g.lastPickTimeMs = now;
      handlersRef.current?.onPick?.(t.clientX, t.clientY, 'touch');
    };

    const handleTouchCancel = () => {
      g.lastTouchTimeMs = performance.now();
      g.longPressTriggered = false;
      resetGesture(true);
    };

    // ─────────────────────── Mouse & Wheel Events (PC / Tablet) ───────────────────────

    const handleMouseDown = (e: MouseEvent) => {
      const now = performance.now();
      if (now - g.lastTouchTimeMs < 500) return;
      if (blockedRef.current) return;
      if (isEventFromDataUi(e.target)) return;
      if (e.target !== container && !container.contains(e.target as Node)) return;

      const ctrl = controllerRef.current;
      if (!ctrl) return;

      refreshRect();
      g.isPointerDown = true;
      g.hasDragged = false;
      g.pointerButton = e.button;
      g.downX = e.clientX;
      g.downY = e.clientY;
      g.lastX = e.clientX;
      g.lastY = e.clientY;
      ctrl.beginDrag();

      if (ctrl.isPlacing && e.button === 0) {
        clearLongPressTimer();
        handlersRef.current?.onPlacementMove?.(e.clientX, e.clientY);
      } else if (swipeModeRef.current && e.button === 0 && !e.shiftKey) {
        clearLongPressTimer();
        g.lastSwipePickX = e.clientX;
        g.lastSwipePickY = e.clientY;
        g.lastSwipePickMs = now;
        handlersRef.current?.onSwipeBegin?.();
        handlersRef.current?.onSwipePick?.(e.clientX, e.clientY, 'mouse');
      } else if (e.button === 0) {
        scheduleLongPress(e.clientX, e.clientY, 'mouse');
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - g.lastTouchTimeMs < 500) return;
      if (!g.isPointerDown || blockedRef.current) return;

      const ctrl = controllerRef.current;
      if (!ctrl) return;

      const cx = e.clientX;
      const cy = e.clientY;
      const dx = cx - g.lastX;
      const dy = cy - g.lastY;
      const driftFromDown = Math.hypot(cx - g.downX, cy - g.downY);
      const rect = g.cachedRect;

      if (driftFromDown > MOUSE_DRAG_THRESHOLD_PX) {
        clearLongPressTimer();
      }

      if (ctrl.isPlacing && g.pointerButton === 0 && !e.shiftKey) {
        if (driftFromDown > MOUSE_DRAG_THRESHOLD_PX) {
          g.hasDragged = true;
        }
        g.lastX = cx;
        g.lastY = cy;
        handlersRef.current?.onPlacementMove?.(cx, cy);
        return;
      }

      if (swipeModeRef.current && g.pointerButton === 0 && !e.shiftKey) {
        if (driftFromDown > MOUSE_DRAG_THRESHOLD_PX) {
          g.hasDragged = true;
        }
        const swipeDist = Math.hypot(cx - g.lastSwipePickX, cy - g.lastSwipePickY);
        if (now - g.lastSwipePickMs >= 24 || swipeDist >= 10) {
          g.lastSwipePickX = cx;
          g.lastSwipePickY = cy;
          g.lastSwipePickMs = now;
          handlersRef.current?.onSwipePick?.(cx, cy, 'mouse');
        }
        g.lastX = cx;
        g.lastY = cy;
        return;
      }

      if (g.hasDragged || driftFromDown > MOUSE_DRAG_THRESHOLD_PX) {
        g.hasDragged = true;
        // คลิกขวาเมาส์ (ไม่กด Shift) = หมุนมุมมองรอบแกนเสริมบน PC, คลิกซ้ายลาก = ลากจอแบบ Hay Day 100%
        if (g.pointerButton === 2 && !e.shiftKey) {
          ctrl.orbitByPixels(dx, dy);
        } else {
          ctrl.panByScreenPoints(
            g.lastX,
            g.lastY,
            cx,
            cy,
            rect.left,
            rect.top,
            rect.width,
            rect.height
          );
        }
        g.lastX = cx;
        g.lastY = cy;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const now = performance.now();
      if (now - g.lastTouchTimeMs < 500) return;
      if (!g.isPointerDown) return;

      const wasDragged = g.hasDragged;
      const wasLongPress = g.longPressTriggered;
      const wasSwipeMode = swipeModeRef.current && !controllerRef.current?.isPlacing;
      const btn = g.pointerButton;
      resetGesture(true);
      g.longPressTriggered = false;

      if (blockedRef.current || wasDragged || wasLongPress || btn !== 0) return;
      if (isEventFromDataUi(e.target)) return;
      if (e.target !== container && !container.contains(e.target as Node)) return;

      if (wasSwipeMode) {
        handlersRef.current?.onPick?.(e.clientX, e.clientY, 'mouse');
        return;
      }

      if (now - g.lastPickTimeMs < 20) return;
      g.lastPickTimeMs = now;
      handlersRef.current?.onPick?.(e.clientX, e.clientY, 'mouse');
    };

    const handleWheel = (e: WheelEvent) => {
      if (blockedRef.current) return;
      if (isEventFromDataUi(e.target)) return;
      e.preventDefault();
      refreshRect();
      const ctrl = controllerRef.current;
      if (!ctrl) return;
      const zoomFactor = Math.exp(e.deltaY * 0.0012);
      ctrl.zoomAtScreenPoint(
        zoomFactor,
        e.clientX,
        e.clientY,
        g.cachedRect.left,
        g.cachedRect.top,
        g.cachedRect.width,
        g.cachedRect.height,
        false
      );
    };

    const handleWindowBlur = () => {
      g.longPressTriggered = false;
      resetGesture(true);
    };

    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('dblclick', handleDoubleClick);
    container.addEventListener('mousemove', handleMouseHover, { passive: true });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', refreshRect, { passive: true });

    return () => {
      clearLongPressTimer();
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('dblclick', handleDoubleClick);
      container.removeEventListener('mousemove', handleMouseHover);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);

      container.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', refreshRect);
      resetGesture(false);
    };
  }, [containerRef, controllerRef, handlersRef]);
}
