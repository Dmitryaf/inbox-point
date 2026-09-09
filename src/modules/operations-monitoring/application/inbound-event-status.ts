import type {
  InboundEventIncident,
  InboundEventSummary,
} from '@/core/model/inbound-event.js';
import type { InboundEventOperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

export function mapInboundEventStatus(
  summary: InboundEventSummary,
  incidents: readonly InboundEventIncident[],
): InboundEventOperationsStatus {
  return {
    incidents: incidents.map((incident) => ({
      attempts: incident.attempts,
      channel: 'VK',
      eventId: incident.externalEventId,
      reason: incident.lastError,
      receivedAt: incident.receivedAt.toISOString(),
      source: incident.source,
    })),
    quarantined: summary.quarantined,
    state: summary.quarantined > 0 ? 'quarantined' : 'healthy',
  };
}
