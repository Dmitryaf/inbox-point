import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { connectionSourceLabel } from '@frontend/entities/operations/lib/status-format';

import { renderChannelStatusCardPart1 } from './ChannelStatusCard.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ChannelStatusCard.model';

export default function ChannelStatusCard($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const state = $state.state.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <article
        {...$attributes}
        className={$class('status-card', $attributes.className)}
      >
        <div className="status-card-heading">
          <h3>{$props.name}</h3>
          <span className={$class('status-pill', `status-pill--${state.tone}`)}>
            {state.label}
          </span>
        </div>
        <p>{$unref(connectionSourceLabel)($props.channel.source)}</p>
        {renderChannelStatusCardPart1($props)}
      </article>
    </ModelScopeProvider>
  );
}
