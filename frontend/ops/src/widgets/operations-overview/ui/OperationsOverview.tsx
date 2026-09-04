import {
  useComponentModel,
  ModelScopeProvider,
} from '@ops/shared/lib/component-model';
import { classNames as $class } from '@ops/shared/lib/component-view';

import { unref as $unref } from '@ops/shared/lib/model-state';

import { inheritedAttributes } from '@ops/shared/lib/component-attributes';

import { formatUptime } from '@ops/entities/operations/lib/status-format';

import ChannelStatusCard from './ChannelStatusCard';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsOverview.model';

export default function OperationsOverview($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  const observedAt = $state.observedAt.value;
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="overview-title"
        className={$class('overview', $attributes.className)}
      >
        <article
          className={$class('summary-card card', {
            'summary-card--attention': $props.status.state === 'attention',
          })}
        >
          <div>
            <p className="eyebrow">{'Общее состояние'}</p>
            <h2 id="overview-title">
              {$props.status.state === 'healthy'
                ? 'Сервис работает'
                : 'Нужно проверить'}
            </h2>
          </div>
          <dl className="summary-facts">
            <div>
              <dt>{'Работает без перезапуска'}</dt>
              <dd>{$unref(formatUptime)($props.status.uptimeSeconds)}</dd>
            </div>
            <div>
              <dt>{'Данные обновлены'}</dt>
              <dd>{observedAt}</dd>
            </div>
          </dl>
        </article>
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
      </section>
    </ModelScopeProvider>
  );
}
