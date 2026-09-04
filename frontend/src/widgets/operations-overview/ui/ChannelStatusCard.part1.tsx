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
        <dl className="channel-activity">
          <div>
            <dt>{'Последняя успешная проверка'}</dt>
            <dd>
              {$unref(formatStatusTime)($props.channel.lastSuccessfulPollAt)}
            </dd>
          </div>
          {$props.channel.lastFailedPollAt ? (
            <div>
              <dt>{'Последняя ошибка связи'}</dt>
              <dd>
                {$unref(formatStatusTime)($props.channel.lastFailedPollAt)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </>
  );
}
