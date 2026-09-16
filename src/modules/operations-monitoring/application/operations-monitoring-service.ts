import { mapDeliveryStatus } from '@/modules/operations-monitoring/application/delivery-status.js';
import { mapDeliveryIncident } from '@/modules/operations-monitoring/application/delivery-incident.js';
import { mapOperatorRelayStatus } from '@/modules/operations-monitoring/application/operator-relay-status.js';
import { mapInboundEventStatus } from '@/modules/operations-monitoring/application/inbound-event-status.js';
import {
  channelNeedsAttention,
  mapChannelStatus,
} from '@/modules/operations-monitoring/application/channel-status.js';
import type { OperationsMonitoringDependencies } from '@/modules/operations-monitoring/application/operations-monitoring-dependencies.js';
import { operationsAreReady } from '@/modules/operations-monitoring/application/operations-readiness.js';
import {
  mapOperatorInboxStatus,
  mapOperationsState,
  uptimeSeconds,
} from '@/modules/operations-monitoring/application/operations-summary.js';
import type { OperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

export class OperationsMonitoringService {
  private readonly clock: () => Date;
  private readonly pendingDeliveryStaleAfterMs: number;
  private readonly pollStaleAfterMs: number;

  public constructor(
    private readonly dependencies: OperationsMonitoringDependencies,
  ) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.pendingDeliveryStaleAfterMs =
      dependencies.pendingDeliveryStaleAfterMs ?? 300_000;
    this.pollStaleAfterMs = dependencies.pollStaleAfterMs ?? 120_000;
  }

  public getStatus(): OperationsStatus {
    const observedAt = this.clock();
    const outbound = this.dependencies.deliveryControlStatus?.() ?? {
      mode: 'active' as const,
    };
    const deliveryStatus = mapDeliveryStatus(
      this.dependencies.deliverySummary(),
      this.dependencies.deliveryActivity(),
      observedAt,
      this.pendingDeliveryStaleAfterMs,
    );
    const deliveries = {
      ...deliveryStatus,
      incidents: (this.dependencies.deliveryFailures?.() ?? []).map(
        mapDeliveryIncident,
      ),
      state:
        outbound.mode === 'paused' ? ('paused' as const) : deliveryStatus.state,
    };
    const telegram = mapChannelStatus(
      this.dependencies.telegramStatus(),
      this.dependencies.channelActivity('telegram'),
      observedAt,
      this.dependencies.startedAt,
      this.pollStaleAfterMs,
    );
    const vk = mapChannelStatus(
      this.dependencies.vkStatus(),
      this.dependencies.channelActivity('vk'),
      observedAt,
      this.dependencies.startedAt,
      this.pollStaleAfterMs,
    );
    const needsAttention =
      (deliveries.state !== 'healthy' && deliveries.state !== 'paused') ||
      deliveries.worker.state === 'stalled' ||
      channelNeedsAttention(telegram) ||
      channelNeedsAttention(vk);
    const intake = this.dependencies.intakeStatus?.() ?? {
      telegram: { mode: 'active' as const },
      vk: { mode: 'active' as const },
    };
    const maintenance =
      intake.telegram.mode === 'paused' ||
      intake.vk.mode === 'paused' ||
      outbound.mode === 'paused';
    const operatorActionIncidents =
      this.dependencies.operatorActionIncidents?.() ?? [];
    const operatorRelays = mapOperatorRelayStatus(
      this.dependencies.operatorActionSummary?.() ?? { uncertain: 0 },
      operatorActionIncidents,
    );
    const inboundEvents = mapInboundEventStatus(
      this.dependencies.inboundEventSummary?.() ?? { quarantined: 0 },
      this.dependencies.inboundEventIncidents?.() ?? [],
    );
    const operatorInbox = mapOperatorInboxStatus(
      this.dependencies.webOperatorRequests?.() ?? {
        recoverable: 0,
        webOwned: 0,
      },
    );
    const overallNeedsAttention =
      needsAttention ||
      operatorInbox.state === 'attention' ||
      operatorRelays.state === 'uncertain' ||
      inboundEvents.state === 'quarantined';

    return {
      channels: { telegram, vk },
      deliveries,
      intake,
      inboundEvents,
      observedAt: observedAt.toISOString(),
      operatorInbox,
      operatorRelays,
      outbound,
      startedAt: this.dependencies.startedAt.toISOString(),
      state: mapOperationsState(overallNeedsAttention, maintenance),
      uptimeSeconds: uptimeSeconds(this.dependencies.startedAt, observedAt),
    };
  }

  public isReady = (): boolean => operationsAreReady(this.getStatus());
}
