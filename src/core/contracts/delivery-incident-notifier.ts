import type { FailedDelivery } from '@/core/model/support-request.js';
import type { EnrollmentConfirmationNotification } from '@/core/contracts/class-enrollment-store.js';

export interface DeliveryIncidentNotifier {
  notifyDeliveryFailure(delivery: FailedDelivery): Promise<void>;
  notifyEnrollmentConfirmed?(
    notification: EnrollmentConfirmationNotification,
  ): Promise<void>;
}
