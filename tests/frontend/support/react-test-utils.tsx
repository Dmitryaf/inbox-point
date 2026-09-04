import * as React from 'react';
import { act, render } from '@testing-library/react';
import { roots } from './react-test-utils-roots';
import { ReactWrapper, type Events } from './react-test-utils-wrapper';
export { ReactWrapper } from './react-test-utils-wrapper';
export { DOMWrapper } from './react-test-utils-dom';
export { enableAutoUnmount } from './react-test-utils-roots';
type AnyProps = Record<string, unknown>;
export async function flushPromises(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 12; turn += 1) {
      await Promise.resolve();
    }
  });
}

interface MountOptions<Props> {
  props?: Partial<Props>;
  attrs?: AnyProps;
  slots?: Record<string, React.ReactNode>;
  attachTo?: Element | string;
  global?: { plugins?: unknown[]; stubs?: AnyProps; provide?: AnyProps };
}

export function mount<Props extends object>(
  Component: React.ComponentType<Props>,
  options: MountOptions<Props> = {},
): ReactWrapper<Props> {
  if (options.global?.provide) {
    throw new Error(
      'Mount global provide requires an explicit React provider adapter',
    );
  }
  if (
    options.global?.stubs &&
    Object.entries(options.global.stubs).some(
      ([name, value]) => name !== 'RouterLink' || value !== true,
    )
  ) {
    throw new Error('Unsupported component stub');
  }
  const wrap = (children: React.ReactNode): React.ReactNode => {
    for (const plugin of [...(options.global?.plugins ?? [])].reverse()) {
      if (
        !plugin ||
        typeof plugin !== 'object' ||
        !('__reactRouter' in plugin) ||
        !('render' in plugin) ||
        typeof plugin.render !== 'function'
      ) {
        throw new Error('Mount plugin requires a React provider adapter');
      }
      children = (
        plugin.render as (children: React.ReactNode) => React.ReactNode
      )(children);
    }
    return children;
  };
  const events: Events = {};
  const supplied = { ...options.attrs, ...options.props };
  const exposed: { current: unknown } = { current: undefined };
  const suppliedRef: unknown = Reflect.get(supplied, 'ref');
  Reflect.set(supplied, 'ref', (value: unknown) => {
    exposed.current = value;
    if (typeof suppliedRef === 'function') {
      Reflect.apply(suppliedRef, undefined, [value]);
    } else if (
      suppliedRef &&
      typeof suppliedRef === 'object' &&
      'current' in suppliedRef
    ) {
      suppliedRef.current = value;
    }
  });
  if (options.slots) {
    if (Object.keys(options.slots).some((name) => name !== 'default')) {
      throw new Error('Named mount slots require render callbacks');
    }
    Reflect.set(supplied, 'children', options.slots.default);
  }
  Reflect.set(
    supplied,
    '__onModelEvent',
    (event: string, ...args: unknown[]) => {
      const originalName = event.endsWith('Change')
        ? `update:${event.slice(0, -6)}`
        : event;
      (events[originalName] ??= []).push(args);
    },
  );
  const currentProps = supplied as Props;
  const attached =
    typeof options.attachTo === 'string'
      ? document.querySelector(options.attachTo)
      : options.attachTo;
  const ownedContainer = attached ? document.createElement('div') : undefined;
  if (ownedContainer) {
    attached?.appendChild(ownedContainer);
  }
  const rendered = render(
    wrap(React.createElement(Component, currentProps)),
    ownedContainer ? { container: ownedContainer } : undefined,
  );
  const wrapper = new ReactWrapper(
    rendered,
    Component,
    currentProps,
    events,
    wrap,
    exposed,
    ownedContainer,
  );
  roots.add(wrapper);
  return wrapper;
}
