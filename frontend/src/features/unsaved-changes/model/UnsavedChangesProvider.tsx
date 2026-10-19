import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

const UnsavedContext = createContext<{
  register: (guard: () => boolean) => () => void;
  confirmExit: () => boolean;
} | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guard = useRef<(() => boolean) | undefined>(undefined);
  const value = useMemo(
    () => ({
      register(next: () => boolean) {
        guard.current = next;
        return () => {
          if (guard.current === next) {
            guard.current = undefined;
          }
        };
      },
      confirmExit: () =>
        !guard.current?.() || window.confirm('Выйти без сохранения изменений?'),
    }),
    [],
  );
  return <UnsavedContext value={value}>{children}</UnsavedContext>;
}
export function useUnsavedChanges() {
  const context = useContext(UnsavedContext);
  if (!context) {
    throw new Error('Unsaved changes provider is missing');
  }
  return context;
}
