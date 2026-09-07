import { classNames as $class } from '@frontend/shared/lib/component-view';
import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
} from '@frontend/shared/lib/component-bindings';

import SaveBar from '@frontend/features/save-content/ui/SaveBar';
import ContentSummary from '@frontend/entities/content/ui/ContentSummary';

import WorkspaceNavigation from './WorkspaceNavigation';

import { renderContentWorkspacePart2 } from './ContentWorkspace.part2';

import type { createComponentModel } from './ContentWorkspace.model';
export function renderContentWorkspacePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { save } = $state;
  const workspace = $unref($state.workspace);
  const activeView = $state.activeView.value;
  const activeSection = $state.activeSection.value;
  const validation = $state.validation.value;

  return (
    <>
      {workspace.loading.value ? (
        <p role="status" className="state-card">
          {' Загружаем информацию… '}
        </p>
      ) : !workspace.loaded.value ? (
        <section className="state-card">
          <p>{'Редактор не открыт. Повторите загрузку.'}</p>
          <button
            type="button"
            onClick={$nativeHandler($required($unref($state.workspace)).load)}
            className="secondary-button"
          >
            {' Повторить '}
          </button>
        </section>
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
          <section aria-label="Рабочая область" className="workspace-panel">
            {renderContentWorkspacePart2($state)}
          </section>
          <aside className="workspace-rail">
            <SaveBar
              dirty={workspace.dirty.value}
              saving={workspace.saving.value}
              valid={validation.valid}
              validationMessage={validation.message}
              onSave={$callback(save)}
            />
            <ContentSummary content={workspace.draft} />
          </aside>
        </div>
      )}
    </>
  );
}
