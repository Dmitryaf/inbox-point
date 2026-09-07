import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  propertySetter as $propertySetter,
  requiredValue as $required,
} from '@frontend/shared/lib/component-bindings';

import ChangeHistory from '@frontend/widgets/change-history/ui/ChangeHistory';
import ContentEditor from '@frontend/widgets/content-editor/ui/ContentEditor';
import ContentPreview from '@frontend/widgets/content-preview/ui/ContentPreview';

import type { createComponentModel } from './ContentWorkspace.model';
export function renderContentWorkspacePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const workspace = $unref($state.workspace);
  const activeView = $state.activeView.value;
  const activeSection = $state.activeSection.value;
  const fieldErrors = $state.fieldErrors.value;
  if (!!workspace.loading.value) {
    return null;
  }
  if (!!!workspace.loaded.value) {
    return null;
  }
  return (
    <>
      {activeView === 'edit' ? (
        <ContentEditor
          activeSection={activeSection}
          errors={fieldErrors}
          modelValue={workspace.draft}
          onModelValueChange={$propertySetter(
            () => $unref($state.workspace),
            'draft',
          )}
        />
      ) : activeView === 'preview' ? (
        <ContentPreview content={workspace.draft} />
      ) : (
        <ChangeHistory
          changes={workspace.history.value}
          hasUnsavedChanges={workspace.dirty.value}
          loading={workspace.historyLoading.value}
          restoring={workspace.restoring.value}
          onRestore={$callback($required($unref($state.workspace)).restore)}
        />
      )}
    </>
  );
}
