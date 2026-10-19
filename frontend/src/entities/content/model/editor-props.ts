import type {
  ContentDraft,
  ContentValidationIssue,
} from '@frontend-common/entities/content/model/types';
import { copyContentDraft } from '@frontend-common/entities/content/model/content-draft';
export interface ContentEditorProps {
  draft: ContentDraft;
  edit: (change: Partial<ContentDraft>) => void;
  issues?: readonly ContentValidationIssue[];
}
export type OpenClass = (type: 'direction' | 'group', id: string) => void;
export function changeDraft(
  props: ContentEditorProps,
  change: (draft: ContentDraft) => void,
): void {
  const next = copyContentDraft(props.draft);
  change(next);
  props.edit(next);
}
