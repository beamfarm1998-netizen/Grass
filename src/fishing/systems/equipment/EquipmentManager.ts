import { EquippedSetup } from '../../storage/SaveSchema';
import {
  BAIT_CATALOG,
  BaitSpec,
  LINE_CATALOG,
  LineSpec,
  REEL_CATALOG,
  ReelSpec,
  ROD_CATALOG,
  RodSpec,
} from './EquipmentCatalog';

export interface ActiveEquipmentLoadout {
  rod: RodSpec;
  reel: ReelSpec;
  line: LineSpec;
  bait: BaitSpec;
}

export class EquipmentManager {
  private loadout: ActiveEquipmentLoadout;

  constructor(initialSetup?: EquippedSetup) {
    this.loadout = this.resolveLoadout(initialSetup);
  }

  resolveLoadout(setup?: EquippedSetup): ActiveEquipmentLoadout {
    const rod = ROD_CATALOG.find((r) => r.id === setup?.rodId) ?? ROD_CATALOG[0];
    const reel = REEL_CATALOG.find((r) => r.id === setup?.reelId) ?? REEL_CATALOG[0];
    const line = LINE_CATALOG.find((l) => l.id === setup?.lineId) ?? LINE_CATALOG[0];
    const bait = BAIT_CATALOG.find((b) => b.id === setup?.baitId) ?? BAIT_CATALOG[0];
    return { rod, reel, line, bait };
  }

  setEquipped(setup: EquippedSetup): ActiveEquipmentLoadout {
    this.loadout = this.resolveLoadout(setup);
    return this.loadout;
  }

  getLoadout(): ActiveEquipmentLoadout {
    return this.loadout;
  }
}
