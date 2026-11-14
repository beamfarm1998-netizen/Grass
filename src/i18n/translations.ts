// src/i18n/translations.ts
import {
  ANIMAL_DEFS,
  ANIMAL_FEED_DEFS,
  AnimalFeedType,
  AnimalType,
  BAKED_GOOD_DEFS,
  BakedGoodType,
  BREW_DRINK_DEFS,
  BrewDrinkType,
  CROP_DEFINITIONS,
  CropType,
  HOUSE_DEFS,
  PROCESSED_FEATHER_DEFS,
  ProcessedFeatherType,
  ROCK_DEFS,
  RockType,
  TREE_DEFINITIONS,
  TreeType,
} from '../types/game';

export type Language = 'th' | 'en';

export const LANG_STORAGE_KEY = 'beam_farm_lang';

let _currentLang: Language = (() => {
  if (typeof window === 'undefined') return 'th';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'th') return saved;
  } catch {}
  return 'th';
})();

export function getCurrentLang(): Language {
  return _currentLang;
}

export function setCurrentLangStorage(lang: Language): void {
  _currentLang = lang;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {}
  }
}

/**
 * Pure bilingual string selector usable in non-UI gameplay modules without React context coupling.
 */
export function tr(th: string, en: string, lang: Language = _currentLang): string {
  return lang === 'en' ? en : th;
}

// ─── Entity Display Helpers (Decoupled from Entity State & 3D Models) ───

const CROP_SEED_EN: Record<CropType, string> = {
  wheat: 'Wheat Seeds',
  barley: 'Barley Seeds',
  carrot: 'Carrot Seeds',
  soybean: 'Soybean Seeds',
  corn: 'Sweet Corn Seeds',
  pumpkin: 'Pumpkin Seeds',
  tomato: 'Tomato Seeds',
  strawberry: 'Strawberry Seeds',
};

const CROP_DESC_EN: Record<CropType, string> = {
  wheat: 'Fast-growing staple grain with golden ears for brewing beer.',
  barley: 'Golden-amber malting grain prized for brewing ale and spirits.',
  carrot: 'Crisp orange root crop used in cooking and distilling vodka.',
  soybean: 'Plump green soybean pods imparting rich character to artisan schnapps.',
  corn: 'Tall stalks yielding sweet corn cobs for craft beer and whiskey.',
  pumpkin: 'Heavy golden pumpkins that fetch a high price.',
  tomato: 'Vine-ripened ruby tomatoes grown on wooden stakes.',
  strawberry: 'Sweet fragrant berries prized at the farm market.',
};

const TREE_SAPLING_EN: Record<TreeType, string> = {
  apple: 'Red Apple Sapling',
  orange: 'Mandarin Sapling',
  peach: 'Sweet Peach Sapling',
  cherry: 'Sakura Cherry Sapling',
  pine: 'Mountain Pine Sapling',
  oak: 'Ancient Oak Sapling',
  lemon: 'Lemon Sapling',
  coconut: 'Coconut Palm Sapling',
};

const TREE_DESC_EN: Record<TreeType, string> = {
  apple: 'Crisp red orchard apples that regrow every harvest.',
  orange: 'Refreshing golden citrus rich in vitamin C.',
  peach: 'Soft, fragrant pink-orange peaches.',
  cherry: 'Ruby cherry clusters beneath pink blossoms.',
  pine: 'Tall alpine conifer yielding prime timber logs.',
  oak: 'Broad-canopy heritage oak yielding abundant timber.',
  lemon: 'Golden lemons regrow in 4 rounds before the tree withers.',
  coconut: 'Tropical coconut palm with 4 harvest cycles (13 coconuts total) yielding ~594 profit.',
};

