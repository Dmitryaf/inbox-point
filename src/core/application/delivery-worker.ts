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
  repository: SupportRepository;
  retryBaseDelayMs?: number;
}

export class DeliveryWorker {
  private readonly activity: DeliveryWorkerActivityReporter;
  private readonly channels: Map<string, ClientChannel>;
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly failurePolicy: DeliveryFailurePolicy;
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

  public async processPending(): Promise<number> {
    const deliveries = this.repository.findPendingDeliveries(this.clock(), 25);
    for (const delivery of deliveries) {
      const channel = this.channels.get(delivery.channel);
      let sent: { externalMessageId: string };
      try {
        if (!channel) {
          throw new Error(
            `Client channel is not configured: ${delivery.channel}`,
          );
        }
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
    return deliveries.length;
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
