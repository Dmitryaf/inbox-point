import { snapshotContent } from '@frontend-common/entities/content/model/content-draft';
import type {
  ContentChange,
  ContentDraft,
  ContentSnapshot,
} from '@frontend-common/entities/content/model/types';

export interface EditorState {
  draft: ContentDraft | undefined;
  savedSnapshot: string;
  version: string;
  loading: boolean;
  saving: boolean;
  restoring: boolean;
  draftRevision: number;
  error: string;
  notice: string;
  history: ContentChange[];
  historyLoading: boolean;
  historyError: string;
  preview: ContentSnapshot | undefined;
  previewLoading: boolean;
  reviewedRevision: number | undefined;
}
export function initialEditorState(): EditorState {
  return {
    draft: undefined,
    savedSnapshot: '',
    version: '',
    loading: true,
    saving: false,
    restoring: false,
    draftRevision: 0,
    error: '',
    notice: '',
    history: [],
    historyLoading: false,
    historyError: '',
    preview: undefined,
    previewLoading: false,
    reviewedRevision: undefined,
  };
}
export function isDirty(state: EditorState): boolean {
  return !!state.draft && snapshotContent(state.draft) !== state.savedSnapshot;
}
export interface EditorLifetime {
  state: EditorState;
  active: boolean;
  generation: number;
  command: boolean;
  released: boolean;
  previewSequence: number;
}
