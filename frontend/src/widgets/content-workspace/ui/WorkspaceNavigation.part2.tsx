import { renderList as $renderList } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import { editorSections } from '@frontend/widgets/content-workspace/model/navigation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './WorkspaceNavigation.model';
export function renderWorkspaceNavigationPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { changeSection } = $state;

  return (
    <>
      {$props.activeView === 'edit' ? (
        <div className="mobile-navigation-field" data-r-e6e22060="">
          <label htmlFor="editor-section" data-r-e6e22060="">
            {'Раздел'}
          </label>
          <select
            id="editor-section"
            value={$props.activeSection}
            onChange={$nativeHandler(changeSection)}
            data-r-e6e22060=""
          >
            {$renderList($unref(editorSections), (section) => (
              <option key={section.id} value={section.id} data-r-e6e22060="">
                {section.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
