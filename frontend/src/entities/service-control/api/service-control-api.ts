import {
  parseServiceControlState,
  type ClientChannel,
  type ServiceControlState,
} from '@frontend/entities/service-control/model/types';
import { request } from '@frontend/shared/api/http-client';

export function loadServiceControl(): Promise<ServiceControlState> {
  return request<unknown>('/api/ops/service-control').then(
    parseServiceControlState,
  );
}

export function pauseClientIntake(
  channel: ClientChannel,
): Promise<ServiceControlState> {
  return request<unknown>(`/api/ops/service-control/${channel}/pause`, {
    body: '{}',
    method: 'POST',
  }).then(parseServiceControlState);
}

export function resumeClientIntake(
  channel: ClientChannel,
): Promise<ServiceControlState> {
  return request<unknown>(`/api/ops/service-control/${channel}/resume`, {
    body: '{}',
    method: 'POST',
  }).then(parseServiceControlState);
}

export function pauseOutboundDelivery(): Promise<ServiceControlState> {
  return request<unknown>('/api/ops/service-control/delivery/pause', {
    body: '{}',
    method: 'POST',
  }).then(parseServiceControlState);
}

export function resumeOutboundDelivery(): Promise<ServiceControlState> {
  return request<unknown>('/api/ops/service-control/delivery/resume', {
    body: '{}',
    method: 'POST',
  }).then(parseServiceControlState);
}
