import type * as React from 'react';
export function renderList<Value>(
  source: readonly Value[],
  render: (value: Value, index: number) => React.ReactNode,
): React.ReactNode[];
export function renderList<Value>(
  source: Record<string, Value>,
  render: (value: Value, key: string, index: number) => React.ReactNode,
): React.ReactNode[];
export function renderList(
  source: number | string,
  render: (value: number | string, index: number) => React.ReactNode,
): React.ReactNode[];
export function renderList(
  source: unknown,
  render: (...args: never[]) => React.ReactNode,
): React.ReactNode[] {
  if (Array.isArray(source) || typeof source === 'string') {
    return Array.from(source).map(
      (value, index) =>
        Reflect.apply(render, undefined, [value, index]) as React.ReactNode,
    );
  }
  if (typeof source === 'number') {
    return Array.from(
      { length: source },
      (_, index) =>
        Reflect.apply(render, undefined, [index + 1, index]) as React.ReactNode,
    );
  }
  if (source && typeof source === 'object') {
    return Object.entries(source).map(
      ([key, value], index) =>
        Reflect.apply(render, undefined, [
          value,
          key,
          index,
        ]) as React.ReactNode,
    );
  }
  return [];
}
