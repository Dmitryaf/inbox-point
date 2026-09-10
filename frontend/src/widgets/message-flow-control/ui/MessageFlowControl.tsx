import '@frontend/widgets/message-flow-control/styles/message-flow-control.react-data-r-c8d03842.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderMessageFlowControlPart1 } from './MessageFlowControl.part1';
import { renderMessageFlowControlPart2 } from './MessageFlowControl.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './MessageFlowControl.model';

export default function MessageFlowControl($incomingProps: ComponentProps) {
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
        className={$class('message-flow-control card', $attributes.className)}
        data-r-c8d03842=""
      >
        {renderMessageFlowControlPart1()}
        {renderMessageFlowControlPart2($state, $props, $scope)}
      </details>
    </ModelScopeProvider>
  );
}
