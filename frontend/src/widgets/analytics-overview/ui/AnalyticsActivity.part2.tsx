import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import type { createComponentModel } from './AnalyticsActivity.model';
export function renderAnalyticsActivityPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { label } = $state;
  const dailyExpanded = $state.dailyExpanded.value;
  const recentDays = $state.recentDays.value;

  return (
    <>
      <div
        id="daily-values"
        tabIndex={0}
        role="region"
        aria-label="Значения по дням"
        className={$class('daily-values', {
          'daily-values--expanded': dailyExpanded,
        })}
        data-r-163b6de6=""
      >
        <table
          aria-label="Активность по дням"
          className="analytics-table"
          data-r-163b6de6=""
        >
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
            {$renderList(recentDays, (day) => (
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
    </>
  );
}
