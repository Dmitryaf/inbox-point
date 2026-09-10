import ChannelStatusCard from './ChannelStatusCard';
import DeliveryStatusCard from './DeliveryStatusCard';
import InboundEventStatusCard from './InboundEventStatusCard';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart3(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
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
