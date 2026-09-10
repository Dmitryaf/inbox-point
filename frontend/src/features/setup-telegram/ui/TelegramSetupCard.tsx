import '@frontend/entities/setup/styles/setup-card.react-data-r-44d690ea.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderTelegramSetupCardPart1 } from './TelegramSetupCard.part1';
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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="telegram-setup-title"
        className={$class('setup-card card', $attributes.className)}
        data-r-44d690ea=""
      >
        <p className="step" data-r-44d690ea="">
          {'Шаг 1'}
        </p>
        <h2 id="telegram-setup-title" data-r-44d690ea="">
          {'Telegram'}
        </h2>
        {renderTelegramSetupCardPart1($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
