import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { workspaceViews } from '@frontend/widgets/content-workspace/model/navigation';

import { renderWorkspaceNavigationPart1 } from './WorkspaceNavigation.part1';
import { renderWorkspaceNavigationPart2 } from './WorkspaceNavigation.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './WorkspaceNavigation.model';

export default function WorkspaceNavigation($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { $emit } = $state;
  return (
    <ModelScopeProvider scope={$scope}>
      {renderWorkspaceNavigationPart1($state, $props)}
      <nav
        aria-label="Разделы управления"
        className="workspace-navigation desktop-workspace-navigation"
      >
        {$renderList($unref(workspaceViews), (view) => (
          <button
            key={view.id}
            aria-pressed={$props.activeView === view.id}
            type="button"
            onClick={() => {
              void $emit('viewChange', view.id);
            }}
            className={$class(
              { active: $props.activeView === view.id },
              'navigation-button',
            )}
          >
            {view.label}
          </button>
        ))}
      </nav>
      {renderWorkspaceNavigationPart2($state, $props)}
    </ModelScopeProvider>
  );
}
