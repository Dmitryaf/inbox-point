import '@frontend/entities/setup/styles/setup-card.react-data-r-44d690ea.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderTelegramSetupCardPart1 } from './TelegramSetupCard.part1';
import { renderTelegramSetupCardPart2 } from './TelegramSetupCard.part2';
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
        className={$class('setup-card card', $attributes.className)}
        data-r-44d690ea=""
      >
        {renderTelegramSetupCardPart1($props)}
        <button
          type="button"
          onClick={() => void $set($state, 'expanded', !$state.expanded.value)}
          className="quiet setup-toggle"
          data-r-44d690ea=""
        >
          {expanded
            ? 'Скрыть'
            : $props.status.connected
              ? 'Сведения'
              : 'Подключить Telegram'}
        </button>
        {renderTelegramSetupCardPart2($state, $props)}
      </section>
    </ModelScopeProvider>
  );
}
