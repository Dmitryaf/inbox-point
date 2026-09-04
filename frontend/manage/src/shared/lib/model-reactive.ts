import { notify } from './model-events';
import { trackModelRead } from './model-tracking';
const rawObjects = new WeakMap<object, object>();
const proxies = new WeakMap<object, object>();

export function reactive<T extends object>(target: T): T {
  if (rawObjects.has(target)) {
    return target;
  }
  const existing = proxies.get(target);
  if (existing) {
    return existing as T;
  }
  const prototype = Object.getPrototypeOf(target) as object | null;
  if (
    prototype !== Object.prototype &&
    prototype !== Array.prototype &&
    prototype !== null
  ) {
    return target;
  }
  const proxy = new Proxy(target, {
    get(object, key, receiver) {
      const value: unknown = trackModelRead(
        () => Reflect.get(object, key, receiver) as unknown,
      );
      return value !== null && typeof value === 'object'
        ? reactive(value)
        : value;
    },
    set(object, key, value, receiver) {
      const previous: unknown = Reflect.get(object, key, receiver);
      const changed = Reflect.set(object, key, toRaw(value), receiver);
      if (changed && !Object.is(previous, value)) {
        notify();
      }
      return changed;
    },
    deleteProperty(object, key) {
      const existed = Reflect.has(object, key);
      const result = Reflect.deleteProperty(object, key);
      if (result && existed) {
        notify();
      }
      return result;
    },
    ownKeys(object) {
      trackModelRead(() => JSON.stringify(Reflect.ownKeys(object).map(String)));
      return Reflect.ownKeys(object);
    },
    has(object, key) {
      return trackModelRead(() => Reflect.has(object, key));
    },
  });
  proxies.set(target, proxy);
  rawObjects.set(proxy, target);
  return proxy;
}

export function toRaw<T>(value: T): T {
  return value !== null && typeof value === 'object'
    ? ((rawObjects.get(value) as T | undefined) ?? value)
    : value;
}
