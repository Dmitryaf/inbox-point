import '@frontend/widgets/operations-overview/styles/channel-status-card.react-data-r-0b4df92b.css';
import '@frontend/widgets/operations-overview/styles/status-card.react-data-r-0b4df92b.css';
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
        data-r-0b4df92b=""
      >
        <div className="status-card-heading" data-r-0b4df92b="">
          <h3 data-r-0b4df92b="">{$props.name}</h3>
          <span
            className={$class('status-pill', `status-pill--${state.tone}`)}
            data-r-0b4df92b=""
          >
            {state.label}
          </span>
        </div>
        <p data-r-0b4df92b="">
          {$unref(connectionSourceLabel)($props.channel.source)}
        </p>
        {$props.intake.mode === 'paused' ? (
          <p className="channel-maintenance-note" data-r-0b4df92b="">
            {' Новые обращения приостановлены вручную. '}
          </p>
        ) : null}
        {renderChannelStatusCardPart1($props)}
      </article>
    </ModelScopeProvider>
  );
}
