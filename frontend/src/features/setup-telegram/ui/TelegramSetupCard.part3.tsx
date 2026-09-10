import TelegramConnectionForm from './TelegramConnectionForm';

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
  const { $emit } = $state;
  const expanded = $state.expanded.value;
  if (!expanded) {
    return null;
  }
  return (
    <>
      {$props.status.source !== 'none' ? (
        <>{renderTelegramSetupCardPart4($state, $props)}</>
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
