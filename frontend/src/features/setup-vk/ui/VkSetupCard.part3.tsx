import VkSetupInstructions from './VkSetupInstructions';

import { renderVkSetupCardPart4 } from './VkSetupCard.part4';
import { renderVkSetupCardPart5 } from './VkSetupCard.part5';

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
      {$props.status.source !== 'none' ? (
        <>
          <VkSetupInstructions
            compact
            connected={$props.status.connected}
            data-r-712bbad4=""
          />
          {renderVkSetupCardPart4($state, $props)}
        </>
      ) : (
        <>
          <VkSetupInstructions data-r-712bbad4="" />
          {renderVkSetupCardPart5($state, $props)}
        </>
      )}
    </>
  );
}
