import { customRef, type Ref } from './model-values';
import { dependenciesUnchanged, trackedValue } from './model-tracking';

export function computed<Value>(
  read: (() => Value) | { get(): Value; set(value: Value): void },
): Ref<Value> {
  let cached: ReturnType<typeof trackedValue<Value>> | undefined;
  let computing = false;
  const evaluate = (): Value => {
    if (cached && dependenciesUnchanged(cached.dependencies)) {
      return cached.value;
    }
    if (computing) {
      throw new Error('A computed model depends on itself');
    }
    computing = true;
    try {
      cached = trackedValue(
        typeof read === 'function' ? read : () => read.get(),
      );
      return cached.value;
    } finally {
      computing = false;
    }
  };
  return customRef(evaluate, (value) => {
    if (typeof read === 'function') {
      throw new TypeError('Cannot assign a computed value');
    }
    read.set(value);
  });
}
