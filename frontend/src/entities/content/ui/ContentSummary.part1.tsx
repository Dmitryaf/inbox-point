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
      <dl className="content-facts" data-r-109c0780="">
        <div data-r-109c0780="">
          <dt data-r-109c0780="">{'Основные кнопки'}</dt>
          <dd data-r-109c0780="">
            {standardCount}
            {' из 4'}
          </dd>
        </div>
        <div data-r-109c0780="">
          <dt data-r-109c0780="">{'Частые вопросы'}</dt>
          <dd data-r-109c0780="">{$props.content.faq.length}</dd>
        </div>
        <div data-r-109c0780="">
          <dt data-r-109c0780="">{'Свои разделы'}</dt>
          <dd data-r-109c0780="">{$props.content.customSections.length}</dd>
        </div>
      </dl>
    </>
  );
}
