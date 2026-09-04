import { act, fireEvent } from '@testing-library/react';

export class DOMWrapper<ElementType extends Element = Element> {
  constructor(private readonly node: ElementType | undefined) {}
  get element(): ElementType {
    if (!this.node) {
      throw new Error('Cannot access element of an empty wrapper');
    }
    return this.node;
  }
  exists(): boolean {
    return Boolean(this.node);
  }
  find<T extends Element = Element>(selector: string): DOMWrapper<T> {
    return new DOMWrapper(this.element.querySelector<T>(selector) ?? undefined);
  }
  get<T extends Element = Element>(selector: string): DOMWrapper<T> {
    const wrapper = this.find<T>(selector);
    if (!wrapper.exists()) {
      throw new Error(
        `Unable to get ${selector} within ${this.element.outerHTML}`,
      );
    }
    return wrapper;
  }
  findAll<T extends Element = Element>(selector: string): DOMWrapper<T>[] {
    return Array.from(
      this.element.querySelectorAll<T>(selector),
      (element) => new DOMWrapper(element),
    );
  }
  text(): string {
    return this.element.textContent?.trim() ?? '';
  }
  html(): string {
    return this.element.outerHTML;
  }
  classes(): string[];
  classes(name: string): boolean;
  classes(name?: string): string[] | boolean {
    return name
      ? this.element.classList.contains(name)
      : [...this.element.classList];
  }
  attributes(): Record<string, string>;
  attributes(name: string): string | undefined;
  attributes(name?: string): Record<string, string> | string | undefined {
    return name
      ? (this.element.getAttribute(name) ?? undefined)
      : Object.fromEntries(
          Array.from(this.element.attributes, (attr) => [
            attr.name,
            attr.value,
          ]),
        );
  }
  isVisible(): boolean {
    let element: Element | null = this.element;
    while (element) {
      const styles = getComputedStyle(element);
      if (
        element.hasAttribute('hidden') ||
        styles.display === 'none' ||
        styles.visibility === 'hidden' ||
        styles.opacity === '0'
      ) {
        return false;
      }
      element = element.parentElement;
    }
    return true;
  }
  async trigger(
    type: string,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    await act(async () => {
      const [name, ...modifiers] = type.split('.');
      const eventOptions = { bubbles: true, cancelable: true, ...options };
      if (modifiers.includes('enter')) {
        Object.assign(eventOptions, { key: 'Enter', code: 'Enter' });
      }
      const factory: unknown = Reflect.get(fireEvent, name ?? '');
      if (typeof factory === 'function') {
        (factory as (element: Element, options: object) => void)(
          this.element,
          eventOptions,
        );
      } else {
        fireEvent(this.element, new Event(name ?? type, eventOptions));
      }
      await Promise.resolve();
    });
  }
  async setValue(value: unknown): Promise<void> {
    const element = this.element;
    await act(async () => {
      if (
        element instanceof HTMLInputElement &&
        (element.type === 'checkbox' || element.type === 'radio')
      ) {
        if (element.checked !== Boolean(value)) {
          fireEvent.click(element);
        }
      } else if (
        element instanceof HTMLSelectElement &&
        element.multiple &&
        Array.isArray(value)
      ) {
        for (const option of element.options) {
          option.selected = value.includes(option.value);
        }
        fireEvent.change(element);
      } else if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      ) {
        fireEvent.input(element, { target: { value: value ?? '' } });
        fireEvent.change(element, { target: { value: value ?? '' } });
      } else if (element instanceof HTMLSelectElement) {
        fireEvent.change(element, { target: { value: value ?? '' } });
      } else {
        throw new TypeError('setValue requires an input, textarea or select');
      }
      await Promise.resolve();
    });
  }
  async setChecked(checked = true): Promise<void> {
    await this.setValue(checked);
  }
}
