import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import OperatorRequestList from './OperatorRequestList';

import { renderOperatorInboxPart2 } from './OperatorInbox.part2';

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
          data-r-ae8be5db=""
        >
          <header className="operator-inbox-heading" data-r-ae8be5db="">
            <div data-r-ae8be5db="">
              <p data-r-ae8be5db="">
                <span
                  className="status-pill status-pill--attention"
                  data-r-ae8be5db=""
                >
                  {' Ответы через приложение '}
                </span>
              </p>
              <h2 id="operator-inbox-title" data-r-ae8be5db="">
                {'Входящие обращения'}
              </h2>
              <p data-r-ae8be5db="">
                {
                  ' Здесь можно отвечать, если группа администраторов в Telegram недоступна. '
                }
              </p>
            </div>
            <span
              className="status-pill status-pill--neutral"
              data-r-ae8be5db=""
            >
              {' Активных: '}
              {inbox.requests.value.length}
            </span>
          </header>
          <AsyncMessage
            kind="success"
            text={inbox.notice.value}
            data-r-ae8be5db=""
          />
          <div className="operator-inbox-layout" data-r-ae8be5db="">
            <OperatorRequestList
              requests={inbox.requests.value}
              selectedRequestId={inbox.selectedRequestId.value}
              onSelect={$callback($required($unref($state.inbox)).select)}
              data-r-ae8be5db=""
            />
            {renderOperatorInboxPart2($state)}
          </div>
        </section>
      ) : null}
    </>
  );
}
