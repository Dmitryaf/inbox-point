import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { markTelegramConnected, markVkConnected } = $state;
  const session = $unref($state.session);
  const status = $state.status.value;
  if (!session.authenticated.value) {
    return null;
  }
  return (
    <>
      {!status ? (
        <p role="status" className="state-card card" data-r-ad468c1b="">
          {' Проверяем подключения… '}
        </p>
      ) : (
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
              onConnected={$callback(markTelegramConnected)}
              data-r-ad468c1b=""
            />
            <VkSetupCard
              status={status.vk}
              telegramConnected={status.connected}
              onConnected={$callback(markVkConnected)}
              data-r-ad468c1b=""
            />
          </div>
        </div>
      )}
    </>
  );
}
