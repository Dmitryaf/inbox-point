import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart2(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      {$props.report.channel === 'all' ? (
        <dl
          aria-label="Использование каналов"
          className="usage-channels"
          data-r-b5a5a8db=""
        >
          {$renderList($props.report.channels, (counts, channel) => (
            <div key={channel} data-r-b5a5a8db="">
              <dt data-r-b5a5a8db="">
                {channel === 'telegram' ? 'Telegram' : 'VK'}
              </dt>
              <dd data-r-b5a5a8db="">
                {' Обращения: '}
                {counts.requests}
                {' · Выборы в меню: '}
                {counts.menuActions}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  );
}
