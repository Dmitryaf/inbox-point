import {
  preserveContentDraft,
  takeContentDraftRecovery,
} from '@frontend-common/features/content-draft/model/draft-recovery';
import type { ContentDraft } from '@frontend-common/entities/content/model/types';

export function preserveDraft(recovery: {
  draft: ContentDraft;
  savedSnapshot: string;
  version: string;
}): void {
  preserveContentDraft(
    recovery.draft,
    recovery.savedSnapshot,
    recovery.version,
  );
}
// Consume only after a current successful load, never during render.
export const takeDraftRecovery = takeContentDraftRecovery;
