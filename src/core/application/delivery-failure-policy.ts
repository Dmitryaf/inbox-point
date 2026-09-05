import { DeliveryOutcomeUnknownError } from '@/core/contracts/client-channel.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { QueuedDelivery } from '@/core/model/support-request.js';

export interface DeliveryFailureContext {
  attempt: number;
  deliveryId: string;
  final: boolean;
  requestId: string;
}

export interface DeliveryFailurePolicyDependencies {
  clock: () => Date;
  maxAttempts: number;
  onError: (error: unknown, context: DeliveryFailureContext) => void;
  repository: SupportRepository;
  retryBaseDelayMs: number;
}

export class DeliveryFailurePolicy {
  public constructor(
    private readonly dependencies: DeliveryFailurePolicyDependencies,
  ) {}

  public record(delivery: QueuedDelivery, error: unknown): void {
    const message = safeErrorMessage(error);
    const attempt = delivery.attempts + 1;
    if (error instanceof DeliveryOutcomeUnknownError) {
      this.dependencies.repository.markDeliveryOutcomeUnknown(
        delivery.id,
        message,
      );
      this.report(error, delivery, attempt, true);
      return;
    }

    const final = attempt >= this.dependencies.maxAttempts;
    if (final) {
      this.dependencies.repository.markDeliveryFailed(delivery.id, message);
    } else {
      const retryDelay = Math.min(
        this.dependencies.retryBaseDelayMs * 2 ** delivery.attempts,
        5 * 60_000,
      );
      const retryAt = new Date(
        this.dependencies.clock().getTime() + retryDelay,
      );
      this.dependencies.repository.markDeliveryRetry(
        delivery.id,
        message,
        retryAt,
      );
    }
    this.report(error, delivery, attempt, final);
  }

  private report(
    error: unknown,
    delivery: QueuedDelivery,
    attempt: number,
    final: boolean,
  ): void {
    this.dependencies.onError(error, {
      attempt,
      deliveryId: delivery.id,
      final,
      requestId: delivery.requestId,
    });
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return 'Unknown delivery error';
}
