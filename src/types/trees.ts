// src/types/trees.ts

export type TreeType = 'apple' | 'orange' | 'peach' | 'cherry' | 'pine' | 'oak' | 'lemon' | 'coconut';

export type TreeStage = 'sapling' | 'growing' | 'mature' | 'ready' | 'withered';

export interface TreeDefinition {
  id: TreeType;
  name: string;
  nameEn: string;
  saplingName: string;
  growthTimeSeconds: number;
  saplingCost: number;
  fruitSellPrice: number;
  woodYield: number;
  xpReward: number;
  color: string;
  fruitColor: string;
  iconEmoji: string;
  description: string;
  isFruitTree: boolean;
  unlockLevel?: number;
  maxHarvestRounds?: number;
  modelPath?: string;

  /**
   * Offset แกน Y (หน่วยเมตร) ใช้ดันโมเดล GLB ขึ้น/ลงจากพื้นดิน
   * ค่าลบ = ดันลงดิน, ค่าบวก = ดันขึ้น
   * ใช้เมื่อ origin ของโมเดล GLB ไม่ได้อยู่ที่โคนต้นจริง
   * @default 0
   */
  modelYOffset?: number;

  /**
   * ตัวคูณสเกลเพิ่มเติม หลัง loader ทำ auto-scale (targetHeight ~3.5m) เรียบร้อยแล้ว
   * ใช้ tune ขนาดให้พอดีกับดีไซน์เกาะ
   * @default 1.0
   */
  modelScale?: number;
}

export interface PlacedTree {
  id: string;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  type: TreeType;
  stage: TreeStage;
  growthProgress: number;
  isWatered: boolean;
  wateredAt?: number;
  plantedAt: number;
  harvestsCount: number;
}

