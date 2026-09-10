import { unref as $unref } from '@frontend/shared/lib/model-state';

import { formatStatusTime } from '@frontend/entities/operations/lib/status-format';

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
          <summary data-r-0b4df92b="">{'Подробности'}</summary>
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
          </dl>
        </details>
      ) : null}
    </>
  );
}
