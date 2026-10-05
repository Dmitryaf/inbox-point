import TelegramConnectionForm from './TelegramConnectionForm';

import { renderTelegramSetupCardPart6 } from './TelegramSetupCard.part6';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart5(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;
  const expanded = $state.expanded.value;
  if (!expanded) {
    return null;
  }
  return (
    <>
      {$props.status.source !== 'none' ? (
        <>{renderTelegramSetupCardPart6($state, $props)}</>
      ) : (
        <TelegramConnectionForm
          locked={$props.status.locked}
          onConnected={() => void $emit('connected')}
          data-r-44d690ea=""
        />
      )}
    </>
  );
}
