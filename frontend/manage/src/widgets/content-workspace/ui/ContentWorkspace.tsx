import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';
import { invokeArgs as $invokeArgs } from '@manage/shared/lib/component-events';
import { unref as $unref } from '@manage/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
  setProperty as $setProperty,
} from '@manage/shared/lib/component-bindings';

import SaveBar from '@manage/features/save-content/ui/SaveBar';
import AsyncMessage from '@manage/shared/ui/AsyncMessage';
import ChangeHistory from '@manage/widgets/change-history/ui/ChangeHistory';
import ContentEditor from '@manage/widgets/content-editor/ui/ContentEditor';
import ContentPreview from '@manage/widgets/content-preview/ui/ContentPreview';

import WorkspaceNavigation from './WorkspaceNavigation';
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
  const activeView = $state.activeView.value;
  const activeSection = $state.activeSection.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <AsyncMessage kind="error" text={workspace.error.value} />
      <AsyncMessage kind="success" text={workspace.notice.value} />
      {workspace.loading.value ? (
        <p role="status" className="state-card">
          {' Загружаем информацию… '}
        </p>
      ) : (
        <div
          className={$class('workspace', {
            'workspace--editing': activeView === 'edit',
          })}
        >
          <WorkspaceNavigation
            activeSection={activeSection}
            activeView={activeView}
            onSectionChange={$setter($state, 'activeSection')}
            onViewChange={$setter($state, 'activeView')}
          />
          <main className="workspace-panel">
            {activeView === 'edit' ? (
              <ContentEditor
                activeSection={activeSection}
                modelValue={workspace.draft}
                onModelValueChange={($value) => {
                  $setProperty(
                    $required($unref($state.workspace)),
                    'draft',
                    $value,
                  );
                }}
              />
            ) : activeView === 'preview' ? (
              <ContentPreview content={workspace.draft} />
            ) : (
              <ChangeHistory
                changes={workspace.history.value}
                hasUnsavedChanges={workspace.dirty.value}
                restoring={workspace.restoring.value}
                onRestore={(...$args) => {
                  $invokeArgs(
                    $required($unref($state.workspace)).restore,
                    $args,
                  );
                }}
              />
            )}
          </main>
          <SaveBar
            dirty={workspace.dirty.value}
            saving={workspace.saving.value}
            onSave={(...$args) => {
              $invokeArgs($required($unref($state.workspace)).save, $args);
            }}
          />
        </div>
      )}
    </ModelScopeProvider>
  );
}
