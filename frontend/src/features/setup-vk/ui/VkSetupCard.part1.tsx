import VkSetupInstructions from './VkSetupInstructions';

import { renderVkSetupCardPart2 } from './VkSetupCard.part2';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      {$props.status.connected ? (
        <p
          role="status"
          className="setup-status setup-status--success setup-connected-status"
          data-r-712bbad4=""
        >
          <strong data-r-712bbad4="">{'VK подключён'}</strong>
          <span data-r-712bbad4="">
            {'Новые сообщения сообщества будут передаваться операторам.'}
          </span>
        </p>
      ) : !$props.telegramConnected ? (
        <>
          <p className="setup-status setup-status--info" data-r-712bbad4="">
            {
              ' Сначала подключите Telegram. После этого здесь откроется следующий шаг. '
            }
          </p>
        </>
      ) : (
        <>
          <VkSetupInstructions data-r-712bbad4="" />
          {renderVkSetupCardPart2($state, $props)}
        </>
      )}
    </>
  );
}
