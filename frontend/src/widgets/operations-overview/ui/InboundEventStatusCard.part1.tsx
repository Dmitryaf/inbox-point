import { classNames as $class } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './InboundEventStatusCard.model';
export function renderInboundEventStatusCardPart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <div className="status-card-heading" data-r-df4e40d1="">
        <h3 data-r-df4e40d1="">{'Сообщения VK'}</h3>
        <span
          className={$class(
            'status-pill',
            $props.inboundEvents.state === 'healthy'
              ? 'status-pill--healthy'
              : 'status-pill--attention',
          )}
          data-r-df4e40d1=""
        >
          {$props.inboundEvents.state === 'healthy'
            ? 'Работает'
            : 'Нужна проверка'}
        </span>
      </div>
    </>
  );
}
