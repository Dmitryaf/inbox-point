import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { editorSections } from '@frontend/widgets/content-workspace/model/navigation';
import AppIcon from '@frontend/shared/ui/AppIcon';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './WorkspaceNavigation.model';
export function renderWorkspaceNavigationPart4(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      {$props.activeView === 'edit' ? (
        <aside className="dashboard-sidebar" data-r-e6e22060="">
          <nav
            aria-label="Разделы информации"
            className="sidebar-group"
            data-r-e6e22060=""
          >
            <p data-r-e6e22060="">{'Разделы'}</p>
            {$renderList($unref(editorSections), (section) => (
              <button
                key={section.id}
                aria-pressed={$props.activeSection === section.id}
                type="button"
                onClick={() => void $emit('sectionChange', section.id)}
                className={$class(
                  { active: $props.activeSection === section.id },
                  'section-button',
                )}
                data-r-e6e22060=""
              >
                <AppIcon name={section.id} data-r-e6e22060="" /> {section.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}
    </>
  );
}
