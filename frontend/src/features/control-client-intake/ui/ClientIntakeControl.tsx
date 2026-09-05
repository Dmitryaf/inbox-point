import '@frontend/features/control-client-intake/ui/client-intake-control.react-data-r-77f00789.css';

import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderClientIntakeControlPart1 } from './ClientIntakeControl.part1';
import { renderClientIntakeControlPart2 } from './ClientIntakeControl.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClientIntakeControl.model';

export default function ClientIntakeControl($incomingProps: ComponentProps) {
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
      <details
        {...$attributes}
        className={$class('intake-control card', $attributes.className)}
        data-r-77f00789=""
      >
        {renderClientIntakeControlPart1($state)}
        {renderClientIntakeControlPart2($state)}
      </details>
    </ModelScopeProvider>
  );
}
