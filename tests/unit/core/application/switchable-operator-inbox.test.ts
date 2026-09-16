import { describe, expect, it } from 'vitest';

import { SwitchableOperatorInbox } from '@/core/application/switchable-operator-inbox.js';
import {
  OperatorInboxUnavailableError,
  type OpenOperatorRequest,
  type OperatorInbox,
  type OperatorLifecycleActionOptions,
  type RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { SupportMessage } from '@/core/model/support-message.js';

class RecordingInbox implements OperatorInbox {
  public closeCalls = 0;
  public closeError: Error | undefined;
  public reopenCalls = 0;
  public reopenError: Error | undefined;

  public closeRequest(): Promise<void> {
    this.closeCalls += 1;
    return this.closeError
      ? Promise.reject(this.closeError)
      : Promise.resolve();
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    return Promise.resolve({ topicId: request.reusableTopicId ?? 'topic-1' });
  }

  public notifyDeliveryFailure(): Promise<void> {
    return Promise.resolve();
  }

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ) {
    void options;
    return Promise.resolve({
      operatorMessageIds: [message.externalMessageId],
      operatorTopicId,
    });
  }

  public reopenRequest(): Promise<void> {
    this.reopenCalls += 1;
    return this.reopenError
      ? Promise.reject(this.reopenError)
      : Promise.resolve();
  }
}

const lifecycleOptions: OperatorLifecycleActionOptions = {
  externalEventId: 'event-1',
  requestId: 'request-1',
};

describe('SwitchableOperatorInbox lifecycle', () => {
  it.each(['close', 'reopen'] as const)(
    'does not mask a Telegram %s when the primary inbox is unavailable',
    async (operation) => {
      const fallback = new RecordingInbox();
      const inbox = new SwitchableOperatorInbox(fallback);

      const promise =
        operation === 'close'
          ? inbox.closeRequest('900', lifecycleOptions)
          : inbox.reopenRequest('900', lifecycleOptions);

      await expect(promise).rejects.toBeInstanceOf(
        OperatorInboxUnavailableError,
      );
      expect(fallback.closeCalls).toBe(0);
      expect(fallback.reopenCalls).toBe(0);
    },
  );

  it.each(['close', 'reopen'] as const)(
    'propagates a definite Telegram %s failure without a no-op fallback',
    async (operation) => {
      const fallback = new RecordingInbox();
      const primary = new RecordingInbox();
      const error = new Error('Telegram lifecycle failure');
      if (operation === 'close') {
        primary.closeError = error;
      } else {
        primary.reopenError = error;
      }
      const inbox = new SwitchableOperatorInbox(fallback);
      inbox.register(primary);

      const promise =
        operation === 'close'
          ? inbox.closeRequest('900', lifecycleOptions)
          : inbox.reopenRequest('900', lifecycleOptions);

      await expect(promise).rejects.toBe(error);
      expect(fallback.closeCalls).toBe(0);
      expect(fallback.reopenCalls).toBe(0);
    },
  );

  it('keeps local web lifecycle operations on the emergency inbox', async () => {
    const fallback = new RecordingInbox();
    const inbox = new SwitchableOperatorInbox(fallback);

    await inbox.closeRequest('web:request-1', lifecycleOptions);
    await inbox.reopenRequest('web:request-1', lifecycleOptions);

    expect(fallback.closeCalls).toBe(1);
    expect(fallback.reopenCalls).toBe(1);
  });
});
