import { vi } from 'vitest';
import type { TelegramGateway } from '@/infrastructure/telegram/telegram-api-client.js';
import type { VkGateway } from '@/infrastructure/vk/vk-api-client.js';
import type { OperatorInbox } from '@/core/contracts/operator-inbox.js';
export function classGateways() {
  const telegram = {
    answerCallbackQuery: vi
      .fn<(id: string) => Promise<void>>()
      .mockResolvedValue(undefined),
    closeForumTopic: vi
      .fn<TelegramGateway['closeForumTopic']>()
      .mockResolvedValue(undefined),
    createForumTopic: vi
      .fn<TelegramGateway['createForumTopic']>()
      .mockResolvedValue({ topicId: 1 }),
    reopenForumTopic: vi
      .fn<TelegramGateway['reopenForumTopic']>()
      .mockResolvedValue(undefined),
    getUpdates: vi.fn<TelegramGateway['getUpdates']>().mockResolvedValue([]),
    sendMessage: vi
      .fn<TelegramGateway['sendMessage']>()
      .mockResolvedValue({ messageId: 1 }),
  };
  const vk = {
    getLongPollServer: vi
      .fn<VkGateway['getLongPollServer']>()
      .mockResolvedValue({
        key: 'synthetic',
        server: 'https://example.test',
        ts: '1',
      }),
    getUserDisplayName: vi
      .fn<VkGateway['getUserDisplayName']>()
      .mockResolvedValue('Synthetic'),
    poll: vi
      .fn<VkGateway['poll']>()
      .mockResolvedValue({ ts: '1', updates: [] }),
    sendMessage: vi
      .fn<VkGateway['sendMessage']>()
      .mockResolvedValue({ externalMessageId: '1' }),
  };
  const inbox = {
    openRequest: vi
      .fn<OperatorInbox['openRequest']>()
      .mockImplementation((request) =>
        Promise.resolve({ topicId: request.reusableTopicId ?? 'topic-1' }),
      ),
    closeRequest: vi
      .fn<OperatorInbox['closeRequest']>()
      .mockResolvedValue(undefined),
    reopenRequest: vi
      .fn<OperatorInbox['reopenRequest']>()
      .mockResolvedValue(undefined),
    relayCustomerMessage: vi
      .fn<OperatorInbox['relayCustomerMessage']>()
      .mockImplementation((topicId) =>
        Promise.resolve({
          operatorTopicId: topicId,
          operatorMessageIds: ['message-1'],
        }),
      ),
    mirrorOperatorMessage: vi
      .fn<OperatorInbox['mirrorOperatorMessage']>()
      .mockResolvedValue(undefined),
  };
  return { telegram, vk, inbox };
}
