import { unref as $unref } from '@ops/shared/lib/model-state';

import { formatStatusTime } from '@ops/entities/operations/lib/status-format';

import type { WithDefaults } from '@ops/shared/lib/component-model';
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
