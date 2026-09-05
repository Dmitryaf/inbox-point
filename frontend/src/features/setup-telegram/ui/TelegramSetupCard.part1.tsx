import { renderList as $renderList } from '@frontend/shared/lib/component-view';
import { invokeHandler as $invoke } from '@frontend/shared/lib/component-events';

import {
  setModelValue as $set,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderTelegramSetupCardPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { discover, chatLabel, connect } = $state;
  const botToken = $state.botToken.value;
  const pending = $state.pending.value;
  const selectedChatId = $state.selectedChatId.value;
  const chats = $state.chats.value;
  const message = $state.message.value;
  return (
    <>
      {$props.status.connected ? (
        <p className="setup-status setup-status--success">
          {' Telegram подключён. '}
        </p>
      ) : (
        <>
          <ol className="setup-steps">
            <li>{'Создайте закрытую группу и включите темы.'}</li>
            <li>
              {'Добавьте бота администратором с правом управлять темами.'}
            </li>
            <li>{'Напишите в группе любое сообщение.'}</li>
          </ol>
          {$props.status.locked ? (
            <p className="setup-status">
              {' Подключение управляется настройками сервера. '}
            </p>
          ) : (
            <>
              <label htmlFor="telegram-token">{'Токен от @BotFather'}</label>
              <input
                id="telegram-token"
                autoComplete="off"
                type="password"
                value={botToken ?? ''}
                onChange={$controlledChange<HTMLInputElement>(($event) => {
                  $set($state, 'botToken', $event.currentTarget.value);
                })}
              />
              <button
                disabled={$or(
                  pending !== null,
                  () => botToken.trim().length < 20,
                )}
                type="button"
                onClick={($event) => {
                  $invoke(discover, $event);
                }}
              >
                {pending === 'discover' ? 'Ищем…' : 'Найти группы'}
              </button>
              {chats.length ? (
                <fieldset className="setup-options">
                  <legend>{'Операторская группа'}</legend>
                  {$renderList(chats, (chat) => (
                    <label key={chat.id}>
                      <input
                        value={chat.id}
                        type="radio"
                        checked={selectedChatId === chat.id}
                        onChange={$controlledChange<HTMLInputElement>(
                          ($event) => {
                            if ($event.currentTarget.checked) {
                              $set($state, 'selectedChatId', chat.id);
                            }
                          },
                        )}
                      />
                      <span>{chatLabel(chat)}</span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {chats.length ? (
                <button
                  disabled={$or(
                    pending !== null,
                    () => selectedChatId === null,
                  )}
                  type="button"
                  onClick={($event) => {
                    $invoke(connect, $event);
                  }}
                >
                  {pending === 'connect'
                    ? 'Подключаем…'
                    : 'Подключить Telegram'}
                </button>
              ) : null}
              <p role="status" className="setup-status">
                {message}
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
