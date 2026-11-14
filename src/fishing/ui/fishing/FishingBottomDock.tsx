import React from 'react';
import { ChevronDown, ChevronUp, Gamepad2, Minus, Plus } from 'lucide-react';
import { CameraPreset } from '../../core/GameConfig';
import { GameHUDState } from '../../core/GameState';
import { useI18n } from '../../localization/i18n';
import { FishingState } from '../../systems/fishing/FishingState';

interface FishingBottomDockProps {
  hud: GameHUDState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleJoysticks: () => void;
  onBeginCast: () => void;
  onReleaseCast: () => void;
  onAimChange: (angleDeg: number) => void;
  onStrike: () => void;
  onReelStart: () => void;
  onReelStop: () => void;
  onCancelCast: () => void;
  onAdjustDrag: (delta: number) => void;
  onCameraPresetChange: (preset: CameraPreset) => void;
}

export const FishingBottomDock: React.FC<FishingBottomDockProps> = ({
  hud,
  collapsed,
  onToggleCollapse,
  onToggleJoysticks,
  onBeginCast,
  onReleaseCast,
  onAimChange,
  onStrike,
  onReelStart,
  onReelStop,
  onCancelCast,
  onAdjustDrag,
  onCameraPresetChange,
}) => {
  const { t } = useI18n();
  const state = hud.fishingState;

  const tensionRatio =
    hud.maxLineStrengthN > 0 ? Math.min(1, hud.lineTensionN / hud.maxLineStrengthN) : 0;

  const isFightPhase =
    state === FishingState.HOOKED ||
    state === FishingState.FIGHTING ||
    state === FishingState.REELING;

  const isTerminalModalState =
    state === FishingState.RESULT ||
    state === FishingState.FISH_ESCAPED ||
    state === FishingState.HOOK_FAILED ||
    state === FishingState.LINE_BROKEN;

  const hintKey =
    state === FishingState.IDLE
      ? 'hint.IDLE'
      : state === FishingState.CASTING
      ? 'hint.CASTING'
      : state === FishingState.WAITING
      ? 'hint.WAITING'
      : state === FishingState.BITE
      ? 'hint.BITE'
      : state === FishingState.REELING
      ? 'hint.REELING'
      : isFightPhase
      ? 'hint.FIGHTING'
      : 'hint.RESULT';

  let tensionBarColor = 'bg-sky-400';
  if (tensionRatio > 0.84) {
    tensionBarColor = 'bg-red-500';
  } else if (tensionRatio > 0.25) {
    tensionBarColor = 'bg-emerald-400';
  }

  // On desktop (lg:), narrow the center dock slightly when Left & Right Joysticks are active so they never overlap
  const dockWidthClass = hud.virtualJoysticks
    ? 'w-[94vw] lg:w-[min(740px,calc(100vw-296px))]'
    : 'w-[min(920px,94vw)]';

  return (
    <div
      className={`pointer-events-none fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 ${dockWidthClass} flex flex-col items-center`}
    >
      {/* Collapse / Expand Cinema Toggle + Quick Joystick Toggle */}
      <div className="pointer-events-auto mb-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex items-center gap-1.5 rounded-t-lg rounded-b-md bg-slate-950/90 border border-white/12 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{collapsed ? t('menu.zenShow') : t('menu.zenHide')}</span>
        </button>

        <button
          type="button"
          onClick={onToggleJoysticks}
          aria-pressed={hud.virtualJoysticks}
          className={`inline-flex items-center gap-1.5 rounded-t-lg rounded-b-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
            hud.virtualJoysticks
              ? 'bg-slate-900/95 border-amber-400/45 text-amber-300 hover:text-amber-200'
              : 'bg-slate-950/90 border-white/12 text-slate-400 hover:text-white'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>{hud.virtualJoysticks ? t('settings.joysticksOn') : t('settings.joysticksOff')}</span>
        </button>
      </div>

      {/* Main Dock Surface */}
      <div
        className={`pointer-events-auto w-full rounded-xl bg-slate-950/92 border border-white/12 p-3.5 sm:p-4 transition-transform duration-200 ${
          collapsed ? 'translate-y-[125%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        {/* Row 1: Unboxed Angler Telemetry Metadata + Camera Segmented Control */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 tabular-nums">
            <span className="font-semibold text-white">{t(`state.${state}`)}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              {t('stats.level')} {hud.level}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              {hud.coins} {t('stats.coins')}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              {t('fishing.distance')} {hud.fishDistanceM.toFixed(1)}m
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>
              {t('fishing.depth')} {hud.waterDepthM.toFixed(1)}m
            </span>
          </div>

          {/* Camera Framing Segmented Controls */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-white/8 overflow-x-auto max-w-full">
            {(['angler', 'bobber', 'underwater', 'cinematic'] as const).map((cam) => (
              <button
                key={cam}
                type="button"
                onClick={() => onCameraPresetChange(cam)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  hud.cameraPreset === cam
                    ? 'bg-slate-100 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {t(`camera.${cam}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Contextual Gauges (Cast Power OR Line Tension + Fish Stamina + Counter-Pull Feedback) */}
        <div className="pt-2.5 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
          <div className="md:col-span-7 space-y-2">
            {state === FishingState.IDLE ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-slate-300">{t('fishing.power')}</span>
                  <span className="font-mono font-semibold text-amber-400">
                    {Math.round(hud.castPower * 100)}%
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-transform duration-75 origin-left"
                    style={{ transform: `scaleX(${Math.max(0.04, hud.castPower)})` }}
                  />
                </div>

                <div className="flex items-center gap-3 pt-0.5">
                  <label htmlFor="aim-slider" className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                    {t('fishing.aim')} ({hud.aimAngleDeg > 0 ? `+${Math.round(hud.aimAngleDeg)}` : Math.round(hud.aimAngleDeg)}°)
                  </label>
                  <input
                    id="aim-slider"
                    type="range"
                    min={-42}
                    max={42}
                    step={1}
                    value={hud.aimAngleDeg}
                    onChange={(e) => onAimChange(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs tabular-nums gap-2">
                  <span className="text-slate-300">
                    {t('fishing.tension')} · {hud.lineTensionN.toFixed(1)} / {hud.maxLineStrengthN} N
                  </span>
                  {isFightPhase && (
                    <span className="text-slate-300">
                      {t('fishing.stamina')} {Math.round(hud.fishStaminaRatio * 100)}%
                    </span>
                  )}
                  {hud.isNibbling && state === FishingState.WAITING && (
                    <span className="text-amber-300 font-medium">{t('fishing.nibbleAlert')}</span>
                  )}
                </div>

                {/* Line Tension Meter */}
                <div className="relative h-3 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full ${tensionBarColor} transition-transform duration-75 origin-left`}
                    style={{ transform: `scaleX(${Math.max(0.02, tensionRatio)})` }}
                  />
                </div>

                {/* Fish Stamina Bar during Fight */}
                {isFightPhase && (
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-transform duration-100 origin-left"
                      style={{ transform: `scaleX(${Math.max(0.02, hud.fishStaminaRatio)})` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Counter-Pull Hint during Active Fish Fight */}
            {isFightPhase && hud.isCounterPulling ? (
              <p className="text-xs font-medium text-emerald-400 truncate">
                {t('fishing.counterPullGood')}
              </p>
            ) : isFightPhase && Math.abs(hud.fishPullDirX) > 0.2 ? (
              <p className="text-xs font-medium text-amber-300 truncate">
                {hud.fishPullDirX > 0 ? t('fishing.pullLeftHint') : t('fishing.pullRightHint')}
              </p>
            ) : (
              <p className="text-xs text-slate-400 truncate">{t(hintKey)}</p>
            )}
          </div>

          {/* Right Column: Interactive Drag & Primary Angling Trigger */}
          <div className="md:col-span-5 flex items-center justify-end gap-2.5">
            {/* Reel Drag Clutch Control */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 shrink-0">
              <button
                type="button"
                aria-label="Decrease Drag"
                onClick={() => onAdjustDrag(-0.1)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="px-1.5 text-center tabular-nums">
                <div className="text-[11px] text-slate-400 leading-none">{t('fishing.drag')}</div>
                <div className="text-xs font-mono font-semibold text-slate-100 mt-0.5">
                  {Math.round(hud.reelDragRatio * 100)}%
                </div>
              </div>
              <button
                type="button"
                aria-label="Increase Drag"
                onClick={() => onAdjustDrag(0.1)}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* State-Specific Action Controls */}
            {state === FishingState.IDLE && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore synthetic pointer events
                  }
                  onBeginCast();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  onReleaseCast();
                }}
                onPointerCancel={onReleaseCast}
                onLostPointerCapture={() => {
                  if (hud.castPower > 0) onReleaseCast();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-semibold text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer select-none touch-none"
              >
                {hud.castPower > 0 ? t('fishing.releaseToCast') : t('fishing.holdToCast')}
              </button>
            )}

            {state === FishingState.CASTING && (
              <button
                type="button"
                disabled
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-slate-800 text-slate-400 font-semibold text-sm whitespace-nowrap shrink-0"
              >
                {t('state.CASTING')}
              </button>
            )}

            {state === FishingState.WAITING && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore synthetic pointer events
                    }
                    onReelStart();
                  }}
                  onPointerUp={onReelStop}
                  onPointerCancel={onReelStop}
                  onLostPointerCapture={onReelStop}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none touch-none"
                >
                  {t('fishing.reel')}
                </button>
                <button
                  type="button"
                  onClick={onCancelCast}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-lg border border-white/15 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t('fishing.cancelCast')}
                </button>
              </div>
            )}

            {state === FishingState.BITE && (
              <button
                type="button"
                onClick={onStrike}
                className="min-h-[44px] px-6 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-[0.97] text-slate-950 font-bold text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('fishing.strike')}
              </button>
            )}

            {isFightPhase && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } catch {
                    // Ignore synthetic pointer events
                  }
                  onReelStart();
                }}
                onPointerUp={onReelStop}
                onPointerCancel={onReelStop}
                onLostPointerCapture={onReelStop}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] text-slate-950 font-bold text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer select-none touch-none"
              >
                {t('fishing.holdReel')}
              </button>
            )}

            {(state === FishingState.LANDED || isTerminalModalState) && (
              <span className="text-xs font-medium text-amber-400 px-3 whitespace-nowrap">
                {t(`state.${state}`)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
