import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HandoffService } from '@/core/application/handoff-service.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';

import type {
  GetUpdatesOptions,
  SendMessageOptions,
  TelegramGateway,
} from './telegram-api-client.js';
import { TelegramClientChannel } from './telegram-client-channel.js';
import { TelegramTopicsInbox } from './telegram-topics-inbox.js';
import type { TelegramUpdate } from './telegram-types.js';
import { TelegramUpdateRouter } from './telegram-update-router.js';

class FakeTelegramGateway implements TelegramGateway {
  public readonly sent: SendMessageOptions[] = [];

  public closeForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    void chatId;
    void messageThreadId;
    return Promise.resolve();
  }

  public createForumTopic(
    chatId: number,
    name: string,
  ): Promise<{ topicId: number }> {
    void chatId;
    void name;
    return Promise.resolve({ topicId: 900 });
  }

  public getUpdates(
    options: GetUpdatesOptions,
  ): Promise<readonly TelegramUpdate[]> {
    void options;
    return Promise.resolve([]);
  }

  public reopenForumTopic(
    chatId: number,
    messageThreadId: number,
  ): Promise<void> {
    void chatId;
    void messageThreadId;
    return Promise.resolve();
  }

  public sendMessage(
    options: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    this.sent.push(options);
    return Promise.resolve({ messageId: 700 + this.sent.length });
  }
}

describe('Telegram handoff integration', () => {
  let gateway: FakeTelegramGateway;
  let repository: SqliteSupportRepository;
  let router: TelegramUpdateRouter;

  beforeEach(() => {
    gateway = new FakeTelegramGateway();
    repository = new SqliteSupportRepository(':memory:');
    const handoff = new HandoffService({
      clientChannels: [new TelegramClientChannel(gateway)],
      createId: (() => {
        let nextId = 1;
        return () => `id-${nextId++}`;
      })(),
      operatorInbox: new TelegramTopicsInbox(gateway, -1_001),
      repository,
    });
    router = new TelegramUpdateRouter(handoff, -1_001);
  });

  afterEach(() => {
    repository.close();
  });

  it('routes customer text through a topic and returns the operator reply', async () => {
    await router.route({
      message: {
        chat: { id: 101, type: 'private' },
        date: 1_788_177_600,
        from: {
          first_name: 'Test',
          id: 101,
          is_bot: false,
        },
        message_id: 501,
        text: 'Question',
      },
      update_id: 1,
    });
    await router.route({
      message: {
        chat: { id: -1_001, type: 'supergroup' },
        date: 1_788_177_660,
        from: {
          first_name: 'Operator',
          id: 202,
          is_bot: false,
        },
        message_id: 502,
        message_thread_id: 900,
        text: 'Answer',
      },
      update_id: 2,
    });

    expect(gateway.sent).toHaveLength(2);
    expect(gateway.sent[0]).toMatchObject({
      chatId: -1_001,
      messageThreadId: 900,
    });
    expect(gateway.sent[0]?.text).toContain('Question');
    expect(gateway.sent[1]).toEqual({
      chatId: 101,
      text: 'Answer',
    });
  });
});
