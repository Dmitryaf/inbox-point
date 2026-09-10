import ChannelStatusCard from './ChannelStatusCard';
import DeliveryStatusCard from './DeliveryStatusCard';
import InboundEventStatusCard from './InboundEventStatusCard';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart3(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;

  return (
    <>
      <div className="status-grid" data-r-2dc401be="">
        <ChannelStatusCard
          name="Telegram"
          channel={$props.status.channels.telegram}
          intake={$props.status.intake.telegram}
          data-r-2dc401be=""
        />
        <ChannelStatusCard
          name="VK"
          channel={$props.status.channels.vk}
          intake={$props.status.intake.vk}
          data-r-2dc401be=""
        />
        <DeliveryStatusCard
          deliveries={$props.status.deliveries}
          deliveryControlPending={$props.deliveryControlPending}
          outbound={$props.status.outbound}
          onChangeDeliveryMode={($event) =>
            void $emit('changeDeliveryMode', $event)
          }
          data-r-2dc401be=""
        />
        <InboundEventStatusCard
          inboundEvents={$props.status.inboundEvents}
          data-r-2dc401be=""
        />
      </div>
    </>
  );
}
