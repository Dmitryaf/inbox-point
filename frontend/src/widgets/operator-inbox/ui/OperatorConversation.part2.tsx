import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

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
  const { deliveryLabel } = $state;

  return (
    <>
      {$props.messages.length ? (
        <ol
          aria-label="Переписка"
          className="operator-message-list"
          data-r-e21483db=""
        >
          {$renderList($props.messages, (message) => (
            <li
              key={message.id}
              className={$class(
                'operator-message',
                `operator-message--${message.direction}`,
              )}
              data-r-e21483db=""
            >
              <div className="operator-message-meta" data-r-e21483db="">
                <strong data-r-e21483db="">
                  {message.direction === 'client_to_operator'
                    ? $or(message.senderName, () => 'Отправитель')
                    : 'Оператор'}
                </strong>
                <time dateTime={message.createdAt} data-r-e21483db="">
                  {$unref(formatShortDateTime)(message.createdAt)}
                </time>
              </div>
              <p data-r-e21483db="">{message.text}</p>
              {deliveryLabel(message) ? (
                <span
                  className={$class('operator-message-delivery', {
                    'operator-message-delivery--failed':
                      message.deliveryStatus === 'failed',
                  })}
                  data-r-e21483db=""
                >
                  {deliveryLabel(message)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="operator-inbox-empty" data-r-e21483db="">
          {'Сообщений пока нет.'}
        </p>
      )}
    </>
  );
}
