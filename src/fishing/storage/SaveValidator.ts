import { LanguageStorage } from '../localization/LanguageStorage';
import { SaveData } from './SaveSchema';

export class SaveValidator {
  static isValid(data: unknown): data is SaveData {
    if (!data || typeof data !== 'object') return false;
    const candidate = data as Record<string, unknown>;

    if (typeof candidate.version !== 'number' || candidate.version < 1) return false;
    if (!LanguageStorage.isSupported(candidate.language as string)) return false;
    if (typeof candidate.level !== 'number' || candidate.level < 1 || !Number.isFinite(candidate.level)) {
      return false;
    }
    if (typeof candidate.xp !== 'number' || candidate.xp < 0 || !Number.isFinite(candidate.xp)) {
      return false;
    }
    if (typeof candidate.coins !== 'number' || candidate.coins < 0 || !Number.isFinite(candidate.coins)) {
      return false;
    }
    if (!Array.isArray(candidate.inventory)) return false;
    if (!Array.isArray(candidate.ownedEquipmentIds) || candidate.ownedEquipmentIds.length === 0) {
      return false;
    }
    if (!candidate.equipped || typeof candidate.equipped !== 'object') return false;
    if (!candidate.statistics || typeof candidate.statistics !== 'object') return false;
    if (!candidate.settings || typeof candidate.settings !== 'object') return false;

    return true;
  }
}
