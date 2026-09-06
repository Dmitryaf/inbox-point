import { request } from '@frontend/shared/api/http-client';
import type {
  OperationsStatus,
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend/entities/operations/model/types';

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

export function readOperatorInboxRequests(): Promise<{
  requests: readonly OperatorInboxRequest[];
}> {
  return request('/api/ops/inbox/requests');
}

export function readOperatorInboxMessages(requestId: string): Promise<{
  messages: readonly OperatorInboxMessage[];
}> {
  return request(
    `/api/ops/inbox/requests/${encodeURIComponent(requestId)}/messages`,
  );
}

export function sendOperatorInboxReply(
  requestId: string,
  input: { idempotencyKey: string; text: string },
): Promise<void> {
  return request(
    `/api/ops/inbox/requests/${encodeURIComponent(requestId)}/replies`,
    { body: JSON.stringify(input), method: 'POST' },
  );
}

export function closeOperatorInboxRequest(
  requestId: string,
  idempotencyKey: string,
): Promise<void> {
  return request(
    `/api/ops/inbox/requests/${encodeURIComponent(requestId)}/close`,
    {
      body: JSON.stringify({ idempotencyKey }),
      method: 'POST',
    },
  );
}
