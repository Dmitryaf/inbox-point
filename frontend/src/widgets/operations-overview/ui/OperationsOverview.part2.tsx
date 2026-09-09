import ChannelStatusCard from './ChannelStatusCard';
import DeliveryStatusCard from './DeliveryStatusCard';
import InboundEventStatusCard from './InboundEventStatusCard';

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
          deliveryControlPending={$props.deliveryControlPending}
          outbound={$props.status.outbound}
          operatorRelays={$props.status.operatorRelays}
          pendingDeliveryId={$props.pendingDeliveryId}
          pendingOperatorActionId={$props.pendingOperatorActionId}
          onChangeDeliveryMode={($event) =>
            void $emit('changeDeliveryMode', $event)
          }
          onResolve={(id, resolution) =>
            $emit('resolveDelivery', id, resolution)
          }
          onRetry={($event) => void $emit('retryDelivery', $event)}
          onResolveOperatorAction={(id, resolution) =>
            $emit('resolveOperatorAction', id, resolution)
          }
        />
        <InboundEventStatusCard
          inboundEvents={$props.status.inboundEvents}
          pendingEventId={$props.pendingInboundEventId}
          onResolve={(id, source, resolution) =>
            $emit('resolveInboundEvent', id, source, resolution)
          }
        />
      </div>
    </>
  );
}
