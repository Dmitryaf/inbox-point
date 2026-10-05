import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import ChangeHistory from '@frontend/widgets/change-history/ui/ChangeHistory';

import ContentPreview from '@frontend/widgets/content-preview/ui/ContentPreview';

import type { createComponentModel } from './ContentWorkspace.model';
export function renderContentWorkspacePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const workspace = $unref($state.workspace);
  const activeView = $state.activeView.value;
  if (!!workspace.loading.value) {
    return null;
  }
  if (!!!workspace.loaded.value) {
    return null;
  }
  return (
    <>
      {activeView === 'edit' ? (
        <aside className="workspace-live-preview" data-r-09629bd3="">
          <ContentPreview content={workspace.draft} data-r-09629bd3="" />
        </aside>
      ) : activeView === 'preview' ? (
        <ContentPreview content={workspace.draft} data-r-09629bd3="" />
      ) : (
        <ChangeHistory
          changes={workspace.history.value}
          hasUnsavedChanges={workspace.dirty.value}
          loading={workspace.historyLoading.value}
          restoring={workspace.restoring.value}
          onRestore={$callback($required($unref($state.workspace)).restore)}
          onUnauthorized={$callback(
            $required($unref($state.workspace)).expireSession,
          )}
          data-r-09629bd3=""
        />
      )}
    </>
  );
}
