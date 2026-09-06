import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import DeliveryIncidentList from './DeliveryIncidentList';
import OutboundDeliveryControl from './OutboundDeliveryControl';

import { renderDeliveryStatusCardPart1 } from './DeliveryStatusCard.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './DeliveryStatusCard.model';

export default function DeliveryStatusCard($incomingProps: ComponentProps) {
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
  const state = $state.state.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <article
        {...$attributes}
        className={$class('status-card delivery-card', $attributes.className)}
      >
        <div className="status-card-heading">
          <h3>{'Доставка ответов'}</h3>
          <span className={$class('status-pill', `status-pill--${state.tone}`)}>
            {state.label}
          </span>
        </div>
        {renderDeliveryStatusCardPart1($props)}
        <OutboundDeliveryControl
          outbound={$props.outbound}
          pending={$props.deliveryControlPending}
          onChange={($event) => void $emit('changeDeliveryMode', $event)}
        />
        <DeliveryIncidentList
          incidents={$props.deliveries.incidents}
          pendingDeliveryId={$props.pendingDeliveryId}
          onResolve={(id, resolution) => $emit('resolve', id, resolution)}
          onRetry={($event) => void $emit('retry', $event)}
        />
      </article>
    </ModelScopeProvider>
  );
}
