import type { QueryClient } from '@tanstack/react-query';
import type { RefObject } from 'react';
import type { EditorLifetime, EditorState } from './editor-state';

export interface EditorContext {
  lifetime: RefObject<EditorLifetime>;
  patch: (patch: Partial<EditorState>) => void;
  cache: QueryClient;
  epoch: number;
  report: (cause: unknown) => string;
}
export const editorKey = (epoch: number) =>
  ['session', epoch, 'editor'] as const;
export function isCurrent(context: EditorContext, generation: number): boolean {
  return (
    context.lifetime.current.active &&
    context.lifetime.current.generation === generation
  );
}
