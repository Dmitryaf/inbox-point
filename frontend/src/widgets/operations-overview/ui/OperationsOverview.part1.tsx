import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const observedAt = $state.observedAt.value;
  return (
    <>
      <article
        className={$class('summary-card card', {
          'summary-card--attention': $props.status.state === 'attention',
          'summary-card--maintenance': $props.status.state === 'maintenance',
        })}
      >
        <div>
          <p className="eyebrow">{'Общее состояние'}</p>
          <h2 id="overview-title">
            {$props.status.state === 'healthy'
              ? 'Сервис работает'
              : $props.status.state === 'maintenance'
                ? 'Приём обращений приостановлен'
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
    </>
  );
}
