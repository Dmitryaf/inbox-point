import VkSetupInstructions from './VkSetupInstructions';

import { renderVkSetupCardPart4 } from './VkSetupCard.part4';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const expanded = $state.expanded.value;
  if (!expanded) {
    return null;
  }
  return (
    <>
      {$props.status.connected ? (
        <p
          role="status"
          className="setup-status setup-status--success"
          data-r-712bbad4=""
        >
          {
            ' Подключение активно. Изменить секреты можно через конфигурацию установки. '
          }
        </p>
      ) : (
        <>
          <VkSetupInstructions data-r-712bbad4="" />
          {renderVkSetupCardPart4($state, $props)}
        </>
      )}
    </>
  );
}
