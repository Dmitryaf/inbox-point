import '@frontend/entities/setup/styles/setup-card.react-data-r-44d690ea.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderTelegramSetupCardPart1 } from './TelegramSetupCard.part1';
import { renderTelegramSetupCardPart2 } from './TelegramSetupCard.part2';
import { renderTelegramSetupCardPart3 } from './TelegramSetupCard.part3';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './TelegramSetupCard.model';

export default function TelegramSetupCard($incomingProps: ComponentProps) {
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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="telegram-setup-title"
        className={$class(
          'setup-card card',
          { 'setup-card--expanded': expanded },
          $attributes.className,
        )}
        data-r-44d690ea=""
      >
        {renderTelegramSetupCardPart1($props)}
        {renderTelegramSetupCardPart2($state, $props)}
        {renderTelegramSetupCardPart3($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
