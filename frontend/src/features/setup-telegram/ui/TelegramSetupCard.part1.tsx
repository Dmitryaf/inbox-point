import { renderList as $renderList } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import {
  textModel as $textModel,
  radioModel as $radioModel,
} from '@frontend/shared/lib/component-inputs';

import TelegramSetupInstructions from './TelegramSetupInstructions';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
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
          {
            ' Telegram подключён. После перезапуска сервис восстановит подключение автоматически. '
          }
        </p>
      ) : (
        <>
          <TelegramSetupInstructions />
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
                onChange={$textModel($state, 'botToken')}
              />
              <button
                disabled={$or(
                  pending !== null,
                  () => botToken.trim().length < 20,
                )}
                type="button"
                onClick={$nativeHandler(discover)}
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
                        onChange={$radioModel(
                          $state,
                          'selectedChatId',
                          chat.id,
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
                  onClick={$nativeHandler(connect)}
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
