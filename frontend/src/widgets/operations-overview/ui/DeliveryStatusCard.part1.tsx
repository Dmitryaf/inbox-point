import { unref as $unref } from '@frontend/shared/lib/model-state';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './DeliveryStatusCard.model';
export function renderDeliveryStatusCardPart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <dl className="delivery-facts" data-r-39c836f9="">
        <div data-r-39c836f9="">
          <dt data-r-39c836f9="">{'Ожидают отправки'}</dt>
          <dd data-r-39c836f9="">{$props.deliveries.pending}</dd>
        </div>
        <div data-r-39c836f9="">
          <dt data-r-39c836f9="">{'Не доставлены'}</dt>
          <dd data-r-39c836f9="">{$props.deliveries.failed}</dd>
        </div>
        {$props.deliveries.uncertain > 0 ? (
          <div data-r-39c836f9="">
            <dt data-r-39c836f9="">{'Требуют ручной проверки'}</dt>
            <dd data-r-39c836f9="">{$props.deliveries.uncertain}</dd>
          </div>
        ) : null}
        {$props.deliveries.oldestPendingAgeSeconds !== undefined ? (
          <div data-r-39c836f9="">
            <dt data-r-39c836f9="">{'Самое старое ожидание'}</dt>
            <dd data-r-39c836f9="">
              {$unref(formatUptime)($props.deliveries.oldestPendingAgeSeconds)}
            </dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}
