import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
export function renderVkSetupCardPart6(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const community = $unref($state.community);
  const accessToken = $unref($state.accessToken);
  const pending = $unref($state.pending);
  const messageKind = $unref($state.messageKind);
  const message = $unref($state.message);
  const expanded = $state.expanded.value;
  if (!expanded) {
    return null;
  }
  if (!!($props.status.source !== 'none')) {
    return null;
  }
  return (
    <>
      {$props.status.locked ? (
        <p className="setup-status setup-status--info" data-r-712bbad4="">
          {
            ' VK подключён при установке. Если он не работает, откройте раздел «Мониторинг». '
          }
        </p>
      ) : (
        <form
          onSubmit={$nativeHandler($unref($state.connect), { prevent: true })}
          className="setup-form"
          data-r-712bbad4=""
        >
          <label htmlFor="vk-community" data-r-712bbad4="">
            {'Ссылка на страницу сообщества VK'}
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
            {'Ключ с правами управления и сообщений'}
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
