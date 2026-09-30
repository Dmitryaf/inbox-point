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
      <header className="operator-conversation-heading" data-r-e21483db="">
        <div data-r-e21483db="">
          <h3 data-r-e21483db="">
            {$or($props.request.displayName, () => 'Без имени')}
          </h3>
          <p data-r-e21483db="">
            {$props.request.channel === 'telegram' ? 'Telegram' : 'VK'}
          </p>
        </div>
        <button
          type="button"
          disabled={$or($props.actionPending, () => !$props.messagesReady)}
          onClick={$nativeHandler(closeRequest)}
          className="secondary-button"
          data-r-e21483db=""
        >
          {' Закрыть обращение '}
        </button>
      </header>
    </>
  );
}
