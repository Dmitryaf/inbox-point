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
  const { openSection, save } = $state;
  const workspace = $unref($state.workspace);
  const activeSection = $state.activeSection.value;
  const activeView = $state.activeView.value;
  const validation = $state.validation.value;

  return (
    <>
      {workspace.loading.value ? (
        <p role="status" className="state-card card" data-r-09629bd3="">
          {' Загружаем информацию… '}
        </p>
      ) : !workspace.loaded.value ? (
        <section className="state-card card" data-r-09629bd3="">
          <p data-r-09629bd3="">{'Редактор не открыт. Повторите загрузку.'}</p>
          <button
            type="button"
            onClick={$nativeHandler($required($unref($state.workspace)).load)}
            className="secondary-button"
            data-r-09629bd3=""
          >
            {' Повторить '}
          </button>
        </section>
      ) : (
        <div className="workspace" data-r-09629bd3="">
          <WorkspaceNavigation
            activeSection={activeSection}
            activeView={activeView}
            onSectionChange={$callback(openSection)}
            onViewChange={$setter($state, 'activeView')}
            data-r-09629bd3=""
          />
          <div className="workspace-main" data-r-09629bd3="">
            <ContentSummary content={workspace.draft} data-r-09629bd3="" />
            <section
              aria-label="Рабочая область"
              className="workspace-panel"
              data-r-09629bd3=""
            >
              <div
                key={activeView}
                className="workspace-view"
                data-r-09629bd3=""
              >
                {renderContentWorkspacePart2($state)}
              </div>
            </section>
            <SaveBar
              dirty={workspace.dirty.value}
              saving={workspace.saving.value}
              valid={validation.valid}
              validationMessage={validation.message}
              onSave={$callback(save)}
              data-r-09629bd3=""
            />
          </div>
        </div>
      )}
    </>
  );
}
