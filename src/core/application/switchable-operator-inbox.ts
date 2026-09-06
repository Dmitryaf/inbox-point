import {
  OperatorInboxUnavailableError,
  type OpenOperatorRequest,
  type OperatorInbox,
  type RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import { isWebOperatorTopic } from '@/core/model/operator-topic.js';
import type { SupportMessage } from '@/core/model/support-message.js';

type ActiveOperatorInbox = OperatorInbox & DeliveryIncidentNotifier;
type FallbackOperation = 'close' | 'open' | 'relay' | 'reopen';

export class SwitchableOperatorInbox
  implements OperatorInbox, DeliveryIncidentNotifier
{
  private inbox: ActiveOperatorInbox | undefined;

  public constructor(
    private readonly fallback: OperatorInbox,
    private readonly onFallback: (
      error: unknown,
      operation: FallbackOperation,
    ) => void = () => undefined,
  ) {}

  public async closeRequest(operatorTopicId: string): Promise<void> {
    if (isWebOperatorTopic(operatorTopicId)) {
      return this.fallback.closeRequest(operatorTopicId);
    }
    await this.runWithFallback(
      'close',
      (inbox) => inbox.closeRequest(operatorTopicId),
      () => this.fallback.closeRequest(operatorTopicId),
    );
  }

  public async openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    return this.runWithFallback(
      'open',
      (inbox) => inbox.openRequest(request),
      () => this.fallback.openRequest(request),
    );
  }

  public notifyDeliveryFailure(delivery: FailedDelivery): Promise<void> {
    if (isWebOperatorTopic(delivery.operatorTopicId)) {
      return Promise.resolve();
    }
    return this.requireInbox().notifyDeliveryFailure(delivery);
  }

  public register(inbox: ActiveOperatorInbox): () => void {
    this.inbox = inbox;
    return () => {
      if (this.inbox === inbox) {
        this.inbox = undefined;
      }
    };
  }

  public async relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{
    operatorMessageIds: readonly string[];
    operatorTopicId: string;
  }> {
    if (isWebOperatorTopic(operatorTopicId)) {
      return this.fallback.relayCustomerMessage(
        operatorTopicId,
        message,
        options,
      );
    }
    return this.runWithFallback(
      'relay',
      (inbox) => inbox.relayCustomerMessage(operatorTopicId, message, options),
      () =>
        this.fallback.relayCustomerMessage(operatorTopicId, message, options),
    );
  }

  public async reopenRequest(operatorTopicId: string): Promise<void> {
    if (isWebOperatorTopic(operatorTopicId)) {
      return this.fallback.reopenRequest(operatorTopicId);
    }
    await this.runWithFallback(
      'reopen',
      (inbox) => inbox.reopenRequest(operatorTopicId),
      () => this.fallback.reopenRequest(operatorTopicId),
    );
  }

  private async runWithFallback<T>(
    operation: FallbackOperation,
    runPrimary: (inbox: ActiveOperatorInbox) => Promise<T>,
    runFallback: () => Promise<T>,
  ): Promise<T> {
    const inbox = this.inbox;
    if (!inbox) {
      return runFallback();
    }
    try {
      return await runPrimary(inbox);
    } catch (error: unknown) {
      this.onFallback(error, operation);
      return runFallback();
    }
  }

  private requireInbox(): ActiveOperatorInbox {
    if (!this.inbox) {
      throw new OperatorInboxUnavailableError();
    }
    return this.inbox;
  }
}
