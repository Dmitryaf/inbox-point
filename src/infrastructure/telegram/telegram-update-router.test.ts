import { describe, expect, it } from 'vitest';

import type { OperatorMessage } from '@/core/model/operator-message.js';
import type { SupportMessage } from '@/core/model/support-message.js';

import type { TelegramUpdate } from './telegram-types.js';
import {
  TelegramUpdateRouter,
  type TelegramUpdateHandler,
} from './telegram-update-router.js';

class RecordingHandler implements TelegramUpdateHandler {
  public readonly clientMessages: {
    eventId: string;
    message: SupportMessage;
  }[] = [];
  public readonly operatorMessages: {
    eventId: string;
    message: OperatorMessage;
  }[] = [];

  public handleClientMessage(
    eventId: string,
    message: SupportMessage,
  ): Promise<void> {
    this.clientMessages.push({ eventId, message });
    return Promise.resolve();
  }

  public handleOperatorMessage(
    eventId: string,
    message: OperatorMessage,
  ): Promise<void> {
    this.operatorMessages.push({ eventId, message });
    return Promise.resolve();
  }
}

describe('TelegramUpdateRouter', () => {
  it('routes private text to the client handoff boundary', async () => {
    const handler = new RecordingHandler();
    const router = new TelegramUpdateRouter(handler, -1_001);

    await router.route(
      createUpdate({
        chatId: 101,
        chatType: 'private',
        firstName: 'Test',
        lastName: 'Customer',
        text: 'Question',
      }),
    );

    expect(handler.clientMessages).toEqual([
      {
        eventId: '77',
        message: {
          channel: 'telegram',
          conversationId: '101',
          displayName: 'Test Customer',
          externalMessageId: '55',
          receivedAt: new Date('2026-08-31T12:00:00.000Z'),
          text: 'Question',
        },
      },
    ]);
    expect(handler.operatorMessages).toHaveLength(0);
  });

  it('routes only human text from an operator topic', async () => {
    const handler = new RecordingHandler();
    const router = new TelegramUpdateRouter(handler, -1_001);

    await router.route(
      createUpdate({
        chatId: -1_001,
        chatType: 'supergroup',
        firstName: 'Operator',
        messageThreadId: 900,
        text: 'Answer',
      }),
    );
    await router.route(
      createUpdate({
        chatId: -1_001,
        chatType: 'supergroup',
        firstName: 'Bot',
        isBot: true,
        messageThreadId: 900,
        text: 'Own message',
      }),
    );
    await router.route(
      createUpdate({
        chatId: -2_002,
        chatType: 'supergroup',
        firstName: 'Unknown',
        messageThreadId: 901,
        text: 'Wrong group',
      }),
    );

    expect(handler.operatorMessages).toEqual([
      {
        eventId: '77',
        message: {
          externalMessageId: '55',
          operatorTopicId: '900',
          receivedAt: new Date('2026-08-31T12:00:00.000Z'),
          text: 'Answer',
        },
      },
    ]);
    expect(handler.clientMessages).toHaveLength(0);
  });
});

interface UpdateOverrides {
  chatId: number;
  chatType: 'private' | 'supergroup';
  firstName: string;
  isBot?: boolean;
  lastName?: string;
  messageThreadId?: number;
  text: string;
}

function createUpdate(overrides: UpdateOverrides): TelegramUpdate {
  return {
    message: {
      chat: { id: overrides.chatId, type: overrides.chatType },
      date: 1_788_177_600,
      from: {
        first_name: overrides.firstName,
        id: 42,
        is_bot: overrides.isBot ?? false,
        ...(overrides.lastName ? { last_name: overrides.lastName } : {}),
      },
      message_id: 55,
      ...(overrides.messageThreadId === undefined
        ? {}
        : { message_thread_id: overrides.messageThreadId }),
      text: overrides.text,
    },
    update_id: 77,
  };
}
