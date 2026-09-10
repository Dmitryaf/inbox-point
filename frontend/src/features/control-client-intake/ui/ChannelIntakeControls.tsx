import '@frontend/features/control-client-intake/styles/channel-intake-controls.react-data-r-0bf4defe.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderChannelIntakeControlsPart1 } from './ChannelIntakeControls.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ChannelIntakeControls.model';

export default function ChannelIntakeControls($incomingProps: ComponentProps) {
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
        className={$class('intake-channel-list', $attributes.className)}
        data-r-0bf4defe=""
      >
        {renderChannelIntakeControlsPart1($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
