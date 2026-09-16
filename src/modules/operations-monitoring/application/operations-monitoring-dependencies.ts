import type {
  DeliverySummary,
  WebOperatorRequestSummary,
} from '@/core/contracts/support-repository.js';
import type {
  OperatorActionIncident,
  OperatorActionSummary,
} from '@/core/model/operator-action.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import type {
  InboundEventIncident,
  InboundEventSummary,
} from '@/core/model/inbound-event.js';
import type { ChannelActivitySnapshot } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import type { DeliveryWorkerActivitySnapshot } from '@/modules/operations-monitoring/application/delivery-worker-activity-monitor.js';
import type { ChannelStatusSnapshot } from '@/modules/operations-monitoring/application/channel-status.js';
import type { ServiceControlState } from '@/modules/service-control/model/service-control-state.js';

export interface OperationsMonitoringDependencies {
  clock?: () => Date;
  channelActivity: (channel: ClientChannelKind) => ChannelActivitySnapshot;
  deliveryActivity: () => DeliveryWorkerActivitySnapshot;
  deliveryFailures?: () => readonly FailedDelivery[];
  deliverySummary: () => DeliverySummary;
  deliveryControlStatus?: () => ServiceControlState['delivery'];
  intakeStatus?: () => ServiceControlState['channels'];
  inboundEventIncidents?: () => readonly InboundEventIncident[];
  inboundEventSummary?: () => InboundEventSummary;
  operatorActionIncidents?: () => readonly OperatorActionIncident[];
  operatorActionSummary?: () => OperatorActionSummary;
  pendingDeliveryStaleAfterMs?: number;
  pollStaleAfterMs?: number;
  startedAt: Date;
  telegramStatus: () => ChannelStatusSnapshot;
  vkStatus: () => ChannelStatusSnapshot;
  webOperatorRequests?: () => WebOperatorRequestSummary;
}
