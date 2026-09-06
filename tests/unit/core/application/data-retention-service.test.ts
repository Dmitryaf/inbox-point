import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataRetentionService } from '@/core/application/data-retention-service.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('DataRetentionService', () => {
  it('runs immediately and periodically using the configured cutoff', () => {
    vi.useFakeTimers();
    const purgeClosedConversationContent = vi.fn(() => ({
      deliveriesRedacted: 1,
      eligibleRequests: 1,
      messagesDeleted: 2,
      requestsAnonymized: 1,
      skippedRequests: 0,
    }));
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new DataRetentionService(
      { purgeClosedConversationContent },
      7,
      logger,
      {
        cleanupIntervalMilliseconds: 1_000,
        now: () => new Date('2026-09-06T12:00:00.000Z'),
      },
    );

    service.start();
    service.start();
    expect(purgeClosedConversationContent).toHaveBeenCalledTimes(1);
    expect(purgeClosedConversationContent).toHaveBeenLastCalledWith(
      new Date('2026-08-30T12:00:00.000Z'),
    );
    expect(logger.info).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1_000);
    expect(purgeClosedConversationContent).toHaveBeenCalledTimes(2);

    service.stop();
    vi.advanceTimersByTime(1_000);
    expect(purgeClosedConversationContent).toHaveBeenCalledTimes(2);
  });

  it('warns when unfinished deliveries prevent cleanup', () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    const service = new DataRetentionService(
      {
        purgeClosedConversationContent: () => ({
          deliveriesRedacted: 0,
          eligibleRequests: 0,
          messagesDeleted: 0,
          requestsAnonymized: 0,
          skippedRequests: 1,
        }),
      },
      7,
      logger,
      { now: () => new Date('2026-09-06T12:00:00.000Z') },
    );

    service.run();

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
