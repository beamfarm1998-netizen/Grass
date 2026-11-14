import { DATABASE_NAME, DATABASE_VERSION, SAVE_STORE_NAME } from './SaveVersion';

export class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback = new Map<string, unknown>();

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        this.dbPromise = null;
        reject(new Error('IndexedDB unavailable'));
        return;
      }

      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAVE_STORE_NAME)) {
          db.createObjectStore(SAVE_STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error ?? new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        this.dbPromise = null;
        reject(new Error('IndexedDB open blocked'));
      };
    });

    return this.dbPromise;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.openDatabase();
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(SAVE_STORE_NAME, 'readonly');
        const store = tx.objectStore(SAVE_STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return (this.memoryFallback.get(key) as T) ?? null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.memoryFallback.set(key, value);
    try {
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SAVE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SAVE_STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'));
      });
    } catch {
      // Fallback map already updated for restricted environments
    }
  }

  async delete(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    try {
      const db = await this.openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SAVE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(SAVE_STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'));
      });
    } catch {
      // Safe no-op
    }
  }
}
