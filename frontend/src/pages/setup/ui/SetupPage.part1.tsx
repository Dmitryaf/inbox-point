import { invokeArgs as $invokeArgs } from '@frontend/shared/lib/component-events';

import BackupCard from '@frontend/features/create-backup/ui/BackupCard';
import DeliveryStatusCard from '@frontend/features/manage-deliveries/ui/DeliveryStatusCard';
import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard';

import type { createComponentModel } from './SetupPage.model';
export function renderSetupPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { markTelegramConnected, markVkConnected } = $state;
  const status = $state.status.value;
  const error = $state.error.value;
  return (
    <>
      {error ? (
        <p role="alert" className="message message--error">
          {error}
        </p>
      ) : !status ? (
        <p role="status" className="state-card">
          {' Проверяем подключения… '}
        </p>
      ) : (
        <div className="setup-workspace">
          <div className="setup-channel-grid">
            <TelegramSetupCard
              status={status}
              onConnected={(...$args) => {
                $invokeArgs(markTelegramConnected, $args);
              }}
            />
            <VkSetupCard
              status={status.vk}
              telegramConnected={status.connected}
              onConnected={(...$args) => {
                $invokeArgs(markVkConnected, $args);
              }}
            />
          </div>
          <div className="setup-service-grid">
            <DeliveryStatusCard />
            <BackupCard />
          </div>
        </div>
      )}
    </>
  );
}
