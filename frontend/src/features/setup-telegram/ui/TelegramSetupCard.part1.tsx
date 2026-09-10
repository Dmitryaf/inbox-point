import TelegramSetupInstructions from './TelegramSetupInstructions';

import { renderTelegramSetupCardPart2 } from './TelegramSetupCard.part2';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      {$props.status.connected ? (
        <p
          role="status"
          className="setup-status setup-status--success setup-connected-status"
          data-r-44d690ea=""
        >
          <strong data-r-44d690ea="">{'Telegram подключён'}</strong>
          <span data-r-44d690ea="">
            {'Сообщения клиентов будут передаваться операторам.'}
          </span>
        </p>
      ) : (
        <>
          <TelegramSetupInstructions data-r-44d690ea="" />
          {renderTelegramSetupCardPart2($state, $props)}
        </>
      )}
    </>
  );
}
