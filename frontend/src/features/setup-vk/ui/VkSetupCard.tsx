import '@frontend/entities/setup/styles/setup-card.react-data-r-712bbad4.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderVkSetupCardPart1 } from './VkSetupCard.part1';
import { renderVkSetupCardPart2 } from './VkSetupCard.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './VkSetupCard.model';

export default function VkSetupCard($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const expanded = $state.expanded.value;
  const toggleLabel = $state.toggleLabel.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="vk-setup-title"
        className={$class(
          'setup-card card',
          {
            'setup-card--expanded': expanded,
            'setup-card--locked':
              !$props.telegramConnected && !$props.status.connected,
          },
          $attributes.className,
        )}
        data-r-712bbad4=""
      >
        {renderVkSetupCardPart1($props)}
        <button
          disabled={!$props.telegramConnected && !$props.status.connected}
          type="button"
          onClick={() => void $set($state, 'expanded', !$state.expanded.value)}
          className="quiet setup-toggle"
          data-r-712bbad4=""
        >
          {toggleLabel}
        </button>
        {renderVkSetupCardPart2($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
