export const DEFAULT_AUTOSAVE_DELAY_MS = 5000;

export type AutosavePhase =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

export interface AutosaveState {
  dirty: boolean;
  phase: AutosavePhase;
}

interface AutosaveCoordinatorOptions<Snapshot> {
  delayMs?: number | null;
  getSnapshot: () => Snapshot;
  onError?: (error: unknown) => void;
  onStateChange: (state: AutosaveState) => void;
  save: (snapshot: Snapshot) => Promise<void>;
}

export default class AutosaveCoordinator<Snapshot> {
  private readonly delayMs: number | null;
  private disposed = false;
  private flushRequested = false;
  private getSnapshot: () => Snapshot;
  private onError?: (error: unknown) => void;
  private onStateChange: (state: AutosaveState) => void;
  private revision = 0;
  private save: (snapshot: Snapshot) => Promise<void>;
  private savedRevision = 0;
  private savePromise: Promise<boolean> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: AutosaveCoordinatorOptions<Snapshot>) {
    this.delayMs = options.delayMs === undefined
      ? DEFAULT_AUTOSAVE_DELAY_MS
      : options.delayMs;
    this.getSnapshot = options.getSnapshot;
    this.onError = options.onError;
    this.onStateChange = options.onStateChange;
    this.save = options.save;
  }

  dispose() {
    this.disposed = true;
    this.flushRequested = false;
    this.clearTimer();
  }

  hasUnsavedChanges() {
    return this.revision > this.savedRevision;
  }

  markChanged({immediate = false}: {immediate?: boolean} = {}) {
    if (this.disposed) return;

    this.revision += 1;
    this.emit(this.savePromise ? "saving" : "pending");
    this.clearTimer();

    if (immediate) {
      void this.flush();
      return;
    }

    if (this.delayMs === null) return;

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  flush(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);

    this.clearTimer();
    this.flushRequested = true;
    if (!this.savePromise) {
      this.savePromise = this.drain().finally(() => {
        this.savePromise = null;
      });
    }
    return this.savePromise;
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async drain(): Promise<boolean> {
    while (
      !this.disposed &&
      this.flushRequested &&
      this.hasUnsavedChanges()
    ) {
      this.flushRequested = false;
      const savingRevision = this.revision;
      const snapshot = this.getSnapshot();
      this.emit("saving");

      try {
        await this.save(snapshot);
      } catch (error) {
        this.flushRequested = false;
        if (!this.disposed) {
          this.emit("error");
          this.onError?.(error);
        }
        return false;
      }

      this.savedRevision = Math.max(this.savedRevision, savingRevision);
      if (this.disposed) return false;

      if (!this.hasUnsavedChanges()) {
        this.emit("saved");
      } else if (!this.flushRequested) {
        this.emit("pending");
      }
    }

    return !this.disposed && !this.hasUnsavedChanges();
  }

  private emit(phase: AutosavePhase) {
    if (this.disposed) return;
    this.onStateChange({
      dirty: this.hasUnsavedChanges(),
      phase,
    });
  }
}
