import { useLayoutEffect, useRef, useState } from 'react';

export function useCollectionEditor<T>(
  items: T[],
  onChange: (items: T[]) => void,
  options: {
    create: () => T;
    limit: number;
    prefix: string;
    description: (item: T, index: number) => string;
    hasContent: (item: T) => boolean;
  },
) {
  const [keys, setKeys] = useState(() => items.map(() => crypto.randomUUID()));
  const focus = useRef<{ id: string; move?: number } | undefined>(undefined);
  useLayoutEffect(() => {
    if (!focus.current) {
      return;
    }
    const field = document.getElementById(focus.current.id);
    const button =
      focus.current.move === undefined
        ? undefined
        : field
            ?.closest('fieldset')
            ?.querySelector<HTMLButtonElement>(
              `[data-move="${focus.current.move}"]`,
            );
    (button && !button.disabled ? button : field)?.focus();
    focus.current = undefined;
  });
  function add() {
    if (items.length >= options.limit) {
      return;
    }
    focus.current = { id: `${options.prefix}-${items.length}` };
    setKeys([...keys, crypto.randomUUID()]);
    onChange([...items, options.create()]);
  }
  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) {
      return;
    }
    const next = [...items];
    const nextKeys = [...keys];
    [next[index], next[target]] = [next[target]!, next[index]!];
    [nextKeys[index], nextKeys[target]] = [nextKeys[target]!, nextKeys[index]!];
    focus.current = { id: `${options.prefix}-${target}`, move: offset };
    setKeys(nextKeys);
    onChange(next);
  }
  function remove(index: number) {
    const item = items[index];
    if (item === undefined) {
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
    focus.current = {
      id:
        items.length > 1
          ? `${options.prefix}-${Math.min(index, items.length - 2)}`
          : `add-${options.prefix}`,
    };
    setKeys(keys.filter((_, itemIndex) => itemIndex !== index));
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }
  return { keys, add, move, remove };
}
