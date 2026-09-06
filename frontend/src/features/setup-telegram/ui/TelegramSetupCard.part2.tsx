import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';

import { renderTelegramSetupCardPart3 } from './TelegramSetupCard.part3';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramSetupCard.model';
export function renderTelegramSetupCardPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { discover, connect } = $state;
  const botToken = $state.botToken.value;
  const pending = $state.pending.value;
  const selectedChatId = $state.selectedChatId.value;
  const chats = $state.chats.value;
  const message = $state.message.value;
  if (!!$props.status.connected) {
    return null;
  }
  return (
    <>
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
            disabled={$or(pending !== null, () => botToken.trim().length < 20)}
            type="button"
            onClick={$nativeHandler(discover)}
          >
            {pending === 'discover' ? 'Ищем…' : 'Найти группы'}
          </button>
          {renderTelegramSetupCardPart3($state, $props)}
          {chats.length ? (
            <button
              disabled={$or(pending !== null, () => selectedChatId === null)}
              type="button"
              onClick={$nativeHandler(connect)}
            >
              {pending === 'connect' ? 'Подключаем…' : 'Подключить Telegram'}
            </button>
          ) : null}
          <p role="status" className="setup-status">
            {message}
          </p>
        </>
      )}
    </>
  );
}
