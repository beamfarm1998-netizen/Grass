// src/game/player/PlayerTouchSlideMove.ts
import type { CameraMode } from '../../types/game';
import type { WorldMoveDirection } from './PlayerKeyboardWASD';

const DEADZONE_PX = 10;
const MAX_RADIUS_PX = 52;

/**
 * ตัวจัดการการเลื่อนนิ้วบนหน้าจอมือถือเพื่อขยับเดินทันที (Floating Touch-Slide-to-Walk)
 * - แตะแล้วเลื่อน 1 นิ้วบนฉาก 3D: เดิน 360 องศาตามทิศทางที่เลื่อนเทียบกับมุมกล้องปัจจุบันทันที ไม่ต้องกดเดินทีละจุด
 * - จุดศูนย์กลางเลื่อนตามนิ้วอัตโนมัติ (Dynamic Floating Anchor) เปลี่ยนทิศกลับหลังหันได้ทันทีไม่ต้องยกนิ้ว
 * - เมื่อแตะ 2 นิ้วพร้อมกัน (ซูม/หมุน/แพนกล้อง): ยกเลิกการเดินอัตโนมัติทันทีเพื่อไม่ให้ชนกับการบังคับกล้อง
 */
export class PlayerTouchSlideMove {
  private domElement: HTMLElement | null = null;
  private enabled = true;
  private activeTouchId: number | null = null;
  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;
  private canvasLeft = 0;
  private canvasTop = 0;
  private isSliding = false;

  private indicatorContainer: HTMLElement | null = null;
  private indicatorRing: HTMLElement | null = null;
  private indicatorKnob: HTMLElement | null = null;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isActivelySliding(): boolean {
    return this.enabled && this.isSliding && this.activeTouchId !== null;
  }

  public setIndicatorElements(
    container: HTMLElement | null,
    ring: HTMLElement | null,
    knob: HTMLElement | null
  ): void {
    this.indicatorContainer = container;
    this.indicatorRing = ring;
    this.indicatorKnob = knob;
    this.syncIndicatorDom();
  }

  public clear(): void {
    this.activeTouchId = null;
    this.isSliding = false;
    this.syncIndicatorDom();
  }

  public attach(domElement: HTMLElement): void {
    this.detach();
    this.domElement = domElement;
    domElement.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.handleTouchCancel, { passive: true });
    window.addEventListener('blur', this.handleBlur);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public detach(): void {
    if (this.domElement) {
      this.domElement.removeEventListener('touchstart', this.handleTouchStart);
      this.domElement = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('touchmove', this.handleTouchMove);
      window.removeEventListener('touchend', this.handleTouchEnd);
      window.removeEventListener('touchcancel', this.handleTouchCancel);
      window.removeEventListener('blur', this.handleBlur);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.clear();
  }

  /**
   * คำนวณเวกเตอร์ทิศทางเดินบนระนาบพื้นโลก (XZ) พร้อมสเกลความเร็วแบบอนาล็อก (0.35..1.0)
   * โดยไม่สร้าง Object ใหม่ต่อเฟรม (Zero-GC)
   */
  public computeWorldDirection(
    cameraMode: CameraMode,
    theta: number,
    fppYaw: number,
    out: WorldMoveDirection
  ): boolean {
    if (!this.enabled || !this.isSliding || this.activeTouchId === null) {
      out.x = 0;
      out.z = 0;
      return false;
    }

    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const dist = Math.hypot(dx, dy);

    if (dist < DEADZONE_PX) {
      out.x = 0;
      out.z = 0;
      return false;
    }

    // บนหน้าจอ: เลื่อนขึ้น (dy < 0) = เดินหน้า (+forward), เลื่อนขวา (dx > 0) = เดินขวา (+right)
    const forwardAxis = -dy / dist;
    const rightAxis = dx / dist;

    const fx = cameraMode === 'fpp' ? Math.sin(fppYaw) : -Math.sin(theta);
    const fz = cameraMode === 'fpp' ? Math.cos(fppYaw) : -Math.cos(theta);
    const rx = -fz;
    const rz = fx;

    const wx = fx * forwardAxis + rx * rightAxis;
    const wz = fz * forwardAxis + rz * rightAxis;
    const wLen = Math.hypot(wx, wz);

    if (wLen < 1e-5) {
      out.x = 0;
      out.z = 0;
      return false;
    }

    const normSpeed = Math.min(
      1,
      Math.max(0, (dist - DEADZONE_PX) / (MAX_RADIUS_PX - DEADZONE_PX))
    );
    const speedScale = 0.35 + 0.65 * normSpeed;

    out.x = (wx / wLen) * speedScale;
    out.z = (wz / wLen) * speedScale;
    return true;
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (!this.enabled) return;

    // หากแตะ 2 นิ้วขึ้นไป ให้ยกเลิกการเดินเพื่อให้ใช้ควบคุมกล้อง (ซูม/หมุน/แพน) ได้ทันที
    if (e.touches.length >= 2) {
      this.clear();
      return;
    }

    if (!this.domElement || e.target !== this.domElement || e.touches.length !== 1) {
      return;
    }

    const rect = this.domElement.getBoundingClientRect();
    this.canvasLeft = rect.left;
    this.canvasTop = rect.top;

    const t = e.touches[0];
    this.activeTouchId = t.identifier;
    this.originX = t.clientX;
    this.originY = t.clientY;
    this.currentX = t.clientX;
    this.currentY = t.clientY;
    this.isSliding = false;
    this.syncIndicatorDom();
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.enabled || this.activeTouchId === null) return;

    if (e.touches.length >= 2) {
      this.clear();
      return;
    }

    let tracked: Touch | null = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === this.activeTouchId) {
        tracked = e.touches[i];
        break;
      }
    }
    if (!tracked) return;

    this.currentX = tracked.clientX;
    this.currentY = tracked.clientY;

    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const dist = Math.hypot(dx, dy);

    if (!this.isSliding && dist >= DEADZONE_PX) {
      this.isSliding = true;
    }

    // Dynamic Floating Anchor: ดึงจุดศูนย์กลางตามนิ้วเมื่อเลื่อนเกินรัศมีสูงสุด เพื่อให้หักเลี้ยวกลับทิศได้ทันที
    if (dist > MAX_RADIUS_PX) {
      const pullRatio = (dist - MAX_RADIUS_PX) / dist;
      this.originX += dx * pullRatio;
      this.originY += dy * pullRatio;
    }

    if (this.isSliding) {
      this.syncIndicatorDom();
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    if (this.activeTouchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.activeTouchId) {
        this.clear();
        return;
      }
    }

    if (e.touches.length === 0) {
      this.clear();
    }
  };

  private handleTouchCancel = (): void => {
    this.clear();
  };

  private handleBlur = (): void => {
    this.clear();
  };

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.clear();
    }
  };

  private syncIndicatorDom(): void {
    const container = this.indicatorContainer;
    const ring = this.indicatorRing;
    const knob = this.indicatorKnob;
    if (!container || !ring || !knob) return;

    if (!this.enabled || !this.isSliding || this.activeTouchId === null) {
      container.style.opacity = '0';
      return;
    }

    const ox = this.originX - this.canvasLeft;
    const oy = this.originY - this.canvasTop;
    const kx = this.currentX - this.canvasLeft;
    const ky = this.currentY - this.canvasTop;

    container.style.opacity = '1';
    ring.style.transform = `translate3d(${ox}px, ${oy}px, 0) translate(-50%, -50%)`;
    knob.style.transform = `translate3d(${kx}px, ${ky}px, 0) translate(-50%, -50%)`;
  }
}
