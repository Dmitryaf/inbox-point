import { nextTick, toRaw } from 'vue';

export function createItemKey(): (item: object) => number {
  const keys = new WeakMap<object, number>();
  let nextKey = 0;
  return (item) => {
    const raw = toRaw(item);
    let key = keys.get(raw);
    if (key === undefined) {
      key = ++nextKey;
      keys.set(raw, key);
    }
    return key;
  };
}

export async function focusEditorField(id: string): Promise<void> {
  await nextTick();
  document.getElementById(id)?.focus();
}

export async function focusMovedItem(
  id: string,
  offset: number,
): Promise<void> {
  await nextTick();
  const field = document.getElementById(id);
  const button = field
    ?.closest('fieldset')
    ?.querySelector<HTMLButtonElement>(`button[data-move="${offset}"]`);
  if (button && !button.disabled) {
    button.focus();
  } else {
    field?.focus();
  }
}
