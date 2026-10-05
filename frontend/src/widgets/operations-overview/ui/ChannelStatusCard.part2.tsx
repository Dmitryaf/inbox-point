import { renderChannelStatusCardPart3 } from './ChannelStatusCard.part3';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './ChannelStatusCard.model';
export function renderChannelStatusCardPart2(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  if (!$props.channel.configured) {
    return null;
  }
  return (
    <>
      {$props.channel.lastFailure ? (
        <>
          <div data-r-0b4df92b="">
            <dt data-r-0b4df92b="">{'Последний сбой'}</dt>
            <dd data-r-0b4df92b="">
              {$props.channel.lastFailure.stage === 'startup'
                ? 'При подключении'
                : 'При получении данных'}
            </dd>
          </div>
          {renderChannelStatusCardPart3($props)}
        </>
      ) : null}
    </>
  );
}
