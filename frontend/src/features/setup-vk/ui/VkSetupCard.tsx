import '@frontend/entities/setup/styles/setup-card.react-data-r-712bbad4.css';
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
        className={$class(
          'setup-card card',
          {
            'setup-card--locked':
              !$props.telegramConnected && !$props.status.connected,
          },
          $attributes.className,
        )}
        data-r-712bbad4=""
      >
        <p className="step" data-r-712bbad4="">
          {'Шаг 2'}
        </p>
        <h2 id="vk-setup-title" data-r-712bbad4="">
          {'VK'}
        </h2>
        {renderVkSetupCardPart1($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
