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
      <section
        {...$attributes}
        aria-labelledby="content-summary-title"
        className={$class('content-summary', $attributes.className)}
        data-r-109c0780=""
      >
        <div className="summary-heading" data-r-109c0780="">
          <div data-r-109c0780="">
            <p data-r-109c0780="">{'Готовность ответов'}</p>
            <h3 id="content-summary-title" data-r-109c0780="">
              {totalCount ? 'Готово к показу' : 'Пока не заполнено'}
            </h3>
          </div>
        </div>
        {renderContentSummaryPart1($state, $props)}
        <p className="channel-note" data-r-109c0780="">
          <AppIcon name="check" data-r-109c0780="" />
          {' После сохранения изменения появятся в Telegram и VK. '}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
