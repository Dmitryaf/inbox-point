import { renderVkSetupCardPart3 } from './VkSetupCard.part3';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const expanded = $state.expanded.value;

  return (
    <>
      <div
        id="vk-setup-details"
        className="setup-details"
        style={Object.assign({}, { display: expanded ? undefined : 'none' })}
        data-r-712bbad4=""
      >
        {renderVkSetupCardPart3($state, $props)}
      </div>
    </>
  );
}
