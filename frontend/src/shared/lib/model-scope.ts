import {
  listeners,
  watchers,
  getVersion,
  notify,
  type Cleanup,
} from './model-events';
import type { Ref } from './model-values';
let currentScope: ModelScope | undefined;

export class ModelScope {
  readonly templateRefs = new Map<string, Ref<unknown>>();
  readonly provided = new Map<symbol | string, unknown>();
  private readonly mountCallbacks: (() => unknown)[] = [];
  private readonly cleanups: Cleanup[] = [];
  private readonly watcherChecks = new Set<Cleanup>();
  private mounted = false;
  private disposed = false;
  constructor(readonly parent?: ModelScope) {}
  readonly subscribe = (listener: Cleanup): Cleanup => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  readonly getVersion = getVersion;
  readonly notify = notify;
  checkWatchers(): void {
    for (const watcher of [...this.watcherChecks]) {
      watcher();
    }
  }
  flushWatchers(): void {
    this.checkWatchers();
  }
  addWatcher(check: Cleanup): Cleanup {
    this.watcherChecks.add(check);
    if (this.mounted) {
      watchers.add(check);
    }
    return () => {
      this.watcherChecks.delete(check);
      watchers.delete(check);
    };
  }
  setTemplateRef(name: string, value: unknown): void {
    const target = this.templateRefs.get(name);
    if (target && target.value !== value) {
      target.value = value;
    }
  }
  onMount(callback: () => unknown): void {
    this.mountCallbacks.push(callback);
  }
  onDispose(callback: Cleanup): void {
    this.cleanups.push(callback);
  }
  mount(): void {
    if (this.disposed || this.mounted) {
      return;
    }
    this.mounted = true;
    for (const watcher of this.watcherChecks) {
      watchers.add(watcher);
    }
    for (const callback of this.mountCallbacks) {
      runInScope(this, callback);
    }
  }
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const cleanup of this.cleanups.splice(0).reverse()) {
      cleanup();
    }
    this.watcherChecks.clear();
  }
}

export function createModelScope(parent?: ModelScope): ModelScope {
  return new ModelScope(parent);
}
export function getCurrentScope(): ModelScope | undefined {
  return currentScope;
}
export function runInScope<T>(scope: ModelScope, action: () => T): T {
  const previous = currentScope;
  currentScope = scope;
  try {
    return action();
  } finally {
    currentScope = previous;
  }
}
