import { unref as $unref } from '@frontend/shared/lib/model-state';

import { formatStatusTime } from '@frontend/entities/operations/lib/status-format';

import { renderChannelStatusCardPart2 } from './ChannelStatusCard.part2';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './ChannelStatusCard.model';
export function renderChannelStatusCardPart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      {$props.channel.configured ? (
        <details
          className="technical-details channel-details"
          data-r-0b4df92b=""
        >
          <summary data-r-0b4df92b="">{'Технические данные'}</summary>
          <dl className="channel-activity" data-r-0b4df92b="">
            <div data-r-0b4df92b="">
              <dt data-r-0b4df92b="">{'Последняя успешная проверка'}</dt>
              <dd data-r-0b4df92b="">
                {$unref(formatStatusTime)($props.channel.lastSuccessfulPollAt)}
              </dd>
            </div>
            {$props.channel.lastFailedPollAt ? (
              <div data-r-0b4df92b="">
                <dt data-r-0b4df92b="">{'Последняя ошибка связи'}</dt>
                <dd data-r-0b4df92b="">
                  {$unref(formatStatusTime)($props.channel.lastFailedPollAt)}
                </dd>
              </div>
            ) : null}
            {$props.channel.consecutiveFailures ? (
              <div data-r-0b4df92b="">
                <dt data-r-0b4df92b="">{'Ошибок подряд'}</dt>
                <dd data-r-0b4df92b="">{$props.channel.consecutiveFailures}</dd>
              </div>
            ) : null}
            {$props.channel.lastRecoveredAt ? (
              <div data-r-0b4df92b="">
                <dt data-r-0b4df92b="">{'Связь восстановлена'}</dt>
                <dd data-r-0b4df92b="">
                  {$unref(formatStatusTime)($props.channel.lastRecoveredAt)}
                </dd>
              </div>
            ) : null}
            {renderChannelStatusCardPart2($props)}
          </dl>
        </details>
      ) : null}
    </>
  );
}
