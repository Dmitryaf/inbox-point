import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ContentSummary.model';
export function renderContentSummaryPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const standardCount = $state.standardCount.value;

  return (
    <>
      <dl className="content-facts">
        <div>
          <dt>{'Основные кнопки'}</dt>
          <dd>
            {standardCount}
            {' из 4'}
          </dd>
        </div>
        <div>
          <dt>{'Частые вопросы'}</dt>
          <dd>{$props.content.faq.length}</dd>
        </div>
        <div>
          <dt>{'Свои разделы'}</dt>
          <dd>{$props.content.customSections.length}</dd>
        </div>
      </dl>
    </>
  );
}
