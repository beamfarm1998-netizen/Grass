// src/game/player/PlayerKeyboardWASD.ts
import type { CameraMode } from '../../types/game';

export interface WorldMoveDirection {
  x: number;
  z: number;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * ตัวจัดการปุ่มเดินคีย์บอร์ด W / A / S / D แบบอ้างอิงทิศทางมุมกล้องปัจจุบัน (Zero-GC)
 * - W (KeyW): เดินหน้า
 * - S (KeyS): ถอยหลัง
 * - A (KeyA): เอี้ยวซ้าย (เดินไปทางซ้าย)
 * - D (KeyD): เอี้ยวขวา (เดินไปทางขวา)
 */
export class PlayerKeyboardWASD {
  private pressed = {
    w: false,
    s: false,
    a: false,
    d: false,
  };
  private enabled = true;
  private attached = false;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clear(): void {
    this.pressed.w = false;
    this.pressed.s = false;
    this.pressed.a = false;
    this.pressed.d = false;
  }

  public attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  public detach(): void {
    if (!this.attached || typeof window === 'undefined') return;
    this.attached = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.clear();
  }

  public setKeyStateForTest(key: 'w' | 's' | 'a' | 'd', isDown: boolean): void {
    if (!this.enabled) {
      this.clear();
      return;
    }
    this.pressed[key] = isDown;
  }

  public getAxes(): { forward: number; right: number; isPressed: boolean } {
    if (!this.enabled) {
      return { forward: 0, right: 0, isPressed: false };
    }
    const forward = (this.pressed.w ? 1 : 0) - (this.pressed.s ? 1 : 0);
    const right = (this.pressed.d ? 1 : 0) - (this.pressed.a ? 1 : 0);
    return {
      forward,
      right,
      isPressed: forward !== 0 || right !== 0,
    };
  }

  /**
   * คำนวณเวกเตอร์ทิศทางเดินบนระนาบพื้นโลก (XZ) ตามมุมกล้องปัจจุบันโดยไม่สร้าง Object ใหม่ต่อเฟรม
   */
  public computeWorldDirection(
    cameraMode: CameraMode,
    theta: number,
    fppYaw: number,
    out: WorldMoveDirection
  ): boolean {
    if (!this.enabled) {
      out.x = 0;
      out.z = 0;
      return false;
    }

    const forwardAxis = (this.pressed.w ? 1 : 0) - (this.pressed.s ? 1 : 0);
    const rightAxis = (this.pressed.d ? 1 : 0) - (this.pressed.a ? 1 : 0);

    if (forwardAxis === 0 && rightAxis === 0) {
      out.x = 0;
      out.z = 0;
      return false;
    }

    // ทิศทางมองไปข้างหน้าในแนวราบของกล้อง (Forward)
    const fx = cameraMode === 'fpp' ? Math.sin(fppYaw) : -Math.sin(theta);
    const fz = cameraMode === 'fpp' ? Math.cos(fppYaw) : -Math.cos(theta);

    // ทิศทางขวามือของกล้อง (Right = Forward × Up)
    const rx = -fz;
    const rz = fx;

    const wx = fx * forwardAxis + rx * rightAxis;
    const wz = fz * forwardAxis + rz * rightAxis;
    const len = Math.hypot(wx, wz);

    if (len < 1e-5) {
      out.x = 0;
      out.z = 0;
      return false;
    }

    out.x = wx / len;
    out.z = wz / len;
    return true;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isEditableElement(e.target)) return;

    switch (e.code) {
      case 'KeyW':
        this.pressed.w = true;
        break;
      case 'KeyS':
        this.pressed.s = true;
        break;
      case 'KeyA':
        this.pressed.a = true;
        break;
      case 'KeyD':
        this.pressed.d = true;
        break;
      default:
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case 'KeyW':
        this.pressed.w = false;
        break;
      case 'KeyS':
        this.pressed.s = false;
        break;
      case 'KeyA':
        this.pressed.a = false;
        break;
      case 'KeyD':
        this.pressed.d = false;
        break;
      default:
        break;
    }
  };

  private handleWindowBlur = (): void => {
    this.clear();
  };

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.clear();
    }
  };
}
