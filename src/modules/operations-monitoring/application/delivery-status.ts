import type { DeliverySummary } from '@/core/contracts/support-repository.js';
import type { DeliveryWorkerActivitySnapshot } from '@/modules/operations-monitoring/application/delivery-worker-activity-monitor.js';
import type { DeliveryOperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

export function mapDeliveryStatus(
  summary: DeliverySummary,
  activity: DeliveryWorkerActivitySnapshot,
  observedAt: Date,
  staleAfterMs: number,
): DeliveryOperationsStatus {
  const oldestPendingAgeMs = summary.oldestPendingAt
    ? Math.max(0, observedAt.getTime() - summary.oldestPendingAt.getTime())
    : undefined;
  const cycleStale = activity.lastCycleAt
    ? observedAt.getTime() - activity.lastCycleAt.getTime() > staleAfterMs
    : true;
  const workerStalled =
    summary.pending > 0 && (!activity.running || cycleStale);
  const backlog =
    summary.pending > 0 &&
    oldestPendingAgeMs !== undefined &&
    oldestPendingAgeMs > staleAfterMs;
  const state = workerStalled
    ? 'stalled'
    : backlog
      ? 'backlog'
      : summary.failed > 0
        ? 'failed'
        : 'healthy';

  return {
    failed: summary.failed,
    ...(oldestPendingAgeMs === undefined || !summary.oldestPendingAt
      ? {}
      : {
          oldestPendingAgeSeconds: Math.floor(oldestPendingAgeMs / 1_000),
          oldestPendingAt: summary.oldestPendingAt.toISOString(),
        }),
    pending: summary.pending,
    state,
    uncertain: summary.uncertain ?? 0,
    worker: {
      ...(activity.lastCycleAt
        ? { lastCycleAt: activity.lastCycleAt.toISOString() }
        : {}),
      running: activity.running,
      state: workerStalled
        ? 'stalled'
        : activity.running
          ? 'running'
          : 'inactive',
    },
  };
}
