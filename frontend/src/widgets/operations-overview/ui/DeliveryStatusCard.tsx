import '@frontend/widgets/operations-overview/styles/delivery-status-card.react-data-r-39c836f9.css';
import '@frontend/widgets/operations-overview/styles/status-card.react-data-r-39c836f9.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderDeliveryStatusCardPart1 } from './DeliveryStatusCard.part1';
import { renderDeliveryStatusCardPart2 } from './DeliveryStatusCard.part2';
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
  const state = $state.state.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <article
        {...$attributes}
        className={$class('status-card delivery-card', $attributes.className)}
        data-r-39c836f9=""
      >
        <div className="status-card-heading" data-r-39c836f9="">
          <h3 data-r-39c836f9="">{'Отправка ответов'}</h3>
          <span
            className={$class('status-pill', `status-pill--${state.tone}`)}
            data-r-39c836f9=""
          >
            {state.label}
          </span>
        </div>
        {renderDeliveryStatusCardPart1($props)}
        {renderDeliveryStatusCardPart2($props)}
      </article>
    </ModelScopeProvider>
  );
}
