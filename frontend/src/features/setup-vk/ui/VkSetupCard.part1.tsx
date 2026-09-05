import { invokeHandler as $invoke } from '@frontend/shared/lib/component-events';

import {
  setModelValue as $set,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import VkSetupInstructions from './VkSetupInstructions';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './VkSetupCard.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';
export function renderVkSetupCardPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { connect } = $state;
  const community = $state.community.value;
  const accessToken = $state.accessToken.value;
  const pending = $state.pending.value;
  const message = $state.message.value;
  return (
    <>
      {$props.status.connected ? (
        <p className="setup-status setup-status--success">
          {
            ' VK подключён. После перезапуска сервис восстановит подключение автоматически. '
          }
        </p>
      ) : (
        <>
          <VkSetupInstructions />
          {!$props.telegramConnected ? (
            <p className="setup-status">
              {' Сначала подключите Telegram для операторов. '}
            </p>
          ) : $props.status.locked ? (
            <p className="setup-status">
              {' Подключение управляется настройками сервера. '}
            </p>
          ) : (
            <form
              onSubmit={($event) => {
                $event.preventDefault();
                $invoke(connect, $event);
              }}
              className="setup-form"
            >
              <label htmlFor="vk-community">{'Адрес сообщества VK'}</label>
              <input
                id="vk-community"
                placeholder="https://vk.com/your_community"
                required
                type="text"
                value={community ?? ''}
                onChange={$controlledChange<HTMLInputElement>(($event) => {
                  $set($state, 'community', $event.currentTarget.value);
                })}
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
                onChange={$controlledChange<HTMLInputElement>(($event) => {
                  $set($state, 'accessToken', $event.currentTarget.value);
                })}
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
      )}
    </>
  );
}