export const TREE_DEFINITIONS: Record<TreeType, TreeDefinition> = {
  apple: {
    id: 'apple',
    name: 'ต้นแอปเปิ้ล',
    nameEn: 'Apple Tree',
    saplingName: 'กล้าแอปเปิ้ลแดง',
    growthTimeSeconds: 1200,
    saplingCost: 100,
    fruitSellPrice: 220,
    woodYield: 4,
    xpReward: 220,
    color: '#2e7d32',
    fruitColor: '#e53935',
    iconEmoji: '🍎',
    description: 'ผลแอปเปิ้ลแดงสด รสชาติกรอบหวาน เก็บผลได้ต่อเนื่อง',
    isFruitTree: true,
    modelPath: '/apple tree.glb',
    modelYOffset: -0.4, // 👈 ลองปรับตัวเลขนี้ให้ติดลบมากขึ้นถ้ายังลอย
    modelScale: 1.0,
  },
  orange: {
    id: 'orange',
    name: 'ต้นส้มเขียวหวาน',
    nameEn: 'Orange Tree',
    saplingName: 'กล้าส้มทอง',
    growthTimeSeconds: 900,
    saplingCost: 80,
    fruitSellPrice: 170,
    woodYield: 4,
    xpReward: 170,
    color: '#388e3c',
    fruitColor: '#ff9800',
    iconEmoji: '🍊',
    description: 'ผลส้มสีทอง กลิ่นหอมสดชื่น ให้วิตามินซีสูง',
    isFruitTree: true,
    modelPath: '/Orange tree.glb',
  },
  peach: {
    id: 'peach',
    name: 'ต้นพีชชมพู',
    nameEn: 'Peach Tree',
    saplingName: 'กล้าพีชฉ่ำน้ำ',
    growthTimeSeconds: 1500,
    saplingCost: 130,
    fruitSellPrice: 280,
    woodYield: 4,
    xpReward: 280,
    color: '#43a047',
    fruitColor: '#ff7043',
    iconEmoji: '🍑',
    description: 'ผลพีชสีชมพูอมส้ม เนื้อนุ่มฉ่ำน้ำ หอมหวานละมุน',
    isFruitTree: true,
  },
  cherry: {
    id: 'cherry',
    name: 'ต้นเชอร์รี่',
    nameEn: 'Cherry Tree',
    saplingName: 'กล้าซากุระเชอร์รี่',
    growthTimeSeconds: 600,
    saplingCost: 60,
    fruitSellPrice: 140,
    woodYield: 3,
    xpReward: 130,
    color: '#4caf50',
    fruitColor: '#c2185b',
    iconEmoji: '🍒',
    description: 'ช่อผลเชอร์รี่สีแดงทับทิม ดอกสีชมพูบานสะพรั่งน่าหลงใหล',
    isFruitTree: true,
  },
  pine: {
    id: 'pine',
    name: 'ต้นสนภูเขา',
    nameEn: 'Mountain Pine',
    saplingName: 'กล้าสนป่า',
    growthTimeSeconds: 720,
    saplingCost: 55,
    fruitSellPrice: 40,
    woodYield: 8,
    xpReward: 110,
    color: '#1b5e20',
    fruitColor: '#8d6e63',
    iconEmoji: '🌲',
    description: 'ทรงพุ่มกรวยสูงสง่า ลำต้นตรง ให้เนื้อไม้ซุงคุณภาพดีเยี่ยม',
    modelPath: '/pine_tree.glb',
    isFruitTree: false,
  },
  oak: {
    id: 'oak',
    name: 'ต้นโอ๊คโบราณ',
    nameEn: 'Ancient Oak',
    saplingName: 'กล้าโอ๊คทอง',
    growthTimeSeconds: 1800,
    saplingCost: 160,
    fruitSellPrice: 60,
    woodYield: 12,
    xpReward: 360,
    color: '#2e7d32',
    fruitColor: '#5d4037',
    iconEmoji: '🌳',
    description: 'พุ่มไม้ใบดกหนาแน่น กิ่งก้านแผ่ร่มเงากว้างใหญ่ ให้ไม้ซุงมหาศาล',
    isFruitTree: true,
    modelPath: '/oak_trees.glb',
  },
  lemon: {
    id: 'lemon',
    name: 'ต้นมะนาว',
    nameEn: 'Lemon Tree',
    saplingName: 'กล้ามะนาวเลมอน',
    growthTimeSeconds: 104400, // 29 ชั่วโมง (1 วัน 5 ชั่วโมง) หรือเร่งได้ใน Dashboard
    saplingCost: 400,
    fruitSellPrice: 135,
    woodYield: 6,
    xpReward: 350,
    color: '#4caf50',
    fruitColor: '#fdd835',
    iconEmoji: '🍋',
    description:
      'ผลมะนาวเลมอนสีเหลืองทอง ปลดล็อกเลเวล 66 ซื้อต้นละ 400 เหรียญ เก็บผลผลิตได้ 4 รอบ ' +
      '(รอบ 1: 2 ลูก, รอบ 2: 3 ลูก, รอบ 3: 4 ลูก, รอบ 4: 4 ลูก รวม 13 ลูก) ก่อนตายสนิทและต้องใช้เลื่อย (Saw) ตัดเคลียร์พื้นที่',
    isFruitTree: true,
    unlockLevel: 66,
    maxHarvestRounds: 4,
    modelPath: '/lemon_tree_.glb',
  },
  coconut: {
    id: 'coconut',
    name: 'ต้นมะพร้าว',
    nameEn: 'Coconut Palm',
    saplingName: 'กล้ามะพร้าวพันธุ์ดี',
    growthTimeSeconds: 2, // 36 ชั่วโมง (1 วัน 12 ชั่วโมง) ต่อรอบออกผล
    saplingCost: 810,
    fruitSellPrice: 110,
    woodYield: 36,
    xpReward: 84, // 21 XP ต่อมะพร้าว 1 ลูก (รอบ 4 ลูก = 84 XP)
    color: '#1b5e20',
    fruitColor: '#6d4c41',
    iconEmoji: '🥥',
    description:
      'ต้นมะพร้าวเขตร้อน ปลดล็อกเลเวล 101 ซื้อต้นละ 810 เหรียญ โต 36 ชม./รอบ เก็บเกี่ยว 4 รอบ ' +
      '(รอบ 1: 2 ลูก, รอบ 2: 3 ลูก, รอบ 3: 4 ลูก → เหี่ยวเฉาต้องชุบชีวิต, รอบ 4: 4 ลูก → รวม 13 ลูก กำไรสุทธิ ~594 Coins) จากนั้นตายถาวรต้องใช้เลื่อยตัดออก',
    isFruitTree: true,
    unlockLevel: 101,
    maxHarvestRounds: 4,
    modelPath: '/lcoconut tree.glb',
  },
};