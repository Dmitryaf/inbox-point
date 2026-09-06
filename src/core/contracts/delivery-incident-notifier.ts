import type { FailedDelivery } from '@/core/model/support-request.js';

export interface DeliveryIncidentNotifier {
  notifyDeliveryFailure(delivery: FailedDelivery): Promise<void>;
}
