import type { ComponentType } from 'react';
import { notify } from './model-events';
import { reactive } from './model-reactive';
import { trackModelRead } from './model-tracking';
export interface Ref<T = unknown> {
  value: T;
  readonly __isModelRef?: true;
}
export type ShallowRef<T = unknown> = Ref<T>;
export type InjectionKey<T> = symbol & { readonly __injectionType?: T };
export type DefineComponent<Props = Record<string, unknown>> =
  ComponentType<Props>;

export function ref<T>(value: T): Ref<T>;
export function ref<T = undefined>(): Ref<T | undefined>;
export function ref<T>(value?: T): Ref<T | undefined> {
  let current =
    value !== null && typeof value === 'object' ? reactive(value) : value;
  return customRef(
    () => current,
    (next) => {
      if (Object.is(current, next)) {
        return;
      }
      current =
        next !== null && typeof next === 'object' ? reactive(next) : next;
      notify();
    },
  );
}

export function shallowRef<T>(value: T): Ref<T> {
  let current = value;
  return customRef(
    () => current,
    (next) => {
      if (!Object.is(current, next)) {
        current = next;
        notify();
      }
    },
  );
}

export function customRef<T>(get: () => T, set: (value: T) => void): Ref<T> {
  return {
    __isModelRef: true,
    get value() {
      return trackModelRead(get);
    },
    set value(value: T) {
      set(value);
    },
  };
}
export function isRef(value: unknown): value is Ref<unknown> {
  return value !== null && typeof value === 'object' && '__isModelRef' in value;
}
export function unref<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value;
}
