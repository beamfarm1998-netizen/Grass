// src/components/ui/DroneMinimap.tsx
// 🗺️ เรดาร์มินิแมพ SVG แสดงขอบเขตฟาร์ม แปลงผัก ต้นไม้ แท่นชาร์จ Helipad โดรน และผู้เล่น
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Navigation, Crosshair } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { FarmPlot, PlacedTree } from '../../types/game';

interface DroneMinimapProps {
  plots?: FarmPlot[];
  trees?: PlacedTree[];
  dronePos?: { x: number; z: number; heading?: number };
  playerPos?: { x: number; z: number; heading?: number };
  targetPos?: { x: number; z: number } | null;
  helipadPos?: { x: number; z: number };
  show?: boolean;
}

export const DroneMinimap: React.FC<DroneMinimapProps> = ({
  plots = [],
  trees = [],
  dronePos = { x: -2, z: 0, heading: 0 },
  playerPos = { x: 0, z: 0, heading: 0 },
  targetPos = null,
  helipadPos = { x: -2, z: 0 },
  show = true,
}) => {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  if (!show) return null;

  // แปลงพิกัดโลก (-30..30) เป็นพิกัด SVG (0..200)
  const mapSize = 200;
  const worldRange = 50; // -25 to +25
  const worldToSvg = (wx: number, wz: number) => {
    const x = ((wx + worldRange / 2) / worldRange) * mapSize;
    const y = ((wz + worldRange / 2) / worldRange) * mapSize;
    return { x: Math.max(4, Math.min(mapSize - 4, x)), y: Math.max(4, Math.min(mapSize - 4, y)) };
  };

  const droneSvg = worldToSvg(dronePos.x, dronePos.z);
  const playerSvg = worldToSvg(playerPos.x, playerPos.z);
  const helipadSvg = worldToSvg(helipadPos.x, helipadPos.z);
  const targetSvg = targetPos ? worldToSvg(targetPos.x, targetPos.z) : null;

  const droneDeg = ((dronePos.heading ?? 0) * 180) / Math.PI;

  return (
    <div className="fixed top-14 right-3 z-40 pointer-events-auto select-none safe-top safe-right">
      <div className="rounded-2xl border-2 border-cyan-500/40 bg-slate-950/90 shadow-2xl backdrop-blur-md overflow-hidden text-cyan-200">
        {/* Header with Collapse Button */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-950/80 border-b border-cyan-500/30">
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <span className="text-sm">📡</span>
            <span>{t('เรดาร์ฟาร์ม', 'Farm Radar')}</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-cyan-800/40 text-cyan-400 transition"
            title={collapsed ? t('ขยาย', 'Expand') : t('ย่อ', 'Collapse')}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Map Body */}
        {!collapsed && (
          <div className="p-2 space-y-1.5">
            <svg
              width={mapSize}
              height={mapSize}
              className="rounded-xl bg-slate-900 border border-cyan-500/20"
              viewBox={`0 0 ${mapSize} ${mapSize}`}
            >
              {/* Grid Lines */}
              <defs>
                <pattern id="radarGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={mapSize} height={mapSize} fill="url(#radarGrid)" />

              {/* Farm plots */}
              {plots.map((p) => {
                const s = worldToSvg(p.worldX, p.worldZ);
                const isReady = p.status === 'READY';
                return (
                  <rect
                    key={`p-${p.id}`}
                    x={s.x - 3}
                    y={s.y - 3}
                    width={6}
                    height={6}
                    rx={1.5}
                    fill={isReady ? '#facc15' : '#10b981'}
                    opacity={0.8}
                  />
                );
              })}

              {/* Trees */}
              {trees.map((trItem) => {
                const s = worldToSvg(trItem.worldX, trItem.worldZ);
                return (
                  <circle
                    key={`tr-${trItem.id}`}
                    cx={s.x}
                    cy={s.y}
                    r={2.5}
                    fill="#059669"
                    opacity={0.7}
                  />
                );
              })}

              {/* Helipad 'H' */}
              <g transform={`translate(${helipadSvg.x}, ${helipadSvg.y})`}>
                <circle r={7} fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeDasharray="3 2" />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill="#00f0ff"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  H
                </text>
              </g>

              {/* Flight path to target */}
              {targetSvg && (
                <line
                  x1={droneSvg.x}
                  y1={droneSvg.y}
                  x2={targetSvg.x}
                  y2={targetSvg.y}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Target Crosshair */}
              {targetSvg && (
                <g transform={`translate(${targetSvg.x}, ${targetSvg.y})`}>
                  <circle r={5} fill="none" stroke="#ef4444" strokeWidth="1.2" />
                  <line x1={-7} y1={0} x2={7} y2={0} stroke="#ef4444" strokeWidth="1" />
                  <line x1={0} y1={-7} x2={0} y2={7} stroke="#ef4444" strokeWidth="1" />
                </g>
              )}

              {/* Player Icon */}
              <circle cx={playerSvg.x} cy={playerSvg.y} r={4.5} fill="#fbbf24" stroke="#ffffff" strokeWidth="1.2" />

              {/* Drone Icon & Heading Arrow */}
              <g transform={`translate(${droneSvg.x}, ${droneSvg.y}) rotate(${droneDeg})`}>
                <polygon points="0,-7 5,5 0,2 -5,5" fill="#00f0ff" stroke="#ffffff" strokeWidth="1" />
              </g>
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-between text-[9px] text-cyan-300/80 px-1 pt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> {t('โดรน', 'Drone')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> {t('ผู้เล่น', 'Player')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-yellow-400" /> {t('สุก', 'Ripe')}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[10px] text-cyan-300 font-bold">H</span> {t('ฐาน', 'Pad')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
