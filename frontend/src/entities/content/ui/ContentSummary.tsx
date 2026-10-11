import '@frontend/entities/content/styles/content-summary.react-data-r-109c0780.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AppIcon from '@frontend/shared/ui/AppIcon';

import { renderContentSummaryPart1 } from './ContentSummary.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentSummary.model';

export default function ContentSummary($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const summaryTitle = $state.summaryTitle.value;
  const responses = $state.responses.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Готовность ответов"
        className={$class('content-summary', $attributes.className)}
        data-r-109c0780=""
      >
        <p className="summary-heading" data-r-109c0780="">
          <span className="summary-title" data-r-109c0780="">
            {summaryTitle}
          </span>
          <span data-r-109c0780="">
            {' · Ответов в меню: '}
            {responses.length}
          </span>
        </p>
        {renderContentSummaryPart1($state, $props)}
        <p className="channel-note" data-r-109c0780="">
          <AppIcon name="check" data-r-109c0780="" />
          {' После сохранения изменения появятся в Telegram и VK. '}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
