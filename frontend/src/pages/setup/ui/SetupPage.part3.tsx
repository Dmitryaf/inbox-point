import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart3(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { markTelegramConnected, markVkConnected } = $state;
  const session = $unref($state.session);
  const status = $state.status.value;
  if (!!session.booting.value) {
    return null;
  }
  if (!!!session.authenticated.value) {
    return null;
  }
  return (
    <>
      {!status ? (
        <p role="status" className="state-card">
          {' Проверяем подключения… '}
        </p>
      ) : (
        <div className="setup-workspace">
          <div
            className={$class('setup-channel-grid', {
              'setup-channel-grid--mixed':
                status.connected !== status.vk.connected,
            })}
          >
            <TelegramSetupCard
              status={status}
              onConnected={$callback(markTelegramConnected)}
            />
            <VkSetupCard
              status={status.vk}
              telegramConnected={status.connected}
              onConnected={$callback(markVkConnected)}
            />
          </div>
        </div>
      )}
    </>
  );
}
