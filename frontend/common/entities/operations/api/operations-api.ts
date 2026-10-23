import { request } from '@frontend-common/shared/api/http-client';
import type {
  OperationsStatus,
  OperatorActionResolution,
  OperatorInboxMessage,
  OperatorInboxRequest,
} from '@frontend-common/entities/operations/model/types';

export function readOperationsStatus(
  signal?: AbortSignal,
): Promise<OperationsStatus> {
  return request<OperationsStatus>('/api/ops/status', signal ? { signal } : {});
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

export function resolveOperatorAction(
  actionId: string,
  resolution: OperatorActionResolution,
): Promise<void> {
  return request(
    `/api/ops/operator-actions/${encodeURIComponent(actionId)}/resolve`,
    {
      body: JSON.stringify({ resolution }),
      method: 'POST',
    },
  );
}

export function resolveInboundEvent(
  eventId: string,
  source: string,
  resolution: 'retry' | 'skip',
): Promise<void> {
  return request(
    `/api/ops/inbound-events/${encodeURIComponent(eventId)}/resolve`,
    {
      body: JSON.stringify({ resolution, source }),
      method: 'POST',
    },
  );
}

export function readOperatorInboxRequests(signal?: AbortSignal): Promise<{
  requests: readonly OperatorInboxRequest[];
}> {
  return request('/api/ops/inbox/requests', signal ? { signal } : {});
}

export function readOperatorInboxMessages(
  requestId: string,
  signal?: AbortSignal,
): Promise<{
  messages: readonly OperatorInboxMessage[];
}> {
  return request(
    `/api/ops/inbox/requests/${encodeURIComponent(requestId)}/messages`,
    signal ? { signal } : {},
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
