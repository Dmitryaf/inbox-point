import { randomUUID } from 'node:crypto';

import {
  DeliveryOutcomeUnknownError,
  type ClientChannel,
} from '@/core/contracts/client-channel.js';
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
    return processed;
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
