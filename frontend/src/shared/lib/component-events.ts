import { publish } from './model-events';

export function invokeArgs(
  handler: (...args: never[]) => unknown,
  args: unknown[],
): void {
  Reflect.apply(handler, undefined, args);
}

export function invokeHandler(
  handler: (...args: never[]) => unknown,
  event: unknown,
): void {
  if (
    !event ||
    typeof event !== 'object' ||
    !('nativeEvent' in event) ||
    !('currentTarget' in event)
  ) {
    Reflect.apply(handler, undefined, [event]);
    return;
  }
  const native = event.nativeEvent as Event;
  const descriptor = Object.getOwnPropertyDescriptor(native, 'currentTarget');
  Object.defineProperty(native, 'currentTarget', {
    configurable: true,
    value: event.currentTarget,
  });
  try {
    Reflect.apply(handler, undefined, [native]);
  } finally {
    if (descriptor) {
      Object.defineProperty(native, 'currentTarget', descriptor);
    } else {
      Reflect.deleteProperty(native, 'currentTarget');
    }
  }
}

export function checkboxChecked<Value>(
  value: boolean | readonly Value[] | Set<Value>,
  option: Value,
): boolean {
  return Array.isArray(value)
    ? value.includes(option)
    : value instanceof Set
      ? value.has(option)
      : Boolean(value);
}

export function toggleCheckbox<Value>(
  value: Value[],
  option: Value,
  checked: boolean,
): Value[];
export function toggleCheckbox<Value>(
  value: Set<Value>,
  option: Value,
  checked: boolean,
): Set<Value>;
export function toggleCheckbox(
  value: boolean,
  option: unknown,
  checked: boolean,
): boolean;
export function toggleCheckbox<Value>(
  value: boolean | Value[] | Set<Value>,
  option: Value,
  checked: boolean,
): boolean | Value[] | Set<Value> {
  if (Array.isArray(value)) {
    return checked
      ? value.includes(option)
        ? value
        : [...value, option]
      : value.filter((item) => item !== option);
  }
  if (value instanceof Set) {
    const updated = new Set(value);
    if (checked) {
      updated.add(option);
    } else {
      updated.delete(option);
    }
    return updated;
  }
  return checked;
}
import type * as React from 'react';
export function eventCallback<Handler extends (...args: never[]) => unknown>(
  handler: Handler,
): (...args: Parameters<Handler>) => void {
  return (...args) => {
    Reflect.apply(handler, undefined, args);
  };
}
interface NativeModifiers {
  prevent?: boolean;
  stop?: boolean;
  self?: boolean;
  key?: string;
}
export function nativeHandler<NativeEvent extends Event = Event>(
  handler: (event: NativeEvent) => unknown,
  modifiers: NativeModifiers = {},
): React.EventHandler<React.SyntheticEvent> {
  return (event) => {
    if (modifiers.self && event.currentTarget !== event.target) {
      return;
    }
    if (modifiers.key && (!('key' in event) || event.key !== modifiers.key)) {
      return;
    }
    if (modifiers.prevent) {
      event.preventDefault();
    }
    if (modifiers.stop) {
      event.stopPropagation();
    }
    try {
      invokeHandler(handler, event);
    } finally {
      publish();
    }
  };
}
