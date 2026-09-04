import {
  useComponentModel,
  ModelScopeProvider,
} from '@ops/shared/lib/component-model';
import { classNames as $class } from '@ops/shared/lib/component-view';

import { unref as $unref } from '@ops/shared/lib/model-state';

import { inheritedAttributes } from '@ops/shared/lib/component-attributes';

import { connectionSourceLabel } from '@ops/entities/operations/lib/status-format';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ChannelStatusCard.model';

export default function ChannelStatusCard($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
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
      </article>
    </ModelScopeProvider>
  );
}
