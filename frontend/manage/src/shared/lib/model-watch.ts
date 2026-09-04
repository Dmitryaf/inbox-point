import { watchers, type Cleanup } from './model-events';
import { getCurrentScope } from './model-scope';
import type { Ref } from './model-values';
type WatchSource<T> = Ref<T> | (() => T);
interface WatchOptions {
  immediate?: boolean;
  deep?: boolean;
  flush?: 'pre' | 'post' | 'sync';
}

function readSource<T>(source: WatchSource<T>): T {
  return typeof source === 'function' ? source() : source.value;
}
function snapshot(value: unknown): string {
  return JSON.stringify(value) ?? 'undefined';
}
export function watch<T>(
  source: WatchSource<T>,
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: Cleanup) => void,
  ) => unknown,
  options?: WatchOptions,
): Cleanup;
export function watch<T extends readonly unknown[]>(
  source: { [K in keyof T]: WatchSource<T[K]> },
  callback: (
    value: T,
    previous: T | undefined,
    onCleanup: (cleanup: Cleanup) => void,
  ) => unknown,
  options?: WatchOptions,
): Cleanup;
export function watch(
  source: WatchSource<unknown> | readonly WatchSource<unknown>[],
  callback: (
    value: never,
    previous: never,
    onCleanup: (cleanup: Cleanup) => void,
  ) => unknown,
  options: WatchOptions = {},
): Cleanup {
  const read = (): unknown =>
    Array.isArray(source)
      ? source.map(readSource)
      : readSource(source as WatchSource<unknown>);
  let previous = read();
  let previousSnapshot = options.deep ? snapshot(previous) : '';
  let cleanup: Cleanup | undefined;
  const changed = (next: unknown): boolean =>
    options.deep
      ? snapshot(next) !== previousSnapshot
      : Array.isArray(source) && Array.isArray(previous) && Array.isArray(next)
        ? next.some(
            (value, index) => !Object.is(value, (previous as unknown[])[index]),
          )
        : !Object.is(next, previous);
  const invoke = (next: unknown, old: unknown): void => {
    cleanup?.();
    callback(next as never, old as never, (fn) => {
      cleanup = fn;
    });
  };
  const check = (): void => {
    const next = read();
    if (!changed(next)) {
      return;
    }
    const old = previous;
    previous = next;
    if (options.deep) {
      previousSnapshot = snapshot(next);
    }
    invoke(next, old);
  };
  const currentScope = getCurrentScope();
  const unregister = currentScope
    ? currentScope.addWatcher(check)
    : (() => {
        watchers.add(check);
        return () => {
          watchers.delete(check);
        };
      })();
  const stop = (): void => {
    unregister();
    cleanup?.();
  };
  currentScope?.onDispose(stop);
  if (options.immediate) {
    invoke(previous, undefined);
  }
  return stop;
}
