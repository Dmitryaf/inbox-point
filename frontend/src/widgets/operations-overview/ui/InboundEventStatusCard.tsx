import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderInboundEventStatusCardPart1 } from './InboundEventStatusCard.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './InboundEventStatusCard.model';

export default function InboundEventStatusCard($incomingProps: ComponentProps) {
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
      <article
        {...$attributes}
        className={$class('status-card delivery-card', $attributes.className)}
      >
        <div className="status-card-heading">
          <h3>{'Входящие события'}</h3>
          <span
            className={$class(
              'status-pill',
              $props.inboundEvents.state === 'healthy'
                ? 'status-pill--healthy'
                : 'status-pill--attention',
            )}
          >
            {$props.inboundEvents.state === 'healthy'
              ? 'Работает'
              : 'Есть изолированные события'}
          </span>
        </div>
        {renderInboundEventStatusCardPart1($state, $props)}
      </article>
    </ModelScopeProvider>
  );
}
