import type {
  BackupResult,
  DeliveryStatus,
  SetupStatus,
  TelegramOperatorChat,
} from '@frontend/entities/setup/model/types';
import { request } from '@frontend/shared/api/http-client';

export function readSetupStatus(): Promise<SetupStatus> {
  return request<SetupStatus>('/api/setup/status');
}

export function discoverTelegramChats(
  botToken: string,
): Promise<{ chats: TelegramOperatorChat[] }> {
  return request('/api/setup/telegram/discover', {
    body: JSON.stringify({ botToken }),
    method: 'POST',
  });
}

export function connectTelegram(
  botToken: string,
  operatorChatId: number,
): Promise<{ connected: boolean }> {
  return request('/api/setup/telegram/connect', {
    body: JSON.stringify({ botToken, operatorChatId }),
    method: 'POST',
  });
}

export function connectVk(
  accessToken: string,
  community: string,
): Promise<{ connected: boolean }> {
  return request('/api/setup/vk/connect', {
    body: JSON.stringify({ accessToken, community }),
    method: 'POST',
  });
}

export function readDeliveryStatus(): Promise<DeliveryStatus> {
  return request('/api/setup/deliveries');
}

export function retryDelivery(
  deliveryId: string,
): Promise<{ queued: boolean }> {
  return request('/api/setup/deliveries/retry', {
    body: JSON.stringify({ deliveryId }),
    method: 'POST',
  });
}

export function createBackup(): Promise<BackupResult> {
  return request('/api/setup/backups', {
    body: '{}',
    method: 'POST',
  });
}
