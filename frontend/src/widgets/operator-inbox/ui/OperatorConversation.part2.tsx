import { unref as $unref } from '@frontend/shared/lib/model-state';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperatorConversation.model';
export function renderOperatorConversationPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      {$props.messagesLoading ? (
        <p role="status" data-r-e21483db="">
          {'Загружаем переписку…'}
        </p>
      ) : $props.messagesError ? (
        <div data-r-e21483db="">
          <AsyncMessage
            kind="error"
            text={$props.messagesError}
            data-r-e21483db=""
          />
          <button
            type="button"
            onClick={() => void $unref($state.emit)('retry')}
            className="secondary-button"
            data-r-e21483db=""
          >
            {' Повторить загрузку переписки '}
          </button>
        </div>
      ) : null}
    </>
  );
}
