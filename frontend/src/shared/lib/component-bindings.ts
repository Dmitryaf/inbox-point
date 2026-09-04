import { isRef } from './model-state';

export type ModelValue<Value> = Value extends { readonly value: infer Inner }
  ? Inner
  : Value;
export function setProperty<State extends object, Key extends keyof State>(
  state: State,
  key: Key,
  value: State[Key],
): void {
  if (!Reflect.set(state, key, value)) {
    throw new TypeError(`Cannot update property: ${String(key)}`);
  }
}

export function setModelValue<State extends object, Key extends keyof State>(
  state: State,
  key: Key,
  value: ModelValue<State[Key]>,
): void {
  const target: unknown = Reflect.get(state, key);
  if (isRef(target)) {
    target.value = value;
  } else if (!Reflect.set(state, key, value)) {
    throw new TypeError(`Cannot update component value: ${String(key)}`);
  }
}

export function modelSetter<State extends object, Key extends keyof State>(
  state: State,
  key: Key,
): (value: ModelValue<State[Key]>) => void {
  return (value) => {
    setModelValue(state, key, value);
  };
}

export function requiredValue<Value>(value: Value): NonNullable<Value> {
  if (value === undefined || value === null) {
    throw new TypeError('The edited item is no longer available');
  }
  return value;
}
