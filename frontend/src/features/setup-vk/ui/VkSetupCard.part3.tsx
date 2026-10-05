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

  return <>{expanded ? <>{renderVkSetupCardPart4($state, $props)}</> : null}</>;
}
