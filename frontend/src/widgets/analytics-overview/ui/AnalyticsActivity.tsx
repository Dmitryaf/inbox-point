import '@frontend/widgets/analytics-overview/styles/analytics-overview.react-data-r-163b6de6.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        className={$class('card', $attributes.className)}
        data-r-163b6de6=""
      >
        <h2 data-r-163b6de6="">{'Активность по дням'}</h2>
        <p className="chart-legend" data-r-163b6de6="">
          <span data-r-163b6de6="">{'━ Выборы в меню'}</span>
          <span data-r-163b6de6="">{'┄ Обращения'}</span>
        </p>
        {renderAnalyticsActivityPart1($state, $props)}
        <p className="muted" data-r-163b6de6="">
          {'Дни и время показаны по UTC.'}
        </p>
        {renderAnalyticsActivityPart2($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
