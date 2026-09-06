import ChannelStatusCard from './ChannelStatusCard';
import DeliveryStatusCard from './DeliveryStatusCard';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      <div className="status-grid">
        <ChannelStatusCard
          name="Telegram"
          channel={$props.status.channels.telegram}
          intake={$props.status.intake.telegram}
        />
        <ChannelStatusCard
          name="VK"
          channel={$props.status.channels.vk}
          intake={$props.status.intake.vk}
        />
        <DeliveryStatusCard
          deliveries={$props.status.deliveries}
          pendingDeliveryId={$props.pendingDeliveryId}
          onRetry={($event) => void $emit('retryDelivery', $event)}
        />
      </div>
    </>
  );
}
