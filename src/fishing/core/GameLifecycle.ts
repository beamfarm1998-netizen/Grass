export interface LifecycleCallbacks {
  onPause: () => void;
  onResume: () => void;
  onResize: (width: number, height: number) => void;
}

export class GameLifecycle {
  private callbacks: LifecycleCallbacks;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private boundVisibility: (() => void) | null = null;
  private boundWindowResize: (() => void) | null = null;

  constructor(callbacks: LifecycleCallbacks) {
    this.callbacks = callbacks;
  }

  attach(container: HTMLElement): void {
    this.detach();
    this.container = container;

    this.boundVisibility = () => {
      if (document.hidden) {
        this.callbacks.onPause();
      } else {
        this.callbacks.onResume();
      }
    };
    document.addEventListener('visibilitychange', this.boundVisibility);

    this.boundWindowResize = () => {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.callbacks.onResize(rect.width, rect.height);
      }
    };
    window.addEventListener('resize', this.boundWindowResize);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            this.callbacks.onResize(width, height);
          }
        }
      });
      this.resizeObserver.observe(container);
    }
  }

  detach(): void {
    if (this.boundVisibility) {
      document.removeEventListener('visibilitychange', this.boundVisibility);
      this.boundVisibility = null;
    }
    if (this.boundWindowResize) {
      window.removeEventListener('resize', this.boundWindowResize);
      this.boundWindowResize = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.container = null;
  }
}
