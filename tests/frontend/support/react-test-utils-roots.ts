import { afterEach } from 'vitest';
export const roots = new Set<{ unmount(): void }>();
afterEach(() => {
  for (const root of roots) {
    root.unmount();
  }
  roots.clear();
});
export function enableAutoUnmount(hook: (callback: () => void) => void): void {
  hook(() => {
    for (const root of roots) {
      root.unmount();
    }
    roots.clear();
  });
}
