import { renderTelegramSetupCardPart4 } from './TelegramSetupCard.part4';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const expanded = $state.expanded.value;

  return (
    <>
      <div
        id="telegram-setup-details"
        className="setup-details"
        style={Object.assign({}, { display: expanded ? undefined : 'none' })}
        data-r-44d690ea=""
      >
        {renderTelegramSetupCardPart4($state, $props)}
      </div>
    </>
  );
}
