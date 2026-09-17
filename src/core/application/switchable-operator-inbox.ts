import {
  OperatorActionOutcomeUnknownError,
  OperatorInboxUnavailableError,
  type MirrorOperatorMessageOptions,
  type OpenOperatorRequest,
  type OperatorInbox,
  type OperatorLifecycleActionOptions,
  type RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import { isWebOperatorTopic } from '@/core/model/operator-topic.js';
import type { SupportMessage } from '@/core/model/support-message.js';
import type { ChannelOperatorMessage } from '@/core/model/operator-message.js';

type ActiveOperatorInbox = OperatorInbox & DeliveryIncidentNotifier;
type FallbackOperation = 'close' | 'mirror' | 'open' | 'relay' | 'reopen';

export class SwitchableOperatorInbox
  implements OperatorInbox, DeliveryIncidentNotifier
{
  private inbox: ActiveOperatorInbox | undefined;

  public constructor(
    private readonly fallback: OperatorInbox,
    private readonly onFallback: (
      error: unknown,
      operation: FallbackOperation,
      fallbackUsed: boolean,
    ) => void = () => undefined,
  ) {}

  public async closeRequest(
    operatorTopicId: string,
    options: OperatorLifecycleActionOptions,
  ): Promise<void> {
    if (isWebOperatorTopic(operatorTopicId)) {
      return this.fallback.closeRequest(operatorTopicId, options);
    }
    await this.runWithoutFallback('close', (inbox) =>
      inbox.closeRequest(operatorTopicId, options),
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

  public async mirrorOperatorMessage(
    operatorTopicId: string,
    message: ChannelOperatorMessage,
    options: MirrorOperatorMessageOptions,
  ): Promise<void> {
    if (isWebOperatorTopic(operatorTopicId)) {
      return this.fallback.mirrorOperatorMessage(
        operatorTopicId,
        message,
        options,
      );
    }
    await this.runWithoutFallback('mirror', (inbox) =>
      inbox.mirrorOperatorMessage(operatorTopicId, message, options),
    );
  }

  public register(inbox: ActiveOperatorInbox): () => void {
    this.inbox = inbox;
    return () => {
      if (this.inbox === inbox) {
        this.inbox = undefined;
      }
    };
  }

  public withRegisteredInbox<T>(
    operation: (inbox: ActiveOperatorInbox) => Promise<T>,
  ): Promise<T> {
    const inbox = this.inbox;
    if (!inbox) {
      return Promise.reject(new OperatorInboxUnavailableError());
    }
    return operation(inbox);
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

  public async reopenRequest(
    operatorTopicId: string,
    options: OperatorLifecycleActionOptions,
  ): Promise<void> {
    if (isWebOperatorTopic(operatorTopicId)) {
      return this.fallback.reopenRequest(operatorTopicId, options);
    }
    await this.runWithoutFallback('reopen', (inbox) =>
      inbox.reopenRequest(operatorTopicId, options),
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
      if (error instanceof OperatorActionOutcomeUnknownError) {
        throw error;
      }
      this.onFallback(error, operation, true);
      return runFallback();
    }
  }

  private async runWithoutFallback<T>(
    operation: Extract<FallbackOperation, 'close' | 'mirror' | 'reopen'>,
    runPrimary: (inbox: ActiveOperatorInbox) => Promise<T>,
  ): Promise<T> {
    const inbox = this.inbox;
    if (!inbox) {
      throw new OperatorInboxUnavailableError();
    }
    try {
      return await runPrimary(inbox);
    } catch (error: unknown) {
      this.onFallback(error, operation, false);
      throw error;
    }
  }

  private requireInbox(): ActiveOperatorInbox {
    if (!this.inbox) {
      throw new OperatorInboxUnavailableError();
    }
    return this.inbox;
  }
}
