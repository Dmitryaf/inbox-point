import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import OperatorConversation from './OperatorConversation';
import OperatorRequestList from './OperatorRequestList';

import type { createComponentModel } from './OperatorInbox.model';
export function renderOperatorInboxPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const inbox = $unref($state.inbox);

  return (
    <>
      {inbox.loading.value && inbox.requests.value.length === 0 ? (
        <p className="operator-inbox-empty">{' Получаем обращения… '}</p>
      ) : inbox.requests.value.length === 0 ? (
        <p className="operator-inbox-empty">{' Активных обращений нет. '}</p>
      ) : (
        <div className="operator-inbox-layout">
          <OperatorRequestList
            requests={inbox.requests.value}
            selectedRequestId={inbox.selectedRequestId.value}
            onSelect={$callback($required($unref($state.inbox)).select)}
          />
          {inbox.selectedRequest.value ? (
            <OperatorConversation
              key={inbox.selectedRequest.value.id}
              actionPending={inbox.actionPending.value}
              messages={inbox.messages.value}
              onClose={inbox.close}
              onReply={inbox.reply}
              request={inbox.selectedRequest.value}
            />
          ) : null}
        </div>
      )}
    </>
  );
}
