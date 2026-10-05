import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const expanded = $state.expanded.value;

  return (
    <>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="telegram-setup-details"
        onClick={() => void $set($state, 'expanded', !$state.expanded.value)}
        className="quiet setup-toggle"
        data-r-44d690ea=""
      >
        {expanded
          ? 'Скрыть'
          : $props.status.source !== 'none'
            ? 'Сведения'
            : 'Подключить Telegram'}
      </button>
    </>
  );
}
