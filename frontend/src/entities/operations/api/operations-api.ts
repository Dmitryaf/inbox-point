import { request } from '@frontend/shared/api/http-client';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export function readOperationsStatus(): Promise<OperationsStatus> {
  return request<OperationsStatus>('/api/ops/status');
}

export function retryOperationsDelivery(deliveryId: string): Promise<void> {
  return request(
    `/api/ops/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    { body: '{}', method: 'POST' },
  );
}

export function resolveOperationsDelivery(
  deliveryId: string,
  resolution: 'not_received' | 'received',
): Promise<void> {
  return request(
    `/api/ops/deliveries/${encodeURIComponent(deliveryId)}/resolve`,
    {
      body: JSON.stringify({ resolution }),
      method: 'POST',
    },
  );
}
