import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderOperatorRequestListPart1 } from './OperatorRequestList.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperatorRequestList.model';

export default function OperatorRequestList($incomingProps: ComponentProps) {
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
      <nav
        {...$attributes}
        aria-label="Активные обращения"
        className={$class('operator-request-list', $attributes.className)}
      >
        {renderOperatorRequestListPart1($state, $props)}
      </nav>
    </ModelScopeProvider>
  );
}
