import {
  OperatorInboxUnavailableError,
  type OpenOperatorRequest,
  type OperatorInbox,
  type RelayCustomerMessageOptions,
} from '@/core/contracts/operator-inbox.js';
import type { DeliveryIncidentNotifier } from '@/core/contracts/delivery-incident-notifier.js';
import type { FailedDelivery } from '@/core/model/support-request.js';
import type { SupportMessage } from '@/core/model/support-message.js';

type ActiveOperatorInbox = OperatorInbox & DeliveryIncidentNotifier;

export class SwitchableOperatorInbox
  implements OperatorInbox, DeliveryIncidentNotifier
{
  private inbox: ActiveOperatorInbox | undefined;

  public closeRequest(operatorTopicId: string): Promise<void> {
    return this.requireInbox().closeRequest(operatorTopicId);
  }

  public openRequest(
    request: OpenOperatorRequest,
  ): Promise<{ topicId: string }> {
    return this.requireInbox().openRequest(request);
  }

  public notifyDeliveryFailure(delivery: FailedDelivery): Promise<void> {
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

  public relayCustomerMessage(
    operatorTopicId: string,
    message: SupportMessage,
    options: RelayCustomerMessageOptions,
  ): Promise<{ operatorMessageIds: readonly string[] }> {
    return this.requireInbox().relayCustomerMessage(
      operatorTopicId,
      message,
      options,
    );
  }

  public reopenRequest(operatorTopicId: string): Promise<void> {
    return this.requireInbox().reopenRequest(operatorTopicId);
  }

  private requireInbox(): ActiveOperatorInbox {
    if (!this.inbox) {
      throw new OperatorInboxUnavailableError();
    }
    return this.inbox;
  }
}
