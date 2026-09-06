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
        <p className="setup-status setup-status--success">
          {
            ' VK подключён. После перезапуска сервис восстановит подключение автоматически. '
          }
        </p>
      ) : (
        <>
          <VkSetupInstructions />
          {renderVkSetupCardPart2($state, $props)}
        </>
      )}
    </>
  );
}
