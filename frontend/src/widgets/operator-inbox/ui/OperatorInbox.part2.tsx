import { eventCallback as $callback } from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import OperatorConversation from './OperatorConversation';

import type { createComponentModel } from './OperatorInbox.model';
export function renderOperatorInboxPart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const inbox = $unref($state.inbox);
  if (!(inbox.requests.value.length > 0)) {
    return null;
  }
  return (
    <>
      {inbox.selectedRequest.value ? (
        <OperatorConversation
          key={inbox.selectedRequest.value.id}
          actionPending={inbox.actionPending.value}
          messages={inbox.messages.value}
          messagesLoading={inbox.messagesLoading.value}
          messagesError={inbox.messagesError.value}
          messagesReady={inbox.messagesReady.value}
          draft={inbox.drafts.value[inbox.selectedRequest.value.id] ?? ''}
          onClose={inbox.close}
          onReply={inbox.reply}
          request={inbox.selectedRequest.value}
          onDraft={$callback($required($unref($state.inbox)).setDraft)}
          onRetry={$callback($required($unref($state.inbox)).refreshMessages)}
          data-r-ae8be5db=""
        />
      ) : null}
    </>
  );
}
