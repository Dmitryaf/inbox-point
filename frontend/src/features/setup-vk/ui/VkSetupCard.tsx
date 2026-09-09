import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderVkSetupCardPart1 } from './VkSetupCard.part1';
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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="vk-setup-title"
        className={$class('setup-card card', $attributes.className)}
      >
        <p className="step">{'Шаг 2'}</p>
        <h2 id="vk-setup-title">{'VK'}</h2>
        {renderVkSetupCardPart1($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