export function getCropName(crop: CropType, lang: Language = _currentLang): string {
  const def = CROP_DEFINITIONS[crop];
  if (!def) return crop;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getCropSeedName(crop: CropType, lang: Language = _currentLang): string {
  const def = CROP_DEFINITIONS[crop];
  if (!def) return crop;
  return lang === 'en' ? CROP_SEED_EN[crop] : def.seedName;
}

export function getCropDesc(crop: CropType, lang: Language = _currentLang): string {
  const def = CROP_DEFINITIONS[crop];
  if (!def) return '';
  return lang === 'en' ? CROP_DESC_EN[crop] : def.description;
}

export function getTreeName(tree: TreeType, lang: Language = _currentLang): string {
  const def = TREE_DEFINITIONS[tree];
  if (!def) return tree;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getTreeFruitName(tree: TreeType, lang: Language = _currentLang): string {
  const def = TREE_DEFINITIONS[tree];
  if (!def) return tree;
  if (lang === 'en') {
    return def.nameEn.replace(/\s*Tree$/i, '') + ' Fruit';
  }
  return `ผล${def.name}`;
}

export function getTreeSaplingName(tree: TreeType, lang: Language = _currentLang): string {
  const def = TREE_DEFINITIONS[tree];
  if (!def) return tree;
  return lang === 'en' ? TREE_SAPLING_EN[tree] : def.saplingName;
}

export function getTreeDesc(tree: TreeType, lang: Language = _currentLang): string {
  const def = TREE_DEFINITIONS[tree];
  if (!def) return '';
  return lang === 'en' ? TREE_DESC_EN[tree] : def.description;
}

export function getHouseName(type: number, lang: Language = _currentLang): string {
  const def = HOUSE_DEFS[type];
  if (!def) return lang === 'en' ? 'Building' : 'สิ่งก่อสร้าง';
  return lang === 'en' ? def.nameEn || def.name : def.name;
}

export function getAnimalName(type: AnimalType, lang: Language = _currentLang): string {
  const def = ANIMAL_DEFS[type];
  if (!def) return type;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getRockName(type: RockType, lang: Language = _currentLang): string {
  const def = ROCK_DEFS[type];
  if (!def) return type;
  return lang === 'en' ? def.nameEn : def.name;
}

export const ZONE_TEXT_EN: Record<number, { name: string; desc: string }> = {
  1: {
    name: 'Central Homestead (Starter)',
    desc: 'Fertile fields around the main barn and windmill.',
  },
  2: {
    name: 'South Meadow',
    desc: 'Expand southward to unlock 8 rich meadow crop plots.',
  },
  3: {
    name: 'West Orchard',
    desc: 'Open fertile land beside the farmhouse with 8 new plots.',
  },
  4: {
    name: 'East Hillside',
    desc: 'Clear prime soil along the pine foothills for 8 new plots.',
  },
  5: {
    name: 'Golden Frontier (Lv.10)',
    desc: 'Vast western frontier unlocked at Lv.10 for large-scale building and +12 crop plots.',
  },
};

export function getProcessedFeatherName(
  item: ProcessedFeatherType,
  lang: Language = _currentLang
): string {
  const def = PROCESSED_FEATHER_DEFS[item];
  if (!def) return item;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getProcessedFeatherDesc(
  item: ProcessedFeatherType,
  lang: Language = _currentLang
): string {
  const def = PROCESSED_FEATHER_DEFS[item];
  if (!def) return '';
  return lang === 'en' ? def.descriptionEn : def.description;
}

export function getBrewDrinkName(
  item: BrewDrinkType,
  lang: Language = _currentLang
): string {
  const def = BREW_DRINK_DEFS[item];
  if (!def) return item;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getBrewDrinkDesc(
  item: BrewDrinkType,
  lang: Language = _currentLang
): string {
  const def = BREW_DRINK_DEFS[item];
  if (!def) return '';
  return lang === 'en' ? def.descriptionEn : def.description;
}

export function getBakedGoodName(
  item: BakedGoodType,
  lang: Language = _currentLang
): string {
  const def = BAKED_GOOD_DEFS[item];
  if (!def) return item;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getBakedGoodDesc(
  item: BakedGoodType,
  lang: Language = _currentLang
): string {
  const def = BAKED_GOOD_DEFS[item];
  if (!def) return '';
  return lang === 'en' ? def.descriptionEn : def.description;
}

export function getAnimalFeedName(
  item: AnimalFeedType,
  lang: Language = _currentLang
): string {
  const def = ANIMAL_FEED_DEFS[item];
  if (!def) return item;
  return lang === 'en' ? def.nameEn : def.name;
}

export function getAnimalFeedDesc(
  item: AnimalFeedType,
  lang: Language = _currentLang
): string {
  const def = ANIMAL_FEED_DEFS[item];
  if (!def) return '';
  return lang === 'en' ? def.descriptionEn : def.description;
}

export function formatBrewDuration(
  totalSeconds: number,
  lang: Language = _currentLang
): string {
  const sec = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;
  if (lang === 'en') {
    if (hours > 0 && mins > 0 && remSec === 0) return `${hours}h ${mins}m`;
    if (hours > 0 && mins === 0 && remSec === 0) return `${hours} hr`;
    if (hours === 0 && remSec === 0) return `${mins} min`;
    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  }
  if (hours > 0 && mins > 0 && remSec === 0) return `${hours} ชั่วโมง ${mins} นาที`;
  if (hours > 0 && mins === 0 && remSec === 0) return `${hours} ชั่วโมง`;
  if (hours === 0 && remSec === 0) return `${mins} นาที`;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

export const RECIPE_DESC_EN: Record<string, string> = {
  wheat_bread: 'Crusty wood-fired loaf baked with freshly harvested golden wheat.',
  veggie_soup: 'Hearty simmered tomato and carrot soup to restore farm energy.',
  pumpkin_pie: 'Rich buttery pumpkin pie packed with stamina for long harvest days.',
  grilled_corn: 'Charcoal-grilled sweet corn glazed with melted farmstead butter.',
  fruit_salad: 'Crisp orchard apples tossed with sweet ruby strawberries.',
  warm_fruit_tea: 'Soothing warm citrus infusion brewed from fresh mandarin peel.',
  crispy_duck_omelette: 'Fluffy golden pan-seared duck egg omelette seasoned with garden herbs.',
  braised_duck_eggs: 'Savory slow-simmered farmstead duck eggs braised with sweet carrots.',
  duck_custard_tart: 'Silky rich wood-fired custard tart baked with fresh duck eggs and wheat.',
};

const REASON_MAP_EN: Record<string, string> = {
  'วางได้อย่างอิสระทุกพื้นที่': 'Free placement anywhere on the farm',
  'ตำแหน่งนี้วางได้อิสระ': 'Valid placement spot',
  'ตำแหน่งนี้วางได้อิสระ บนกริดดิน': 'Valid soil grid placement',
  'ตำแหน่งนี้ไม่สามารถวางได้': 'Cannot place at this spot',
  'ชิดขอบเกาะเกินไป': 'Too close to the island edge',
  'อยู่นอกขอบเขตเกาะฟาร์ม': 'Outside farm island boundary',
  'อยู่บนพื้นที่ต้องห้าม': 'Blocked terrain area',
  'อยู่บนพื้นที่น้ำหรือถนน': 'Blocked by water or road',
  'ทับซ้อนสิ่งปลูกสร้างหรือหินอื่น': 'Overlaps a building or rock',
  'ทับซ้อนสิ่งปลูกสร้างอื่น': 'Overlaps another building',
  'มีต้นไม้ปลูกอยู่ในช่องนี้แล้ว': 'A tree is already planted here',
  'ซ้อนทับแปลงปลูกผัก': 'Overlaps a crop plot',
  'ซ้อนทับบริเวณบ้านไม้หรือลานรั้ว': 'Overlaps a building or yard',
  'ซ้อนทับก้อนหินในฟาร์ม': 'Overlaps a rock on the farm',
};

export function translatePlacementReason(
  reason: string | undefined,
  lang: Language = _currentLang
): string | undefined {
  if (!reason || lang === 'th') return reason;
  if (REASON_MAP_EN[reason]) return REASON_MAP_EN[reason];
  if (reason.includes('แม่น้ำ') || reason.includes('สระน้ำ') || reason.includes('น้ำ')) {
    return 'Blocked by water / river';
  }
  if (reason.includes('ถนน') || reason.includes('ทางเดิน')) {
    return 'Blocked by road / path';
  }
  if (reason.includes('ทราย')) {
    return 'Cannot place on sand pit';
  }
  if (reason.includes('ทับซ้อน') || reason.includes('ซ้อนทับ')) {
    return 'Overlaps existing farm object';
  }
  return reason;
}