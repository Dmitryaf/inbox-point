import { randomUUID } from 'node:crypto';

import type { ClientChannel } from '@/core/contracts/client-channel.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';

export interface DeliveryWorkerDependencies {
  channels: readonly ClientChannel[];
  clock?: () => Date;
  createId?: () => string;
  maxAttempts?: number;
  onError?: (error: unknown, context: DeliveryFailureContext) => void;
  repository: SupportRepository;
  retryBaseDelayMs?: number;
}

export interface DeliveryFailureContext {
  attempt: number;
  deliveryId: string;
  final: boolean;
  requestId: string;
}

export class DeliveryWorker {
  private readonly channels: Map<string, ClientChannel>;
  private readonly clock: () => Date;
  private readonly createId: () => string;
  private readonly maxAttempts: number;
  private readonly onError: (
    error: unknown,
    context: DeliveryFailureContext,
  ) => void;
  private readonly repository: SupportRepository;
  private readonly retryBaseDelayMs: number;

  public constructor(dependencies: DeliveryWorkerDependencies) {
    this.channels = new Map(
      dependencies.channels.map((channel) => [channel.kind, channel]),
    );
    this.clock = dependencies.clock ?? (() => new Date());
    this.createId = dependencies.createId ?? randomUUID;
    this.maxAttempts = dependencies.maxAttempts ?? 5;
    this.onError = dependencies.onError ?? (() => undefined);
    this.repository = dependencies.repository;
    this.retryBaseDelayMs = dependencies.retryBaseDelayMs ?? 5_000;
  }

  public registerChannel(channel: ClientChannel): void {
    this.channels.set(channel.kind, channel);
  }

  public async processPending(): Promise<number> {
    const deliveries = this.repository.findPendingDeliveries(this.clock(), 25);
    for (const delivery of deliveries) {
      const channel = this.channels.get(delivery.channel);
      try {
        if (!channel) {
          throw new Error(
            `Client channel is not configured: ${delivery.channel}`,
          );
        }
        const sent = await channel.send({
          conversationId: delivery.conversationId,
          idempotencyKey: delivery.idempotencyKey,
          ...(delivery.replyToExternalMessageId
            ? { replyToExternalMessageId: delivery.replyToExternalMessageId }
            : {}),
          text: delivery.text,
        });
        const sentAt = this.clock();
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
        const message = safeErrorMessage(error);
        const attempt = delivery.attempts + 1;
        const final = attempt >= this.maxAttempts;
        if (final) {
          this.repository.markDeliveryFailed(delivery.id, message);
        } else {
          const retryDelay = Math.min(
            this.retryBaseDelayMs * 2 ** delivery.attempts,
            5 * 60_000,
          );
          this.repository.markDeliveryRetry(
            delivery.id,
            message,
            new Date(this.clock().getTime() + retryDelay),
          );
        }
        this.onError(error, {
          attempt,
          deliveryId: delivery.id,
          final,
          requestId: delivery.requestId,
        });
      }
    }
    return deliveries.length;
  }

  public async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const processed = await this.processPending();
      await wait(processed > 0 ? 100 : 1_000, signal);
    }
  }
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : 'Unknown delivery error';
}

async function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
