import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

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
  const { formatDate, deliveryLabel } = $state;

  return (
    <>
      {$props.messages.length ? (
        <ol aria-label="Переписка" className="operator-message-list">
          {$renderList($props.messages, (message) => (
            <li
              key={message.id}
              className={$class(
                'operator-message',
                `operator-message--${message.direction}`,
              )}
            >
              <div className="operator-message-meta">
                <strong>
                  {message.direction === 'client_to_operator'
                    ? $or(message.senderName, () => 'Клиент')
                    : 'Преподаватель'}
                </strong>
                <time dateTime={message.createdAt}>
                  {formatDate(message.createdAt)}
                </time>
              </div>
              <p>{message.text}</p>
              {deliveryLabel(message) ? (
                <span
                  className={$class('operator-message-delivery', {
                    'operator-message-delivery--failed':
                      message.deliveryStatus === 'failed',
                  })}
                >
                  {deliveryLabel(message)}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="operator-inbox-empty">{'Сообщений пока нет.'}</p>
      )}
    </>
  );
}
