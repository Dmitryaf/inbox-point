import { useEffect, type RefObject } from 'react';
import { useBlocker } from 'react-router';
import { useUnsavedChanges } from '@frontend/features/unsaved-changes/model/UnsavedChangesProvider';
import { isDirty, type EditorLifetime } from './editor-state';

export function useEditorExitGuard(lifetime: RefObject<EditorLifetime>) {
  const { register } = useUnsavedChanges();
  useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      !lifetime.current.released &&
      isDirty(lifetime.current.state) &&
      !window.confirm('Уйти без сохранения изменений?'),
  );
  useEffect(() => {
    const dirty = () =>
      !lifetime.current.released && isDirty(lifetime.current.state);
    const unregister = register(dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty()) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [lifetime, register]);
}
