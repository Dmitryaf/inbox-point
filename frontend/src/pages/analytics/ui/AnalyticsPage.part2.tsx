import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import AnalyticsOverview from '@frontend/widgets/analytics-overview/ui/AnalyticsOverview';

import type { createComponentModel } from './AnalyticsPage.model';
export function renderAnalyticsPagePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const report = $unref($state.report);
  const error = $unref($state.error);
  const loading = $unref($state.loading);
  const empty = $state.empty.value;

  return (
    <>
      {loading ? (
        <section role="status" className="card" data-r-53e74af6="">
          <p data-r-53e74af6="">{'Загружаем аналитику…'}</p>
        </section>
      ) : error ? (
        <section
          role="alert"
          className="card message--error"
          data-r-53e74af6=""
        >
          <p data-r-53e74af6="">{error}</p>
          <button
            type="button"
            onClick={$nativeHandler($unref($state.refresh))}
            className="quiet"
            data-r-53e74af6=""
          >
            {' Повторить попытку '}
          </button>
        </section>
      ) : empty ? (
        <section
          role="status"
          className="card analytics-empty"
          data-r-53e74af6=""
        >
          <h2 data-r-53e74af6="">{'Пока нет активности'}</h2>
          <p data-r-53e74af6="">
            {
              'За выбранный период в этих каналах нет обращений и действий меню.'
            }
          </p>
          <p data-r-53e74af6="">
            {
              ' Когда пользователи начнут взаимодействовать с ботами, здесь появится статистика. '
            }
          </p>
        </section>
      ) : report ? (
        <AnalyticsOverview report={report} data-r-53e74af6="" />
      ) : null}
    </>
  );
}
