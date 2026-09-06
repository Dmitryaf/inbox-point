import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorConversation.model';
export function renderOperatorConversationPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { closeRequest } = $state;

  return (
    <>
      <header className="operator-conversation-heading">
        <div>
          <h3>{$or($props.request.displayName, () => 'Клиент')}</h3>
          <p>{$props.request.channel === 'telegram' ? 'Telegram' : 'VK'}</p>
        </div>
        <button
          type="button"
          disabled={$props.actionPending}
          onClick={$nativeHandler(closeRequest)}
          className="secondary-button"
        >
          {' Закрыть обращение '}
        </button>
      </header>
    </>
  );
}
