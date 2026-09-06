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
        <p className="setup-status setup-status--success">
          {
            ' Telegram подключён. После перезапуска сервис восстановит подключение автоматически. '
          }
        </p>
      ) : (
        <>
          <TelegramSetupInstructions />
          {renderTelegramSetupCardPart2($state, $props)}
        </>
      )}
    </>
  );
}
