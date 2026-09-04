/** Observable domain models consumed through React's useSyncExternalStore. */
import { publish, type Cleanup } from './model-events';
import { getCurrentScope } from './model-scope';
import { shallowRef, type Ref, type InjectionKey } from './model-values';
export { notify } from './model-events';
export * from './model-scope';
export * from './model-values';
export * from './model-reactive';
export * from './model-watch';
export * from './model-computed';
export { trackModelRead } from './model-tracking';

export function onMounted(callback: () => unknown): void {
  const currentScope = getCurrentScope();
  if (!currentScope) {
    throw new Error('onMounted requires a React component model scope');
  }
  currentScope.onMount(callback);
}
export function onBeforeUnmount(callback: Cleanup): void {
  const currentScope = getCurrentScope();
  if (!currentScope) {
    throw new Error('onBeforeUnmount requires a React component model scope');
  }
  currentScope.onDispose(callback);
}
export function onUnmounted(callback: Cleanup): void {
  onBeforeUnmount(callback);
}
export function useTemplateRef<T>(name: string): Ref<T | null> {
  const currentScope = getCurrentScope();
  if (!currentScope) {
    throw new Error('useTemplateRef requires a React component model scope');
  }
  let target = currentScope.templateRefs.get(name);
  if (!target) {
    target = shallowRef<unknown>(null);
    currentScope.templateRefs.set(name, target);
  }
  return target as Ref<T | null>;
}
export function provide<T>(key: InjectionKey<T> | string, value: T): void {
  const currentScope = getCurrentScope();
  if (!currentScope) {
    throw new Error('provide requires a React component model scope');
  }
  currentScope.provided.set(key, value);
}
export function inject<T>(key: InjectionKey<T> | string): T | undefined;
export function inject<T>(key: InjectionKey<T> | string, fallback: T): T;
export function inject<T>(
  key: InjectionKey<T> | string,
  fallback?: T,
): T | undefined {
  for (let scope = getCurrentScope(); scope; scope = scope.parent) {
    if (scope.provided.has(key)) {
      return scope.provided.get(key) as T;
    }
  }
  return fallback;
}
export function readonly<T extends object>(value: T): Readonly<T> {
  return value;
}
export async function nextTick<T = void>(
  action?: () => T,
): Promise<T | undefined> {
  await Promise.resolve();
  publish();
  await Promise.resolve();
  return action?.();
}
