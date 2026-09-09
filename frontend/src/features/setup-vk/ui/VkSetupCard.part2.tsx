import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { connect } = $state;
  const community = $state.community.value;
  const accessToken = $state.accessToken.value;
  const pending = $state.pending.value;
  const message = $state.message.value;
  if (!!$props.status.connected) {
    return null;
  }
  return (
    <>
      {!$props.telegramConnected ? (
        <p className="setup-status">
          {' Сначала подключите Telegram для операторов. '}
        </p>
      ) : $props.status.locked ? (
        <p className="setup-status">
          {
            ' VK настроен на сервере. Если он не работает, откройте раздел «Состояние». '
          }
        </p>
      ) : (
        <form
          onSubmit={$nativeHandler(connect, { prevent: true })}
          className="setup-form"
        >
          <label htmlFor="vk-community">{'Адрес сообщества VK'}</label>
          <input
            id="vk-community"
            placeholder="https://vk.com/your_community"
            required
            type="text"
            value={community ?? ''}
            onChange={$textModel($state, 'community')}
          />
          <label htmlFor="vk-token">
            {'Ключ доступа с правом работы с сообщениями'}
          </label>
          <input
            id="vk-token"
            autoComplete="off"
            required
            type="password"
            value={accessToken ?? ''}
            onChange={$textModel($state, 'accessToken')}
          />
          <button
            disabled={$or(pending, () => accessToken.trim().length < 20)}
            type="submit"
          >
            {pending ? 'Подключаем…' : 'Подключить VK'}
          </button>
          <p role="status" className="setup-status">
            {message}
          </p>
        </form>
      )}
    </>
  );
}
