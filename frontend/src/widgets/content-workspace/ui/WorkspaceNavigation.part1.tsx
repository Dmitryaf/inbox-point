import { renderList as $renderList } from '@frontend/shared/lib/component-view';
import { invokeHandler as $invoke } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import {
  editorSections,
  workspaceViews,
} from '@frontend/widgets/content-workspace/model/navigation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './WorkspaceNavigation.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderWorkspaceNavigationPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { changeView, changeSection } = $state;
  return (
    <>
      <div className="mobile-workspace-navigation">
        <div className="mobile-navigation-field">
          <label htmlFor="workspace-view">{'Режим'}</label>
          <select
            id="workspace-view"
            value={$props.activeView}
            onChange={$controlledChange<HTMLSelectElement>(($event) => {
              $invoke(changeView, $event);
            })}
          >
            {$renderList($unref(workspaceViews), (view) => (
              <option key={view.id} value={view.id}>
                {view.label}
              </option>
            ))}
          </select>
        </div>
        {$props.activeView === 'edit' ? (
          <div className="mobile-navigation-field">
            <label htmlFor="editor-section">{'Раздел'}</label>
            <select
              id="editor-section"
              value={$props.activeSection}
              onChange={$controlledChange<HTMLSelectElement>(($event) => {
                $invoke(changeSection, $event);
              })}
            >
              {$renderList($unref(editorSections), (section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </>
  );
}
