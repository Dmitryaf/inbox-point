import { renderList as $renderList } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
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
export function renderWorkspaceNavigationPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { changeView, changeSection } = $state;

  return (
    <>
      <div className="mobile-workspace-navigation" data-r-e6e22060="">
        <div className="mobile-navigation-field" data-r-e6e22060="">
          <label htmlFor="workspace-view" data-r-e6e22060="">
            {'Режим'}
          </label>
          <select
            id="workspace-view"
            value={$props.activeView}
            onChange={$nativeHandler(changeView)}
            data-r-e6e22060=""
          >
            {$renderList($unref(workspaceViews), (view) => (
              <option key={view.id} value={view.id} data-r-e6e22060="">
                {view.id === 'edit'
                  ? 'Редактор'
                  : view.id === 'preview'
                    ? 'Просмотр'
                    : view.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mobile-navigation-field" data-r-e6e22060="">
          <label htmlFor="editor-section" data-r-e6e22060="">
            {'Раздел'}
          </label>
          <select
            id="editor-section"
            value={$props.activeView === 'edit' ? $props.activeSection : ''}
            onChange={$nativeHandler(changeSection)}
            data-r-e6e22060=""
          >
            <option disabled value="" data-r-e6e22060="">
              {'Перейти к разделу'}
            </option>
            {$renderList($unref(editorSections), (section) => (
              <option key={section.id} value={section.id} data-r-e6e22060="">
                {section.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
