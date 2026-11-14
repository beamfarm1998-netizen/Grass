export class AutoSave {
  private timerId: number | null = null;
  private dirty = false;
  private readonly debounceMs: number;
  private readonly saveCallback: () => Promise<void>;

  constructor(saveCallback: () => Promise<void>, debounceMs = 600) {
    this.saveCallback = saveCallback;
    this.debounceMs = debounceMs;
  }

  schedule(): void {
    this.dirty = true;
    if (this.timerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.timerId);
    }
    if (typeof window !== 'undefined') {
      this.timerId = window.setTimeout(() => {
        this.timerId = null;
        this.dirty = false;
        void this.saveCallback();
      }, this.debounceMs);
    } else {
      this.dirty = false;
      void this.saveCallback();
    }
  }

  async flush(): Promise<void> {
    if (this.timerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.dirty) {
      this.dirty = false;
      await this.saveCallback();
    }
  }

  dispose(): void {
    if (this.timerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.dirty) {
      this.dirty = false;
      void this.saveCallback();
    }
  }
}
