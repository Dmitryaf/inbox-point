import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import { invokeArgs as $invokeArgs } from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';

import SaveBar from '@manage/features/save-content/ui/SaveBar';
import AsyncMessage from '@manage/shared/ui/AsyncMessage';
import ChangeHistory from '@manage/widgets/change-history/ui/ChangeHistory';
import ContentEditor from '@manage/widgets/content-editor/ui/ContentEditor';
import ContentPreview from '@manage/widgets/content-preview/ui/ContentPreview';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentWorkspace.model';

export default function ContentWorkspace($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  const workspace = $unref($state.workspace);

  return (
    <ModelScopeProvider scope={$scope}>
      <AsyncMessage kind="error" text={workspace.error.value} />
      <AsyncMessage kind="success" text={workspace.notice.value} />
      {workspace.loading.value ? (
        <p role="status" className="state-card">
          {' Загружаем информацию… '}
        </p>
      ) : (
        <div className="workspace">
          <div>
            <ContentEditor
              modelValue={workspace.draft}
              onModelValueChange={($value) => {
                workspace.draft = $value;
              }}
            />
            <SaveBar
              dirty={workspace.dirty.value}
              saving={workspace.saving.value}
              onSave={(...$args) => {
                $invokeArgs(workspace.save, $args);
              }}
            />
          </div>
          <aside className="side-column">
            <ContentPreview content={workspace.draft} />
            <ChangeHistory
              changes={workspace.history.value}
              restoring={workspace.restoring.value}
              onRestore={(...$args) => {
                $invokeArgs(workspace.restore, $args);
              }}
            />
          </aside>
        </div>
      )}
    </ModelScopeProvider>
  );
}
