import { languageManager } from '../localization/LanguageManager';
import { AutoSave } from './AutoSave';
import { BackupManager } from './BackupManager';
import { IndexedDBStorage } from './IndexedDBStorage';
import { SaveMigration } from './SaveMigration';
import { createDefaultSaveData, SaveData } from './SaveSchema';
import { SaveValidator } from './SaveValidator';
import { PRIMARY_SAVE_SLOT } from './SaveVersion';

export class SaveManager {
  private readonly storage: IndexedDBStorage;
  private readonly autoSave: AutoSave;
  private currentData: SaveData;

  constructor(storage = new IndexedDBStorage()) {
    this.storage = storage;
    this.currentData = createDefaultSaveData(languageManager.getLanguage());
    this.autoSave = new AutoSave(() => this.saveNow());
  }

  async load(): Promise<SaveData> {
    const raw = await this.storage.get<unknown>(PRIMARY_SAVE_SLOT);
    if (!raw) {
      this.currentData = createDefaultSaveData(languageManager.getLanguage());
      await this.saveNow();
      return this.currentData;
    }

    const migrated = SaveMigration.migrate(raw);
    if (SaveValidator.isValid(migrated)) {
      this.currentData = migrated;
      languageManager.setLanguage(migrated.language, true);
    } else {
      this.currentData = createDefaultSaveData(languageManager.getLanguage());
    }
    await this.saveNow();
    return this.currentData;
  }

  getData(): SaveData {
    return this.currentData;
  }

  update(mutator: (draft: SaveData) => void): SaveData {
    mutator(this.currentData);
    this.currentData.updatedAtIso = new Date().toISOString();
    this.autoSave.schedule();
    return this.currentData;
  }

  async saveNow(): Promise<void> {
    this.currentData.updatedAtIso = new Date().toISOString();
    await this.storage.set(PRIMARY_SAVE_SLOT, this.currentData);
  }

  async reset(): Promise<SaveData> {
    const lang = languageManager.getLanguage();
    this.currentData = createDefaultSaveData(lang);
    await this.storage.set(PRIMARY_SAVE_SLOT, this.currentData);
    return this.currentData;
  }

  exportBackup(): void {
    BackupManager.downloadJsonBackup(this.currentData);
  }

  async flushPending(): Promise<void> {
    await this.autoSave.flush();
  }

  dispose(): void {
    this.autoSave.dispose();
  }
}
