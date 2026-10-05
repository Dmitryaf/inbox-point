import VkSetupInstructions from './VkSetupInstructions';

import { renderVkSetupCardPart5 } from './VkSetupCard.part5';
import { renderVkSetupCardPart6 } from './VkSetupCard.part6';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart4(
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
          {renderVkSetupCardPart5($state, $props)}
        </>
      ) : (
        <>
          <VkSetupInstructions data-r-712bbad4="" />
          {renderVkSetupCardPart6($state, $props)}
        </>
      )}
    </>
  );
}
