import { SaveMigration } from './SaveMigration';
import { SaveData } from './SaveSchema';
import { SaveValidator } from './SaveValidator';

export class BackupManager {
  static serialize(data: SaveData): string {
    return JSON.stringify(data, null, 2);
  }

  static deserialize(jsonText: string): SaveData | null {
    try {
      const parsed = JSON.parse(jsonText);
      const migrated = SaveMigration.migrate(parsed);
      return SaveValidator.isValid(migrated) ? migrated : null;
    } catch {
      return null;
    }
  }

  static downloadJsonBackup(data: SaveData): void {
    if (typeof document === 'undefined') return;
    const json = this.serialize(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `realistic-fishing-3d-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
