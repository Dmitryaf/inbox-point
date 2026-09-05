import { classNames as $class } from '@frontend/shared/lib/component-view';
import { invokeArgs as $invokeArgs } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
  setProperty as $setProperty,
} from '@frontend/shared/lib/component-bindings';

import SaveBar from '@frontend/features/save-content/ui/SaveBar';
import ContentSummary from '@frontend/entities/content/ui/ContentSummary';

import AppIcon from '@frontend/shared/ui/AppIcon';
import ChangeHistory from '@frontend/widgets/change-history/ui/ChangeHistory';
import ContentEditor from '@frontend/widgets/content-editor/ui/ContentEditor';
import ContentPreview from '@frontend/widgets/content-preview/ui/ContentPreview';

import WorkspaceNavigation from './WorkspaceNavigation';

import type { createComponentModel } from './ContentWorkspace.model';
export function renderContentWorkspacePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const workspace = $unref($state.workspace);
  const activeView = $state.activeView.value;
  const activeSection = $state.activeSection.value;
  return (
    <>
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
          <header className="workspace-topbar">
            <div className="workspace-identity">
              <span className="workspace-mark">
                <AppIcon name="channel" />
              </span>
              <div>
                <strong>{'Messenger Handoff'}</strong>
                <small>{'Информация для клиентов'}</small>
              </div>
            </div>
            <span className="channel-badge">
              <span aria-hidden="true" />
              {' Telegram и VK '}
            </span>
          </header>
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
          <aside className="workspace-rail">
            <SaveBar
              dirty={workspace.dirty.value}
              saving={workspace.saving.value}
              onSave={(...$args) => {
                $invokeArgs($required($unref($state.workspace)).save, $args);
              }}
            />
            <ContentSummary content={workspace.draft} />
          </aside>
        </div>
      )}
    </>
  );
}
