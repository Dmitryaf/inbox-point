import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { workspaceViews } from '@frontend/widgets/content-workspace/model/navigation';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './WorkspaceNavigation.model';
export function renderWorkspaceNavigationPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      <nav
        aria-label="Режим работы"
        className="workspace-tabs desktop-workspace-navigation"
        data-r-e6e22060=""
      >
        {$renderList($unref(workspaceViews), (view) => (
          <button
            key={view.id}
            aria-pressed={$props.activeView === view.id}
            type="button"
            onClick={() => void $emit('viewChange', view.id)}
            className={$class(
              { active: $props.activeView === view.id },
              'navigation-button',
            )}
            data-r-e6e22060=""
          >
            {view.label}
          </button>
        ))}
      </nav>
    </>
  );
}
