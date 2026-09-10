import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';

import { renderTelegramConnectionFormPart2 } from './TelegramConnectionForm.part2';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './TelegramConnectionForm.model';
export function renderTelegramConnectionFormPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { discover, connect } = $state;
  const botToken = $state.botToken.value;
  const pending = $state.pending.value;
  const selectedChatId = $state.selectedChatId.value;
  const chats = $state.chats.value;
  const messageKind = $state.messageKind.value;
  const message = $state.message.value;

  return (
    <>
      {$props.locked ? (
        <p className="setup-status setup-status--info" data-r-4c039fa9="">
          {
            ' Telegram подключён при установке. Если он не работает, откройте раздел «Мониторинг». '
          }
        </p>
      ) : (
        <>
          <label htmlFor="telegram-token" data-r-4c039fa9="">
            {'Токен от @BotFather'}
          </label>
          <input
            id="telegram-token"
            autoComplete="off"
            type="password"
            value={botToken ?? ''}
            onChange={$textModel($state, 'botToken')}
            data-r-4c039fa9=""
          />
          <button
            disabled={$or(pending !== null, () => botToken.trim().length < 20)}
            type="button"
            onClick={$nativeHandler(discover)}
            data-r-4c039fa9=""
          >
            {pending === 'discover' ? 'Ищем…' : 'Найти группы'}
          </button>
          {renderTelegramConnectionFormPart2($state, $props)}
          {chats.length ? (
            <button
              disabled={$or(pending !== null, () => selectedChatId === null)}
              type="button"
              onClick={$nativeHandler(connect)}
              data-r-4c039fa9=""
            >
              {pending === 'connect' ? 'Подключаем…' : 'Подключить Telegram'}
            </button>
          ) : null}
          <p
            role={messageKind === 'error' ? 'alert' : 'status'}
            className={$class('setup-status', `setup-status--${messageKind}`)}
            data-r-4c039fa9=""
          >
            {message}
          </p>
        </>
      )}
    </>
  );
}
