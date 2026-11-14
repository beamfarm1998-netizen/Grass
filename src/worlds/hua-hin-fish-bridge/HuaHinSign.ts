// src/worlds/hua-hin-fish-bridge/HuaHinSign.ts
import * as THREE from 'three';

export interface HuaHinSignOptions {
  x?: number;
  z?: number;
  rotY?: number;
}

/**
 * สร้างป้ายไม้ 3 มิติ "ไปสะพานปลาหัวหิน"
 * ใช้ Canvas สร้าง Texture เพื่อให้ข้อความคมชัดและปรับแต่งได้ง่าย
 */
export function createHuaHinSign(opts: HuaHinSignOptions = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HuaHinSign';
  
  // ตำแหน่งเริ่มต้น (สามารถส่งเข้ามาตอนเรียกใช้ได้)
  group.position.set(opts.x ?? 10, 0, opts.z ?? 10);
  group.rotation.y = opts.rotY ?? Math.PI / 4;

  // --- 1. สร้างเสาป้าย ---
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
  const poleGeo = new THREE.BoxGeometry(0.25, 2.2, 0.25);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 1.1;
  pole.castShadow = true;
  pole.receiveShadow = true;
  group.add(pole);

  // --- 2. สร้างแผ่นป้ายไม้ ---
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
  const boardGeo = new THREE.BoxGeometry(3.2, 1.4, 0.15);
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = 2.2;
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  // --- 3. วาดข้อความลงบน Canvas ---
  const canvas = document.createElement('canvas');
  canvas.width = 1024;  // ความละเอียดสูงเพื่อให้ตัวอักษรคม
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // พื้นหลังไม้ (สีน้ำตาลอ่อน)
  ctx.fillStyle = '#dcb37b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ลายไม้ (เส้นบางๆ)
  ctx.strokeStyle = 'rgba(92, 58, 33, 0.2)';
  ctx.lineWidth = 4;
  for (let i = 0; i < canvas.height; i += 30) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  // กรอบสีน้ำตาลเข้ม
  ctx.strokeStyle = '#5c3a21';
  ctx.lineWidth = 24;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // ข้อความ
  ctx.fillStyle = '#2e1a0d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // บรรทัดที่ 1
  ctx.font = 'bold 90px "Prompt", "Kanit", sans-serif';
  ctx.fillText('ไปสะพานปลา', canvas.width / 2, canvas.height / 2 - 60);
  
  // บรรทัดที่ 2
  ctx.font = 'bold 70px "Prompt", "Kanit", sans-serif';
  ctx.fillStyle = '#1f8fb5'; // สีฟ้าทะเล
  ctx.fillText('หัวหิน ➔', canvas.width / 2, canvas.height / 2 + 60);

  // --- 4. แปะ Texture ลงบน Plane ด้านหน้าป้าย ---
  const texture = new THREE.CanvasTexture(canvas);
  // แก้ไขสีให้ถูกต้องตามระบบสีของ three.js เวอร์ชันใหม่
  texture.colorSpace = THREE.SRGBColorSpace; 
  // ป้องกันภาพเบลอ
  texture.anisotropy = 4; 

  const textMat = new THREE.MeshStandardMaterial({ 
    map: texture, 
    roughness: 0.6,
    transparent: false 
  });
  
  // ขนาด Plane ให้เล็กกว่าแผ่นไม้เล็กน้อย เพื่อให้เห็นขอบไม้รอบๆ
  const textPlaneGeo = new THREE.PlaneGeometry(3.0, 1.25);
  const textPlane = new THREE.Mesh(textPlaneGeo, textMat);
  // ขยับออกมา 0.08 เพื่อไม่ให้ Z-fighting กับแผ่นไม้
  textPlane.position.set(0, 2.2, 0.08); 
  group.add(textPlane);

  // --- 5. เพิ่มแสงเรืองรองรอบป้าย (Glow) เพื่อให้สังเกตง่าย ---
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: 0x00e5ff, 
    transparent: true, 
    opacity: 0.15,
    side: THREE.BackSide // ด้านหลังเพื่อให้เรืองแสงออกมา
  });
  const glowGeo = new THREE.BoxGeometry(3.4, 1.6, 0.2);
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 2.2, 0);
  group.add(glow);

  return group;
}