import type { OperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';
import { channelIsReady } from '@/modules/operations-monitoring/application/channel-status.js';

export function operationsAreReady(status: OperationsStatus): boolean {
  return (
    status.deliveries.state !== 'backlog' &&
    status.deliveries.state !== 'stalled' &&
    status.inboundEvents.state === 'healthy' &&
    status.operatorRelays.state === 'healthy' &&
    channelIsReady(status.channels.telegram) &&
    channelIsReady(status.channels.vk)
  );
}
