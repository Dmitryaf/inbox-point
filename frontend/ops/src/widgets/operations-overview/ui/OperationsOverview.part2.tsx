import { classNames as $class } from '@ops/shared/lib/component-view';

import ChannelStatusCard from './ChannelStatusCard';

import type { WithDefaults } from '@ops/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart2(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <div className="status-grid">
        <ChannelStatusCard
          name="Telegram"
          channel={$props.status.channels.telegram}
        />
        <ChannelStatusCard name="VK" channel={$props.status.channels.vk} />
        <article className="status-card delivery-card">
          <div className="status-card-heading">
            <h3>{'Доставка ответов'}</h3>
            <span
              className={$class(
                'status-pill',
                $props.status.deliveries.failed > 0
                  ? 'status-pill--attention'
                  : 'status-pill--healthy',
              )}
            >
              {$props.status.deliveries.failed > 0
                ? 'Есть ошибки'
                : 'Без ошибок'}
            </span>
          </div>
          <dl className="delivery-facts">
            <div>
              <dt>{'Ожидают отправки'}</dt>
              <dd>{$props.status.deliveries.pending}</dd>
            </div>
            <div>
              <dt>{'Не доставлены'}</dt>
              <dd>{$props.status.deliveries.failed}</dd>
            </div>
          </dl>
        </article>
      </div>
    </>
  );
}
