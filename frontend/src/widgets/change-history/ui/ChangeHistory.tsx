import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderChangeHistoryPart1 } from './ChangeHistory.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ChangeHistory.model';

export default function ChangeHistory($incomingProps: ComponentProps) {
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
        aria-labelledby="history-title"
        className={$class('card', $attributes.className)}
      >
        <p className="step">{'История'}</p>
        <h2 id="history-title">{'Предыдущие версии'}</h2>
        {renderChangeHistoryPart1($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
