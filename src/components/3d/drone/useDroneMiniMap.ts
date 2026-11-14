// src/components/3d/drone/useDroneMiniMap.ts
import { useEffect, useRef } from 'react';
import type { FarmPlot, PlacedTree } from '../../../types/game';

interface Args {
  showMiniMap: boolean;
  plots: FarmPlot[];
  trees: PlacedTree[];
  dronePosForMapRef: React.MutableRefObject<{
    x: number; z: number; targetX: number; targetZ: number; heading: number;
  }>;
  targetPosForMapRef: React.MutableRefObject<{ x: number; z: number } | null>;
  playerPosRef: React.MutableRefObject<{ x: number; z: number; heading: number }>;
}

/** ขอบเขตโลกของฟาร์ม (ตรงกับที่ FarmPlayer3D clamp) */
const WORLD_MIN_X = -88;
const WORLD_MAX_X = 48;
const WORLD_MIN_Z = -35;
const WORLD_MAX_Z = 35;
const SCALE = 2.5; // พิกเซลต่อหน่วยโลก
const TRAIL_MAX = 70;

export function useDroneMiniMap({
  showMiniMap, plots, trees,
  dronePosForMapRef, targetPosForMapRef, playerPosRef,
}: Args) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // หมายเหตุ: showMiniMap ที่ส่งเข้ามาต้องรวมเงื่อนไขว่า "แผงแผนที่ถูก mount แล้ว" (เช่น showMiniMap && isActive)
  // เพราะ effect นี้ต้องรันใหม่ตอนที่ canvas โผล่ขึ้นมา ไม่เช่นนั้น canvas จะเป็น null และแผนที่ว่างตลอด
  useEffect(() => {
    if (!showMiniMap) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const trail: { x: number; z: number }[] = [];
    let viewX = playerPosRef.current.x;
    let viewZ = 0;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = canvas.width;
      const h = canvas.height;
      const halfW = w / 2 / SCALE;
      const halfH = h / 2 / SCALE;

      const drone = dronePosForMapRef.current;
      const player = playerPosRef.current;

      // กล้องแผนที่เลื่อนตามโดรนอย่างนุ่มนวล (ไม่ให้เลยขอบโลก)
      const minCx = WORLD_MIN_X + halfW;
      const maxCx = WORLD_MAX_X - halfW;
      const minCz = WORLD_MIN_Z + halfH;
      const maxCz = WORLD_MAX_Z - halfH;
      const wantX = Math.max(Math.min(minCx, maxCx), Math.min(Math.max(minCx, maxCx), drone.x));
      const wantZ = minCz > maxCz ? 0 : Math.max(minCz, Math.min(maxCz, drone.z));
      const k = 1 - Math.exp(-dt * 4);
      viewX += (wantX - viewX) * k;
      viewZ += (wantZ - viewZ) * k;

      const toCanvas = (wx: number, wz: number) => ({
        x: w / 2 + (wx - viewX) * SCALE,
        y: h / 2 + (wz - viewZ) * SCALE,
      });

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(0, 0, w, h);

      // พื้นที่ฟาร์ม (ขอบโลก)
      const tl = toCanvas(WORLD_MIN_X, WORLD_MIN_Z);
      const br = toCanvas(WORLD_MAX_X, WORLD_MAX_Z);
      ctx.fillStyle = 'rgba(22, 101, 52, 0.18)';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

      // กริดตามพิกัดโลก (ขยับตามกล้อง จึงรู้สึกว่าโดรนบินจริง)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      const gx0 = Math.floor((viewX - halfW) / 5) * 5;
      const gz0 = Math.floor((viewZ - halfH) / 5) * 5;
      for (let gx = gx0; gx <= viewX + halfW; gx += 5) {
        const a = toCanvas(gx, viewZ - halfH);
        ctx.beginPath(); ctx.moveTo(a.x, 0); ctx.lineTo(a.x, h); ctx.stroke();
      }
      for (let gz = gz0; gz <= viewZ + halfH; gz += 5) {
        const a = toCanvas(viewX - halfW, gz);
        ctx.beginPath(); ctx.moveTo(0, a.y); ctx.lineTo(w, a.y); ctx.stroke();
      }

      for (const p of plots) {
        const { x, y } = toCanvas(p.worldX, p.worldZ);
        if (x < -4 || x > w + 4 || y < -4 || y > h + 4) continue;
        ctx.fillStyle =
          p.status === 'READY' ? '#fbbf24'
          : p.status === 'PLANTED' || p.status === 'GROWING' ? '#22c55e'
          : '#64748b';
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      }

      for (const t of trees) {
        const { x, y } = toCanvas(t.worldX, t.worldZ);
        if (x < -4 || x > w + 4 || y < -4 || y > h + 4) continue;
        ctx.fillStyle = t.stage === 'ready' ? '#f59e0b' : '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // เส้นทางที่โดรนเพิ่งบินผ่าน (หางจางๆ)
      const lastPt = trail[trail.length - 1];
      if (!lastPt || Math.hypot(drone.x - lastPt.x, drone.z - lastPt.z) > 0.35) {
        trail.push({ x: drone.x, z: drone.z });
        if (trail.length > TRAIL_MAX) trail.shift();
      }
      for (let i = 1; i < trail.length; i++) {
        const a = toCanvas(trail[i - 1].x, trail[i - 1].z);
        const b = toCanvas(trail[i].x, trail[i].z);
        ctx.strokeStyle = `rgba(34, 211, 238, ${(i / trail.length) * 0.65})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // เป้าหมาย + เส้นนำทาง
      const dpc = toCanvas(drone.x, drone.z);
      if (targetPosForMapRef.current) {
        const tp = toCanvas(targetPosForMapRef.current.x, targetPosForMapRef.current.z);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(dpc.x, dpc.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
        ctx.setLineDash([]);
        const pulse = 4 + Math.sin(now * 0.008) * 1.5;
        ctx.strokeStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(tp.x, tp.y, pulse + 2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 3, 0, Math.PI * 2); ctx.fill();
      }

      // ผู้เล่น
      const pp = toCanvas(player.x, player.z);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // โดรน: วงเรืองแสงเต้น + ใบพัดหมุน + ตัวโดรนชี้ทิศที่บิน
      const glow = 9 + Math.sin(now * 0.006) * 2;
      ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
      ctx.beginPath(); ctx.arc(dpc.x, dpc.y, glow, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(dpc.x, dpc.y);
      ctx.save();
      ctx.rotate(now * 0.03);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
      ctx.restore();
      ctx.rotate(-drone.heading); // heading 0 = หัน +Z (ลงบนจอ) ; ใช้ลูกศรให้ชี้ตามทิศบิน
      ctx.rotate(Math.PI);
      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(-5, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(5, 5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [showMiniMap, plots, trees, dronePosForMapRef, targetPosForMapRef, playerPosRef]);

  return { canvasRef };
}
