// src/types/rocks.ts

export type RockType = 'rock_small' | 'rock_large' | 'grass_on_rock';

export interface RockDef {
  type: RockType;
  name: string;
  nameEn: string;
  desc: string;
  gridSpan: number;
  cost: number;
  swatch: string;
  icon: string;
  modelFile?: string;
}

export const ROCK_DEFS: Record<RockType, RockDef> = {
  rock_small: {
    type: 'rock_small',
    name: 'ก้อนหินเล็ก',
    nameEn: 'Small Field Rock',
    desc: 'หินแม่น้ำมนกลมฝังดินประดับฟาร์ม แต่งขอบแปลงและทางเดิน (ขนาด 1x1 กริด)',
    gridSpan: 1,
    cost: 300,
    swatch: '#78716c',
    icon: '🪨',
  },
  rock_large: {
    type: 'rock_large',
    name: 'ก้อนหินใหญ่',
    nameEn: 'Giant Boulder',
    desc: 'หินแกรนิตผาขนาดใหญ่ฝังลึกในดินฟาร์ม พร้อมรอยร้าวธรรมชาติและมอสป่า (ขนาด 2x2 กริด)',
    gridSpan: 2,
    cost: 1,
    swatch: '#57534e',
    icon: '⛰️',
  },
  grass_on_rock: {
    type: 'grass_on_rock',
    name: 'หญ้าบนโขดหิน',
    nameEn: 'Grass on a Rock',
    desc: 'โขดหินธรรมชาติปกคลุมด้วยกอหญ้าเขียวชอุ่ม ใช้ตกแต่งสวนและทางเดินในฟาร์ม (Grass on a rock.glb)',
    gridSpan: 1,
    cost: 10,
    swatch: '#4d7c0f',
    icon: '🌿',
    modelFile: 'Grass on a rock.glb',
  },
};

export interface PlacedRock {
  id: string;
  type: RockType;
  gridX: number;
  gridZ: number;
  x: number;
  z: number;
  rot: number;
}
