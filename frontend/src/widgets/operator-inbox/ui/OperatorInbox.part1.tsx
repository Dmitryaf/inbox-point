import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './OperatorInbox.model';
export function renderOperatorInboxPart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const inbox = $unref($state.inbox);

  return (
    <>
      <header className="operator-inbox-heading">
        <div>
          <p className="eyebrow">{'РЕЗЕРВНЫЙ КАНАЛ'}</p>
          <h2 id="operator-inbox-title">{'Входящие обращения'}</h2>
          <p>
            {
              ' Здесь можно ответить клиенту, даже если Telegram для преподавателей недоступен. '
            }
          </p>
        </div>
        <span className="status-pill status-pill--neutral">
          {' Активных: '}
          {inbox.requests.value.length}
        </span>
      </header>
    </>
  );
}
