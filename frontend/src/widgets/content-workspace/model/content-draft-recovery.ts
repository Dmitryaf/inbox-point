import {
  copyContentDraft,
  normalizeContentDraft,
} from '@frontend/entities/content/model/content-draft';
import type { ContentDraft } from '@frontend/entities/content/model/types';

const recoveryKey = 'inbox-point:content-draft';

interface ContentDraftRecovery {
  draft: ContentDraft;
  savedSnapshot: string;
  version: string;
}

export function preserveContentDraft(
  draft: ContentDraft,
  savedSnapshot: string,
  version: string,
): void {
  const recovery: ContentDraftRecovery = {
    draft: copyContentDraft(draft),
    savedSnapshot,
    version,
  };
  window.sessionStorage.setItem(recoveryKey, JSON.stringify(recovery));
}

export function takeContentDraftRecovery(): ContentDraftRecovery | undefined {
  const stored = window.sessionStorage.getItem(recoveryKey);
  if (!stored) {
    return undefined;
  }
  window.sessionStorage.removeItem(recoveryKey);

  try {
    const recovery = JSON.parse(stored) as Partial<ContentDraftRecovery>;
    if (
      !recovery.draft ||
      typeof recovery.savedSnapshot !== 'string' ||
      typeof recovery.version !== 'string'
    ) {
      return undefined;
    }
    return {
      draft: normalizeContentDraft(recovery.draft),
      savedSnapshot: recovery.savedSnapshot,
      version: recovery.version,
    };
  } catch {
    return undefined;
  }
}
