import type {
  DeliverySummary,
  SupportRepository,
} from '@/core/contracts/support-repository.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import { mapDeliveryIncident } from '@/modules/operations-monitoring/application/delivery-incident.js';

export interface PublicDeliveryFailure {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  reason: string;
  retryAllowed: boolean;
}

export interface PublicDeliveryStatus {
  failures: readonly PublicDeliveryFailure[];
  summary: DeliverySummary;
}

export function createPublicDeliveryStatus(
  deliveries:
    | Pick<SupportRepository, 'findFailedDeliveries' | 'getDeliverySummary'>
    | undefined,
): PublicDeliveryStatus {
  if (!deliveries) {
    return {
      failures: [],
      summary: { failed: 0, pending: 0 },
    };
  }
  return {
    failures: deliveries.findFailedDeliveries(20).map(mapDeliveryFailure),
    summary: deliveries.getDeliverySummary(),
  };
}

export function mapDeliveryFailure(
  delivery: FailedDelivery,
): PublicDeliveryFailure {
  const incident = mapDeliveryIncident(delivery);
  return {
    attempts: incident.attempts,
    channel: incident.channel,
    createdAt: incident.createdAt,
    id: incident.id,
    reason: incident.reason,
    retryAllowed: incident.retryAllowed,
  };
}
