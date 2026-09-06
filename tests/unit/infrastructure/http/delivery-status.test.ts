import { describe, expect, it } from 'vitest';

import { mapDeliveryFailure } from '@/infrastructure/http/delivery-status.js';

describe('public delivery status', () => {
  it('requires manual verification when the channel outcome is unknown', () => {
    const failure = mapDeliveryFailure({
      attempts: 1,
      channel: 'telegram',
      createdAt: new Date('2026-09-05T10:00:00.000Z'),
      id: 'delivery-1',
      lastError: 'Telegram API request failed for sendMessage',
      operatorMessageId: 'operator-message-1',
      operatorTopicId: 'topic-1',
      outcomeUnknown: true,
      requestId: 'request-1',
    });

    expect(failure.retryAllowed).toBe(false);
    expect(failure.reason).toContain('Автоматический повтор отключён');
  });
});
