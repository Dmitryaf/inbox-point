import '@frontend/entities/content/styles/content-summary.react-data-r-109c0780.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AppIcon from '@frontend/shared/ui/AppIcon';

import { renderContentSummaryPart1 } from './ContentSummary.part1';
import { renderContentSummaryPart2 } from './ContentSummary.part2';
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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="content-summary-title"
        className={$class('content-summary', $attributes.className)}
        data-r-109c0780=""
      >
        {renderContentSummaryPart1($state)}
        {renderContentSummaryPart2($state, $props)}
        <p className="channel-note" data-r-109c0780="">
          <AppIcon name="check" data-r-109c0780="" />
          {' После сохранения изменения появятся в Telegram и VK. '}
        </p>
      </section>
    </ModelScopeProvider>
  );
}
