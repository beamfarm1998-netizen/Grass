// src/core/Lighting.ts
import * as THREE from 'three';
import type { TimeOfDay } from '../types/game';

export interface FarmLightingSetup {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fill: THREE.DirectionalLight;
  dispose: () => void;
}

export interface FarmLightingOptions {
  shadowMapDim?: number;
  enableShadows?: boolean;
}

export const SKY_COLORS: Record<TimeOfDay, THREE.Color> = {
  morning: new THREE.Color(0xfdecd2),
  day: new THREE.Color(0xcfe2ec),
  sunset: new THREE.Color(0xec9f74),
  night: new THREE.Color(0x0c1222),
};

export function createFarmLighting(
  scene: THREE.Scene,
  options: FarmLightingOptions = {}
): FarmLightingSetup {
  const shadowMapDim = options.shadowMapDim ?? 2048;
  const enableShadows = options.enableShadows ?? true;

  const hemi = new THREE.HemisphereLight(0xfffaed, 0x8d9e78, 1.35);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5dd, 2.0);
  sun.position.set(38, 55, 30);
  sun.castShadow = enableShadows;
  sun.shadow.mapSize.width = shadowMapDim;
  sun.shadow.mapSize.height = shadowMapDim;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 130;
  const d = 35;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 1.5;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xb0d5f0, 0.45);
  fill.position.set(-30, 20, -30);
  scene.add(fill);

  return {
    sun,
    hemi,
    fill,
    dispose: () => {
      scene.remove(hemi);
      scene.remove(sun);
      scene.remove(fill);
      sun.shadow.map?.dispose();
    },
  };
}

/**
 * ปรับสีท้องฟ้า หมอก แสงอาทิตย์ และแสงบรรยากาศตามช่วงเวลาของวัน (เช้า / กลางวัน / เย็น / กลางคืน)
 */
export function applyTimeOfDayAtmosphere(
  scene: THREE.Scene,
  timeOfDay: TimeOfDay,
  sun: THREE.DirectionalLight | null,
  hemi: THREE.HemisphereLight | null
): void {
  const skyColor = SKY_COLORS[timeOfDay];
  scene.background = skyColor;
  if (scene.fog) {
    scene.fog.color.copy(skyColor);
  }

  if (timeOfDay === 'morning') {
    if (scene.fog) {
      (scene.fog as THREE.Fog).near = 70;
      (scene.fog as THREE.Fog).far = 240;
    }
    sun?.color.setHex(0xfff3d0);
    if (sun) sun.intensity = 1.9;
    sun?.position.set(45, 45, 25);
    hemi?.color.setHex(0xfffaed);
    hemi?.groundColor.setHex(0x9fa882);
    if (hemi) hemi.intensity = 1.3;
  } else if (timeOfDay === 'day') {
    if (scene.fog) {
      (scene.fog as THREE.Fog).near = 85;
      (scene.fog as THREE.Fog).far = 260;
    }
    sun?.color.setHex(0xffffff);
    if (sun) sun.intensity = 2.2;
    sun?.position.set(15, 60, 20);
    hemi?.color.setHex(0xffffff);
    hemi?.groundColor.setHex(0x8d9e78);
    if (hemi) hemi.intensity = 1.4;
  } else if (timeOfDay === 'sunset') {
    if (scene.fog) {
      (scene.fog as THREE.Fog).near = 60;
      (scene.fog as THREE.Fog).far = 210;
    }
    sun?.color.setHex(0xff7733);
    if (sun) sun.intensity = 1.7;
    sun?.position.set(-42, 28, 25);
    hemi?.color.setHex(0xffb74d);
    hemi?.groundColor.setHex(0x5d4037);
    if (hemi) hemi.intensity = 1.1;
  } else if (timeOfDay === 'night') {
    if (scene.fog) {
      (scene.fog as THREE.Fog).near = 58;
      (scene.fog as THREE.Fog).far = 215;
    }
    sun?.color.setHex(0xa8ccff);
    if (sun) sun.intensity = 0.74;
    sun?.position.set(46, 26, -48);
    hemi?.color.setHex(0x2d4396);
    hemi?.groundColor.setHex(0x0d152a);
    if (hemi) hemi.intensity = 0.56;
  }
}
