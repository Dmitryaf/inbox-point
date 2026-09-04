import { describe, expect, it } from 'vitest';

import type {
  GetUpdatesOptions,
  SendMessageOptions,
  TelegramGateway,
} from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramPoller } from '@/infrastructure/telegram/telegram-poller.js';
import type { TelegramUpdate } from '@/infrastructure/telegram/telegram-types.js';

class RetryGateway implements TelegramGateway {
  public readonly offsets: (number | undefined)[] = [];

  public constructor(private readonly abortController: AbortController) {}

  public closeForumTopic(): Promise<void> {
    return Promise.resolve();
  }

  public createForumTopic(): Promise<{ topicId: number }> {
    return Promise.resolve({ topicId: 1 });
  }

  public getUpdates(
    options: GetUpdatesOptions,
  ): Promise<readonly TelegramUpdate[]> {
    this.offsets.push(options.offset);
    if (options.offset === 2) {
      this.abortController.abort();
      return Promise.resolve([]);
    }
    return Promise.resolve([{ update_id: 1 }]);
  }

  public reopenForumTopic(): Promise<void> {
    return Promise.resolve();
  }

  public sendMessage(
    options: SendMessageOptions,
  ): Promise<{ messageId: number }> {
    void options;
    return Promise.resolve({ messageId: 1 });
  }
}

describe('TelegramPoller', () => {
  it('retries a failed update without stopping or advancing its offset', async () => {
    const abortController = new AbortController();
    const gateway = new RetryGateway(abortController);
    const errors: unknown[] = [];
    let attempts = 0;
    let successfulPolls = 0;
    const poller = new TelegramPoller(
      gateway,
      {
        route: () => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new Error('Temporary failure'))
            : Promise.resolve();
        },
      },
      30,
      {
        onError: (error) => errors.push(error),
        onSuccess: () => {
          successfulPolls += 1;
        },
        retryDelay: () => Promise.resolve(),
      },
    );

    await poller.run(abortController.signal);

    expect(attempts).toBe(2);
    expect(errors).toHaveLength(1);
    expect(successfulPolls).toBe(1);
    expect(gateway.offsets).toEqual([undefined, undefined, 2]);
  });
});
