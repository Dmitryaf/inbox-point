import { classNames as $class } from '@frontend/shared/lib/component-view';
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
  const messageKind = $state.messageKind.value;
  const message = $state.message.value;
  if (!!$props.status.connected) {
    return null;
  }
  if (!!!$props.telegramConnected) {
    return null;
  }
  return (
    <>
      {$props.status.locked ? (
        <p className="setup-status setup-status--info" data-r-712bbad4="">
          {
            ' VK подключён при установке. Если он не работает, откройте раздел «Состояние». '
          }
        </p>
      ) : (
        <form
          onSubmit={$nativeHandler(connect, { prevent: true })}
          className="setup-form"
          data-r-712bbad4=""
        >
          <label htmlFor="vk-community" data-r-712bbad4="">
            {'Адрес сообщества VK'}
          </label>
          <input
            id="vk-community"
            placeholder="https://vk.com/your_community"
            required
            type="text"
            value={community ?? ''}
            onChange={$textModel($state, 'community')}
            data-r-712bbad4=""
          />
          <label htmlFor="vk-token" data-r-712bbad4="">
            {'Ключ доступа с правом работы с сообщениями'}
          </label>
          <input
            id="vk-token"
            autoComplete="off"
            required
            type="password"
            value={accessToken ?? ''}
            onChange={$textModel($state, 'accessToken')}
            data-r-712bbad4=""
          />
          <button
            disabled={$or(pending, () => accessToken.trim().length < 20)}
            type="submit"
            data-r-712bbad4=""
          >
            {pending ? 'Подключаем…' : 'Подключить VK'}
          </button>
          <p
            role={messageKind === 'error' ? 'alert' : 'status'}
            className={$class('setup-status', `setup-status--${messageKind}`)}
            data-r-712bbad4=""
          >
            {message}
          </p>
        </form>
      )}
    </>
  );
}
