import React, { useEffect, useRef, useState } from 'react';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import { FishingState } from '../../systems/fishing/FishingState';

interface DualTouchJoysticksProps {
  hud: GameHUDState;
  dockCollapsed: boolean;
  onLeftStickChange: (x: number, y: number) => void;
  onRightStickChange: (x: number, y: number, crankRadPerSec: number, active: boolean) => void;
}

const MAX_RADIUS_PX = 36;

export const DualTouchJoysticks: React.FC<DualTouchJoysticksProps> = ({
  hud,
  dockCollapsed,
  onLeftStickChange,
  onRightStickChange,
}) => {
  const { t } = useI18n();

  const leftCbRef = useRef(onLeftStickChange);
  leftCbRef.current = onLeftStickChange;
  const rightCbRef = useRef(onRightStickChange);
  rightCbRef.current = onRightStickChange;

  useEffect(() => {
    return () => {
      leftCbRef.current(0, 0);
      rightCbRef.current(0, 0, 0, false);
    };
  }, []);

  // Left Stick UI state
  const leftPointerIdRef = useRef<number | null>(null);
  const [leftOffset, setLeftOffset] = useState({ x: 0, y: 0, active: false });

  // Right Stick UI state (supports both directional tilt & circular reel cranking)
  const rightPointerIdRef = useRef<number | null>(null);
  const lastRightAngleRef = useRef<number | null>(null);
  const lastRightTimeRef = useRef<number>(0);
  const [rightState, setRightState] = useState({
    x: 0,
    y: 0,
    angleRad: 0,
    active: false,
  });

  const state = hud.fishingState;
  const isFightPhase =
    state === FishingState.HOOKED ||
    state === FishingState.FIGHTING ||
    state === FishingState.REELING;

  const tensionRatio =
    hud.maxLineStrengthN > 0 ? Math.min(1, hud.lineTensionN / hud.maxLineStrengthN) : 0;

  // Tactile visual micro-rumble synced to HapticsManager intensity during fights/bites
  const rumblePx =
    hud.hapticsEnabled && hud.hapticRumbleIntensity > 0.1
      ? hud.hapticRumbleIntensity * 2.6
      : 0;
  const rumbleJitterX = rumblePx > 0 ? Math.sin(hud.lineTensionN * 7.3) * rumblePx : 0;
  const rumbleJitterY = rumblePx > 0 ? Math.cos(hud.lineTensionN * 9.1) * rumblePx : 0;

  const computeClampedStick = (el: HTMLElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(MAX_RADIUS_PX, dist);
    const angle = Math.atan2(dy, dx);
    const px = dist > 0.001 ? Math.cos(angle) * clampedDist : 0;
    const py = dist > 0.001 ? Math.sin(angle) * clampedDist : 0;
    return {
      px,
      py,
      nx: px / MAX_RADIUS_PX,
      ny: py / MAX_RADIUS_PX,
      angle,
      dist,
    };
  };

  // Determine Right Joystick contextual label & ring color
  const rightLabelKey =
    state === FishingState.IDLE
      ? 'joystick.rightCast'
      : state === FishingState.BITE
      ? 'joystick.rightStrike'
      : 'joystick.rightReel';

  let rightAccentStroke = '#38bdf8';
  let rightKnobClass = 'bg-sky-400 border-sky-200 text-slate-950';
  if (state === FishingState.IDLE) {
    rightAccentStroke = '#f59e0b';
    rightKnobClass = 'bg-amber-400 border-amber-200 text-slate-950';
  } else if (state === FishingState.BITE) {
    rightAccentStroke = '#facc15';
    rightKnobClass = 'bg-amber-300 border-white text-slate-950';
  } else if (isFightPhase) {
    if (tensionRatio > 0.84) {
      rightAccentStroke = '#ef4444';
      rightKnobClass = 'bg-red-500 border-red-200 text-white';
    } else {
      rightAccentStroke = '#34d399';
      rightKnobClass = 'bg-emerald-400 border-emerald-200 text-slate-950';
    }
  }

  // Determine Left Joystick counter-pull cue during fish fights
  const needPullLeft = isFightPhase && hud.fishPullDirX > 0.18;
  const needPullRight = isFightPhase && hud.fishPullDirX < -0.18;

  const mobileBottomClass = dockCollapsed
    ? 'bottom-5'
    : 'bottom-[228px] sm:bottom-[204px] lg:bottom-5';

  return (
    <>
      {/* LEFT VIRTUAL JOYSTICK: Rod Aiming, Lure Twitch & Fight Counter-Pull */}
      <div
        className={`pointer-events-auto fixed left-3.5 sm:left-5 ${mobileBottomClass} z-20 flex flex-col items-center gap-1.5 select-none touch-none transition-transform duration-150`}
        style={{
          transform: `translate3d(${rumbleJitterX.toFixed(1)}px, ${rumbleJitterY.toFixed(1)}px, 0)`,
        }}
      >
        <div
          role="slider"
          aria-label={t('joystick.leftLabel')}
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={Math.round((leftOffset.x / MAX_RADIUS_PX) * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore synthetic pointer capture error
            }
            leftPointerIdRef.current = e.pointerId;
            const res = computeClampedStick(e.currentTarget, e.clientX, e.clientY);
            setLeftOffset({ x: res.px, y: res.py, active: true });
            onLeftStickChange(res.nx, res.ny);
          }}
          onPointerMove={(e) => {
            if (leftPointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            const res = computeClampedStick(e.currentTarget, e.clientX, e.clientY);
            setLeftOffset({ x: res.px, y: res.py, active: true });
            onLeftStickChange(res.nx, res.ny);
          }}
          onPointerUp={(e) => {
            if (leftPointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            leftPointerIdRef.current = null;
            setLeftOffset({ x: 0, y: 0, active: false });
            onLeftStickChange(0, 0);
          }}
          onPointerCancel={(e) => {
            if (leftPointerIdRef.current !== e.pointerId) return;
            leftPointerIdRef.current = null;
            setLeftOffset({ x: 0, y: 0, active: false });
            onLeftStickChange(0, 0);
          }}
          onLostPointerCapture={() => {
            if (leftPointerIdRef.current === null) return;
            leftPointerIdRef.current = null;
            setLeftOffset({ x: 0, y: 0, active: false });
            onLeftStickChange(0, 0);
          }}
          className={`relative w-[104px] h-[104px] sm:w-[114px] sm:h-[114px] rounded-full bg-slate-950/88 border ${
            hud.isCounterPulling
              ? 'border-emerald-400/80'
              : leftOffset.active
              ? 'border-amber-400/70'
              : 'border-white/18'
          } flex items-center justify-center shadow-xl cursor-grab active:cursor-grabbing touch-none`}
        >
          {/* Directional Guide Ring & Counter-Steer Arcs */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            {/* Upward Strike / Pump Chevron */}
            <path
              d="M44 16 L50 10 L56 16"
              fill="none"
              stroke={state === FishingState.BITE ? '#facc15' : 'rgba(255,255,255,0.32)'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Left Counter-Pull Highlight */}
            <path
              d="M16 44 L10 50 L16 56"
              fill="none"
              stroke={needPullLeft ? '#34d399' : 'rgba(255,255,255,0.28)'}
              strokeWidth={needPullLeft ? '3' : '2'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Right Counter-Pull Highlight */}
            <path
              d="M84 44 L90 50 L84 56"
              fill="none"
              stroke={needPullRight ? '#34d399' : 'rgba(255,255,255,0.28)'}
              strokeWidth={needPullRight ? '3' : '2'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Movable Thumb Stick Knob */}
          <div
            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center shadow-md transition-transform ${
              leftOffset.active ? 'duration-0' : 'duration-150'
            } ${
              hud.isCounterPulling
                ? 'bg-emerald-400 border-emerald-100 text-slate-950'
                : leftOffset.active
                ? 'bg-slate-100 border-white text-slate-950'
                : 'bg-slate-800/95 border-white/25 text-slate-200'
            }`}
            style={{
              transform: `translate3d(${leftOffset.x.toFixed(1)}px, ${leftOffset.y.toFixed(1)}px, 0)`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-current opacity-80" />
          </div>
        </div>

        <span className="text-[11px] font-medium text-slate-300 whitespace-nowrap">
          {isFightPhase ? t('joystick.leftFight') : t('joystick.leftLabel')}
        </span>
      </div>

      {/* RIGHT VIRTUAL JOYSTICK: Cast Charge, Hook Strike & Circular Reel Crank */}
      <div
        className={`pointer-events-auto fixed right-3.5 sm:right-5 ${mobileBottomClass} z-20 flex flex-col items-center gap-1.5 select-none touch-none transition-transform duration-150`}
        style={{
          transform: `translate3d(${(-rumbleJitterX).toFixed(1)}px, ${rumbleJitterY.toFixed(1)}px, 0)`,
        }}
      >
        <div
          role="slider"
          aria-label={t(rightLabelKey)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            state === FishingState.IDLE
              ? Math.round(hud.castPower * 100)
              : Math.round(tensionRatio * 100)
          }
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Ignore synthetic pointer capture error
            }
            rightPointerIdRef.current = e.pointerId;
            const res = computeClampedStick(e.currentTarget, e.clientX, e.clientY);
            lastRightAngleRef.current = res.angle;
            lastRightTimeRef.current = performance.now();
            setRightState({
              x: res.px,
              y: res.py,
              angleRad: res.angle,
              active: true,
            });
            onRightStickChange(res.nx, res.ny, 0, true);
          }}
          onPointerMove={(e) => {
            if (rightPointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            const res = computeClampedStick(e.currentTarget, e.clientX, e.clientY);
            const now = performance.now();
            const dtSec = Math.max(0.008, (now - lastRightTimeRef.current) / 1000);
            let crankRadPerSec = 0;

            if (lastRightAngleRef.current !== null && res.dist > 8) {
              let deltaAngle = res.angle - lastRightAngleRef.current;
              while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
              while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
              crankRadPerSec = Math.min(14, Math.abs(deltaAngle) / dtSec);
            }

            lastRightAngleRef.current = res.angle;
            lastRightTimeRef.current = now;
            setRightState({
              x: res.px,
              y: res.py,
              angleRad: res.angle,
              active: true,
            });
            onRightStickChange(res.nx, res.ny, crankRadPerSec, true);
          }}
          onPointerUp={(e) => {
            if (rightPointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            rightPointerIdRef.current = null;
            lastRightAngleRef.current = null;
            setRightState((prev) => ({ ...prev, x: 0, y: 0, active: false }));
            onRightStickChange(0, 0, 0, false);
          }}
          onPointerCancel={(e) => {
            if (rightPointerIdRef.current !== e.pointerId) return;
            rightPointerIdRef.current = null;
            lastRightAngleRef.current = null;
            setRightState((prev) => ({ ...prev, x: 0, y: 0, active: false }));
            onRightStickChange(0, 0, 0, false);
          }}
          onLostPointerCapture={() => {
            if (rightPointerIdRef.current === null) return;
            rightPointerIdRef.current = null;
            lastRightAngleRef.current = null;
            setRightState((prev) => ({ ...prev, x: 0, y: 0, active: false }));
            onRightStickChange(0, 0, 0, false);
          }}
          className={`relative w-[104px] h-[104px] sm:w-[114px] sm:h-[114px] rounded-full bg-slate-950/88 border ${
            state === FishingState.BITE
              ? 'border-amber-300'
              : rightState.active
              ? 'border-sky-400/80'
              : 'border-white/18'
          } flex items-center justify-center shadow-xl cursor-grab active:cursor-grabbing touch-none`}
        >
          {/* Circular Reel Spool Track */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              transform: `rotate(${((rightState.angleRad * 180) / Math.PI).toFixed(1)}deg)`,
            }}
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={rightAccentStroke}
              strokeWidth="2.8"
              strokeDasharray="48 220"
              strokeLinecap="round"
            />
          </svg>

          {/* Movable Reel Crank Knob */}
          <div
            className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold text-[11px] shadow-md transition-transform ${
              rightState.active ? 'duration-0' : 'duration-150'
            } ${
              rightState.active
                ? rightKnobClass
                : state === FishingState.BITE
                ? 'bg-amber-400 border-white text-slate-950'
                : 'bg-slate-800/95 border-white/25 text-slate-100'
            }`}
            style={{
              transform: `translate3d(${rightState.x.toFixed(1)}px, ${rightState.y.toFixed(1)}px, 0)`,
            }}
          >
            <div className="w-3 h-3 rounded-full border-2 border-current" />
          </div>
        </div>

        <span className="text-[11px] font-medium text-slate-300 whitespace-nowrap">
          {t(rightLabelKey)}
        </span>
      </div>
    </>
  );
};
