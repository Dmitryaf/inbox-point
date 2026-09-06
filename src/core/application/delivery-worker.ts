import { randomUUID } from 'node:crypto';

import {
  DeliveryOutcomeUnknownError,
  type ClientChannel,
} from '@/core/contracts/client-channel.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import {
  silentDeliveryWorkerActivityReporter,
  type DeliveryWorkerActivityReporter,
} from '@/core/contracts/delivery-worker-activity-reporter.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import {
  activeOutboundDeliveryPolicy,
  type OutboundDeliveryPolicy,
} from '@/core/contracts/outbound-delivery-policy.js';
import {
  DeliveryFailurePolicy,
  type DeliveryFailureContext,
} from './delivery-failure-policy.js';
import { waitForDelay } from './wait-for-delay.js';

export interface DeliveryWorkerDependencies {
  activity?: DeliveryWorkerActivityReporter;
  channels: readonly ClientChannel[];
  clock?: () => Date;
  createId?: () => string;
  maxAttempts?: number;
  incidentNotifier?: DeliveryIncidentNotifier;
  notificationRetryDelayMs?: number;
  onNotificationError?: (error: unknown, deliveryId: string) => void;
  onError?: (error: unknown, context: DeliveryFailureContext) => void;
  policy?: OutboundDeliveryPolicy;
  repository: SupportRepository;
  retryBaseDelayMs?: number;
}

export class DeliveryWorker {
  private readonly activity: DeliveryWorkerActivityReporter;
  private readonly channels: Map<string, ClientChannel>;
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly failurePolicy: DeliveryFailurePolicy;
  private readonly incidentNotifier: DeliveryIncidentNotifier | undefined;
  private readonly notificationRetryDelayMs: number;
  private readonly onNotificationError: (
    error: unknown,
    deliveryId: string,
  ) => void;
  private readonly policy: OutboundDeliveryPolicy;
  private readonly repository: SupportRepository;

  public constructor(dependencies: DeliveryWorkerDependencies) {
    this.activity =
      dependencies.activity ?? silentDeliveryWorkerActivityReporter;
    this.channels = new Map(
      dependencies.channels.map((channel) => [channel.kind, channel]),
    );
    this.clock = dependencies.clock ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.incidentNotifier = dependencies.incidentNotifier;
    this.notificationRetryDelayMs =
      dependencies.notificationRetryDelayMs ?? 30_000;
    this.onNotificationError =
      dependencies.onNotificationError ?? (() => undefined);
    this.repository = dependencies.repository;
    this.policy = dependencies.policy ?? activeOutboundDeliveryPolicy;
    this.failurePolicy = new DeliveryFailurePolicy({
      clock: this.clock,
      maxAttempts: dependencies.maxAttempts ?? 5,
      onError: dependencies.onError ?? (() => undefined),
      repository: this.repository,
      retryBaseDelayMs: dependencies.retryBaseDelayMs ?? 5_000,
    });
  }

  public registerChannel(channel: ClientChannel): void {
    this.channels.set(channel.kind, channel);
  }

  public unregisterChannel(channel: ClientChannel): void {
    if (this.channels.get(channel.kind) === channel) {
      this.channels.delete(channel.kind);
    }
  }

  public async processPending(): Promise<number> {
    if (this.policy.isDeliveryPaused()) {
      await this.notifyFailedDeliveries();
      return 0;
    }
    const deliveries = this.repository.findPendingDeliveries(this.clock(), 25);
    let processed = 0;
    for (const delivery of deliveries) {
      if (this.policy.isDeliveryPaused()) {
        break;
      }
      const channel = this.channels.get(delivery.channel);
      if (
        !channel ||
        !this.repository.claimDeliveryAttempt(delivery.id, this.clock())
      ) {
        continue;
      }
      processed += 1;
      let sent: { externalMessageId: string };
      try {
        sent = await channel.send({
          conversationId: delivery.conversationId,
          idempotencyKey: delivery.idempotencyKey,
          ...(delivery.replyToExternalMessageId
            ? { replyToExternalMessageId: delivery.replyToExternalMessageId }
            : {}),
          text: delivery.text,
        });
      } catch (error: unknown) {
        this.failurePolicy.record(delivery, error);
        continue;
      }

      const sentAt = this.clock();
      try {
        this.repository.completeDelivery(
          delivery.id,
          sent.externalMessageId,
          sentAt,
          {
            clientMessageId: sent.externalMessageId,
            createdAt: sentAt,
            direction: 'operator_to_client',
            id: this.createId(),
            operatorMessageId: delivery.operatorMessageId,
            requestId: delivery.requestId,
          },
        );
      } catch (error: unknown) {
        if (delivery.channel === 'telegram') {
          this.failurePolicy.record(
            delivery,
            new DeliveryOutcomeUnknownError(
              'telegram',
              'delivery was accepted but persistence failed',
            ),
          );
        } else {
          this.failurePolicy.record(delivery, error);
        }
      }
    }
    await this.notifyFailedDeliveries();
    return processed;
  }

  private async notifyFailedDeliveries(): Promise<void> {
    if (!this.incidentNotifier) {
      return;
    }
    const failures = this.repository.findUnnotifiedFailedDeliveries(
      this.clock(),
      10,
    );
    for (const failure of failures) {
      try {
        await this.incidentNotifier.notifyDeliveryFailure(failure);
        this.repository.markDeliveryFailureNotified(failure.id, this.clock());
      } catch (error: unknown) {
        this.repository.markDeliveryFailureNotificationRetry(
          failure.id,
          new Date(this.clock().getTime() + this.notificationRetryDelayMs),
        );
        this.onNotificationError(error, failure.id);
      }
    }
  }

  public async run(signal: AbortSignal): Promise<void> {
    this.activity.recordWorkerStarted(this.clock());
    try {
      while (!signal.aborted) {
        const processed = await this.processPending();
        this.activity.recordWorkerCycle(this.clock());
        await waitForDelay(processed > 0 ? 100 : 1_000, signal);
      }
    } finally {
      this.activity.recordWorkerStopped(this.clock());
    }
  }
}
