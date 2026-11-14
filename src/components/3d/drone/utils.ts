// src/components/3d/drone/utils.ts
import * as THREE from 'three';

export const smoothFactor = (k: number, dt: number) => 1 - Math.exp(-k * dt);
export const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const _moveScratch = new THREE.Vector3();

export function moveVec(
  pos: THREE.Vector3, target: THREE.Vector3, dt: number, speed: number
): number {
  _moveScratch.subVectors(target, pos);
  const dist = _moveScratch.length();
  if (dist < 0.001) return 0;
  const step = Math.min(dist, speed * dt);
  pos.addScaledVector(_moveScratch.divideScalar(dist), step);
  return dist - step;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}