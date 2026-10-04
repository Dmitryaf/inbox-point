import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const lastRequest = $state.lastRequest.value;

  return (
    <>
      <div className="analytics-summary" data-r-b5a5a8db="">
        <section className="card" data-r-b5a5a8db="">
          <h2 data-r-b5a5a8db="">{'Обращения'}</h2>
          <p className="metric-value" data-r-b5a5a8db="">
            {$props.report.summary.requests}
          </p>
          {$props.report.channel === 'all' ? (
            <p className="muted" data-r-b5a5a8db="">
              {' Telegram: '}
              {$props.report.channels.telegram.requests}
              {' · VK: '}
              {$props.report.channels.vk.requests}
            </p>
          ) : null}
          {lastRequest ? (
            <p className="muted" data-r-b5a5a8db="">
              {' Последнее за период: '}
              {lastRequest}
            </p>
          ) : null}
        </section>
        <section className="card" data-r-b5a5a8db="">
          <h2 data-r-b5a5a8db="">{'Выборы в меню'}</h2>
          <p className="metric-value" data-r-b5a5a8db="">
            {$props.report.summary.menuActions}
          </p>
          {$props.report.channel === 'all' ? (
            <p className="muted" data-r-b5a5a8db="">
              {' Telegram: '}
              {$props.report.channels.telegram.menuActions}
              {' · VK: '}
              {$props.report.channels.vk.menuActions}
            </p>
          ) : null}
          <p className="muted" data-r-b5a5a8db="">
            {
              ' В Telegram учитывается и ввод текста, совпадающего с действием меню. '
            }
          </p>
        </section>
      </div>
    </>
  );
}
