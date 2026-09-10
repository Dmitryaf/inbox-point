import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './DeliveryStatusCard.model';
export function renderDeliveryStatusCardPart2(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <details
        className="technical-details status-technical-details"
        data-r-39c836f9=""
      >
        <summary data-r-39c836f9="">{'Технические данные'}</summary>
        <dl className="delivery-facts" data-r-39c836f9="">
          <div data-r-39c836f9="">
            <dt data-r-39c836f9="">{'Система отправки'}</dt>
            <dd data-r-39c836f9="">
              {$props.deliveries.worker.running ? 'Запущена' : 'Остановлена'}
            </dd>
          </div>
        </dl>
      </details>
    </>
  );
}
