import { renderTelegramSetupCardPart5 } from './TelegramSetupCard.part5';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart4(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const expanded = $state.expanded.value;

  return (
    <>
      {expanded ? (
        <>
          {$props.status.connected ? (
            <p
              role="status"
              className="setup-status setup-status--success"
              data-r-44d690ea=""
            >
              {' Подключение активно. '}
            </p>
          ) : null}
          {renderTelegramSetupCardPart5($state, $props)}
        </>
      ) : null}
    </>
  );
}
