import * as React from 'react';
import type { ModelScope } from './model-state';
export function classNames(...values: unknown[]): string {
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (!value) {
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      names.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (typeof value === 'object') {
      for (const [name, enabled] of Object.entries(value)) {
        if (enabled) {
          names.push(name);
        }
      }
    }
  };
  values.forEach(visit);
  return names.join(' ');
}

export function inlineStyle(value: unknown): React.CSSProperties {
  if (!value) {
    return {};
  }
  if (Array.isArray(value)) {
    return value.reduce<React.CSSProperties>(
      (result, item: unknown) => ({ ...result, ...inlineStyle(item) }),
      {},
    );
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    throw new TypeError('Style must be a string, object or array');
  }
  return Object.fromEntries(
    value
      .split(';')
      .filter(Boolean)
      .map((entry) => {
        const colon = entry.indexOf(':');
        if (colon < 0) {
          throw new TypeError(`Invalid CSS declaration: ${entry}`);
        }
        const raw = entry.slice(0, colon).trim();
        const key = raw.startsWith('--')
          ? raw
          : raw.replace(/-([a-z])/g, (_, letter: string) =>
              letter.toUpperCase(),
            );
        return [key, entry.slice(colon + 1).trim()];
      }),
  );
}

export { renderList } from './component-list';
export function renderSlot(
  props: {
    children?: React.ReactNode;
    slots?: Record<
      string,
      ($props: Record<string, unknown>) => React.ReactNode
    >;
  },
  name: string,
  slotProps: Record<string, unknown>,
  fallback: React.ReactNode,
): React.ReactNode {
  return (
    props.slots?.[name]?.(slotProps) ??
    (name === 'default' ? props.children : undefined) ??
    fallback
  );
}

const templateCallbacks = new WeakMap<
  object,
  Map<string, React.RefCallback<Element>>
>();
export function templateRef(
  state: object,
  name: string,
  scope?: ModelScope,
): React.RefCallback<Element> {
  let callbacks = templateCallbacks.get(state);
  if (!callbacks) {
    callbacks = new Map();
    templateCallbacks.set(state, callbacks);
  }
  const previous = callbacks.get(name);
  if (previous) {
    return previous;
  }
  const callback: React.RefCallback<Element> = (value) => {
    const ref: unknown = Reflect.get(state, name);
    if (ref && typeof ref === 'object' && 'value' in ref) {
      ref.value = value;
    }
    scope?.setTemplateRef(name, value);
  };
  callbacks.set(name, callback);
  return callback;
}

export function dynamicComponent(
  component: React.ElementType,
  props: Record<string, unknown>,
  children?: React.ReactNode,
): React.ReactNode {
  return React.createElement(component, props, children);
}
