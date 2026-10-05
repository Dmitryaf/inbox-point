import { renderAnalyticsOverviewPart4 } from './AnalyticsOverview.part4';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const questionChoices = $state.questionChoices.value;
  const lastRequest = $state.lastRequest.value;

  return (
    <>
      <div className="analytics-reading" data-r-b5a5a8db="">
        <section
          aria-labelledby="menu-usage-title"
          className="menu-usage"
          data-r-b5a5a8db=""
        >
          <h2 id="menu-usage-title" data-r-b5a5a8db="">
            {'Что выбирают в меню'}
          </h2>
          {renderAnalyticsOverviewPart4($props)}
          {$props.report.channel !== 'vk' ? (
            <p className="muted" data-r-b5a5a8db="">
              {
                ' В Telegram учитывается и ввод текста, совпадающего с действием меню. '
              }
            </p>
          ) : null}
        </section>
        <section
          aria-labelledby="question-context-title"
          className="question-context"
          data-r-b5a5a8db=""
        >
          <h2 id="question-context-title" data-r-b5a5a8db="">
            {'Начало вопроса'}
          </h2>
          <dl className="question-path" data-r-b5a5a8db="">
            <div data-r-b5a5a8db="">
              <dt data-r-b5a5a8db="">
                {'Выбрали «Задать вопрос» или «Начать новый вопрос»'}
              </dt>
              <dd data-r-b5a5a8db="">{questionChoices}</dd>
            </div>
          </dl>
          <p className="muted" data-r-b5a5a8db="">
            {
              ' Это отдельный счётчик выбора меню. Обращение создаётся после сообщения клиента; оно может начаться и с первого сообщения без выбора меню. '
            }
          </p>
          <p className="muted" data-r-b5a5a8db="">
            {
              ' Эти данные не показывают, какие выборы меню привели к обращению. '
            }
          </p>
          {lastRequest ? (
            <p className="muted" data-r-b5a5a8db="">
              {' Последнее за период: '}
              {lastRequest}
            </p>
          ) : (
            <p className="muted" data-r-b5a5a8db="">
              {'За этот период обращений пока нет.'}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
