import type { OperationsStatus } from '@frontend/entities/operations/model/types';

export function attentionOperationsStatus(): OperationsStatus {
  return {
    channels: {
      telegram: {
        configured: true,
        lastSuccessfulPollAt: '2026-09-04T12:00:30.000Z',
        running: true,
        source: 'environment',
        state: 'running',
      },
      vk: {
        configured: true,
        lastFailedPollAt: '2026-09-04T12:00:45.000Z',
        running: false,
        source: 'local',
        state: 'poll_failed',
      },
    },
    deliveries: {
      failed: 2,
      incidents: [
        {
          attempts: 5,
          channel: 'Telegram',
          createdAt: '2026-09-04T12:00:00.000Z',
          id: 'delivery-1',
          operatorMessageId: 'operator-message-17',
          operatorTopicId: 'topic-42',
          reason: 'Telegram не доставил ответ.',
          requestId: 'request-9',
          retryAllowed: true,
        },
      ],
      oldestPendingAgeSeconds: 90,
      oldestPendingAt: '2026-09-04T11:59:30.000Z',
      pending: 3,
      state: 'failed',
      uncertain: 0,
      worker: {
        lastCycleAt: '2026-09-04T12:00:59.000Z',
        running: true,
        state: 'running',
      },
    },
    intake: {
      telegram: { mode: 'paused' },
      vk: { mode: 'active' },
    },
    observedAt: '2026-09-04T12:01:00.000Z',
    outbound: { mode: 'active' },
    startedAt: '2026-09-04T12:00:00.000Z',
    state: 'attention',
    uptimeSeconds: 60,
  };
}
