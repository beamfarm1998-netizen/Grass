// src/components/3d/structures/stiltDims.ts
// ค่าคงที่เรือนไม้ยกพื้น (type 4) ใช้ร่วมกันระหว่างตัวสร้างโมเดลและระบบเดิน (HouseWalk)
export const STILT_DIMS = {
  cz: -1.2, // กึ่งกลางตัวเรือนตามแกน Z (พิกัดในบ้าน)
  W: 3.8, // กว้างตัวเรือน (X)
  D: 3.0, // ลึกตัวเรือน (Z)
  FY: 1.7, // ความสูงศูนย์กลางพื้นระเบียง (ผิวบน = FY + 0.1)
  doorW: 0.95,
  doorH: 1.7,
  wallT: 0.12, // ความหนาผนังกลวง
} as const;

export const HOUSE_DOOR_PIVOT_NAME = 'HouseDoorPivot';
