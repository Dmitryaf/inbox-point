import { customRef, trackModelRead } from './model-state';

export interface ModelOptions<Value> {
  required?: boolean;
  default?: Value | (() => Value);
}
export interface ModelRef<Value> {
  value: Value;
}

export function createComponentProps<Props extends object>(
  current: { current: Props },
  defaults: Partial<Props>,
) {
  const fallback = new Map<PropertyKey, unknown>();
  const props = new Proxy({} as Props, {
    get(_target, key): unknown {
      return trackModelRead(() => {
        const provided: unknown = Reflect.get(current.current, key);
        if (provided !== undefined) {
          return provided;
        }
        if (!fallback.has(key)) {
          const value: unknown = Reflect.get(defaults, key);
          fallback.set(
            key,
            typeof value === 'function'
              ? Reflect.apply(value, undefined, [])
              : value,
          );
        }
        return fallback.get(key);
      });
    },
    has(_target, key) {
      return key in current.current || key in defaults;
    },
    ownKeys() {
      return [
        ...new Set([
          ...Reflect.ownKeys(current.current),
          ...Reflect.ownKeys(defaults),
        ]),
      ];
    },
    getOwnPropertyDescriptor() {
      return { configurable: true, enumerable: true };
    },
  });
  const emit = (name: string, ...args: unknown[]): void => {
    const observer: unknown = Reflect.get(current.current, '__onModelEvent');
    if (typeof observer === 'function') {
      Reflect.apply(observer, undefined, [name, ...args]);
    }
    const callback: unknown = Reflect.get(current.current, toEventName(name));
    if (typeof callback === 'function') {
      Reflect.apply(callback, undefined, args);
    }
  };
  const model = <Value>(
    name: string,
    options: ModelOptions<Value> = {},
  ): ModelRef<Value> => {
    const ownDefault =
      typeof options.default === 'function'
        ? (options.default as () => Value)()
        : options.default;
    return customRef(
      () => (Reflect.get(props, name) ?? ownDefault) as Value,
      (value) => emit(`${name}Change`, value),
    );
  };
  let exposed: Record<string, unknown> | undefined;
  const expose = (value: Record<string, unknown>): void => {
    exposed = value;
  };
  const publishExposed = (): void => {
    const ref: unknown = Reflect.get(current.current, 'ref');
    if (typeof ref === 'function') {
      Reflect.apply(ref, undefined, [exposed]);
    } else if (ref && typeof ref === 'object' && 'current' in ref) {
      ref.current = exposed;
    }
  };
  return { props, emit, model, expose, publishExposed };
}

function toEventName(name: string): string {
  return `on${name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`;
}
