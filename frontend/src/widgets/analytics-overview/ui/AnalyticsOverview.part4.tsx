import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart4(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const questionChoices = $state.questionChoices.value;

  return (
    <>
      {questionChoices ? (
        <section className="card" data-r-b5a5a8db="">
          <h2 data-r-b5a5a8db="">{'Путь до обращения'}</h2>
          <dl className="question-path" data-r-b5a5a8db="">
            <div data-r-b5a5a8db="">
              <dt data-r-b5a5a8db="">
                {'Выбрали «Задать вопрос» или «Начать новый вопрос»'}
              </dt>
              <dd data-r-b5a5a8db="">{questionChoices}</dd>
            </div>
            <div data-r-b5a5a8db="">
              <dt data-r-b5a5a8db="">{'Создали обращение'}</dt>
              <dd data-r-b5a5a8db="">{$props.report.summary.requests}</dd>
            </div>
          </dl>
          <p className="muted" data-r-b5a5a8db="">
            {
              ' Это отдельные счётчики действий, без сопоставления людей. Обращение можно создать и первым сообщением. '
            }
          </p>
        </section>
      ) : null}
    </>
  );
}
