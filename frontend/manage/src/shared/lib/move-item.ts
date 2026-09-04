export function moveItem<T>(
  items: T[],
  index: number,
  direction: -1 | 1,
): void {
  const target = index + direction;
  const current = items[index];
  const adjacent = items[target];
  const cannotMove =
    target < 0 ||
    target >= items.length ||
    current === undefined ||
    adjacent === undefined;
  if (cannotMove) {
    return;
  }
  items[index] = adjacent;
  items[target] = current;
}
