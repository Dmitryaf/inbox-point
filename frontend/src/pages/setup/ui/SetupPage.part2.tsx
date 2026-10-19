import { classNames as $class } from '@frontend/shared/lib/component-view';
import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const {
    markTelegramConnected,
    markTelegramDisconnected,
    markVkConnected,
    markVkDisconnected,
    loadStatus,
  } = $state;
  const session = $unref($state.session);
  const error = $state.error.value;
  const status = $state.status.value;
  const loading = $state.loading.value;
  if (!session.authenticated.value) {
    return null;
  }
  return (
    <>
      {loading ? (
        <p role="status" className="state-card card" data-r-ad468c1b="">
          {' Проверяем подключения… '}
        </p>
      ) : error ? (
        <button
          type="button"
          onClick={$nativeHandler(loadStatus)}
          className="secondary-button"
          data-r-ad468c1b=""
        >
          {' Повторить проверку подключений '}
        </button>
      ) : status ? (
        <div className="setup-workspace" data-r-ad468c1b="">
          <div
            className={$class('setup-channel-grid', {
              'setup-channel-grid--mixed':
                status.connected !== status.vk.connected,
            })}
            data-r-ad468c1b=""
          >
            <TelegramSetupCard
              status={status}
              vkConfigured={status.vk.source !== 'none'}
              onConnected={$callback(markTelegramConnected)}
              onDisconnected={$callback(markTelegramDisconnected)}
              data-r-ad468c1b=""
            />
            <VkSetupCard
              status={status.vk}
              telegramConnected={status.connected}
              onConnected={$callback(markVkConnected)}
              onDisconnected={$callback(markVkDisconnected)}
              data-r-ad468c1b=""
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
