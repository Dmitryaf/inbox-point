import '@frontend/widgets/analytics-overview/styles/analytics-overview.react-data-r-163b6de6.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderAnalyticsActivityPart1 } from './AnalyticsActivity.part1';
import { renderAnalyticsActivityPart2 } from './AnalyticsActivity.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AnalyticsActivity.model';

export default function AnalyticsActivity($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const dailyExpanded = $state.dailyExpanded.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="activity-title"
        className={$class('analytics-activity', $attributes.className)}
        data-r-163b6de6=""
      >
        <h2 id="activity-title" data-r-163b6de6="">
          {'Активность по дням'}
        </h2>
        <p className="chart-legend" data-r-163b6de6="">
          <span data-r-163b6de6="">{'━ Выборы в меню'}</span>
          <span data-r-163b6de6="">{'┄ Обращения'}</span>
        </p>
        {renderAnalyticsActivityPart1($state, $props)}
        <button
          type="button"
          aria-controls="daily-values"
          aria-expanded={dailyExpanded}
          onClick={() =>
            void $set($state, 'dailyExpanded', !$state.dailyExpanded.value)
          }
          className="daily-toggle secondary-button"
          data-r-163b6de6=""
        >
          {dailyExpanded
            ? 'Скрыть значения по дням'
            : 'Показать значения по дням'}
        </button>
        {renderAnalyticsActivityPart2($state)}
      </section>
    </ModelScopeProvider>
  );
}
