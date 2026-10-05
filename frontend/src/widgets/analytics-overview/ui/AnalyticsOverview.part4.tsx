import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart4(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      {!$props.report.actions.length ? (
        <p className="muted" data-r-b5a5a8db="">
          {' За этот период действий меню пока нет. '}
        </p>
      ) : (
        <table className="analytics-table" data-r-b5a5a8db="">
          <thead data-r-b5a5a8db="">
            <tr data-r-b5a5a8db="">
              <th scope="col" data-r-b5a5a8db="">
                {'Действие'}
              </th>
              <th scope="col" data-r-b5a5a8db="">
                {'Всего'}
              </th>
              {$props.report.channel === 'all' ? (
                <th scope="col" aria-label="Telegram" data-r-b5a5a8db="">
                  <span className="channel-name-full" data-r-b5a5a8db="">
                    {'Telegram'}
                  </span>
                  <abbr
                    title="Telegram"
                    className="channel-name-short"
                    data-r-b5a5a8db=""
                  >
                    {'TG'}
                  </abbr>
                </th>
              ) : null}
              {$props.report.channel === 'all' ? (
                <th scope="col" data-r-b5a5a8db="">
                  {'VK'}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody data-r-b5a5a8db="">
            {$renderList($props.report.actions, (action) => (
              <tr key={action.key} data-r-b5a5a8db="">
                <th scope="row" data-r-b5a5a8db="">
                  {action.label}
                </th>
                <td data-r-b5a5a8db="">{action.count}</td>
                {$props.report.channel === 'all' ? (
                  <td data-r-b5a5a8db="">{action.telegram}</td>
                ) : null}
                {$props.report.channel === 'all' ? (
                  <td data-r-b5a5a8db="">{action.vk}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
