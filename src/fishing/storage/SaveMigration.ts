import { LanguageStorage } from '../localization/LanguageStorage';
import { createDefaultSaveData, SaveData } from './SaveSchema';
import { CURRENT_SAVE_VERSION } from './SaveVersion';

export class SaveMigration {
  static migrate(raw: unknown): SaveData {
    const defaults = createDefaultSaveData(LanguageStorage.resolveInitialLanguage());
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const input = raw as Record<string, any>;
    const version = typeof input.version === 'number' ? input.version : 1;

    // Migrate v1 -> v2 (adds unlockedLocations, cameraPreset, and ensures starter gear ownership)
    const language = LanguageStorage.isSupported(input.language)
      ? input.language
      : defaults.language;

    const ownedSet = new Set<string>([
      ...defaults.ownedEquipmentIds,
      ...(Array.isArray(input.ownedEquipmentIds) ? input.ownedEquipmentIds : []),
    ]);

    const migrated: SaveData = {
      version: CURRENT_SAVE_VERSION,
      updatedAtIso: typeof input.updatedAtIso === 'string' ? input.updatedAtIso : new Date().toISOString(),
      language,
      level: typeof input.level === 'number' && input.level >= 1 ? Math.floor(input.level) : defaults.level,
      xp: typeof input.xp === 'number' && input.xp >= 0 ? Math.floor(input.xp) : defaults.xp,
      coins: typeof input.coins === 'number' && input.coins >= 0 ? Math.floor(input.coins) : defaults.coins,
      inventory: Array.isArray(input.inventory) ? input.inventory : [],
      statistics: {
        totalCasts: Number(input.statistics?.totalCasts) || 0,
        totalCatches: Number(input.statistics?.totalCatches) || 0,
        totalEscaped: Number(input.statistics?.totalEscaped) || 0,
        totalLineBreaks: Number(input.statistics?.totalLineBreaks) || 0,
        biggestWeightKg: Number(input.statistics?.biggestWeightKg) || 0,
        biggestSpeciesId: input.statistics?.biggestSpeciesId ?? null,
      },
      equipped: {
        rodId: typeof input.equipped?.rodId === 'string' ? input.equipped.rodId : defaults.equipped.rodId,
        reelId: typeof input.equipped?.reelId === 'string' ? input.equipped.reelId : defaults.equipped.reelId,
        lineId: typeof input.equipped?.lineId === 'string' ? input.equipped.lineId : defaults.equipped.lineId,
        baitId: typeof input.equipped?.baitId === 'string' ? input.equipped.baitId : defaults.equipped.baitId,
      },
      ownedEquipmentIds: Array.from(ownedSet),
      unlockedLocations:
        version >= 2 && Array.isArray(input.unlockedLocations) && input.unlockedLocations.length > 0
          ? input.unlockedLocations
          : defaults.unlockedLocations,
      settings: {
        audioMuted: Boolean(input.settings?.audioMuted ?? defaults.settings.audioMuted),
        audioVolume:
          typeof input.settings?.audioVolume === 'number'
            ? Math.min(1, Math.max(0, input.settings.audioVolume))
            : defaults.settings.audioVolume,
        weather:
          input.settings?.weather === 'clear' ||
          input.settings?.weather === 'sunset' ||
          input.settings?.weather === 'mist' ||
          input.settings?.weather === 'rain'
            ? input.settings.weather
            : defaults.settings.weather,
        cameraPreset:
          input.settings?.cameraPreset === 'angler' ||
          input.settings?.cameraPreset === 'bobber' ||
          input.settings?.cameraPreset === 'underwater' ||
          input.settings?.cameraPreset === 'cinematic'
            ? input.settings.cameraPreset
            : defaults.settings.cameraPreset,
        virtualJoysticks:
          typeof input.settings?.virtualJoysticks === 'boolean'
            ? input.settings.virtualJoysticks
            : defaults.settings.virtualJoysticks,
        hapticsEnabled:
          typeof input.settings?.hapticsEnabled === 'boolean'
            ? input.settings.hapticsEnabled
            : defaults.settings.hapticsEnabled,
      },
    };

    return migrated;
  }
}
