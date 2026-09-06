import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { workspaceViews } from '@frontend/widgets/content-workspace/model/navigation';
import AppIcon from '@frontend/shared/ui/AppIcon';

import { renderWorkspaceNavigationPart4 } from './WorkspaceNavigation.part4';

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
      <aside className="dashboard-sidebar desktop-workspace-navigation">
        <nav aria-label="Разделы управления" className="sidebar-group">
          <p>{'Работа с информацией'}</p>
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
            >
              <AppIcon name={view.id} /> {view.label}
            </button>
          ))}
        </nav>
        {renderWorkspaceNavigationPart4($state, $props)}
      </aside>
    </>
  );
}
