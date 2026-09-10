import '@frontend/widgets/operations-overview/styles/status-card.react-data-r-df4e40d1.css';
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
  const { props: $props, scope: $scope } = useComponentModel(
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
        data-r-df4e40d1=""
      >
        {renderInboundEventStatusCardPart1($props)}
        {$props.inboundEvents.state === 'healthy' ? (
          <p data-r-df4e40d1="">
            {' Новые сообщения обрабатываются автоматически. '}
          </p>
        ) : (
          <p data-r-df4e40d1="">
            {'Подробности и доступные действия показаны выше.'}
          </p>
        )}
      </article>
    </ModelScopeProvider>
  );
}
