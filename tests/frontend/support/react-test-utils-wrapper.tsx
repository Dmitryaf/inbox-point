import * as React from 'react';
import { act, type RenderResult } from '@testing-library/react';
import { DOMWrapper } from './react-test-utils-dom';
import { roots } from './react-test-utils-roots';
export type Events = Record<string, unknown[][]>;
export class ReactWrapper<
  Props extends object = Record<string, unknown>,
> extends DOMWrapper<HTMLElement> {
  constructor(
    private readonly rendered: RenderResult,
    private readonly Component: React.ComponentType<Props>,
    private readonly currentProps: Props,
    private readonly events: Events,
    private readonly wrap: (children: React.ReactNode) => React.ReactNode,
    private readonly exposed: { current: unknown },
    private readonly ownedContainer?: HTMLElement,
  ) {
    super(rendered.container);
  }
  get vm(): unknown {
    return this.exposed.current;
  }
  async setProps(props: Partial<Props>): Promise<void> {
    Object.assign(this.currentProps, props);
    await act(async () => {
      this.rendered.rerender(
        this.wrap(React.createElement(this.Component, this.currentProps)),
      );
      await Promise.resolve();
    });
  }
  emitted(): Events;
  emitted(name: string): unknown[][] | undefined;
  emitted(name?: string): Events | unknown[][] | undefined {
    return name ? this.events[name] : this.events;
  }
  unmount(): void {
    this.rendered.unmount();
    this.ownedContainer?.remove();
    roots.delete(this);
  }
}
