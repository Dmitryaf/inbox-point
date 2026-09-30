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
  const totalCount = $state.totalCount.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <details
        {...$attributes}
        className={$class('content-summary', $attributes.className)}
        data-r-109c0780=""
      >
        <summary data-r-109c0780="">
          <span className="summary-title" data-r-109c0780="">
            {totalCount ? 'Готово к показу' : 'Пока не заполнено'}
          </span>
          <span data-r-109c0780="">
            {' · Кнопок: '}
            {totalCount}
          </span>
        </summary>
        {renderContentSummaryPart1($state, $props)}
        <p className="channel-note" data-r-109c0780="">
          <AppIcon name="check" data-r-109c0780="" />
          {' После сохранения изменения появятся в Telegram и VK. '}
        </p>
      </details>
    </ModelScopeProvider>
  );
}
