import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';
import OperatorConversation from './OperatorConversation';
import OperatorRequestList from './OperatorRequestList';

import type { createComponentModel } from './OperatorInbox.model';
export function renderOperatorInboxPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const inbox = $unref($state.inbox);

  return (
    <>
      {inbox.requests.value.length > 0 ? (
        <section
          aria-labelledby="operator-inbox-title"
          className="card operator-inbox"
        >
          <header className="operator-inbox-heading">
            <div>
              <p className="eyebrow">{'РЕЗЕРВНЫЙ КАНАЛ'}</p>
              <h2 id="operator-inbox-title">{'Входящие обращения'}</h2>
              <p>
                {
                  ' Здесь можно ответить клиенту, даже если Telegram для операторов недоступен. '
                }
              </p>
            </div>
            <span className="status-pill status-pill--neutral">
              {' Активных: '}
              {inbox.requests.value.length}
            </span>
          </header>
          <AsyncMessage kind="success" text={inbox.notice.value} />
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
        </section>
      ) : null}
    </>
  );
}
