import {
  parseServiceControlState,
  type ClientChannel,
  type ServiceControlState,
} from '@frontend/entities/service-control/model/types';
import { request } from '@frontend/shared/api/http-client';

export type ServiceControlScope = 'manage' | 'ops';

export function loadServiceControl(
  scope: ServiceControlScope = 'manage',
): Promise<ServiceControlState> {
  return request<unknown>(serviceControlPath(scope)).then(
    parseServiceControlState,
  );
}

export function pauseClientIntake(
  channel: ClientChannel,
  scope: ServiceControlScope = 'manage',
): Promise<ServiceControlState> {
  return request<unknown>(`${serviceControlPath(scope)}/${channel}/pause`, {
    body: '{}',
    method: 'POST',
  }).then(parseServiceControlState);
}

export function resumeClientIntake(
  channel: ClientChannel,
  scope: ServiceControlScope = 'manage',
): Promise<ServiceControlState> {
  return request<unknown>(`${serviceControlPath(scope)}/${channel}/resume`, {
    body: '{}',
    method: 'POST',
  }).then(parseServiceControlState);
}

function serviceControlPath(scope: ServiceControlScope): string {
  return `/api/${scope}/service-control`;
}
