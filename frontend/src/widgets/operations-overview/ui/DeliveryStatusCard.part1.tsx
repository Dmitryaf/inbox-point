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
      <dl className="delivery-facts">
        <div>
          <dt>{'Ожидают отправки'}</dt>
          <dd>{$props.deliveries.pending}</dd>
        </div>
        <div>
          <dt>{'Не доставлены'}</dt>
          <dd>{$props.deliveries.failed}</dd>
        </div>
        <div>
          <dt>{'Обработчик очереди'}</dt>
          <dd>{$props.deliveries.worker.running ? 'Запущен' : 'Остановлен'}</dd>
        </div>
        {$props.deliveries.oldestPendingAgeSeconds !== undefined ? (
          <div>
            <dt>{'Самое старое ожидание'}</dt>
            <dd>
              {$unref(formatUptime)($props.deliveries.oldestPendingAgeSeconds)}
            </dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}
