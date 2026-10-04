import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AnalyticsActivity.model';
export function renderAnalyticsActivityPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { label } = $state;

  return (
    <>
      <details data-r-163b6de6="">
        <summary data-r-163b6de6="">{'Показать значения по дням'}</summary>
        <div className="daily-values" data-r-163b6de6="">
          <table className="analytics-table" data-r-163b6de6="">
            <caption data-r-163b6de6="">{' Активность по дням (UTC) '}</caption>
            <thead data-r-163b6de6="">
              <tr data-r-163b6de6="">
                <th scope="col" data-r-163b6de6="">
                  {'Дата'}
                </th>
                <th scope="col" data-r-163b6de6="">
                  {'Меню'}
                </th>
                <th scope="col" data-r-163b6de6="">
                  {'Обращения'}
                </th>
              </tr>
            </thead>
            <tbody data-r-163b6de6="">
              {$renderList($props.daily, (day) => (
                <tr key={day.date} data-r-163b6de6="">
                  <th scope="row" data-r-163b6de6="">
                    {label(day.date)}
                  </th>
                  <td data-r-163b6de6="">{day.menuActions}</td>
                  <td data-r-163b6de6="">{day.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
