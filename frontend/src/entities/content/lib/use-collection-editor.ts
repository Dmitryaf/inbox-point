import {
  createItemKey,
  focusEditorField,
  focusMovedItem,
} from './editor-focus';

export function useCollectionEditor<T extends object>(options: {
  items: () => T[];
  create: () => T;
  limit: number;
  fieldPrefix: string;
  description: (item: T, index: number) => string;
  hasContent: (item: T) => boolean;
}) {
  function add(): void {
    const items = options.items();
    if (items.length >= options.limit) {
      return;
    }
    items.push(options.create());
    void focusEditorField(`${options.fieldPrefix}-${items.length - 1}`);
  }
  function move(index: number, offset: -1 | 1): void {
    const items = options.items();
    const target = index + offset;
    if (target < 0 || target >= items.length) {
      return;
    }
    const [item] = items.splice(index, 1);
    if (item) {
      items.splice(target, 0, item);
      void focusMovedItem(`${options.fieldPrefix}-${target}`, offset);
    }
  }
  function remove(index: number): void {
    const items = options.items();
    const item = items[index];
    if (!item) {
      return;
    }
    if (
      options.hasContent(item) &&
      !window.confirm(
        `Удалить ${options.description(item, index)}? Остальные изменения сохранятся в черновике.`,
      )
    ) {
      return;
    }
    items.splice(index, 1);
    void focusEditorField(
      items.length
        ? `${options.fieldPrefix}-${Math.min(index, items.length - 1)}`
        : `add-${options.fieldPrefix}`,
    );
  }
  return { add, move, remove, itemKey: createItemKey() };
}
