import type {
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

export function disconnectTelegram(): Promise<{ connected: boolean }> {
  return request('/api/setup/telegram', { method: 'DELETE' });
}

export function disconnectVk(): Promise<{ connected: boolean }> {
  return request('/api/setup/vk', { method: 'DELETE' });
}
