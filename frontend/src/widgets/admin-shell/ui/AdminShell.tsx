import '@frontend/widgets/admin-shell/styles/admin-shell.react-data-r-2be24c3c.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderAdminShellPart1 } from './AdminShell.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AdminShell.model';

export default function AdminShell($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div
        {...$attributes}
        className={$class('admin-shell', $attributes.className)}
        data-r-2be24c3c=""
      >
        {renderAdminShellPart1($state)}
      </div>
    </ModelScopeProvider>
  );
}
